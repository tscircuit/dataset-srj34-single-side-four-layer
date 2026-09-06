import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const sha256 = value => createHash("sha256").update(value).digest("hex")
export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`
  return JSON.stringify(value)
}

/** Deliberately ignores net/port IDs and routing state to reject repeated board layouts. */
export function boardGeometrySha256(srj) {
  const number = value => Math.round(value * 100000) / 100000
  const obstacles = srj.obstacles.map(obstacle => ({
    type: obstacle.type,
    center: { x: number(obstacle.center.x), y: number(obstacle.center.y) },
    width: number(obstacle.width), height: number(obstacle.height),
    rotation: number(obstacle.ccwRotationDegrees ?? 0), layers: [...obstacle.layers].sort(),
  })).sort((a, b) => canonicalize(a).localeCompare(canonicalize(b)))
  return sha256(canonicalize({ bounds: Object.fromEntries(Object.entries(srj.bounds).map(([key, value]) => [key, number(value)])), obstacles }))
}

export function getSimpleRouteJson(raw, sample) {
  if (sample.srjJsonPointer === "/simple_route_json") return raw.simple_route_json
  if (sample.srjJsonPointer !== undefined && sample.srjJsonPointer !== "") throw new Error(`Unsupported JSON pointer: ${sample.srjJsonPointer}`)
  return raw
}

export async function readSample(sample, root = repositoryRoot) {
  const bytes = await readFile(resolve(root, sample.file))
  if (sha256(bytes) !== sample.sha256) throw new Error(`Source-byte checksum mismatch: ${sample.name}`)
  return getSimpleRouteJson(JSON.parse(bytes.toString()), sample)
}

function classify(obstacle) {
  if (obstacle.isCopperPour) return "other"
  const metadata = obstacle.circuitJsonMetadata
  if (metadata?.pcb_plated_hole_id) return "plated-hole"
  if (metadata?.pcb_smtpad_id) return "pad"
  if (metadata?.pcb_via_id) return "other"
  const identity = obstacle.obstacleId ?? obstacle.connectedTo[0] ?? ""
  if (identity.startsWith("pcb_plated_hole_")) return "plated-hole"
  if (identity.startsWith("pcb_smtpad_")) return "pad"
  if (/^pcb_(trace|via|hole)_/.test(identity)) return "other"
  if (obstacle.connectedTo.length) {
    if (obstacle.layers.includes("top") && obstacle.layers.includes("bottom")) return "plated-hole"
    if (obstacle.layers.length === 1) return "pad"
  }
  return "other"
}

function contains(obstacle, point) {
  const angle = -(obstacle.ccwRotationDegrees ?? 0) * Math.PI / 180
  const dx = point.x - obstacle.center.x, dy = point.y - obstacle.center.y
  const x = dx * Math.cos(angle) - dy * Math.sin(angle), y = dx * Math.sin(angle) + dy * Math.cos(angle)
  return obstacle.type === "oval" ? (x / (obstacle.width / 2)) ** 2 + (y / (obstacle.height / 2)) ** 2 <= 1 + 1e-8
    : Math.abs(x) <= obstacle.width / 2 + 1e-8 && Math.abs(y) <= obstacle.height / 2 + 1e-8
}
function pointTouchesSegment(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) < 1e-7
}

/** Existing bottom copper and plated holes are allowed; bottom SMT components are excluded. */
export function hasBottomComponents(srj) {
  if (srj.obstacles.some(obstacle => classify(obstacle) === "pad" && obstacle.layers.includes("bottom"))) return true
  const parents = new Map()
  const find = id => {
    if (!parents.has(id)) parents.set(id, id)
    const parent = parents.get(id)
    if (parent === id) return id
    const root = find(parent)
    parents.set(id, root)
    return root
  }
  const join = ids => { const filtered = ids.filter(id => typeof id === "string"); if (!filtered.length) return; for (const id of filtered.slice(1)) parents.set(find(id), find(filtered[0])) }
  for (const obstacle of srj.obstacles) join([obstacle.obstacleId, ...obstacle.connectedTo, ...(obstacle.offBoardConnectsTo ?? [])])
  for (const connection of srj.connections) join([connection.name, connection.rootConnectionName, connection.netConnectionName,
    connection.__netConnectionName, ...(connection.mergedConnectionNames ?? []), ...(connection.__rootConnectionNames ?? []),
    ...connection.pointsToConnect.flatMap(point => [point.pointId, point.pcb_port_id])])
  for (const trace of srj.traces ?? []) join([trace.pcb_trace_id, trace.connection_name, ...(trace.connectsTo ?? [])])
  for (const connection of srj.connections) for (const point of connection.pointsToConnect) {
    const layers = point.layers ?? [point.layer]
    if (!layers.includes("bottom") || layers.includes("top")) continue
    const plated = srj.obstacles.some(obstacle => classify(obstacle) === "plated-hole" && contains(obstacle, point))
    const existing = srj.traces?.some(trace => find(trace.connection_name) === find(connection.name) && trace.route.some((item, index) => {
      if (item.route_type === "via") return Math.hypot(item.x - point.x, item.y - point.y) < 1e-7
      if (item.route_type !== "wire" || item.layer !== "bottom") return false
      if (Math.hypot(item.x - point.x, item.y - point.y) < 1e-7) return true
      const next = trace.route[index + 1]
      return next?.route_type === "wire" && next.layer === "bottom" && pointTouchesSegment(point, item, next)
    }))
    if (!plated && !existing) return true
  }
  return false
}
