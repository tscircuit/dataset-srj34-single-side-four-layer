import { execFileSync } from "node:child_process"
import { basename } from "node:path"

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
