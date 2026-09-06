export const LAYER_COLORS = { top: "#dfb45e", inner1: "#a08af9", inner2: "#59c3dc", bottom: "#f58c9c" }
export const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])
const numeric = value => Number.isFinite(value) ? value : 0
const pointLayers = point => point.layers ?? (point.layer ? [point.layer] : ["top"])
export const originalLayers = count => count === 4 ? ["top", "inner1", "inner2", "bottom"] : count === 2 ? ["top", "bottom"] : ["top"]
export function availableLayers(srj) {
  const found = new Set([...originalLayers(srj.layerCount), ...srj.obstacles.flatMap(obstacle => obstacle.layers ?? []), ...srj.connections.flatMap(connection => connection.pointsToConnect.flatMap(pointLayers)), ...(srj.traces ?? []).flatMap(trace => trace.route.flatMap(point => [point.layer, point.from_layer, point.to_layer].filter(Boolean)))])
  return [...Object.keys(LAYER_COLORS).filter(layer => found.has(layer)), ...[...found].filter(layer => !Object.hasOwn(LAYER_COLORS, layer)).sort()]
}
export function obstacleKind(obstacle) {
  if (obstacle.isCopperPour) return "Copper pour"
  const metadata = obstacle.circuitJsonMetadata ?? {}
  if (metadata.pcb_plated_hole_id) return "Plated hole"
  if (metadata.pcb_smtpad_id) return "Pad"
  if (metadata.pcb_via_id) return "Existing via"
  const identity = obstacle.obstacleId ?? obstacle.connectedTo?.[0] ?? ""
  if (identity.startsWith("pcb_plated_hole")) return "Plated hole"
  if (identity.startsWith("pcb_smtpad")) return "Pad"
  if (identity.startsWith("pcb_via")) return "Existing via"
  return obstacle.connectedTo?.length ? "Connected obstacle" : "Keepout"
}
export function frameFor(srj) {
  const bounds = srj.bounds
  const width = Math.max(0.1, bounds.maxX - bounds.minX), height = Math.max(0.1, bounds.maxY - bounds.minY)
  const margin = Math.max(width, height) * 0.065
  return { x: bounds.minX - margin, y: -bounds.maxY - margin, width: width + margin * 2, height: height + margin * 2 }
}
export function geometrySvg(srj, { layers = availableLayers(srj), showConnections = false, showTerminals = true, showObstacles = true, showTraces = true, selectedConnection = "" } = {}) {
  const enabled = new Set(layers), visible = candidates => candidates.some(layer => enabled.has(layer))
  const color = candidates => LAYER_COLORS[candidates.find(layer => enabled.has(layer))] ?? "#9caec2"
  const bounds = srj.bounds, frame = frameFor(srj), scale = Math.max(frame.width, frame.height)
  const marker = Math.max(scale * 0.0026, 0.11)
  const hasOutline = Array.isArray(srj.outline) && srj.outline.length > 2
  const parts = [`<rect class="${hasOutline ? "routing-bounds" : "board"}" x="${bounds.minX}" y="${-bounds.maxY}" width="${bounds.maxX - bounds.minX}" height="${bounds.maxY - bounds.minY}"/>`]
  if (hasOutline) parts.push(`<polygon class="board" points="${srj.outline.map(point => `${numeric(point.x)},${-numeric(point.y)}`).join(" ")}"/>`)
  if (showObstacles) for (const obstacle of srj.obstacles) {
    const layers = obstacle.layers ?? ["top"]
    if (!visible(layers)) continue
    const x = numeric(obstacle.center?.x), y = -numeric(obstacle.center?.y), width = numeric(obstacle.width), height = numeric(obstacle.height)
    const kind = obstacleKind(obstacle), keepout = kind === "Keepout"
    const attrs = `fill="${keepout ? "#8495aa" : color(layers)}" fill-opacity="${keepout ? ".14" : ".5"}" stroke="${keepout ? "#9cacc1" : color(layers)}" stroke-width="${scale * 0.00085}"${keepout ? ` stroke-dasharray="${marker} ${marker}"` : ""}`
    const title = `<title>${escapeHtml(kind)} · ${escapeHtml(layers.join(", "))} · ${escapeHtml(obstacle.obstacleId ?? obstacle.connectedTo?.[0] ?? "unassigned")} · ${width.toFixed(3)} × ${height.toFixed(3)} mm</title>`
    const shape = obstacle.type === "oval" ? `<ellipse cx="0" cy="0" rx="${width / 2}" ry="${height / 2}" ${attrs}>${title}</ellipse>` : `<rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" ${attrs}>${title}</rect>`
    parts.push(`<g data-kind="${kind}" transform="translate(${x} ${y}) rotate(${-numeric(obstacle.ccwRotationDegrees)})">${shape}</g>`)
  }
  if (showTraces) for (const trace of srj.traces ?? []) {
    let previous
    for (const entry of trace.route) {
      if (entry.route_type === "wire") {
        if (previous && previous.layer === entry.layer && enabled.has(entry.layer)) parts.push(`<path data-kind="Existing trace" d="M ${numeric(previous.x)} ${-numeric(previous.y)} L ${numeric(entry.x)} ${-numeric(entry.y)}" fill="none" stroke="${color([entry.layer])}" stroke-width="${numeric(previous.width) || numeric(entry.width) || srj.minTraceWidth}" stroke-linecap="round"><title>${escapeHtml(trace.connection_name ?? trace.pcb_trace_id)}</title></path>`)
        previous = entry
      } else if (entry.route_type === "via") {
        if (previous && enabled.has(previous.layer)) parts.push(`<path d="M ${numeric(previous.x)} ${-numeric(previous.y)} L ${numeric(entry.x)} ${-numeric(entry.y)}" fill="none" stroke="${color([previous.layer])}" stroke-width="${numeric(previous.width) || srj.minTraceWidth}"/>`)
        if (visible([entry.from_layer, entry.to_layer])) parts.push(`<circle data-kind="Existing via" cx="${numeric(entry.x)}" cy="${-numeric(entry.y)}" r="${(entry.outer_diameter ?? entry.via_diameter ?? marker * 3) / 2}" fill="#12222f" stroke="${color([entry.from_layer, entry.to_layer])}" stroke-width="${marker * 0.65}"><title>Existing via · ${escapeHtml(entry.from_layer)} → ${escapeHtml(entry.to_layer)}</title></circle>`)
        previous = { ...entry, layer: entry.to_layer, width: srj.minTraceWidth }
      } else previous = undefined
    }
  }
  for (const connection of srj.connections) {
    const points = connection.pointsToConnect.filter(point => visible(pointLayers(point)))
    const focused = !selectedConnection || connection.name === selectedConnection
    if (showConnections && focused && points.length > 1) for (const point of points.slice(1)) parts.push(`<path data-kind="Connection guide" d="M ${points[0].x} ${-points[0].y} L ${point.x} ${-point.y}" fill="none" stroke="#7fb8f1" opacity=".55" stroke-width="${marker * 0.45}" stroke-dasharray="${marker * 2} ${marker * 2}"/>`)
    if (showTerminals) for (const point of points) parts.push(`<circle data-kind="Terminal" cx="${numeric(point.x)}" cy="${-numeric(point.y)}" r="${marker}" fill="${focused ? "#f2f8ff" : "#6c7b8b"}" opacity="${focused ? "1" : ".35"}" stroke="#276899" stroke-width="${marker * 0.4}"><title>${escapeHtml(connection.name)} · ${escapeHtml(point.pcb_port_id ?? point.pointId ?? "terminal")} · ${escapeHtml(pointLayers(point).join(", "))}</title></circle>`)
  }
  return parts.join("")
}
