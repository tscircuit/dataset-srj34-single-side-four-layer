import { execFileSync } from "node:child_process"
import { basename } from "node:path"
import { sha256 } from "../lib/dataset.mjs"

export const pinnedSources = {
  dataset01: {
    repository: "https://github.com/tscircuit/autorouting-dataset-01",
    commit: "b97f5052a2359ab2da3f186765c6a5e839535efb",
    prefix: "lib/dataset/",
    pattern: /^lib\/dataset\/circuit\d+\.simple-route\.json$/,
    count: 85,
  },
  "dataset-srj18": {
    repository: "https://github.com/tscircuit/dataset-srj18",
    commit: "c0aad90256a95256fcac814f9f7da81a82a2fdea",
    prefix: "samples/",
    pattern: /^samples\/sample\d+\.json$/,
    count: 16,
  },
  autorouter: {
    repository: "https://github.com/tscircuit/tscircuit-autorouter",
    commit: "fb6c6d77c091a56c9e1d4648bbac40a7cccd0def",
    prefix: "fixtures/bug-reports/",
    pattern: /\.json$/,
  },
}

/** Read only the pinned Git tree and blobs, regardless of working-tree changes. */
export function readGitSnapshot(directory, source) {
  const git = args => execFileSync("git", ["-C", directory, ...args], {
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (git(["rev-parse", `${source.commit}^{commit}`]).toString().trim() !== source.commit)
    throw new Error(`Missing pinned source commit: ${source.commit}`)
  const paths = git(["ls-tree", "-r", "--name-only", source.commit, "--", source.prefix])
    .toString().trim().split("\n").filter(path => source.pattern.test(path)).sort()
  if (source.count !== undefined && paths.length !== source.count)
    throw new Error(`Expected ${source.count} pinned source files, found ${paths.length}`)
  return paths.map(path => ({ path, bytes: git(["show", `${source.commit}:${path}`]) }))
}

export function readPublicLegacyDatasets(dataset01Root, srj18Root) {
  return [["dataset01", dataset01Root], ["dataset-srj18", srj18Root]].map(([name, directory]) => {
    const source = pinnedSources[name]
    return {
      name, repository: source.repository, commit: source.commit,
      samples: readGitSnapshot(directory, source).map(({ path, bytes }) => ({
        name: basename(path).replace(/(?:\.simple-route)?\.json$/, ""),
        file: path, bytes,
      })),
    }
  })
}


/** A contribution is selected explicitly, but its source bytes always come from its immutable Git commit. */
export function readContributedSamples(directory, registry) {
  if (registry?.version !== 1 || !Array.isArray(registry.samples))
    throw new Error("Invalid contribution registry: expected version 1 and samples array")
  const names = new Set(), files = new Set(), originals = new Set()
  return registry.samples.map(sample => {
    if (!sample || typeof sample !== "object" || sample.category !== "contributed-regression")
      throw new Error("Contribution category must be contributed-regression")
    if (typeof sample.name !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(sample.name))
      throw new Error("Contribution name must be a safe, nonempty identifier")
    if (sample.file !== `samples/${sample.name}.json`)
      throw new Error(`Contribution ${sample.name}: file must match samples/name.json`)
    if (!["", "/simple_route_json"].includes(sample.srjJsonPointer))
      throw new Error(`Contribution ${sample.name}: unsupported SRJ JSON pointer`)
    if (typeof sample.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sample.sha256))
      throw new Error(`Contribution ${sample.name}: a SHA-256 of original bytes is required`)
    const source = sample.source
    if (!source || source.repository !== "https://github.com/tscircuit/dataset-srj34-single-side-four-layer" ||
      typeof source.commit !== "string" || !/^[a-f0-9]{40}$/.test(source.commit) ||
      source.path !== `originals/${sample.name}.json` ||
      source.url !== `${source.repository}/blob/${source.commit}/${source.path}` ||
      typeof source.license !== "string" || !source.license.trim() ||
      typeof source.attribution !== "string" || !source.attribution.trim() ||
      typeof source.dataset !== "string" || !source.dataset.trim())
      throw new Error(`Contribution ${sample.name}: invalid pinned source provenance`)
    if (names.has(sample.name) || files.has(sample.file) || originals.has(source.path))
      throw new Error(`Duplicate contribution: ${sample.name}`)
    names.add(sample.name); files.add(sample.file); originals.add(source.path)
    const [{ bytes }] = readGitSnapshot(directory, {
      ...source,
      prefix: source.path,
      pattern: { test: path => path === source.path },
      count: 1,
    })
    if (sha256(bytes) !== sample.sha256)
      throw new Error(`Contribution ${sample.name}: pinned original checksum mismatch`)
    return { sample, bytes }
  })
}
