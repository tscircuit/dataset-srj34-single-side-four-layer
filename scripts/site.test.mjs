import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { buildSite } from "./build-site.mjs"
import { canonicalize, getSimpleRouteJson, readSample, repositoryRoot, sha256 } from "../lib/dataset.mjs"
import { availableLayers, frameFor, geometrySvg, obstacleKind } from "../site/geometry.mjs"

const manifest = JSON.parse(await readFile(resolve(repositoryRoot, "manifest.json"), "utf8"))
test("public build has only explicit assets and exact benchmark and preserved original bytes, with correct wrapped SRJ downloads", async () => {
  const output = await mkdtemp(resolve(tmpdir(), "srj34-site-test-"))
  try {
    assert.equal((await buildSite(output)).sampleCount, 51)
    assert.deepEqual((await readdir(output)).sort(), ["LICENSE", "app.mjs", "catalog.json", "contributions.json", "corrections.json", "geometry.mjs", "index.html", "licenses", "manifest.json", "originals", "samples", "srj", "styles.css"])
    assert.deepEqual(await readFile(resolve(output, "contributions.json")), await readFile(resolve(repositoryRoot, "contributions.json")))
    assert.deepEqual(await readFile(resolve(output, "licenses/pedometer-MIT.txt")), await readFile(resolve(repositoryRoot, "licenses/pedometer-MIT.txt")))
    const catalog = JSON.parse(await readFile(resolve(output, "catalog.json"), "utf8"))
    assert.equal(catalog.samples.length, 51)
    assert.equal((await readdir(resolve(output, "samples"))).length, 51)
    assert.equal((await readdir(resolve(output, "srj"))).length, 51)
    for (const sample of catalog.samples) {
      const original = await readFile(resolve(output, sample.file))
      assert.equal(sha256(original), sample.sha256)
      if (sample.correction) {
        assert.equal(sha256(await readFile(resolve(output, sample.correction.originalFile))), sample.correction.originalSha256)
      }
      if (sample.category === "contributed-regression") {
        assert.equal(sample.name, "pedometer")
        assert.deepEqual(await readFile(resolve(output, sample.source.path)), original)
        const sourceSample = manifest.samples.find(candidate => candidate.name === sample.name)
        assert.deepEqual(sample.source, sourceSample.source)
        assert.match(sample.source.url, /\/blob\/[a-f0-9]{40}\/originals\/pedometer\.json$/)
      }
      const expected = getSimpleRouteJson(JSON.parse(original), sample)
      const extracted = JSON.parse(await readFile(resolve(output, `.${sample.srjFile}`), "utf8"))
      assert.equal(canonicalize(extracted), canonicalize(expected))
      assert.equal(sha256(canonicalize(extracted)), sample.canonicalSrjSha256)
    }
    const html = await readFile(resolve(output, "index.html"), "utf8")
    assert.match(html, /dataset-srj34-single-side-four-layer/)
    assert.doesNotMatch(html, /privateHappy|\.vercel|dataset-happy-autorouter/)
  } finally { await rm(output, { recursive: true, force: true }) }
})
test("all 51 real inputs render finite SVG and preserve input-layer availability", async () => {
  const layerCounts = new Map()
  for (const sample of manifest.samples) {
    const srj = await readSample(sample)
    const svg = geometrySvg(srj, { showConnections: true })
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/)
    assert.ok(svg.includes('data-kind="Terminal"'))
    assert.equal((svg.match(/data-kind="Terminal"/g) ?? []).length, sample.terminalCount)
    const frame = frameFor(srj)
    assert.ok(frame.width > 0 && frame.height > 0)
    assert.ok(availableLayers(srj).includes("top"))
    if (srj.outline) assert.match(svg, /<polygon class="board"/)
    layerCounts.set(srj.layerCount, (layerCounts.get(srj.layerCount) ?? 0) + 1)
  }
  assert.equal(layerCounts.get(1), 9)
  assert.equal(layerCounts.get(2), 34)
  assert.equal(layerCounts.get(4), 8)
})
test("layer controls include multi-layer terminals and faithfully flip CCW geometry into SVG", () => {
  const srj = { layerCount: 4, minTraceWidth: .2, bounds: { minX:-3,maxX:3,minY:-3,maxY:3 }, obstacles:[{ type:"oval",center:{x:1,y:2},width:2,height:1,ccwRotationDegrees:90,layers:["top"],connectedTo:["pcb_smtpad_1"] }], connections:[{name:"net <script>alert(1)</script>",pointsToConnect:[{x:1,y:2,layers:["top","inner1","inner2","bottom"]}]}] }
  const top = geometrySvg(srj)
  assert.match(top, /translate\(1 -2\) rotate\(-90\)/)
  assert.match(top, /<ellipse/)
  assert.match(top, /&lt;script&gt;/)
  assert.doesNotMatch(top, /<script>/)
  assert.equal(obstacleKind(srj.obstacles[0]), "Pad")
  const bottom = geometrySvg(srj,{ layers:["bottom"] })
  assert.doesNotMatch(bottom, /data-kind="Pad"/)
  assert.match(bottom, /data-kind="Terminal"/)
  assert.doesNotMatch(geometrySvg(srj,{layers:[]}), /data-kind=/)
})
test("existing copper preview respects wire layers and via transitions", () => {
  const srj = {layerCount:4,minTraceWidth:.2,bounds:{minX:0,maxX:5,minY:0,maxY:5},obstacles:[],connections:[],traces:[{connection_name:"test",route:[{route_type:"wire",x:1,y:1,width:.3,layer:"top"},{route_type:"via",x:2,y:2,from_layer:"top",to_layer:"bottom",outer_diameter:.6},{route_type:"wire",x:3,y:3,width:.2,layer:"bottom"}]}]}
  const svg = geometrySvg(srj)
  assert.match(svg, /data-kind="Existing via"/)
  assert.match(svg, /M 2 -2 L 3 -3/)
  assert.doesNotMatch(geometrySvg(srj,{layers:["inner1"]}), /data-kind="Existing trace"/)
})
