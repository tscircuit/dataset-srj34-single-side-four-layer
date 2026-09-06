import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { repositoryRoot, readSample, getSimpleRouteJson, sha256, canonicalize, boardGeometrySha256, hasBottomComponents } from "../lib/dataset.mjs"

import { applySourceCorrection } from "../lib/corrections.mjs"

const correctionRegistry = JSON.parse(await readFile(resolve(repositoryRoot, "corrections.json"), "utf8"))
assert.equal(correctionRegistry.version, 1)
const corrections = new Map(correctionRegistry.corrections.map(({ sample, ...correction }) => [sample, correction]))
assert.equal(corrections.size, correctionRegistry.corrections.length, "Duplicate correction records")
const manifest = JSON.parse(await readFile(resolve(repositoryRoot, "manifest.json"), "utf8"))
assert.equal(manifest.version, 1)
assert.equal(manifest.samples.length, 50, "The curated dataset must contain exactly 50 samples")
assert.equal(manifest.samples.filter(sample => sample.category === "legacy-dataset").length, 25)
assert.equal(manifest.samples.filter(sample => sample.category === "bug-report").length, 25)
const names = new Set(), contents = new Set(), layouts = new Set()
for (const sample of manifest.samples) {
  assert(!names.has(sample.name), `Duplicate sample name: ${sample.name}`)
  names.add(sample.name)
  assert.match(sample.file, /^samples\/[^/]+\.json$/)
  assert.match(sample.sha256, /^[a-f0-9]{64}$/)
  assert.match(sample.source.commit, /^[a-f0-9]{40}$/)
  assert.equal(sample.source.url, `${sample.source.repository}/blob/${sample.source.commit}/${sample.source.path}`)
  const correction = corrections.get(sample.name)
  assert.deepEqual(sample.correction, correction, `${sample.name}: correction provenance differs from registry`)
  if (correction) {
    assert.match(correction.originalFile, /^originals\/[^/]+\.json$/)
    assert(correction.reason?.length > 0 && correction.changes.length > 0)
    const original = await readFile(resolve(repositoryRoot, correction.originalFile))
    const originalSrj = getSimpleRouteJson(JSON.parse(original), sample)
    assert.equal(sha256(canonicalize(originalSrj)), correction.originalCanonicalSrjSha256)
    assert.equal(boardGeometrySha256(originalSrj), correction.originalBoardGeometrySha256)
    assert.deepEqual(await readFile(resolve(repositoryRoot, sample.file)), applySourceCorrection(original, correction), `${sample.name}: undeclared correction`)
  }
  const srj = await readSample(sample)
  assert(Array.isArray(srj.obstacles) && Array.isArray(srj.connections))
  assert([1, 2, 4].includes(srj.layerCount))
  assert(Number.isFinite(srj.minTraceWidth) && srj.minTraceWidth > 0)
  assert.equal(hasBottomComponents(srj), false, `${sample.name}: bottom components are excluded`)
  assert.equal(srj.layerCount, sample.layerCount)
  assert.equal(srj.obstacles.length, sample.obstacleCount)
  assert.equal(srj.connections.length, sample.connectionCount)
  assert.equal(srj.connections.reduce((sum, connection) => sum + connection.pointsToConnect.length, 0), sample.terminalCount)
  const canonical = sha256(canonicalize(srj)), layout = boardGeometrySha256(srj)
  assert.equal(canonical, sample.canonicalSrjSha256)
  assert.equal(layout, sample.boardGeometrySha256)
  assert(!contents.has(canonical), `${sample.name}: duplicate SRJ`)
  assert(!layouts.has(layout), `${sample.name}: repeated board geometry`)
  contents.add(canonical); layouts.add(layout)
  if (sample.category === "bug-report") {
    assert.equal(sample.srjJsonPointer, "/simple_route_json")
    const raw = JSON.parse(await readFile(resolve(repositoryRoot, sample.file), "utf8"))
    assert.equal(raw.autorouting_bug_report_id, sample.source.bugReportId)
    assert(!/0000-0000/.test(sample.source.bugReportId), "Placeholder report IDs are excluded")
  }
}
assert([...corrections.keys()].every(name => names.has(name)), "Correction references an unlisted sample")
assert.deepEqual((await readdir(resolve(repositoryRoot, "originals"))).sort(), [...corrections.values()].map(correction => correction.originalFile.slice("originals/".length)).sort(), "Unlisted original files are forbidden")
const files = await readdir(resolve(repositoryRoot, "samples"))
assert.deepEqual(files.sort(), manifest.samples.map(sample => sample.file.slice("samples/".length)).sort(), "Unlisted sample files are forbidden")
if (process.argv.includes("--verify-remote")) {
  for (let start = 0; start < manifest.samples.length; start += 4) {
    await Promise.all(manifest.samples.slice(start, start + 4).map(async sample => {
      const repository = sample.source.repository.replace("https://github.com/", "")
      const url = `https://raw.githubusercontent.com/${repository}/${sample.source.commit}/${sample.source.path}`
      const response = await fetch(url)
      assert(response.ok, `Source request failed: ${url} (${response.status})`)
      assert.equal(sha256(Buffer.from(await response.arrayBuffer())), sample.correction?.originalSha256 ?? sample.sha256, `Vendored source differs: ${sample.name}`)
    }))
  }
}
console.log(`Verified 50 unique top-only inputs: 25 dataset inputs + 25 genuine bug reports; ${corrections.size} declared source correction(s)${process.argv.includes("--verify-remote") ? "; all upstream bytes match" : ""}.`)
