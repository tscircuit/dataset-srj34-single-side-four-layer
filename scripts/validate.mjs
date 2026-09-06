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
assert.equal(manifest.samples.length, 51, "The curated dataset must contain exactly 51 samples")
assert.equal(sha256(canonicalize(manifest.samples.slice(0, 50))), "e6461502d1281c56e6f884f7ba0c613e1aa81d93f47f19d99427816708132c49", "The original 50 sample records and their order must remain unchanged")
assert.equal(manifest.samples[50].name, "pedometer")
assert.equal(manifest.selection.contributedRegressionCount, 1)
const contributionRegistry = JSON.parse(await readFile(resolve(repositoryRoot, "contributions.json"), "utf8"))
assert.equal(contributionRegistry.version, 1)
assert.equal(contributionRegistry.samples.length, 1)
const contributions = new Map(contributionRegistry.samples.map(sample => [sample.name, sample]))
assert.equal(contributions.size, contributionRegistry.samples.length, "Duplicate contributed sample records")
assert.deepEqual([...contributions.keys()], ["pedometer"])
assert.equal(manifest.samples.filter(sample => sample.category === "legacy-dataset").length, 25)
assert.equal(manifest.samples.filter(sample => sample.category === "bug-report").length, 25)
assert.equal(manifest.samples.filter(sample => sample.category === "contributed-regression").length, 1)
const names = new Set(), contents = new Set(), layouts = new Set()
for (const sample of manifest.samples) {
  assert(!names.has(sample.name), `Duplicate sample name: ${sample.name}`)
  names.add(sample.name)
  assert.match(sample.file, /^samples\/[^/]+\.json$/)
  assert.match(sample.sha256, /^[a-f0-9]{64}$/)
  assert.match(sample.source.commit, /^[a-f0-9]{40}$/)
  assert.equal(sample.source.url, `${sample.source.repository}/blob/${sample.source.commit}/${sample.source.path}`)
  const contribution = contributions.get(sample.name)
  if (sample.category === "contributed-regression") {
    assert(contribution, `${sample.name}: contributed source is absent from registry`)
    const { canonicalSrjSha256, boardGeometrySha256: geometryHash, layerCount, connectionCount, terminalCount, obstacleCount, ...candidate } = sample
    assert.deepEqual(candidate, contribution, `${sample.name}: contributed provenance differs from registry`)
    assert.equal(sample.name, "pedometer")
    assert.equal(sample.file, "samples/pedometer.json")
    assert.equal(sample.srjJsonPointer, "")
    assert.equal(sample.source.repository, manifest.repository)
    assert.equal(sample.source.path, "originals/pedometer.json")
    assert.equal(sample.source.dataset, "pedometer")
    assert.equal(sample.source.license, "MIT")
    assert(sample.source.attribution?.trim().length > 0, "Contributed source requires attribution")
    assert.equal(sample.correction, undefined, "The contributed regression must preserve its exact input")
    const original = await readFile(resolve(repositoryRoot, sample.source.path))
    assert.equal(sha256(original), sample.sha256, `${sample.name}: contributed original checksum mismatch`)
    assert.deepEqual(await readFile(resolve(repositoryRoot, sample.file)), original, `${sample.name}: contributed input differs from its preserved original`)
  } else assert.equal(contribution, undefined, `${sample.name}: unexpected contributed source category`)
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
assert.deepEqual((await readdir(resolve(repositoryRoot, "originals"))).sort(), [
  ...[...corrections.values()].map(correction => correction.originalFile.slice("originals/".length)),
  ...[...contributions.values()].map(sample => sample.source.path.slice("originals/".length)),
].sort(), "Unlisted original files are forbidden")
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
console.log(`Verified 51 unique top-only inputs: 25 dataset inputs + 25 genuine bug reports + 1 contributed regression; ${corrections.size} declared source correction(s)${process.argv.includes("--verify-remote") ? "; all upstream bytes match" : ""}.`)
