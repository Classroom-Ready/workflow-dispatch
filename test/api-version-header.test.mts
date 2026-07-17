// Regression test for the deprecation the action exists to fix: octokit sends REST requests
// unversioned by default, so GitHub's POST .../dispatches emits a deprecation warning. The
// previous fix set `request: { headers: ... }`, which silently attached nothing - this test
// asserts the header is actually present on an outgoing request. Network-free: a wrap hook
// captures the fully-resolved options and aborts before any HTTP call.
import assert from 'node:assert/strict'
import test from 'node:test'

import { getOctokit } from '../src/utils.ts'

test('getOctokit attaches x-github-api-version to outgoing requests', async () => {
  const octokit = getOctokit('fake-token')

  let seen
  octokit.hook.wrap('request', async (_request, options) => {
    seen = options.headers['x-github-api-version']
    throw new Error('__abort_before_network__')
  })

  await assert.rejects(
    octokit.rest.actions.createWorkflowDispatch({
      owner: 'o',
      repo: 'r',
      workflow_id: 'w.yml',
      ref: 'main',
    }),
    /__abort_before_network__/
  )

  assert.equal(
    seen,
    '2026-03-10',
    'x-github-api-version must be attached to REST requests, else GitHub serves the ' +
      'unversioned/deprecated behaviour'
  )
})
