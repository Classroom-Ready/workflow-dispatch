// Bundle the action to a single ESM file for the node24 runtime declared in action.yaml.
// @actions/core@3 and @actions/github@9 are ESM-only, so the bundle must be ESM (a CJS
// bundler emits a broken stub for them - the v4.1.1 bug). esbuild fails loudly on an
// unresolved import, so a clean build here means every dependency was inlined.
//
// The banner reinstates `require`, `__filename` and `__dirname` at the top of the ESM
// bundle: transitive CommonJS dependencies (octokit's deps) still reference them, and
// those globals do not exist in an ES module.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  outfile: 'dist/index.js',
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __dirname_of } from 'node:path';",
      'const require = __createRequire(import.meta.url);',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __dirname_of(__filename);',
    ].join('\n'),
  },
})
