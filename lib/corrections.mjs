import assert from "node:assert/strict"
import { canonicalize, sha256 } from "./dataset.mjs"

/** Reproduce an approved patch while preserving every other source byte. */
export function applySourceCorrection(originalBytes, correction) {
  assert.equal(sha256(originalBytes), correction.originalSha256, "Correction original checksum mismatch")
  const expected = JSON.parse(originalBytes.toString())
  let text = originalBytes.toString()
  for (const change of correction.changes) {
    assert.match(change.path, /^\/(?:[a-zA-Z_][a-zA-Z0-9_]*\/)*[a-zA-Z_][a-zA-Z0-9_]*$/)
    assert(Number.isFinite(change.from) && Number.isFinite(change.to), "Only declared numeric source corrections are supported")
    const parts = change.path.slice(1).split("/")
    const key = parts.pop()
    const parent = parts.reduce((value, part) => value[part], expected)
    assert.equal(parent[key], change.from, `Correction original value mismatch: ${change.path}`)
    parent[key] = change.to
    const pattern = new RegExp(`("${key}"\\s*:\\s*)${JSON.stringify(change.from).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s*[,}])`, "g")
    assert.equal([...text.matchAll(pattern)].length, 1, `Correction byte location must be unique: ${change.path}`)
    text = text.replace(pattern, (_, prefix) => `${prefix}${JSON.stringify(change.to)}`)
  }
  assert.equal(canonicalize(JSON.parse(text)), canonicalize(expected), "Correction changed undeclared source fields")
  return Buffer.from(text)
}
