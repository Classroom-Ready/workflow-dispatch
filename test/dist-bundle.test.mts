// Regression tests for a class of bug we shipped in v4.1.1: @actions/core and @actions/github
// are ESM-only, and bundling them with a CommonJS bundler silently emitted a stub that threw
// at runtime instead of failing the build - see
// https://github.com/Classroom-Ready/classroomready_deployments/actions/runs/29111176742.
// The bundle is now ESM (esbuild), which errors on an unresolved import rather than stubbing;
// these tests assert the dependencies that broke back then are genuinely inlined.
import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '..', 'dist', 'index.js')

test('dist/index.js inlines @actions/core and @actions/github rather than leaving a runtime require', () => {
  const dist = readFileSync(distPath, 'utf8')

  // If a dependency failed to inline it would survive as a bare runtime require of the
  // package - which throws "Cannot find module" since dependencies are not shipped in dist.
  for (const pkg of ['@actions/core', '@actions/github']) {
    assert.equal(
      dist.includes(`require("${pkg}")`) || dist.includes(`require('${pkg}')`),
      false,
      `dist/index.js still requires ${pkg} at runtime - it was not bundled and will throw ` +
        '"Cannot find module".'
    )
  }

  // Positive markers that each package's code actually landed in the bundle: @actions/core's
  // input-validation error string, and octokit's default REST base URL (pulled in via
  // @actions/github). A future failure shape then can't silently pass this test.
  assert.equal(
    dist.includes('Input required and not supplied'),
    true,
    '@actions/core error strings are missing from dist/index.js - it may not be bundled at all.'
  )
  assert.equal(
    dist.includes('api.github.com'),
    true,
    'octokit (via @actions/github) is missing from dist/index.js - it may not be bundled at all.'
  )
})

test('running dist/index.js outside a workflow fails cleanly via @actions/core, not a raw crash', () => {
  // Run the bundle from a scratch dir that has NO node_modules to resolve against - a
  // consumer checks out only the committed files (dist/ + package.json, node_modules is
  // gitignored). Running from the repo root would let an unbundled dependency resolve out
  // of our own node_modules and hide exactly the v4.1.1 "Cannot find module" crash. The
  // scratch package.json is "type": "module" because the bundle is ESM.
  const scratch = mkdtempSync(path.join(tmpdir(), 'workflow-dispatch-dist-'))
  try {
    const scratchDist = path.join(scratch, 'index.js')
    copyFileSync(distPath, scratchDist)
    writeFileSync(path.join(scratch, 'package.json'), JSON.stringify({ type: 'module' }))

    // Strip inherited GITHUB_*/INPUT_* so this doesn't inherit a real runner's environment
    // (and can't write to a real $GITHUB_OUTPUT file).
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !key.startsWith('GITHUB_') && !key.startsWith('INPUT_')
      )
    )

    const result = spawnSync(process.execPath, [scratchDist], {
      encoding: 'utf8',
      env,
      cwd: scratch,
    }) as { status: number | null; stdout: string; stderr: string }

    assert.equal(result.status, 1, 'action should exit non-zero when required context is missing')
    assert.match(
      result.stdout,
      /::error::/,
      'a healthy failure is reported via core.setFailed (an ::error:: workflow command on stdout)'
    )
    assert.doesNotMatch(
      result.stderr,
      /Cannot find module|MODULE_NOT_FOUND/,
      'stderr should not contain a raw Node module-resolution crash - the bundle is not self-contained'
    )
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})
