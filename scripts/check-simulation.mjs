// Generate test frames with the exact browser renderer, without a browser or GPU.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const esbuild = require('../frontend/node_modules/esbuild')
const runtime = process.env.CYPHER_NODE_PACKAGES
if (!runtime) throw new Error('Set CYPHER_NODE_PACKAGES to a directory containing @napi-rs/canvas')
const { createCanvas } = require(resolve(runtime, '@napi-rs/canvas'))
const build = await esbuild.build({ stdin: { contents: "export { drawScene, scenarios } from './frontend/src/simulation.tsx'", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser', define: { 'import.meta.env.VITE_API_URL': '"/api"' } })
const { drawScene, scenarios } = await import(`data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}`)
const folder = resolve('artifacts/simulation-frames')
mkdirSync(folder, { recursive: true })
for (const scenario of scenarios) {
  for (const [n, seconds] of [0.45, 1.55, 2.65, 3.75].entries()) {
    const canvas = createCanvas(320, 180)
    drawScene(canvas.getContext('2d'), scenario.value, seconds, 1)
    writeFileSync(`${folder}/${scenario.value}-${n}.png`, canvas.toBuffer('image/png'))
  }
}
console.log(`Rendered ${scenarios.length * 4} frames using the actual frontend scene code`)
