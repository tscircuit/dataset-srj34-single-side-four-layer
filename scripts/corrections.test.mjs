import assert from "node:assert/strict"
import { test } from "node:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { repositoryRoot, sha256, canonicalize } from "../lib/dataset.mjs"
import { applySourceCorrection } from "../lib/corrections.mjs"

const manifest = JSON.parse(await readFile(resolve(repositoryRoot, "manifest.json"), "utf8"))
const registry = JSON.parse(await readFile(resolve(repositoryRoot, "corrections.json"), "utf8"))

test("the approved correction changes only bugreport02 bounds.maxX and retains all 50 existing inputs before the contributed regression", async () => {
  assert.equal(registry.corrections.length, 1)
  const { sample: name, ...correction } = registry.corrections[0]
  assert.equal(name, "bugreport02-bc4361")
  assert.deepEqual(correction.changes, [{ path: "/simple_route_json/bounds/maxX", from: 6.35, to: 7.15 }])
  assert.equal(correction.originalSha256, "d753bde5bbb87b117b02b7d8e30d552c2ddc3ba0e5be80d03340b830b98f95d8")
  const sample = manifest.samples.find(sample => sample.name === name)
  assert.deepEqual(sample.correction, correction)
  const original = await readFile(resolve(repositoryRoot, correction.originalFile))
  const corrected = await readFile(resolve(repositoryRoot, sample.file))
  assert.equal(sha256(original), correction.originalSha256)
  assert.equal(sha256(corrected), sample.sha256)
  assert.deepEqual(corrected, applySourceCorrection(original, correction))
  const originalJson = JSON.parse(original), correctedJson = JSON.parse(corrected)
  assert.equal(correctedJson.simple_route_json.bounds.maxX, 7.15)
  correctedJson.simple_route_json.bounds.maxX = 6.35
  assert.deepEqual(correctedJson, originalJson)
  assert.equal(manifest.samples.filter(sample => sample.correction).length, 1)
  const audit = JSON.parse(await readFile(resolve(repositoryRoot, "selection-audit.json"), "utf8"))
  assert.deepEqual(manifest.samples.map(sample => sample.name), audit.decisions.filter(decision => decision.decision === "selected").map(decision => decision.sample))
  assert.equal(manifest.samples.length, 51)
  assert.equal(sha256(canonicalize(manifest.samples.slice(0, 50))), "e6461502d1281c56e6f884f7ba0c613e1aa81d93f47f19d99427816708132c49")
  assert.equal(manifest.samples[50].name, "pedometer")
})

test("reproducing a correction rejects changed source bytes and mismatched original values", async () => {
  const correction = registry.corrections[0]
  const original = await readFile(resolve(repositoryRoot, correction.originalFile))
  assert.throws(() => applySourceCorrection(Buffer.concat([original, Buffer.from(" ")]), correction), /original checksum mismatch/)
  const mismatched = structuredClone(correction)
  mismatched.changes[0].from = 6.3
  assert.throws(() => applySourceCorrection(original, mismatched), /original value mismatch/)
})


test("pedometer is an exact, pinned contributed regression with its original bytes retained", async () => {
  const contributions = JSON.parse(await readFile(resolve(repositoryRoot, "contributions.json"), "utf8"))
  assert.equal(contributions.version, 1)
  assert.equal(contributions.samples.length, 1)
  const sample = manifest.samples[50]
  const { sha256: inputHash, canonicalSrjSha256, boardGeometrySha256, layerCount, connectionCount, terminalCount, obstacleCount, ...candidate } = sample
  assert.deepEqual({ ...candidate, sha256: inputHash }, contributions.samples[0])
  assert.equal(sample.name, "pedometer")
  assert.equal(sample.category, "contributed-regression")
  assert.equal(sample.source.repository, manifest.repository)
  assert.equal(sample.source.path, "originals/pedometer.json")
  assert.equal(sample.source.commit, "b07fa8a96acc6cf097b14de128f76ee5acf866d0")
  assert.equal(sample.source.url, `${sample.source.repository}/blob/${sample.source.commit}/${sample.source.path}`)
  assert.equal(sample.source.license, "MIT")
  assert.ok(sample.source.attribution.trim())
  assert.equal(sample.srjJsonPointer, "")
  assert.equal(sample.correction, undefined)
  assert.equal(inputHash, "f546b05ca6dd9f60702775e0b73fdf2f49cb95002e9ac52a50c73dd6d4c892f4")
  const original = await readFile(resolve(repositoryRoot, sample.source.path))
  const benchmark = await readFile(resolve(repositoryRoot, sample.file))
  assert.equal(sha256(original), inputHash)
  assert.deepEqual(benchmark, original)
  assert.equal(layerCount, 4)
  assert.equal(connectionCount, 66)
  assert.equal(terminalCount, 230)
  assert.equal(obstacleCount, 190)
})
