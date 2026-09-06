import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { getSimpleRouteJson, repositoryRoot, sha256 } from "../lib/dataset.mjs"

/** Publish an explicit allowlist. No repository, environment or hosting metadata is copied. */
export async function buildSite(output = resolve(repositoryRoot, "dist")) {
  const manifestBytes = await readFile(resolve(repositoryRoot, "manifest.json"))
  const manifest = JSON.parse(manifestBytes.toString())
  if (manifest.samples.length !== 50) throw new Error("Expected exactly 50 samples")
  await rm(output, { recursive: true, force: true })
  await mkdir(resolve(output, "samples"), { recursive: true })
  await mkdir(resolve(output, "srj"), { recursive: true })
  for (const asset of ["index.html", "styles.css", "app.mjs", "geometry.mjs"]) await copyFile(resolve(repositoryRoot, "site", asset), resolve(output, asset))
  await mkdir(resolve(output, "licenses"), { recursive: true })
  for (const notice of ["LICENSE", "licenses/README.md", "licenses/dataset01-MIT.txt", "licenses/tscircuit-autorouter-MIT.txt", "licenses/oculink-pcie-adapter-Apache-2.0.txt", "licenses/hdmi-edid-debug-board-Apache-2.0.txt", "licenses/dataset-srj18-source-files.json"]) await copyFile(resolve(repositoryRoot, notice), resolve(output, notice))
  await writeFile(resolve(output, "manifest.json"), manifestBytes)
  const samples = []
  for (const sample of manifest.samples) {
    if (!/^samples\/[a-zA-Z0-9_-]+\.json$/.test(sample.file) || !/^[a-zA-Z0-9_-]+$/.test(sample.name)) throw new Error(`Unsafe sample path: ${sample.name}`)
    const bytes = await readFile(resolve(repositoryRoot, sample.file))
    if (sha256(bytes) !== sample.sha256) throw new Error(`Sample checksum mismatch: ${sample.name}`)
    const srj = getSimpleRouteJson(JSON.parse(bytes.toString()), sample)
    if (!Array.isArray(srj.obstacles) || !Array.isArray(srj.connections) || !srj.bounds) throw new Error(`Invalid SRJ: ${sample.name}`)
    await writeFile(resolve(output, sample.file), bytes)
    const srjFile = `/srj/${sample.name}.json`
    await writeFile(resolve(output, `.${srjFile}`), `${JSON.stringify(srj, null, 2)}\n`)
    samples.push({ ...sample, srjFile })
  }
  await writeFile(resolve(output, "catalog.json"), `${JSON.stringify({ name: manifest.name, samples })}\n`)
  return { output, sampleCount: samples.length }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildSite()
  console.log(`Built public dataset browser: ${result.sampleCount} verified original files + extracted SRJs in ${result.output}`)
}
