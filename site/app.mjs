import { LAYER_COLORS, availableLayers, frameFor, geometrySvg } from "./geometry.mjs"
const $ = id => document.getElementById(id)
const repository = "https://github.com/tscircuit/dataset-srj34-single-side-four-layer"
const state = { samples: [], selected: null, srj: null, layers: [], view: null, request: 0 }
const compact = value => Number(value.toFixed(2)).toString()
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node }
function link(id, text, href) { $(id).textContent = text; $(id).href = href }
function drawList() {
  const query = $("search").value.toLowerCase().trim(), category = $("category").value, layer = $("layer-filter").value
  const shown = state.samples.filter(sample => (!query || `${sample.name} ${sample.source.repository} ${sample.source.dataset ?? ""} ${sample.source.path}`.toLowerCase().includes(query)) && (!category || sample.category === category) && (!layer || String(sample.layerCount) === layer))
  $("result-count").textContent = `${shown.length} / ${state.samples.length}`
  $("sample-list").replaceChildren(...shown.map(sample => {
    const button = element("button", undefined, "sample-item")
    button.type = "button"; button.setAttribute("aria-current", String(state.selected?.name === sample.name))
    button.append(element("strong", sample.name))
    const meta = element("span", undefined, "sample-item-meta")
    meta.append(element("span", `${sample.layerCount}L`, "badge"), element("span", sample.category === "bug-report" ? "Bug report" : sample.category === "contributed-regression" ? "Contributed" : sample.source.dataset), element("span", `${sample.connectionCount} net${sample.connectionCount === 1 ? "" : "s"}`, "count"))
    if (sample.correction) meta.append(element("span", "Corrected", "badge"))
    button.append(meta); button.addEventListener("click", () => selectSample(sample.name)); return button
  }))
  if (!shown.length) $("sample-list").append(element("p", "No matching samples. Try another search or clear the filters.", "empty"))
}
function updateView() {
  const { x, y, width, height } = state.view
  $("board").setAttribute("viewBox", `${x} ${y} ${width} ${height}`)
}
function redraw() {
  if (!state.srj) return
  $("board").innerHTML = geometrySvg(state.srj, { layers: state.layers, showConnections: $("show-connections").checked, showTerminals: $("show-terminals").checked, showObstacles: $("show-obstacles").checked, showTraces: $("show-traces").checked, selectedConnection: $("net-select").value })
  updateView()
}
function fit() { if (state.srj) { state.view = frameFor(state.srj); updateView() } }
function zoom(factor, anchor) {
  if (!state.view) return
  const previous = state.view, original = frameFor(state.srj), width = Math.max(original.width / 30, Math.min(original.width * 4, previous.width * factor)), ratio = width / previous.width
  const center = anchor ?? { x: previous.x + previous.width / 2, y: previous.y + previous.height / 2 }
  state.view = { x: center.x - (center.x - previous.x) * ratio, y: center.y - (center.y - previous.y) * ratio, width, height: previous.height * ratio }; updateView()
}
function svgPoint(event) { const point = $("board").createSVGPoint(); point.x = event.clientX; point.y = event.clientY; return point.matrixTransform($("board").getScreenCTM().inverse()) }
async function selectSample(name, updateHistory = true) {
  const sample = state.samples.find(sample => sample.name === name)
  if (!sample) return
  const request = ++state.request
  state.selected = sample; drawList()
  $("loading").hidden = false; $("loading").textContent = "Loading input geometry…"; $("sample-detail").hidden = true
  if (updateHistory) history.replaceState(null, "", `?sample=${encodeURIComponent(name)}`)
  try {
    const response = await fetch(sample.srjFile)
    if (!response.ok) throw new Error(`Input request failed (${response.status})`)
    const srj = await response.json()
    if (request !== state.request) return
    state.srj = srj; state.layers = availableLayers(srj); state.view = frameFor(srj)
    $("sample-name").textContent = sample.name
    $("sample-category").textContent = `${sample.category === "bug-report" ? "Bug report" : sample.category === "contributed-regression" ? "Contributed regression" : "Original dataset"} / ${sample.source.dataset ?? "tscircuit-autorouter"}`
    $("sample-stats").replaceChildren(...[[sample.connectionCount,"connections"],[sample.terminalCount,"terminals"],[sample.obstacleCount,"obstacles"],[`${sample.layerCount} layer${sample.layerCount === 1 ? "" : "s"}`,"original stack"],[`${compact(srj.bounds.maxX-srj.bounds.minX)} × ${compact(srj.bounds.maxY-srj.bounds.minY)}`,"bounds · mm"]].map(([value,label]) => { const item=element("div"); item.append(element("strong",value),element("span",label)); return item }))
    $("srj-download").href = sample.srjFile; $("srj-download").download = `${sample.name}.srj.json`
    $("raw-download").textContent = sample.correction ? "Corrected file ↓" : "Original file ↓"
    const originalFile = sample.correction?.originalFile ?? (sample.category === "contributed-regression" ? sample.source.path : undefined)
    $("original-download").hidden = !originalFile
    if (originalFile) {
      $("original-download").href = `/${originalFile}`
      $("original-download").download = `${sample.name}.original.json`
    }
    $("input-provenance").textContent = sample.correction
      ? `Derived input: ${sample.correction.changes.map(change => `${change.path}: ${change.from} → ${change.to}`).join("; ")}. ${sample.correction.reason} The preserved original remains byte-for-byte upstream data.`
      : sample.category === "contributed-regression"
      ? `This input is a byte-for-byte original export pinned to its source commit. ${sample.source.attribution}`
      : "This input is byte-for-byte upstream data. Wrapped bug reports also provide an extracted SRJ download."
    $("raw-download").href = `/${sample.file}`; $("raw-download").download = `${sample.name}.json`
    $("layers").replaceChildren(...state.layers.map(layer => { const button=element("button",undefined,"layer-button"); button.type="button"; button.style.setProperty("--layer-color",LAYER_COLORS[layer] ?? "#9caec2"); button.setAttribute("aria-pressed","true"); button.append(element("span"),document.createTextNode(layer)); button.addEventListener("click",() => { state.layers = state.layers.includes(layer) ? state.layers.filter(value => value !== layer) : [...state.layers,layer]; button.setAttribute("aria-pressed",String(state.layers.includes(layer))); redraw() }); return button }))
    $("net-select").replaceChildren(new Option("All connections", ""), ...srj.connections.map(connection => new Option(connection.name, connection.name)))
    $("show-traces").disabled = !(srj.traces?.length); $("show-traces").parentElement.title = srj.traces?.length ? `${srj.traces.length} existing traces` : "This original input contains no existing traces"
    $("board-scale").textContent = `${compact(srj.bounds.maxX-srj.bounds.minX)} × ${compact(srj.bounds.maxY-srj.bounds.minY)} mm · input bounds`
    link("source-repo",sample.source.repository.replace("https://github.com/",""),sample.source.repository)
    link("source-file",sample.source.path,sample.source.url)
    link("source-commit",sample.source.commit,`${sample.source.repository}/commit/${sample.source.commit}`)
    $("source-license").textContent=sample.source.license; $("srj-location").textContent=sample.srjJsonPointer || "Root JSON object"
    $("sample-hash").value=sample.sha256; $("copy-status").textContent=""
    link("sample-github","Inspect this sample on GitHub ↗",`${repository}/blob/main/${sample.file}`)
    $("board").setAttribute("aria-label",`${sample.name}: ${sample.obstacleCount} obstacles and ${sample.terminalCount} terminals. Scroll to zoom, drag to pan.`)
    $("loading").hidden=true; $("sample-detail").hidden=false; redraw()
    document.title=`${sample.name} · SRJ34 dataset`
  } catch (error) { if (request===state.request) $("loading").textContent=`Unable to load this preview. ${error.message}. The original files remain available on GitHub.` }
}
for (const id of ["search","category","layer-filter"]) $(id).addEventListener(id==="search" ? "input" : "change",drawList)
for (const id of ["show-obstacles","show-terminals","show-traces","show-connections"]) $(id).addEventListener("change",redraw)
$("net-select").addEventListener("change",() => { if ($("net-select").value) $("show-connections").checked=true; redraw() })
$("zoom-fit").addEventListener("click",fit); $("zoom-in").addEventListener("click",() => zoom(.75)); $("zoom-out").addEventListener("click",() => zoom(1/.75))
$("board").addEventListener("wheel",event => { if (!state.view) return; event.preventDefault(); zoom(Math.exp(Math.max(-.5,Math.min(.5,event.deltaY*.001))),svgPoint(event)) },{passive:false})
let drag
$("board").addEventListener("pointerdown",event => { if (!state.view || event.button!==0) return; drag=svgPoint(event); $("board").setPointerCapture(event.pointerId) })
$("board").addEventListener("pointermove",event => { if (!drag) return; const point=svgPoint(event); state.view.x+=drag.x-point.x; state.view.y+=drag.y-point.y; updateView() })
for (const name of ["pointerup","pointercancel","lostpointercapture"]) $("board").addEventListener(name,() => { drag=null })
$("copy-hash").addEventListener("click",async () => { try { await navigator.clipboard.writeText($("sample-hash").value); $("copy-status").textContent="SHA-256 copied." } catch { $("sample-hash").select(); $("copy-status").textContent="Select and copy the SHA-256 above." } })
window.addEventListener("popstate",() => selectSample(new URLSearchParams(location.search).get("sample") ?? state.samples[0]?.name,false))
try {
  const response=await fetch("/catalog.json")
  if (!response.ok) throw new Error(`Dataset request failed (${response.status})`)
  const catalog=await response.json(); state.samples=catalog.samples
  const requested=new URLSearchParams(location.search).get("sample")
  await selectSample(state.samples.some(sample => sample.name===requested) ? requested : state.samples[0].name,false)
} catch (error) { $("loading").textContent=`Unable to load the dataset: ${error.message}. Please use the GitHub link to browse the original files.`; $("sample-list").replaceChildren(element("p","Dataset unavailable. Please reload or visit GitHub.","empty")) }
