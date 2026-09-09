// A failed downstream job's own error is what the triggering job reports, so these tests pin
// the extraction that lifts it out of the job log. The dev-deploy gate in
// https://github.com/Classroom-Ready/classroomready_frontend/actions/runs/34395740249 is the
// shape they are modelled on. Network-free: the octokit request hook serves canned job lists
// and logs.
import assert from 'node:assert/strict'
import test from 'node:test'

import { collectJobFailures, describeFailures, extractErrorMessages } from '../src/failure-reason.ts'
import { getOctokit } from '../src/utils.ts'

const DEPLOY_GATE_REASON =
  'The E2E run was held because a dev deploy was still running after 900s; the Cypress ' +
  'shards were skipped, not run. Re-run once the deploy has finished.'

const DEPLOY_GATE_LOG = [
  '2026-09-09T19:59:09.9845634Z Active dev deploy runs (run id, blocking jobs):',
  '2026-09-09T19:59:09.9860494Z   34397791573\tDeploy to Dev (in_progress)',
  '2026-09-09T19:59:09.9927590Z ##[error]Process completed with exit code 1.',
  `2026-09-09T19:59:10.0194804Z ##[error]${DEPLOY_GATE_REASON}`,
  '2026-09-09T19:59:10.0389306Z Post job cleanup.',
  '',
].join('\n')

test('extractErrorMessages lifts the specific error out of a job log', () => {
  assert.deepEqual(extractErrorMessages(DEPLOY_GATE_LOG), [DEPLOY_GATE_REASON])
})

test('extractErrorMessages keeps the exit-code line when it is the only error', () => {
  const logs = [
    '2026-09-09T19:59:09.9845634Z Running tests',
    '2026-09-09T19:59:09.9927590Z ##[error]Process completed with exit code 1.',
    '',
  ].join('\n')

  assert.deepEqual(extractErrorMessages(logs), ['Process completed with exit code 1.'])
})

test('extractErrorMessages reads an error line that carries no timestamp', () => {
  assert.deepEqual(extractErrorMessages('##[error]Runner lost communication\n'), [
    'Runner lost communication',
  ])
})

test('extractErrorMessages reports a repeated error once', () => {
  const logs = [
    '2026-09-09T19:59:09.9845634Z ##[error]connect ETIMEDOUT',
    '2026-09-09T19:59:10.0194804Z ##[error]connect ETIMEDOUT',
    '',
  ].join('\n')

  assert.deepEqual(extractErrorMessages(logs), ['connect ETIMEDOUT'])
})

test('describeFailures names the failing job alongside its reason', () => {
  const described = describeFailures([
    { name: 'Wait for dev deployment', conclusion: 'failure', reasons: [DEPLOY_GATE_REASON] },
  ])

  assert.equal(described, `Wait for dev deployment: ${DEPLOY_GATE_REASON}`)
})

test('describeFailures falls back to the conclusion when a job logged no error', () => {
  const described = describeFailures([{ name: 'e2e', conclusion: 'cancelled', reasons: [] }])

  assert.equal(described, 'e2e: cancelled')
})

test('describeFailures joins several failing jobs', () => {
  const described = describeFailures([
    { name: 'shard-1', conclusion: 'failure', reasons: ['2 tests failed'] },
    { name: 'shard-2', conclusion: 'timed_out', reasons: [] },
  ])

  assert.equal(described, 'shard-1: 2 tests failed | shard-2: timed_out')
})

// Serves the two REST calls collectJobFailures makes, and records which job logs were asked
// for so the test can assert the passing/skipped jobs are left alone.
function stubOctokit(jobs: Array<Record<string, unknown>>, logsByJobId: Record<number, string>) {
  const octokit = getOctokit('fake-token')
  const requestedLogJobIds: number[] = []
  let servedJobList = false

  // octokit leaves path parameters on the options object and the route template in
  // options.url, so the request is identified by which parameter is present.
  octokit.hook.wrap(
    'request',
    async (_request: unknown, options: { url: string; run_id?: number; job_id?: number }) => {
      if (options.url.endsWith('/actions/runs/{run_id}/jobs')) {
        servedJobList = true
        return { status: 200, headers: {}, url: options.url, data: { jobs } }
      }

      if (options.url.endsWith('/actions/jobs/{job_id}/logs')) {
        const jobId = options.job_id as number
        requestedLogJobIds.push(jobId)
        const logs = logsByJobId[jobId]
        if (logs === undefined) {
          throw new Error('Not Found')
        }
        return { status: 200, headers: {}, url: options.url, data: logs }
      }

      throw new Error(`unexpected request to ${options.url}`)
    }
  )

  return {
    octokit,
    requestedLogJobIds,
    servedJobList: () => servedJobList,
  }
}

test('collectJobFailures reports the reason of each failed job and skips the rest', async () => {
  const stub = stubOctokit(
    [
      { id: 102618348620, name: 'dependencies-ok', conclusion: 'success' },
      { id: 102618421404, name: 'Wait for dev deployment', conclusion: 'failure' },
      { id: 102623589765, name: 'e2e', conclusion: 'skipped' },
    ],
    { 102618421404: DEPLOY_GATE_LOG }
  )

  const failures = await collectJobFailures(stub.octokit, 'Classroom-Ready', 'classroomready_e2e', 34396777514)

  assert.equal(stub.servedJobList(), true, 'the job list route did not match - the stub served nothing')
  assert.deepEqual(failures, [
    { name: 'Wait for dev deployment', conclusion: 'failure', reasons: [DEPLOY_GATE_REASON] },
  ])
  // A skipped job has no log archive, so asking for one 404s.
  assert.deepEqual(stub.requestedLogJobIds, [102618421404])
})

test('collectJobFailures still names a failed job whose logs cannot be downloaded', async () => {
  const stub = stubOctokit([{ id: 7, name: 'deploy', conclusion: 'failure' }], {})

  const failures = await collectJobFailures(stub.octokit, 'owner', 'repo', 1)

  assert.deepEqual(failures, [{ name: 'deploy', conclusion: 'failure', reasons: [] }])
})

test('collectJobFailures treats a timed-out job as a failure', async () => {
  const stub = stubOctokit([{ id: 9, name: 'slow', conclusion: 'timed_out' }], {
    9: '2026-09-09T19:59:09.9845634Z ##[error]The operation was canceled.\n',
  })

  const failures = await collectJobFailures(stub.octokit, 'owner', 'repo', 1)

  assert.deepEqual(failures, [
    { name: 'slow', conclusion: 'timed_out', reasons: ['The operation was canceled.'] },
  ])
})
