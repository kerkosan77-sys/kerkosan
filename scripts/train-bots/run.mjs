// Bundles the training tool with rolldown (it comes with Vite) and runs it: node scripts/train-bots/run.mjs <game> <step> [games]
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'rolldown'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
// One bundle per game, so two games can train at the same time.
const out = join(root, `node_modules/.cache/train-bots/main-${process.argv[2] ?? 'x'}.mjs`)

await build({
  input: join(root, 'scripts/train-bots/main.ts'),
  platform: 'node',
  logLevel: 'warn',
  output: { file: out, format: 'esm' },
})

const child = spawn(process.execPath, [out, ...process.argv.slice(2)], { stdio: 'inherit', cwd: root })
child.on('exit', (code) => process.exit(code ?? 0))
