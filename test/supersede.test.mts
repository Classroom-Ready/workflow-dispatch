// A dispatched run that a newer run of the same workflow cancels (concurrency
// cancel-in-progress) is followed to that newer run, so every job waiting on the stale run
// finishes with the result of the run that replaced it. Network-free: the octokit request
// hook serves canned runs.
import assert from 'node:assert/strict'
import test from 'node:test'

import { findSupersedingRun, followSupersedingRuns } from '../src/supersede.ts'
import { getOctokit, parseMaxFollows } from '../src/utils.ts'

test('parseMaxFollows reads a whole number of follows', () => {
  assert.equal(parseMaxFollows('5'), 5)
  assert.equal(parseMaxFollows('0'), 0)
})

test('parseMaxFollows rejects a negative or fractional value', () => {
  assert.throws(() => parseMaxFollows('-1'), /max-follows/)
  assert.throws(() => parseMaxFollows('1.5'), /max-follows/)
  assert.throws(() => parseMaxFollows('lots'), /max-follows/)
})

interface StubRun {
  id: number
  workflow_id: number
  head_branch: string
  created_at: string
  html_url?: string
}

// Serves the two REST calls findSupersedingRun makes and records the list query, so the test
// can assert which runs were asked for. listWorkflowRuns answers with every run of the
// requested workflow on the requested branch, newest first, as the API does.
function stubOctokit(runs: Array<StubRun>) {
  const octokit = getOctokit('fake-token')
  const listQueries: Array<Record<string, unknown>> = []

  octokit.hook.wrap(
    'request',
    async (
      _request: unknown,
      options: { url: string; run_id?: number; workflow_id?: number; branch?: string; created?: string }
    ) => {
      if (options.url.endsWith('/actions/runs/{run_id}')) {
        const run = runs.find(r => r.id === options.run_id)
        if (!run) {
          throw new Error('Not Found')
        }
        return { status: 200, headers: {}, url: options.url, data: run }
      }

      if (options.url.endsWith('/actions/workflows/{workflow_id}/runs')) {
        listQueries.push({ workflow_id: options.workflow_id, branch: options.branch, created: options.created })
        const workflowRuns = runs
          .filter(r => r.workflow_id === options.workflow_id && r.head_branch === options.branch)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
        return { status: 200, headers: {}, url: options.url, data: { workflow_runs: workflowRuns } }
      }

      throw new Error(`unexpected request to ${options.url}`)
    }
  )

  return { octokit, listQueries }
}

const run = (id: number, createdAt: string, overrides: Partial<StubRun> = {}): StubRun => ({
  id,
  workflow_id: 42,
  head_branch: 'uat',
  created_at: createdAt,
  html_url: `https://github.com/o/r/actions/runs/${id}`,
  ...overrides,
})

test('findSupersedingRun returns the newest later run of the same workflow on the same branch', async () => {
  const stub = stubOctokit([
    run(1, '2026-10-01T10:00:00Z'),
    run(2, '2026-10-01T10:05:00Z'),
    run(3, '2026-10-01T10:09:00Z'),
  ])

  const successor = await findSupersedingRun(stub.octokit, 'o', 'r', 1)

  assert.deepEqual(successor, { id: 3, url: 'https://github.com/o/r/actions/runs/3' })
  assert.deepEqual(stub.listQueries, [{ workflow_id: 42, branch: 'uat', created: '>=2026-10-01T10:00:00Z' }])
})

test('findSupersedingRun ignores runs on other branches, of other workflows, and older runs', async () => {
  const stub = stubOctokit([
    run(1, '2026-10-01T09:00:00Z'),
    run(2, '2026-10-01T10:00:00Z'),
    run(3, '2026-10-01T10:05:00Z', { head_branch: 'main' }),
    run(4, '2026-10-01T10:06:00Z', { workflow_id: 7 }),
  ])

  assert.equal(await findSupersedingRun(stub.octokit, 'o', 'r', 2), undefined)
})

test('findSupersedingRun treats a run created in the same second as later only when its id is higher', async () => {
  const stub = stubOctokit([run(5, '2026-10-01T10:00:00Z'), run(6, '2026-10-01T10:00:00Z')])

  assert.deepEqual(await findSupersedingRun(stub.octokit, 'o', 'r', 5), {
    id: 6,
    url: 'https://github.com/o/r/actions/runs/6',
  })
  assert.equal(await findSupersedingRun(stub.octokit, 'o', 'r', 6), undefined)
})

// Drives followSupersedingRuns over a scripted chain: each entry is the conclusion the run
// with that id ends with, and successors maps a cancelled run to the run that replaced it.
function chain(conclusions: Record<number, string>, successors: Record<number, number>) {
  const followed: Array<number> = []
  return {
    followed,
    options: (maxFollows: number) => ({
      maxFollows,
      cancelledRunId: (waited: { id: number; conclusion: string }) =>
        waited.conclusion === 'cancelled' ? waited.id : undefined,
      findSuccessor: async (runId: number) =>
        successors[runId] === undefined ? undefined : { id: successors[runId], url: `u/${successors[runId]}` },
      follow: async (successor: { id: number }) => {
        followed.push(successor.id)
        return { id: successor.id, conclusion: conclusions[successor.id] }
      },
    }),
  }
}

test('followSupersedingRuns ends with the result of the run that replaced a cancelled one', async () => {
  const c = chain({ 2: 'success' }, { 1: 2 })

  const waited = await followSupersedingRuns({ id: 1, conclusion: 'cancelled' }, c.options(5))

  assert.deepEqual(waited, { id: 2, conclusion: 'success' })
  assert.deepEqual(c.followed, [2])
})

test('followSupersedingRuns follows a chain of cancelled runs to the last one', async () => {
  const c = chain({ 2: 'cancelled', 3: 'failure' }, { 1: 2, 2: 3 })

  const waited = await followSupersedingRuns({ id: 1, conclusion: 'cancelled' }, c.options(5))

  assert.deepEqual(waited, { id: 3, conclusion: 'failure' })
  assert.deepEqual(c.followed, [2, 3])
})

test('followSupersedingRuns keeps a cancelled run that nothing replaced', async () => {
  const c = chain({}, {})

  const waited = await followSupersedingRuns({ id: 1, conclusion: 'cancelled' }, c.options(5))

  assert.deepEqual(waited, { id: 1, conclusion: 'cancelled' })
  assert.deepEqual(c.followed, [])
})

test('followSupersedingRuns leaves a run that was not cancelled alone', async () => {
  const c = chain({ 2: 'success' }, { 1: 2 })

  const waited = await followSupersedingRuns({ id: 1, conclusion: 'failure' }, c.options(5))

  assert.deepEqual(waited, { id: 1, conclusion: 'failure' })
  assert.deepEqual(c.followed, [])
})

test('followSupersedingRuns stops after max-follows runs', async () => {
  const c = chain({ 2: 'cancelled', 3: 'cancelled', 4: 'success' }, { 1: 2, 2: 3, 3: 4 })

  const waited = await followSupersedingRuns({ id: 1, conclusion: 'cancelled' }, c.options(2))

  assert.deepEqual(waited, { id: 3, conclusion: 'cancelled' })
  assert.deepEqual(c.followed, [2, 3])
})

test('followSupersedingRuns follows nothing when max-follows is 0', async () => {
  const c = chain({ 2: 'success' }, { 1: 2 })

  const waited = await followSupersedingRuns({ id: 1, conclusion: 'cancelled' }, c.options(0))

  assert.deepEqual(waited, { id: 1, conclusion: 'cancelled' })
  assert.deepEqual(c.followed, [])
})

test('followSupersedingRuns keeps the cancelled run when looking for a successor fails', async () => {
  const c = chain({}, {})
  const options = {
    ...c.options(5),
    findSuccessor: async () => {
      throw new Error('API rate limit exceeded')
    },
  }

  const waited = await followSupersedingRuns({ id: 1, conclusion: 'cancelled' }, options)

  assert.deepEqual(waited, { id: 1, conclusion: 'cancelled' })
})
