import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { readGitSnapshot } from "./curation-sources.mjs"

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
