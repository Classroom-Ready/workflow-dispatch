// Regression tests for a class of bug we shipped in v4.1.1: bumping @actions/core and
// @actions/github to ESM-only majors made ncc (a CJS bundler) silently emit a stub that
// throws at runtime instead of failing the build - see
// https://github.com/Classroom-Ready/classroomready_deployments/actions/runs/29111176742.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '..', 'dist', 'index.js')

test('dist/index.js does not contain an ncc "module not found" stub', () => {
  const dist = readFileSync(distPath, 'utf8')

  // ncc emits this stub (instead of a build error) when it cannot statically inline a
  // dependency - e.g. an ESM-only package it can't require() into the CJS bundle.
  assert.equal(
    dist.includes('webpackMissingModule'),
    false,
    'dist/index.js has an unbundled dependency - it will throw "Cannot find module" at runtime. ' +
      'Check every devDependency is CommonJS-resolvable (no "type": "module" with no "require" export).'
  )

  // A positive marker that @actions/core actually got bundled, so a future rename of ncc's
  // stub (or a different failure shape) can't silently pass this test.
  assert.equal(
    dist.includes('Input required and not supplied'),
    true,
    '@actions/core error strings are missing from dist/index.js - it may not be bundled at all.'
  )
})

test('running dist/index.js outside a workflow fails cleanly via @actions/core, not a raw crash', () => {
  // Strip inherited GITHUB_*/INPUT_* so this doesn't inherit a real runner's environment
  // (and can't write to a real $GITHUB_OUTPUT file).
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith('GITHUB_') && !key.startsWith('INPUT_')
    )
  )

  const result = spawnSync(process.execPath, [distPath], { encoding: 'utf8', env }) as {
    status: number | null
    stdout: string
    stderr: string
  }

  assert.equal(result.status, 1, 'action should exit non-zero when required context is missing')
  assert.match(
    result.stdout,
    /::error::/,
    'a healthy failure is reported via core.setFailed (an ::error:: workflow command on stdout)'
  )
  assert.doesNotMatch(
    result.stderr,
    /Cannot find module|MODULE_NOT_FOUND/,
    'stderr should not contain a raw Node module-resolution crash'
  )
})
