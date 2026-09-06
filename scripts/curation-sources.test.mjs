import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { readGitSnapshot, readContributedSamples } from "./curation-sources.mjs"
import { sha256 } from "../lib/dataset.mjs"

test("curation reads pinned Git bytes and membership despite modified or untracked working files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dataset-curation-test-"))
  const git = args => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  try {
    git(["init"])
    await mkdir(join(directory, "samples"))
    await writeFile(join(directory, "samples/sample001.json"), '{"original":true}\n')
    git(["add", "samples"])
    git(["-c", "user.name=Dataset test", "-c", "user.email=dataset-test@example.invalid", "commit", "-m", "Fixture source"])
    const commit = git(["rev-parse", "HEAD"])
    await writeFile(join(directory, "samples/sample001.json"), '{"modified":true}')
    await writeFile(join(directory, "samples/sample002.json"), '{"untracked":true}')
    const source = { commit, prefix: "samples/", pattern: /\.json$/, count: 1 }
    const files = readGitSnapshot(directory, source)
    assert.equal(files.length, 1)
    assert.equal(files[0].path, "samples/sample001.json")
    assert.equal(files[0].bytes.toString(), '{"original":true}\n')
    assert.throws(() => readGitSnapshot(directory, { ...source, count: 2 }), /Expected 2 pinned source files/)
    assert.throws(() => readGitSnapshot(directory, { ...source, commit: "0".repeat(40) }))
  } finally { await rm(directory, { recursive: true, force: true }) }
})


test("contributed samples retain pinned bytes and reject altered provenance, checksums, or duplicates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dataset-contribution-test-"))
  const git = args => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  const original = Buffer.from('{"obstacles":[],"connections":[],"layerCount":4}\n')
  try {
    git(["init"])
    await mkdir(join(directory, "originals"))
    await writeFile(join(directory, "originals/pedometer.json"), original)
    git(["add", "originals/pedometer.json"])
    git(["-c", "user.name=Dataset test", "-c", "user.email=dataset-test@example.invalid", "commit", "-m", "Pinned contributed source"])
    const commit = git(["rev-parse", "HEAD"])
    const repository = "https://github.com/tscircuit/dataset-srj34-single-side-four-layer"
    const sample = {
      name: "pedometer", file: "samples/pedometer.json", category: "contributed-regression", srjJsonPointer: "",
      source: { repository, commit, path: "originals/pedometer.json", url: `${repository}/blob/${commit}/originals/pedometer.json`, license: "MIT", attribution: "Fixture contributor", dataset: "pedometer" },
      sha256: sha256(original),
    }
    const registry = { version: 1, samples: [sample] }
    await writeFile(join(directory, "originals/pedometer.json"), '{"modified":true}')
    await writeFile(join(directory, "originals/untracked.json"), '{"untracked":true}')
    const result = readContributedSamples(directory, registry)
    assert.equal(result.length, 1)
    assert.deepEqual(result[0].sample, sample)
    assert.deepEqual(result[0].bytes, original)
    assert.throws(() => readContributedSamples(directory, { version: 2, samples: [sample] }), /Invalid contribution registry/)
    assert.throws(() => readContributedSamples(directory, { ...registry, samples: [sample, sample] }), /Duplicate contribution/)
    const changed = mutate => {
      const candidate = structuredClone(sample)
      mutate(candidate)
      return { version: 1, samples: [candidate] }
    }
    for (const [mutate, expected] of [
      [candidate => { candidate.sha256 = "0".repeat(64) }, /pinned original checksum mismatch/],
      [candidate => { candidate.category = "bug-report" }, /category/],
      [candidate => { candidate.name = "../pedometer" }, /safe, nonempty identifier/],
      [candidate => { candidate.file = "samples/other.json" }, /file must match/],
      [candidate => { candidate.srjJsonPointer = "/unexpected" }, /unsupported SRJ JSON pointer/],
      [candidate => { candidate.source.path = "../pedometer.json" }, /invalid pinned source provenance/],
      [candidate => { candidate.source.repository = "https://example.com/private" }, /invalid pinned source provenance/],
      [candidate => { candidate.source.url = `${repository}/blob/main/originals/pedometer.json` }, /invalid pinned source provenance/],
      [candidate => { candidate.source.attribution = " " }, /invalid pinned source provenance/],
      [candidate => { candidate.source.license = "" }, /invalid pinned source provenance/],
    ]) assert.throws(() => readContributedSamples(directory, changed(mutate)), expected)
    assert.throws(() => readContributedSamples(directory, changed(candidate => {
      candidate.source.commit = "0".repeat(40)
      candidate.source.url = `${repository}/blob/${candidate.source.commit}/originals/pedometer.json`
    })))
  } finally { await rm(directory, { recursive: true, force: true }) }
})
