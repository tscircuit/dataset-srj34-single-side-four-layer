# Contributing

Open a pull request against `main`. The `staff` and `maintainers` teams have
maintain access and can push branches in this repository. Other contributors can
fork the public repository and submit a pull request.

Keep original source files immutable. Each sample must have a pinned public source
commit, original path and URL, original-byte SHA-256, source attribution, and the
applicable license notice. Keep genuine bug-report wrappers intact and use
`srjJsonPointer` to identify the embedded SimpleRouteJson.

The dataset targets components on the top side and routing on a four-layer board.
Original one-, two-, and four-layer input stacks are retained. Reject bottom SMT
components; plated holes and existing bottom copper alone remain eligible. Do
not remove difficult cases to improve a benchmark score. A source correction needs explicit maintainer approval, an exact patch and reason in `corrections.json`, the byte-identical original retained under `originals/`, and original/corrected hashes in the manifest. Label the derived input clearly and update reproduction, tests, and browser provenance together. Consumers must explicitly adopt the revised dataset commit.

For membership changes, update the manifest, selection audit, reproducible
curation policy, and validation expectations together. Reject duplicate input or
board-layout fingerprints. The current version contains 51 cases (the original 50 plus one contributed regression);
consumers pin its revision and must explicitly adopt a changed dataset.

For a new original contribution, preserve the exported input under `originals/`
with its license notice in a source commit first. Register that immutable commit,
source path, SHA-256, and attribution in `contributions.json`; append the input
under `samples/` without rewriting its bytes. Curation reads the pinned Git blob,
appends contributions in registry order, and applies the same eligibility and
duplicate checks. Update the browser and membership tests with the new count.
Keep routed outputs and solver-dependent success claims out of dataset inputs.

Run the checks before opening a pull request:

```sh
npm test
npm run build
```

Use `npm run validate:upstream` to compare all original files with their pinned
public sources. Inspect changed examples in the dataset browser. Pull requests
run integrity and build checks, and Vercel supplies a preview deployment. Merges
to `main` update the public dataset site.
