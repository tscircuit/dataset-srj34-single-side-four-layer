# Contributing

Open a pull request against `main`. The `staff` and `maintainers` teams have
maintain access and can push branches in this repository. Other contributors can
fork the public repository and submit a pull request.

Keep source samples immutable. Each sample must have a pinned public source
commit, original path and URL, original-byte SHA-256, source attribution, and the
applicable license notice. Keep genuine bug-report wrappers intact and use
`srjJsonPointer` to identify the embedded SimpleRouteJson.

The dataset targets components on the top side and routing on a four-layer board.
Original one-, two-, and four-layer input stacks are retained. Reject bottom SMT
components; plated holes and existing bottom copper alone remain eligible. Do
not change geometry or remove difficult cases to improve a benchmark score.

For membership changes, update the manifest, selection audit, reproducible
curation policy, and validation expectations together. Reject duplicate input or
board-layout fingerprints. The current version deliberately contains 50 cases;
consumers pin its revision and must explicitly adopt a changed dataset.

Run the checks before opening a pull request:

```sh
npm test
npm run build
```

Use `npm run validate:upstream` to compare all original files with their pinned
public sources. Inspect changed examples in the dataset browser. Pull requests
run integrity and build checks, and Vercel supplies a preview deployment. Merges
to `main` update the public dataset site.
