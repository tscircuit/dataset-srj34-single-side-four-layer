# dataset-srj34-single-side-four-layer

50 versioned SimpleRouteJson benchmark inputs for via-in-pad, four-layer autorouting, curated for boards with components on top. This public repository was provisioned through `tscircuit/create-repo`.

| Source | Cases | Pinned commit |
| --- | ---: | --- |
| [autorouting-dataset-01](https://github.com/tscircuit/autorouting-dataset-01) | 23 | `b97f5052a2359ab2da3f186765c6a5e839535efb` |
| [dataset-srj18](https://github.com/tscircuit/dataset-srj18) | 2 | `c0aad90256a95256fcac814f9f7da81a82a2fdea` |
| [tscircuit-autorouter bug reports](https://github.com/tscircuit/tscircuit-autorouter/tree/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports) | 25 | `fb6c6d77c091a56c9e1d4648bbac40a7cccd0def` |

[Browse the dataset](https://dataset-srj34-single-side-four-layer.vercel.app/) · [Open a pull request](https://github.com/tscircuit/dataset-srj34-single-side-four-layer/compare)

The `staff` and `maintainers` teams have maintain access. See [Contributing](CONTRIBUTING.md) for pull requests, source provenance requirements, and local checks. Dataset integrity and site builds run in CI. The hosted dataset browser deploys from `main` through Vercel.

The name describes the target routing technique: components on one side, routing on a four-layer board. Original inputs retain their one-, two-, or four-layer stacks unchanged.

## Original files and provenance

49 samples are byte-for-byte copies of their original files at the recorded upstream commits. `bugreport02-bc4361` is a derived input with one approved board-boundary correction; its byte-identical upstream original is retained in [`originals/bugreport02-bc4361.json`](originals/bugreport02-bc4361.json). Dataset-srj18 contributes `sample010` (Antmicro HDMI EDID Debug Board) and `sample012` (Antmicro OCuLink PCIe Adapter). Original source-board attribution remains intact.

Bug reports retain their JSON wrappers, report IDs, metadata, and `simple_route_json` objects. The manifest's `srjJsonPointer` is empty for direct SRJ files and `/simple_route_json` for report wrappers. All component/pad coordinates, net labels, widths, layer counts, pad geometry, existing routes, and report metadata remain unchanged. The sole correction is `/simple_route_json/bounds/maxX`: `6.35` → `7.15` mm for `bugreport02-bc4361`. Happy-autorouter upgrades eligible input boards to four layers at runtime.

`manifest.json` records original source URLs, commits and paths, benchmark-byte SHA-256, canonical SRJ hashes, conservative layout hashes, and input sizes. `selection-audit.json` records selection and exclusion decisions. No generated circuits, scaled copies, renamed copies, or routed outputs were added to reach the count.

### Approved boundary correction

`bugreport02-bc4361` originally placed existing plated-hole copper outside its right board edge. Its corrected `maxX = 7.15` mm supplies 0.20 mm board-edge clearance. [`corrections.json`](corrections.json) and the manifest retain the exact patch, reason, original-byte hash, original SRJ/layout hashes, and preserved-file path. The original SHA-256 is `d753bde5bbb87b117b02b7d8e30d552c2ddc3ba0e5be80d03340b830b98f95d8`.

The suite still contains the same 50 sample names in the same order. This is an explicit dataset revision; consumers must adopt its new commit and rerun both sides of a benchmark comparison. The browser labels the corrected input and offers its benchmark file and preserved original separately.

## Deterministic selection

Curation retains all 25 unique eligible cases among the 101 pinned dataset01/dataset-srj18 originals. It then selects the first 25 eligible unique genuine wrapped bug reports in numeric fixture order. Report wrappers must contain an actual report ID; placeholder IDs are excluded. Selection never invokes a router or consults completion/DRC results.

Exclude bottom SMT pads and bottom-only terminals without evidence of a plated hole or existing same-net bottom copper. Plated holes and bottom routing copper are allowed. Original layer counts must be 1, 2, or 4. Legacy SRJ has no mandatory component-side field; eligibility is a conservative inference from obstacle/terminal records, not a claim that component bodies are represented.

Duplicates are rejected by canonical SRJ hash and a second layout fingerprint: sorted obstacle geometry and board bounds rounded to 0.00001 mm, ignoring IDs and existing routing state. Different physical layouts from the same underlying design may remain distinct real cases. `bugreport29-7deae8` was excluded as a repeated layout.

Eligibility does not promise routability, valid input copper, or a clean DRC result. Some reports reproduce invalid or difficult routing situations. Benchmark every retained case and report completion and DRC separately.

## Read and validate

No dependencies are required; use Node.js 22 or newer.

```js
import { readFile } from "node:fs/promises"
import { readSample } from "./lib/dataset.mjs"
const manifest = JSON.parse(await readFile("manifest.json", "utf8"))
const srj = await readSample(manifest.samples[0])
```

```sh
npm test
npm run validate:upstream
```

`npm test` verifies benchmark bytes, preserved originals, exact declared correction, extracted SRJ hashes, layout uniqueness, exact 25+25 membership/order, provenance, sizes, and top-side eligibility. `validate:upstream` additionally downloads all 50 immutable upstream files and confirms equality with the unmodified samples or preserved original. GitHub Actions checks local integrity on each push and pull request.

Reproduce curation using Git checkouts of the three public source repositories. Fetch the pinned commits if they are not already present:

```sh
git -C /path/to/tscircuit-autorouter fetch origin fb6c6d77c091a56c9e1d4648bbac40a7cccd0def
git -C /path/to/autorouting-dataset-01 fetch origin b97f5052a2359ab2da3f186765c6a5e839535efb
git -C /path/to/dataset-srj18 fetch origin c0aad90256a95256fcac814f9f7da81a82a2fdea
npm run curate -- \
  --autorouter-root /path/to/tscircuit-autorouter \
  --dataset01-root /path/to/autorouting-dataset-01 \
  --srj18-root /path/to/dataset-srj18 \
  --output-root /tmp/srj34-reproduced
```

Curation selects from the exact pinned Git trees and file bytes, independent of each checkout's current branch or uncommitted changes, then reproducibly applies the declared correction and preserves its original. The optional output directory lets you compare a fresh reproduction without rewriting the checked-in dataset. Omit `--output-root` to update this repository intentionally. The older `--legacy-root` option remains compatible with existing vendored dataset01/dataset-srj18 inputs.

## Licensing

The loader, scripts, and documentation are MIT licensed. Original sample rights remain with upstream authors. MIT notices for dataset01 and upstream autorouter report fixtures are retained in `licenses/`. Dataset-srj18 provides no repository-wide license at its pinned commit; the two selected samples derive from Antmicro boards licensed Apache-2.0. Original Apache notices and `source-files.json` attribution are retained. Those upstream board URLs use `main`; the actual exported SRJ bytes are pinned to the dataset commit. See [licenses/README.md](licenses/README.md).

## Samples

| Sample | Input layers | Connections | Original source |
| --- | ---: | ---: | --- |
| `dataset01-circuit001` | 2 | 4 | [lib/dataset/circuit001.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit001.simple-route.json) |
| `dataset01-circuit002` | 2 | 18 | [lib/dataset/circuit002.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit002.simple-route.json) |
| `dataset01-circuit005` | 2 | 5 | [lib/dataset/circuit005.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit005.simple-route.json) |
| `dataset01-circuit006` | 2 | 5 | [lib/dataset/circuit006.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit006.simple-route.json) |
| `dataset01-circuit007` | 2 | 6 | [lib/dataset/circuit007.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit007.simple-route.json) |
| `dataset01-circuit010` | 2 | 9 | [lib/dataset/circuit010.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit010.simple-route.json) |
| `dataset01-circuit011` | 2 | 4 | [lib/dataset/circuit011.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit011.simple-route.json) |
| `dataset01-circuit012` | 2 | 6 | [lib/dataset/circuit012.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit012.simple-route.json) |
| `dataset01-circuit013` | 2 | 4 | [lib/dataset/circuit013.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit013.simple-route.json) |
| `dataset01-circuit014` | 2 | 8 | [lib/dataset/circuit014.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit014.simple-route.json) |
| `dataset01-circuit015` | 2 | 9 | [lib/dataset/circuit015.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit015.simple-route.json) |
| `dataset01-circuit019` | 2 | 5 | [lib/dataset/circuit019.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit019.simple-route.json) |
| `dataset01-circuit021` | 2 | 11 | [lib/dataset/circuit021.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit021.simple-route.json) |
| `dataset01-circuit115` | 2 | 3 | [lib/dataset/circuit115.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit115.simple-route.json) |
| `dataset01-circuit131` | 2 | 5 | [lib/dataset/circuit131.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit131.simple-route.json) |
| `dataset01-circuit133` | 2 | 7 | [lib/dataset/circuit133.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit133.simple-route.json) |
| `dataset01-circuit135` | 2 | 10 | [lib/dataset/circuit135.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit135.simple-route.json) |
| `dataset01-circuit136` | 2 | 7 | [lib/dataset/circuit136.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit136.simple-route.json) |
| `dataset01-circuit139` | 2 | 28 | [lib/dataset/circuit139.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit139.simple-route.json) |
| `dataset01-circuit147` | 2 | 4 | [lib/dataset/circuit147.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit147.simple-route.json) |
| `dataset01-circuit150` | 2 | 5 | [lib/dataset/circuit150.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit150.simple-route.json) |
| `dataset01-circuit179` | 2 | 16 | [lib/dataset/circuit179.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit179.simple-route.json) |
| `dataset01-circuit180` | 2 | 7 | [lib/dataset/circuit180.simple-route.json](https://github.com/tscircuit/autorouting-dataset-01/blob/b97f5052a2359ab2da3f186765c6a5e839535efb/lib/dataset/circuit180.simple-route.json) |
| `dataset-srj18-sample010` | 4 | 154 | [samples/sample010.json](https://github.com/tscircuit/dataset-srj18/blob/c0aad90256a95256fcac814f9f7da81a82a2fdea/samples/sample010.json) |
| `dataset-srj18-sample012` | 4 | 295 | [samples/sample012.json](https://github.com/tscircuit/dataset-srj18/blob/c0aad90256a95256fcac814f9f7da81a82a2fdea/samples/sample012.json) |
| `bugreport02-bc4361` | 2 | 16 | [fixtures/bug-reports/bugreport02-bc4361/bugreport02-bc4361.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport02-bc4361/bugreport02-bc4361.json) |
| `bugreport03-fe4a17` | 2 | 4 | [fixtures/bug-reports/bugreport03-fe4a17/bugreport03-fe4a17.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport03-fe4a17/bugreport03-fe4a17.json) |
| `bugreport07-d3f3be` | 2 | 8 | [fixtures/bug-reports/bugreport07-d3f3be/bugreport07-d3f3be.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport07-d3f3be/bugreport07-d3f3be.json) |
| `bugreport08-e3ec95` | 4 | 24 | [fixtures/bug-reports/bugreport08-e3ec95/bugreport08-e3ec95.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport08-e3ec95/bugreport08-e3ec95.json) |
| `bugreport10-71239a` | 2 | 1 | [fixtures/bug-reports/bugreport10-71239a/bugreport10-71239a.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport10-71239a/bugreport10-71239a.json) |
| `bugreport16-d95f38` | 2 | 7 | [fixtures/bug-reports/bugreport16-d95f38/bugreport16-d95f38.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport16-d95f38/bugreport16-d95f38.json) |
| `bugreport18-1b2d06` | 4 | 8 | [fixtures/bug-reports/bugreport18-1b2d06/bugreport18-1b2d06.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport18-1b2d06/bugreport18-1b2d06.json) |
| `bugreport24-05597c` | 4 | 35 | [fixtures/bug-reports/bugreport24-05597c/bugreport24-05597c.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport24-05597c/bugreport24-05597c.json) |
| `bugreport25-4b1d55` | 2 | 1 | [fixtures/bug-reports/bugreport25-4b1d55/bugreport25-4b1d55.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport25-4b1d55/bugreport25-4b1d55.json) |
| `bugreport26-66b0b2` | 1 | 6 | [fixtures/bug-reports/bugreport26-66b0b2/bugreport26-66b0b2.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport26-66b0b2/bugreport26-66b0b2.json) |
| `bugreport27-dd3734` | 1 | 9 | [fixtures/bug-reports/bugreport27-dd3734/bugreport27-dd3734.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport27-dd3734/bugreport27-dd3734.json) |
| `bugreport28-18a9ef` | 1 | 9 | [fixtures/bug-reports/bugreport28-18a9ef/bugreport28-18a9ef.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport28-18a9ef/bugreport28-18a9ef.json) |
| `bugreport30-2174c8` | 1 | 8 | [fixtures/bug-reports/bugreport30-2174c8/bugreport30-2174c8.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport30-2174c8/bugreport30-2174c8.json) |
| `bugreport33-213d45` | 1 | 21 | [fixtures/bug-reports/bugreport33-213d45/bugreport33-213d45.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport33-213d45/bugreport33-213d45.json) |
| `bugreport34-e9dea2` | 1 | 21 | [fixtures/bug-reports/bugreport34-e9dea2/bugreport34-e9dea2.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport34-e9dea2/bugreport34-e9dea2.json) |
| `bugreport35-191db9` | 1 | 21 | [fixtures/bug-reports/bugreport35-191db9/bugreport35-191db9.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport35-191db9/bugreport35-191db9.json) |
| `bugreport36-bf8303` | 2 | 58 | [fixtures/bug-reports/bugreport36-bf8303/bugreport36-bf8303.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport36-bf8303/bugreport36-bf8303.json) |
| `bugreport36-d4c6c2` | 1 | 8 | [fixtures/bug-reports/bugreport36-d4c6c2/bugreport36-d4c6c2.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport36-d4c6c2/bugreport36-d4c6c2.json) |
| `bugreport42-70db68` | 2 | 1 | [fixtures/bug-reports/bugreport42-70db68/bugreport42-70db68.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport42-70db68/bugreport42-70db68.json) |
| `bugreport43-e0f33a` | 1 | 21 | [fixtures/bug-reports/bugreport43-e0f33a/bugreport43-e0f33a.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport43-e0f33a/bugreport43-e0f33a.json) |
| `bugreport46-ac4337-arduino-uno` | 2 | 35 | [fixtures/bug-reports/bugreport46-ac4337/bugreport46-ac4337-arduino-uno.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport46-ac4337/bugreport46-ac4337-arduino-uno.json) |
| `bugreport47-8ee80e-esp32-breakout` | 2 | 17 | [fixtures/bug-reports/bugreport47-8ee80e-esp32-breakout/bugreport47-8ee80e-esp32-breakout.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport47-8ee80e-esp32-breakout/bugreport47-8ee80e-esp32-breakout.json) |
| `bugreport48-569cfe` | 2 | 10 | [fixtures/bug-reports/bugreport48-569cfe/bugreport48-569cfe.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport48-569cfe/bugreport48-569cfe.json) |
| `bugreport49-8536f4` | 4 | 55 | [fixtures/bug-reports/bugreport49-8536f4/bugreport49-8536f4.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport49-8536f4/bugreport49-8536f4.json) |
| `bugreport50-e1c376` | 4 | 168 | [fixtures/bug-reports/bugreport50-e1c376/bugreport50-e1c376.json](https://github.com/tscircuit/tscircuit-autorouter/blob/fb6c6d77c091a56c9e1d4648bbac40a7cccd0def/fixtures/bug-reports/bugreport50-e1c376/bugreport50-e1c376.json) |
