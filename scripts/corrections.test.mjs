import assert from "node:assert/strict"
import { test } from "node:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { repositoryRoot, sha256 } from "../lib/dataset.mjs"
import { applySourceCorrection } from "../lib/corrections.mjs"

const manifest = JSON.parse(await readFile(resolve(repositoryRoot, "manifest.json"), "utf8"))
const registry = JSON.parse(await readFile(resolve(repositoryRoot, "corrections.json"), "utf8"))

test("the approved correction changes only bugreport02 bounds.maxX and retains all 50 selected inputs in order", async () => {
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
  assert.equal(manifest.samples.length, 50)
})

test("reproducing a correction rejects changed source bytes and mismatched original values", async () => {
  const correction = registry.corrections[0]
  const original = await readFile(resolve(repositoryRoot, correction.originalFile))
  assert.throws(() => applySourceCorrection(Buffer.concat([original, Buffer.from(" ")]), correction), /original checksum mismatch/)
  const mismatched = structuredClone(correction)
  mismatched.changes[0].from = 6.3
  assert.throws(() => applySourceCorrection(original, mismatched), /original value mismatch/)
})
