import assert from "node:assert/strict"
import { hasBottomComponents, boardGeometrySha256 } from "../lib/dataset.mjs"
const board = { layerCount: 2, minTraceWidth: 0.2, bounds: { minX: -5, maxX: 5, minY: -5, maxY: 5 }, obstacles: [], connections: [] }
const obstacle = { type: "rect", center: { x: 0, y: 0 }, width: 1, height: 1, layers: ["bottom"], connectedTo: ["pcb_smtpad_0", "signal"] }
assert.equal(hasBottomComponents({ ...board, obstacles: [obstacle] }), true)
assert.equal(hasBottomComponents({ ...board, obstacles: [{ ...obstacle, layers: ["top", "bottom"], connectedTo: ["pcb_plated_hole_0", "signal"] }] }), false)
assert.equal(hasBottomComponents({ ...board, connections: [{ name: "signal", pointsToConnect: [{ x: 0, y: 0, layer: "bottom" }] }] }), true)
const copper = { ...board, connections: [{ name: "signal", pointsToConnect: [{ x: 0, y: 0, layer: "bottom" }] }], traces: [{ pcb_trace_id: "t", connection_name: "signal", route: [{ route_type: "wire", x: -1, y: 0, layer: "bottom" }, { route_type: "wire", x: 1, y: 0, layer: "bottom" }] }] }
assert.equal(hasBottomComponents(copper), false)
assert.equal(hasBottomComponents({ ...copper, traces: [{ ...copper.traces[0], connection_name: "unrelated" }] }), true)
assert.equal(boardGeometrySha256({ ...board, obstacles: [obstacle] }), boardGeometrySha256({ ...board, obstacles: [{ ...obstacle, connectedTo: ["renamed"] }] }))
console.log("Bottom-component and duplicate-layout filter tests passed.")
