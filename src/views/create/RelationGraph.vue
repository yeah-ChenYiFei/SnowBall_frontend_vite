<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'
import type { World, WorldEntry, WorldRelation } from '@/types'

/* ================================================================
   Props & Emits
   ================================================================ */
const props = defineProps<{
  worldId: number
  world: World | null
  entries: WorldEntry[]
  relations: WorldRelation[]
  isWorldCreator: boolean
  allTypes: string[]
}>()

const emit = defineEmits<{
  'relations-changed': []
}>()

const router = useRouter()

/* ================================================================
   Constants
   ================================================================ */
const HULL_PALETTE = [
  '#8ecbc9', '#7bb4ea', '#90caf9', '#64b5f6', '#42a5f5',
  '#1e88e5', '#1565c0', '#80cbc4', '#4db6ac', '#26a69a',
  '#a5d6a7', '#66bb6a', '#43a047', '#ef9a9a', '#e57373',
  '#ce93d8', '#ba68c8', '#ab47bc', '#ffab91', '#ff8a65',
]

/* ================================================================
   Derived from props
   ================================================================ */
const relationsRef = computed(() => props.relations)
const entriesRef = computed(() => props.entries)

function getEntryName(id: number) {
  return entriesRef.value.find(e => e.id === id)?.name || '未知'
}

/* ================================================================
   Per-relation customization (localStorage backed)
   ================================================================ */
const LS_PREFIX = `rg:${props.worldId}:`

function lsLoad<T extends Record<string, any>>(suffix: string, target: T): T {
  try {
    const raw = localStorage.getItem(LS_PREFIX + suffix)
    if (raw) Object.assign(target, JSON.parse(raw))
  } catch { /* */ }
  return target
}
function lsSave(suffix: string, data: Record<string, any>) {
  try { localStorage.setItem(LS_PREFIX + suffix, JSON.stringify(data)) } catch { /* */ }
}

const edgeOffsets = reactive<Record<number, number>>({})
const hullColors = reactive<Record<number, string>>({})
// Per-edge bump: `${relId}:${edgeIdx}` → displacement along edge outward-normal
const hullEdgeBumps = reactive<Record<string, number>>({})

function getEdgeOffset(relId: number): number {
  if (edgeOffsets[relId] === undefined) edgeOffsets[relId] = 28
  return edgeOffsets[relId]
}
function getHullColor(relId: number): string {
  if (!hullColors[relId]) hullColors[relId] = '#8ecbc9'
  return hullColors[relId]
}
function getHullEdgeBump(relId: number, edgeIdx: number): number {
  const key = `${relId}:${edgeIdx}`
  if (hullEdgeBumps[key] === undefined) hullEdgeBumps[key] = 0
  return hullEdgeBumps[key]
}
function setHullEdgeBump(relId: number, edgeIdx: number, val: number) {
  hullEdgeBumps[`${relId}:${edgeIdx}`] = val
  saveAll()
}
function saveAll() {
  lsSave('edgeOffsets', edgeOffsets)
  lsSave('hullColors', hullColors)
  lsSave('hullEdgeBumps', hullEdgeBumps)
  lsSave('nodePositions', nodePositions as any)
  lsSave('pan', { x: panX.value, y: panY.value, s: scale.value })
}

/* ================================================================
   Graph State
   ================================================================ */
const graphContainer = ref<HTMLElement | null>(null)
const graphSvg = ref<SVGSVGElement | null>(null)

const panX = ref(0)
const panY = ref(0)
const scale = ref(1)

const nodePositions = reactive<Record<number, { x: number; y: number }>>({})

type DragMode = 'none' | 'pan' | 'node' | 'edge' | 'hull'
const dragMode = ref<DragMode>('none')
const dragTargetId = ref<number | null>(null)   // relId or nodeId
const dragTargetEdgeIdx = ref(0)                 // which edge of the hull is being dragged
const dragStartMouse = ref({ x: 0, y: 0 })
const dragStartLocal = ref({ x: 0, y: 0 })  // group-local position at drag start
const dragStartValue = ref(0)
const dragStartPan = ref({ x: 0, y: 0 })
const dragMoved = ref(false)

const hoveredRelId = ref<number | null>(null)
const hoveredNodeId = ref<number | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })

/* ================================================================
   Graph Computed
   ================================================================ */
const graphNodeIds = computed(() => {
  const set = new Set<number>()
  relationsRef.value.forEach(r => {
    if (r.entryIds && r.entryIds.length > 0) {
      r.entryIds.forEach(id => set.add(id))
    } else {
      set.add(r.fromEntryId); set.add(r.toEntryId)
    }
  })
  return set
})

interface GraphNode { id: number; name: string; x: number; y: number }

const graphNodes = computed<GraphNode[]>(() => {
  const ids = Array.from(graphNodeIds.value)
  const count = ids.length
  if (count === 0) return []
  const cx = 0, cy = 0
  const radius = Math.max(160, count * 22)
  return ids.map((id, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    const baseX = cx + radius * Math.cos(angle)
    const baseY = cy + radius * Math.sin(angle)
    const saved = nodePositions[id]
    return { id, name: getEntryName(id), x: saved ? saved.x : baseX, y: saved ? saved.y : baseY }
  })
})

const nodeMap = computed(() => {
  const m: Record<number, GraphNode> = {}
  graphNodes.value.forEach(n => { m[n.id] = n })
  return m
})

const binaryEdges = computed(() =>
  relationsRef.value
    .filter(r => !r.entryIds || r.entryIds.length <= 2)
    .map(r => ({ id: r.id, fromId: r.fromEntryId, toId: r.toEntryId, direction: r.direction, description: r.description }))
)

const multiGroups = computed(() =>
  relationsRef.value
    .filter(r => r.entryIds && r.entryIds.length > 2)
    .map(r => ({ id: r.id, entryIds: r.entryIds!, description: r.description }))
)

// Dynamic viewBox that fits all nodes with generous padding
const svgViewBox = computed(() => {
  const nodes = graphNodes.value
  if (nodes.length === 0) return '-400 -300 800 600'
  const MARGIN = 200
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x > maxX) maxX = n.x
    if (n.y > maxY) maxY = n.y
  }
  // Account for convex hull padding (PAD=70) + node radius (~24) + extra for bumped edges (~120)
  const PAD = 250
  const x = Math.floor(minX - PAD)
  const y = Math.floor(minY - PAD)
  const w = Math.ceil(maxX - minX + PAD * 2)
  const h = Math.ceil(maxY - minY + PAD * 2)
  return `${x} ${y} ${w} ${h}`
})

// Whether we've done the initial auto-center
const didInitialCenter = ref(false)

function tryAutoCenter() {
  if (didInitialCenter.value) return
  const nodes = graphNodes.value
  if (nodes.length === 0) return
  didInitialCenter.value = true
  // Check if we have a saved pan
  const savedPan = lsLoad('pan', {} as Record<string, number>)
  if (savedPan.x !== undefined) {
    panX.value = savedPan.x
    panY.value = savedPan.y
    scale.value = savedPan.s || 1
  }
}

/* ================================================================
   Geometry helpers
   ================================================================ */
interface Point { x: number; y: number }
function cross(o: Point, a: Point, b: Point): number { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x) }

function convexHull(points: Point[]): Point[] {
  if (points.length <= 2) return [...points]
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const lower: Point[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Point[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop(); upper.pop()
  return [...lower, ...upper]
}

function hullPath(entryIds: number[], relId: number): string | null {
  const nodes = entryIds.map(id => nodeMap.value[id]).filter(Boolean) as Point[]
  if (nodes.length < 3) return null
  const hull = convexHull(nodes)
  if (hull.length < 3) return null

  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length
  const PAD = 70
  const n = hull.length

  // Collect raw per-edge bumps; smooth with Gaussian falloff so
  // pulling one edge blends naturally into its neighbours.
  const rawBumps: number[] = []
  for (let i = 0; i < n; i++) rawBumps.push(getHullEdgeBump(relId, i))

  // 3-tap smooth: each edge's effective bump is a weighted sum of
  // itself and its two neighbours.
  const smoothBumps: number[] = []
  for (let i = 0; i < n; i++) {
    const prev = rawBumps[(i - 1 + n) % n]
    const self = rawBumps[i]
    const next = rawBumps[(i + 1) % n]
    smoothBumps.push(0.25 * prev + 0.5 * self + 0.25 * next)
  }

  // Each vertex belongs to two edges; its bump is the average of the
  // smoothed bumps from its incident edges.
  const vertexBumps: number[] = []
  for (let i = 0; i < n; i++) {
    vertexBumps.push((smoothBumps[(i - 1 + n) % n] + smoothBumps[i]) / 2)
  }

  // Expand hull vertices outward from centroid, plus vertex bump.
  const pts = hull.map((p, i) => {
    const dx = p.x - cx, dy = p.y - cy
    const dist = Math.hypot(dx, dy)
    const extra = vertexBumps[i]
    return dist === 0
      ? { x: p.x, y: p.y }
      : { x: p.x + (dx / dist) * (PAD + extra), y: p.y + (dy / dist) * (PAD + extra) }
  })

  // Catmull–Rom → cubic Bézier (C1 smooth through every vertex)
  const baseCurve = 0.8
  const tans: Point[] = pts.map((_, i) => {
    const prev = pts[(i - 1 + n) % n]
    const next = pts[(i + 1) % n]
    return { x: next.x - prev.x, y: next.y - prev.y }
  })

  const k = baseCurve / 3
  let d = ''
  for (let i = 0; i < n; i++) {
    const p0 = pts[i]
    const p1 = pts[(i + 1) % n]
    const t0 = tans[i]
    const t1 = tans[(i + 1) % n]

    if (i === 0) d += `M ${p0.x} ${p0.y}`
    d += ` C ${p0.x + t0.x * k} ${p0.y + t0.y * k}`
    d += ` ${p1.x - t1.x * k} ${p1.y - t1.y * k}`
    d += ` ${p1.x} ${p1.y}`
  }
  d += ' Z'
  return d
}

// Find which edge of the expanded hull polygon is closest to point `p`.
// Returns [edgeIdx, distance].
function closestHullEdge(entryIds: number[], p: Point): { idx: number; dist: number } | null {
  const nodes = entryIds.map(id => nodeMap.value[id]).filter(Boolean) as Point[]
  if (nodes.length < 3) return null
  const hull = convexHull(nodes)
  if (hull.length < 3) return null
  const cx = hull.reduce((s, pt) => s + pt.x, 0) / hull.length
  const cy = hull.reduce((s, pt) => s + pt.y, 0) / hull.length
  const PAD = 70
  const pts = hull.map(pt => {
    const dx = pt.x - cx, dy = pt.y - cy
    const dist = Math.hypot(dx, dy)
    return dist === 0 ? { x: pt.x, y: pt.y } : { x: pt.x + (dx / dist) * PAD, y: pt.y + (dy / dist) * PAD }
  })
  const n = pts.length
  let bestIdx = 0, bestDist = Infinity
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    const abx = b.x - a.x, aby = b.y - a.y
    const lenSq = abx * abx + aby * aby
    let t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq))
    const projx = a.x + t * abx, projy = a.y + t * aby
    const d = Math.hypot(p.x - projx, p.y - projy)
    if (d < bestDist) { bestDist = d; bestIdx = i }
  }
  return { idx: bestIdx, dist: bestDist }
}

function edgePath(fromId: number, toId: number, relId: number): string | null {
  const a = nodeMap.value[fromId], b = nodeMap.value[toId]
  if (!a || !b) return null
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len, py = dx / len
  const off = getEdgeOffset(relId)
  const cx = mx + px * off, cy = my + py * off
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
}

function bezierPoint(a: Point, ctrl: Point, b: Point, t: number): Point {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x, y: u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y }
}
function bezierTangent(a: Point, ctrl: Point, b: Point, t: number): Point {
  const u = 1 - t
  return { x: 2 * u * (ctrl.x - a.x) + 2 * t * (b.x - ctrl.x), y: 2 * u * (ctrl.y - a.y) + 2 * t * (b.y - ctrl.y) }
}

function edgeControlPoint(fromId: number, toId: number, relId: number): Point | null {
  const a = nodeMap.value[fromId], b = nodeMap.value[toId]
  if (!a || !b) return null
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len, py = dx / len
  const off = getEdgeOffset(relId)
  return { x: mx + px * off, y: my + py * off }
}

/* ================================================================
   SVG coordinate helpers
   ================================================================ */
function getSvgPoint(e: MouseEvent): { x: number; y: number } {
  const svg = graphSvg.value
  if (!svg) return { x: e.clientX, y: e.clientY }
  const pt = svg.createSVGPoint()
  pt.x = e.clientX; pt.y = e.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: e.clientX, y: e.clientY }
  const r = pt.matrixTransform(ctm.inverse())
  return { x: r.x, y: r.y }
}

function svgToLocal(svgX: number, svgY: number): Point {
  return { x: (svgX - panX.value) / scale.value, y: (svgY - panY.value) / scale.value }
}

/* ================================================================
   Unified mouse handlers
   ================================================================ */
const CLICK_THRESHOLD = 4

function onSvgMouseDown(e: MouseEvent) {
  const t = e.target as SVGElement
  if (dragMode.value !== 'none') return
  if (t.classList.contains('graph-bg') || t.classList.contains('graph-root')) {
    dragMode.value = 'pan'
    dragStartPan.value = { x: panX.value, y: panY.value }
    dragStartMouse.value = { x: e.clientX, y: e.clientY }
    dragMoved.value = false
  }
}

function onSvgMouseMove(e: MouseEvent) {
  if (dragMode.value === 'none') return

  const dx = e.clientX - dragStartMouse.value.x
  const dy = e.clientY - dragStartMouse.value.y
  if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) {
    dragMoved.value = true
  }

  if (dragMode.value === 'pan') {
    panX.value = dragStartPan.value.x + dx
    panY.value = dragStartPan.value.y + dy
  } else if (dragMode.value === 'node' && dragTargetId.value !== null) {
    const svgPt = getSvgPoint(e)
    const local = svgToLocal(svgPt.x, svgPt.y)
    const id = dragTargetId.value
    if (nodePositions[id]) {
      nodePositions[id].x = local.x
      nodePositions[id].y = local.y
    }
  } else if (dragMode.value === 'edge' && dragTargetId.value !== null) {
    const svgPt = getSvgPoint(e)
    const local = svgToLocal(svgPt.x, svgPt.y)
    const edge = binaryEdges.value.find(be => be.id === dragTargetId.value)
    if (edge) {
      const a = nodeMap.value[edge.fromId], b = nodeMap.value[edge.toId]
      if (a && b) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        const gdx = b.x - a.x, gdy = b.y - a.y
        const len = Math.hypot(gdx, gdy) || 1
        const px = -gdy / len, py = gdx / len
        const rx = local.x - mx, ry = local.y - my
        const dist = rx * px + ry * py
        edgeOffsets[dragTargetId.value] = Math.round(dist)
        saveAll()
      }
    }
  } else if (dragMode.value === 'hull' && dragTargetId.value !== null) {
    const svgPt = getSvgPoint(e)
    const local = svgToLocal(svgPt.x, svgPt.y)
    const mg = multiGroups.value.find(g => g.id === dragTargetId.value)
    if (mg) {
      const deltaX = local.x - dragStartLocal.value.x
      const deltaY = local.y - dragStartLocal.value.y

      // Get the dragged edge's outward normal
      const nodes = mg.entryIds.map(id => nodeMap.value[id]).filter(Boolean) as Point[]
      const hull = convexHull(nodes)
      const cx = hull.reduce((s, pt) => s + pt.x, 0) / hull.length
      const cy = hull.reduce((s, pt) => s + pt.y, 0) / hull.length
      const PAD = 70
      const pts = hull.map(pt => {
        const dx = pt.x - cx, dy = pt.y - cy
        const dist = Math.hypot(dx, dy)
        return dist === 0 ? { x: pt.x, y: pt.y } : { x: pt.x + (dx / dist) * PAD, y: pt.y + (dy / dist) * PAD }
      })
      const i = dragTargetEdgeIdx.value
      const p0 = pts[i], p1 = pts[(i + 1) % pts.length]
      const emx = (p0.x + p1.x) / 2, emy = (p0.y + p1.y) / 2
      const edx = p1.x - p0.x, edy = p1.y - p0.y
      let nx = edy, ny = -edx
      if (nx * (emx - cx) + ny * (emy - cy) < 0) { nx = -nx; ny = -ny }
      const nlen = Math.hypot(nx, ny) || 1
      nx /= nlen; ny /= nlen

      // Project delta onto edge outward normal
      const bumpDelta = deltaX * nx + deltaY * ny
      const relId = dragTargetId.value
      const newBump = Math.round((dragStartValue.value + bumpDelta) * 10) / 10
      setHullEdgeBump(relId, i, Math.max(-80, Math.min(120, newBump)))
    }
  }
}

function onSvgMouseUp() {
  if (dragMode.value === 'none') return
  if (!dragMoved.value && dragTargetId.value !== null) {
    if (dragMode.value === 'edge' || dragMode.value === 'hull') {
      const r = relationsRef.value.find(r => r.id === dragTargetId.value)
      if (r) openEditModal(r)
    }
  }
  // Save after any drag that could have changed state
  if (dragMoved.value) saveAll()
  dragMode.value = 'none'
  dragTargetId.value = null
}

function onNodeDragStart(e: MouseEvent, nodeId: number) {
  e.stopPropagation(); e.preventDefault()
  dragMode.value = 'node'
  dragTargetId.value = nodeId
  dragStartMouse.value = { x: e.clientX, y: e.clientY }
  dragMoved.value = false
  if (!nodePositions[nodeId]) {
    const node = graphNodes.value.find(n => n.id === nodeId)
    if (node) nodePositions[nodeId] = { x: node.x, y: node.y }
  }
}

function onEdgeDragStart(e: MouseEvent, relId: number) {
  e.stopPropagation(); e.preventDefault()
  dragMode.value = 'edge'
  dragTargetId.value = relId
  dragStartMouse.value = { x: e.clientX, y: e.clientY }
  dragStartValue.value = getEdgeOffset(relId)
  dragMoved.value = false
}

function onHullDragStart(e: MouseEvent, relId: number) {
  e.stopPropagation(); e.preventDefault()
  const svgPt = getSvgPoint(e)
  const local = svgToLocal(svgPt.x, svgPt.y)
  const mg = multiGroups.value.find(g => g.id === relId)
  if (!mg) return
  const edge = closestHullEdge(mg.entryIds, local)
  if (!edge) return

  dragMode.value = 'hull'
  dragTargetId.value = relId
  dragTargetEdgeIdx.value = edge.idx
  dragStartMouse.value = { x: e.clientX, y: e.clientY }
  dragStartLocal.value = { x: local.x, y: local.y }
  dragStartValue.value = getHullEdgeBump(relId, edge.idx)
  dragMoved.value = false
}

function onHullFillClick(e: MouseEvent, relId: number) {
  e.stopPropagation()
  const r = relationsRef.value.find(r => r.id === relId)
  if (r) openEditModal(r)
}

function onEdgeVisualClick(e: MouseEvent, relId: number) {
  e.stopPropagation()
  if (!dragMoved.value) {
    const r = relationsRef.value.find(r => r.id === relId)
    if (r) openEditModal(r)
  }
}

function onGraphWheel(e: WheelEvent) {
  e.preventDefault()
  const svgPt = getSvgPoint(e)
  const oldScale = scale.value
  const delta = -e.deltaY * 0.001
  const newScale = Math.max(0.2, Math.min(3, oldScale * (1 + delta)))
  panX.value = panX.value + (oldScale - newScale) * svgPt.x
  panY.value = panY.value + (oldScale - newScale) * svgPt.y
  scale.value = newScale
}

function onBorderEnter(e: MouseEvent, relId: number) {
  hoveredRelId.value = relId
  const rect = (graphSvg.value as any)?.getBoundingClientRect?.()
  if (rect) {
    tooltipPos.value = { x: e.clientX - rect.left, y: e.clientY - rect.top - 40 }
  }
}
function onBorderLeave() {
  hoveredRelId.value = null
}

/* ================================================================
   Relation CRUD
   ================================================================ */
const directionLabel: Record<string, string> = { LEFT_ARROW: '←', RIGHT_ARROW: '→', BIDIRECTIONAL: '↔' }

// ---- Create modal ----
const showCreateModal = ref(false)
const createForm = ref({ entryIds: [] as number[], direction: 'BIDIRECTIONAL', description: '' })
const createSearch = ref(''); const createType = ref(''); const createMsg = ref(''); const createSaving = ref(false)

const filteredCreateEntries = computed(() => {
  let list = entriesRef.value
  if (createType.value) list = list.filter(e => e.type === createType.value)
  if (createSearch.value) list = list.filter(e => e.name.includes(createSearch.value))
  return list
})
function toggleCreateEntry(id: number) {
  const idx = createForm.value.entryIds.indexOf(id)
  if (idx >= 0) createForm.value.entryIds.splice(idx, 1)
  else createForm.value.entryIds.push(id)
}
function openCreateModal() {
  createForm.value = { entryIds: [], direction: 'BIDIRECTIONAL', description: '' }
  createSearch.value = ''; createType.value = ''; createMsg.value = ''
  showCreateModal.value = true
}
async function handleCreate() {
  const ids = createForm.value.entryIds
  if (ids.length < 2) { createMsg.value = '请至少选择两个设定'; return }
  if (!createForm.value.description.trim()) { createMsg.value = '请输入关系描述'; return }
  createSaving.value = true
  try {
    const body: any = {
      fromEntryId: ids[0], toEntryId: ids.length >= 2 ? ids[1] : ids[0],
      direction: createForm.value.direction, description: createForm.value.description,
    }
    if (ids.length > 2) body.entryIds = ids
    await http.post(`/worlds/${props.worldId}/relations`, body)
    showCreateModal.value = false
    emit('relations-changed')
  } catch (e: any) { createMsg.value = e.message || '创建失败' }
  finally { createSaving.value = false }
}

// ---- Edit modal ----
const showEditModal = ref(false)
const editRel = ref<WorldRelation | null>(null)
const editForm = ref({ entryIds: [] as number[], direction: 'BIDIRECTIONAL', description: '' })
const editSearch = ref(''); const editType = ref(''); const editMsg = ref(''); const editSaving = ref(false)
const editHullColor = ref('#8ecbc9')

const filteredEditEntries = computed(() => {
  let list = entriesRef.value
  if (editType.value) list = list.filter(e => e.type === editType.value)
  if (editSearch.value) list = list.filter(e => e.name.includes(editSearch.value))
  return list
})
function toggleEditEntry(id: number) {
  const idx = editForm.value.entryIds.indexOf(id)
  if (idx >= 0) editForm.value.entryIds.splice(idx, 1)
  else editForm.value.entryIds.push(id)
}
function openEditModal(r: WorldRelation) {
  editRel.value = r
  const ids = r.entryIds && r.entryIds.length > 0 ? [...r.entryIds] : [r.fromEntryId, r.toEntryId]
  editForm.value = { entryIds: ids, direction: r.direction, description: r.description }
  editSearch.value = ''; editType.value = ''; editMsg.value = ''
  if (ids.length > 2) {
    editHullColor.value = getHullColor(r.id)
  }
  showEditModal.value = true
}
async function handleEdit() {
  const ids = editForm.value.entryIds
  if (ids.length < 2) { editMsg.value = '请至少选择两个设定'; return }
  if (!editForm.value.description.trim()) { editMsg.value = '请输入关系描述'; return }
  editSaving.value = true
  try {
    const body: any = {
      fromEntryId: ids[0], toEntryId: ids.length >= 2 ? ids[1] : ids[0],
      direction: editForm.value.direction, description: editForm.value.description,
    }
    if (ids.length > 2) body.entryIds = ids
    else body.entryIds = null
    await http.put(`/worlds/${props.worldId}/relations/${editRel.value!.id}`, body)

    if (ids.length > 2) {
      hullColors[editRel.value!.id] = editHullColor.value
      saveAll()
    }

    showEditModal.value = false
    emit('relations-changed')
  } catch (e: any) { editMsg.value = e.message || '保存失败' }
  finally { editSaving.value = false }
}
async function handleDelete(r: WorldRelation) {
  if (!confirm('确定删除这条关系吗？')) return
  try {
    await http.delete(`/worlds/${props.worldId}/relations/${r.id}`)
    showEditModal.value = false
    emit('relations-changed')
  } catch { /* */ }
}

/* ================================================================
   Hovered relation info
   ================================================================ */
const hoveredRelation = computed(() => {
  if (!hoveredRelId.value) return null
  return relationsRef.value.find(r => r.id === hoveredRelId.value) || null
})

/* ================================================================
   Load persisted state (runs once during setup)
   ================================================================ */
lsLoad('edgeOffsets', edgeOffsets)
lsLoad('hullColors', hullColors)
lsLoad('hullEdgeBumps', hullEdgeBumps)
lsLoad('nodePositions', nodePositions as any)

// Initial pan: load saved or auto-center once nodes appear
watch(graphNodes, () => tryAutoCenter(), { immediate: true })
</script>

<template>
  <div class="rg-root">
    <div class="rg-main">
      <!-- LEFT: Relation List -->
      <aside class="rg-sidebar">
        <div class="rg-sidebar-header">
          <h3>关系列表</h3>
          <span class="rg-count">{{ relations.length }}</span>
        </div>
        <div v-if="relations.length === 0" class="rg-empty">暂无关系，点击下方按钮添加</div>
        <div class="rg-rel-list">
          <div
            v-for="r in relations" :key="r.id"
            :class="['rg-rel-item', { hovered: hoveredRelId === r.id }]"
            @mouseenter="hoveredRelId = r.id"
            @mouseleave="hoveredRelId = null"
          >
            <div class="rg-rel-item-main" @click="openEditModal(r)">
              <template v-if="r.entryIds && r.entryIds.length > 2">
                <span class="rg-rel-entries">
                  {{ (r.entryNames && r.entryNames.length > 0 ? r.entryNames : r.entryIds.map(id => getEntryName(id))).join(' · ') }}
                </span>
              </template>
              <template v-else>
                <span class="rg-rel-entry">{{ r.fromEntryName }}</span>
                <span class="rg-rel-arrow">{{ directionLabel[r.direction] || '—' }}</span>
                <span class="rg-rel-entry">{{ r.toEntryName }}</span>
              </template>
              <span class="rg-rel-desc">{{ r.description }}</span>
            </div>
            <div class="rg-rel-actions">
              <button class="rg-btn-icon" title="编辑" @click.stop="openEditModal(r)">✏️</button>
              <button v-if="isWorldCreator" class="rg-btn-icon rg-btn-del" title="删除" @click.stop="handleDelete(r)">✕</button>
            </div>
          </div>
        </div>
        <button class="rg-add-btn" @click="openCreateModal">
          <span>+</span><span>添加关系</span>
        </button>
      </aside>

      <!-- RIGHT: Graph -->
      <section class="rg-graph-area">
        <transition name="tooltip-fade">
          <div v-if="hoveredRelation" class="rg-tooltip" :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }">
            <template v-if="hoveredRelation.entryIds && hoveredRelation.entryIds.length > 2">
              <span class="rg-tt-entries">
                {{ (hoveredRelation.entryNames && hoveredRelation.entryNames.length > 0 ? hoveredRelation.entryNames : hoveredRelation.entryIds.map(id => getEntryName(id))).join(' · ') }}
              </span>
            </template>
            <template v-else>
              <span class="rg-tt-entry">{{ hoveredRelation.fromEntryName }}</span>
              <span class="rg-tt-arrow">{{ directionLabel[hoveredRelation.direction] || '—' }}</span>
              <span class="rg-tt-entry">{{ hoveredRelation.toEntryName }}</span>
            </template>
            <span class="rg-tt-desc">{{ hoveredRelation.description }}</span>
          </div>
        </transition>

        <div v-if="relations.length === 0" class="rg-graph-empty">暂无关系数据，请先在左侧添加关系</div>

        <div v-else ref="graphContainer" class="rg-graph-container">
          <svg
            ref="graphSvg" class="rg-svg" :viewBox="svgViewBox"
            @mousedown="onSvgMouseDown" @mousemove="onSvgMouseMove"
            @mouseup="onSvgMouseUp" @mouseleave="onSvgMouseUp"
            @wheel.prevent="onGraphWheel"
          >
            <rect class="graph-bg" x="-10000" y="-10000" width="20000" height="20000" fill="transparent" />
            <g class="graph-root" :transform="`translate(${panX},${panY}) scale(${scale})`">

              <!-- Multi-entry convex hulls: visible line + invisible hit area -->
              <g v-for="mg in multiGroups" :key="'mg-'+mg.id">
                <!-- Visible stroke (decorative only, non-interactive) -->
                <path
                  v-if="hullPath(mg.entryIds, mg.id)"
                  :d="hullPath(mg.entryIds, mg.id)!"
                  :class="['rg-hull-vis', { hov: hoveredRelId === mg.id }]"
                  :style="{ stroke: getHullColor(mg.id) }"
                />
                <!-- Hit area: wide transparent stroke, stroke-only pointer-events -->
                <path
                  v-if="hullPath(mg.entryIds, mg.id)"
                  :d="hullPath(mg.entryIds, mg.id)!"
                  class="rg-hull-hit"
                  @click.stop="onHullFillClick($event, mg.id)"
                  @mouseenter="(e: MouseEvent) => onBorderEnter(e, mg.id)"
                  @mouseleave="onBorderLeave"
                  @mousedown="(e: MouseEvent) => onHullDragStart(e, mg.id)"
                />
              </g>

              <!-- Binary edges -->
              <g v-for="edge in binaryEdges" :key="'be-'+edge.id">
                <path
                  v-if="edgePath(edge.fromId, edge.toId, edge.id)"
                  :d="edgePath(edge.fromId, edge.toId, edge.id)!"
                  class="rg-edge-hit"
                  @mouseenter="(e: MouseEvent) => onBorderEnter(e, edge.id)"
                  @mouseleave="onBorderLeave"
                  @mousedown="(e: MouseEvent) => onEdgeDragStart(e, edge.id)"
                />
                <path
                  v-if="edgePath(edge.fromId, edge.toId, edge.id)"
                  :d="edgePath(edge.fromId, edge.toId, edge.id)!"
                  :class="['rg-edge-visual', { hov: hoveredRelId === edge.id }]"
                  @click.stop="onEdgeVisualClick($event, edge.id)"
                />
                <g v-if="edgeControlPoint(edge.fromId, edge.toId, edge.id) && nodeMap[edge.fromId] && nodeMap[edge.toId]"
                   :transform="(() => {
                     const cp = edgeControlPoint(edge.fromId, edge.toId, edge.id)!
                     const a = nodeMap[edge.fromId]; const b = nodeMap[edge.toId]
                     const pt = bezierPoint({x:a.x,y:a.y}, cp, {x:b.x,y:b.y}, 0.5)
                     const tg = bezierTangent({x:a.x,y:a.y}, cp, {x:b.x,y:b.y}, 0.5)
                     const angle = Math.atan2(tg.y, tg.x) * 180 / Math.PI
                     return `translate(${pt.x},${pt.y}) rotate(${angle})`
                   })()"
                   :class="['rg-arrow-g', { hov: hoveredRelId === edge.id }]"
                   style="pointer-events:none"
                >
                  <polygon points="0,0 -8,-4 -8,4" class="rg-arrow" />
                </g>
                <circle
                  v-if="edgeControlPoint(edge.fromId, edge.toId, edge.id) && hoveredRelId === edge.id"
                  :cx="edgeControlPoint(edge.fromId, edge.toId, edge.id)!.x"
                  :cy="edgeControlPoint(edge.fromId, edge.toId, edge.id)!.y"
                  r="6"
                  class="rg-edge-handle"
                  @mousedown.stop="(e: MouseEvent) => onEdgeDragStart(e, edge.id)"
                />
              </g>

              <!-- Nodes -->
              <g
                v-for="node in graphNodes" :key="'n-'+node.id"
                :class="['rg-node-g', { hov: hoveredNodeId === node.id || hoveredRelId !== null }]"
                @mousedown="(e: MouseEvent) => onNodeDragStart(e, node.id)"
                @mouseenter="hoveredNodeId = node.id"
                @mouseleave="hoveredNodeId = null"
                @dblclick="router.push(`/create/setting/${worldId}/entry/${node.id}`)"
              >
                <circle :cx="node.x" :cy="node.y" :r="hoveredNodeId === node.id ? 24 : 20" class="rg-node" />
                <text :x="node.x" :y="node.y + 5" class="rg-node-text" text-anchor="middle">{{ node.name.length > 3 ? node.name.slice(0,3)+'..' : node.name }}</text>
                <text :x="node.x" :y="node.y + 36" class="rg-node-label" text-anchor="middle">{{ node.name }}</text>
              </g>
            </g>
          </svg>
        </div>
      </section>
    </div>

    <!-- ===== CREATE MODAL ===== -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
          <div class="modal-box modal-lg">
            <div class="modal-header"><h2>新建关系</h2><button class="btn-close" @click="showCreateModal = false">✕</button></div>
            <div v-if="createMsg" class="modal-error">{{ createMsg }}</div>
            <div class="rg-create-preview">
              <div class="rg-create-preview-label">
                已选 {{ createForm.entryIds.length }} 个设定
                <span v-if="createForm.entryIds.length >= 2" class="rg-preview-hint">
                  （{{ createForm.entryIds.length === 2 ? '将绘制连线' : '将绘制凸包' }}）
                </span>
              </div>
              <div class="rg-create-chips">
                <span v-for="id in createForm.entryIds" :key="id" class="rg-create-chip">
                  {{ getEntryName(id) }}
                  <button class="rg-chip-x" @click="toggleCreateEntry(id)">×</button>
                </span>
              </div>
            </div>
            <div v-if="createForm.entryIds.length === 2" class="rg-direction-row">
              <label>方向</label>
              <div class="rg-dir-btns">
                <button :class="{ active: createForm.direction === 'LEFT_ARROW' }" @click="createForm.direction = 'LEFT_ARROW'">←</button>
                <button :class="{ active: createForm.direction === 'BIDIRECTIONAL' }" @click="createForm.direction = 'BIDIRECTIONAL'">↔</button>
                <button :class="{ active: createForm.direction === 'RIGHT_ARROW' }" @click="createForm.direction = 'RIGHT_ARROW'">→</button>
              </div>
            </div>
            <div class="form-row">
              <label>关系描述</label>
              <input v-model="createForm.description" class="form-input" placeholder="如：师徒、父子、宿敌..." />
            </div>
            <div class="rg-picker-panel">
              <div class="rg-picker-header">选择设定</div>
              <div class="rg-picker-filters">
                <div class="type-chips">
                  <button v-for="t in allTypes" :key="t" :class="['type-chip', { active: createType === t }]" @click="createType = createType === t ? '' : t">{{ t }}</button>
                </div>
                <input v-model="createSearch" class="form-input form-input-sm" placeholder="搜索..." />
              </div>
              <div class="rg-picker-list">
                <div v-for="e in filteredCreateEntries" :key="e.id" :class="['rg-picker-item', { sel: createForm.entryIds.includes(e.id) }]" @click="toggleCreateEntry(e.id)">
                  <span class="rg-picker-check">{{ createForm.entryIds.includes(e.id) ? '☑' : '☐' }}</span>
                  <span>{{ e.name }}</span>
                  <span class="rg-picker-type">{{ e.type }}</span>
                </div>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn-cancel" @click="showCreateModal = false">取消</button>
              <button class="wd-btn-primary" @click="handleCreate" :disabled="createSaving">{{ createSaving ? '创建中...' : '确认' }}</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- ===== EDIT MODAL ===== -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
          <div class="modal-box modal-lg">
            <div class="modal-header"><h2>编辑关系</h2><button class="btn-close" @click="showEditModal = false">✕</button></div>
            <div v-if="editMsg" class="modal-error">{{ editMsg }}</div>

            <div class="rg-create-preview">
              <div class="rg-create-preview-label">
                已选 {{ editForm.entryIds.length }} 个设定
                <span v-if="editForm.entryIds.length >= 2" class="rg-preview-hint">
                  （{{ editForm.entryIds.length === 2 ? '将绘制连线' : '将绘制凸包' }}）
                </span>
              </div>
              <div class="rg-create-chips">
                <span v-for="id in editForm.entryIds" :key="id" class="rg-create-chip">
                  {{ getEntryName(id) }}
                  <button class="rg-chip-x" @click="toggleEditEntry(id)">×</button>
                </span>
              </div>
            </div>
            <div v-if="editForm.entryIds.length === 2" class="rg-direction-row">
              <label>方向</label>
              <div class="rg-dir-btns">
                <button :class="{ active: editForm.direction === 'LEFT_ARROW' }" @click="editForm.direction = 'LEFT_ARROW'">←</button>
                <button :class="{ active: editForm.direction === 'BIDIRECTIONAL' }" @click="editForm.direction = 'BIDIRECTIONAL'">↔</button>
                <button :class="{ active: editForm.direction === 'RIGHT_ARROW' }" @click="editForm.direction = 'RIGHT_ARROW'">→</button>
              </div>
            </div>
            <div class="form-row">
              <label>关系描述</label>
              <input v-model="editForm.description" class="form-input" placeholder="关系描述..." />
            </div>

            <!-- Color & curvature customization (multi-entry only) -->
            <div v-if="editForm.entryIds.length > 2" class="rg-hull-custom">
              <div class="rg-hc-row">
                <label>凸包颜色</label>
                <div class="rg-hc-palette">
                  <button
                    v-for="c in HULL_PALETTE" :key="c"
                    :class="['rg-hc-swatch', { active: editHullColor === c }]"
                    :style="{ background: c }"
                    @click="editHullColor = c"
                  />
                </div>
              </div>
              <div class="rg-hc-row">
                <label>边凹凸</label>
                <button class="rg-hc-reset-btn" @click="() => {
                  if (editRel) {
                    const n = editForm.entryIds.length
                    for (let i = 0; i < n; i++) setHullEdgeBump(editRel.id, i, 0)
                  }
                }">重置所有边</button>
                <span class="rg-hc-hint">拖拽凸包边可单独调整</span>
              </div>
            </div>

            <div class="rg-picker-panel">
              <div class="rg-picker-header">调整设定</div>
              <div class="rg-picker-filters">
                <div class="type-chips">
                  <button v-for="t in allTypes" :key="t" :class="['type-chip', { active: editType === t }]" @click="editType = editType === t ? '' : t">{{ t }}</button>
                </div>
                <input v-model="editSearch" class="form-input form-input-sm" placeholder="搜索..." />
              </div>
              <div class="rg-picker-list">
                <div v-for="e in filteredEditEntries" :key="e.id" :class="['rg-picker-item', { sel: editForm.entryIds.includes(e.id) }]" @click="toggleEditEntry(e.id)">
                  <span class="rg-picker-check">{{ editForm.entryIds.includes(e.id) ? '☑' : '☐' }}</span>
                  <span>{{ e.name }}</span>
                  <span class="rg-picker-type">{{ e.type }}</span>
                </div>
              </div>
            </div>

            <div class="modal-actions">
              <button v-if="isWorldCreator" class="btn-danger" @click="handleDelete(editRel!)">删除</button>
              <div class="modal-actions-right">
                <button class="btn-cancel" @click="showEditModal = false">取消</button>
                <button class="wd-btn-primary" @click="handleEdit" :disabled="editSaving">{{ editSaving ? '保存中...' : '保存' }}</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped>
/* ===== ROOT ===== */
.rg-root { width: 100%; height: 100%; }
.rg-main { display: flex; gap: 16px; flex: 1; height: 100%; }

/* ===== LEFT SIDEBAR ===== */
.rg-sidebar { width: 260px; min-width: 220px; flex-shrink: 0; background: #fff; border: 1px solid #e8eaed; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
.rg-sidebar-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px 8px; }
.rg-sidebar-header h3 { margin: 0; font-size: 15px; color: #202124; }
.rg-count { font-size: 11px; padding: 2px 8px; background: #e8f0fe; color: #1a73e8; border-radius: 10px; font-weight: 500; }
.rg-empty { text-align: center; color: #999; font-size: 12px; padding: 20px 12px; }
.rg-rel-list { flex: 1; overflow-y: auto; padding: 0 10px 6px; }
.rg-rel-item { display: flex; align-items: center; gap: 4px; padding: 8px 10px; margin-bottom: 4px; border-radius: 8px; cursor: pointer; border: 1px solid #e8eaed; background: #fafafa; transition: all 0.15s; }
.rg-rel-item:hover, .rg-rel-item.hovered { border-color: #5b9bd5; background: #f0f6ff; box-shadow: 0 1px 4px rgba(91,155,213,0.12); }
.rg-rel-item-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; font-size: 12px; }
.rg-rel-entry { font-weight: 500; color: #202124; white-space: nowrap; }
.rg-rel-entries { font-weight: 500; color: #202124; font-size: 11px; }
.rg-rel-arrow { font-weight: 700; color: #1a73e8; font-size: 13px; }
.rg-rel-desc { color: #999; font-size: 11px; margin-left: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }
.rg-rel-actions { display: flex; gap: 1px; flex-shrink: 0; }
.rg-btn-icon { background: none; border: none; font-size: 11px; color: #999; cursor: pointer; padding: 2px 3px; border-radius: 4px; }
.rg-btn-icon:hover { color: #1a73e8; background: #e8f0fe; }
.rg-btn-icon.rg-btn-del:hover { color: #d93025; background: #fce8e6; }
.rg-add-btn { display: flex; align-items: center; justify-content: center; gap: 4px; margin: 6px 12px 10px; padding: 8px; background: #e8f0fe; color: #1a73e8; border: 2px dashed #a8c7fa; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.rg-add-btn:hover { background: #d2e3fc; border-color: #1a73e8; }
.rg-add-btn span:first-child { font-size: 16px; font-weight: 300; }

/* ===== RIGHT GRAPH AREA ===== */
.rg-graph-area { flex: 1; position: relative; min-width: 0; background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
.rg-graph-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 14px; }
.rg-graph-container { width: 100%; height: 100%; cursor: grab; }
.rg-graph-container:active { cursor: grabbing; }
.rg-svg { width: 100%; height: 100%; display: block; }

/* Tooltip */
.rg-tooltip { position: absolute; z-index: 10; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: rgba(32,33,36,0.88); color: #fff; border-radius: 8px; font-size: 13px; white-space: nowrap; pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.rg-tt-entry { font-weight: 500; }
.rg-tt-entries { font-weight: 500; }
.rg-tt-arrow { font-weight: 700; color: #8bc4f0; margin: 0 2px; }
.rg-tt-desc { color: #bdc1c6; margin-left: 4px; }
.tooltip-fade-enter-active { transition: opacity 0.15s; }
.tooltip-fade-leave-active { transition: opacity 0.1s; }
.tooltip-fade-enter-from, .tooltip-fade-leave-to { opacity: 0; }

/* ===== GRAPH ELEMENTS ===== */
.rg-node { fill: #1a3994; stroke: #fff; stroke-width: 3; cursor: grab; transition: r 0.2s, stroke-width 0.2s; }
.rg-node-g.hov .rg-node { stroke-width: 4; filter: brightness(1.15); }
.rg-node-g:active .rg-node { cursor: grabbing; }
.rg-node-text { fill: #fff; font-size: 10px; font-weight: 600; pointer-events: none; }
.rg-node-label { fill: #5f6368; font-size: 10px; pointer-events: none; user-select: none; }

.rg-edge-visual { fill: none; stroke: #7bb4ea; stroke-width: 2.5; stroke-linecap: round; pointer-events: stroke; cursor: pointer; transition: stroke-width 0.2s, stroke 0.2s; }
.rg-edge-visual.hov { stroke: #4a9ae8; stroke-width: 5; }
.rg-edge-hit { fill: none; stroke: transparent; stroke-width: 18; pointer-events: stroke; cursor: pointer; }
.rg-edge-handle { fill: #fff; stroke: #4a9ae8; stroke-width: 2.5; cursor: grab; }
.rg-edge-handle:active { cursor: grabbing; }

.rg-arrow { fill: #7bb4ea; }
.rg-arrow-g.hov .rg-arrow { fill: #4a9ae8; }

.rg-hull-vis { fill: none; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; pointer-events: none; transition: stroke 0.2s; }
.rg-hull-vis.hov { stroke-width: 5; }
.rg-hull-hit { fill: none; stroke: transparent; stroke-width: 14; stroke-linejoin: round; pointer-events: stroke; cursor: pointer; }

/* ===== BUTTONS ===== */
.wd-btn-primary { padding: 10px 24px; background: #1a73e8; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background 0.15s; }
.wd-btn-primary:hover:not(:disabled) { background: #1557b0; }
.wd-btn-primary:disabled { background: #a8c7fa; cursor: not-allowed; }
.btn-cancel { padding: 10px 22px; background: #fff; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; color: #5f6368; cursor: pointer; font-family: inherit; }
.btn-danger { padding: 8px 18px; background: #fff; color: #d93025; border: 1px solid #f28b82; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit; }

/* ===== MODALS ===== */
.modal-overlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.25); backdrop-filter: blur(6px); padding: 24px; }
.modal-box { background: #fff; border-radius: 16px; padding: 28px 32px; width: 460px; max-width: 90vw; max-height: 85vh; overflow-y: auto; box-shadow: 0 16px 48px rgba(0,0,0,0.15); }
.modal-lg { width: 640px; }
.modal-error { background: #fce8e6; color: #d93025; padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 12px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.modal-header h2 { margin: 0; font-size: 18px; }
.btn-close { background: none; border: none; font-size: 18px; color: #999; cursor: pointer; }
.btn-close:hover { color: #202124; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.modal-actions-right { display: flex; gap: 10px; margin-left: auto; }

.rg-create-preview { margin-bottom: 14px; }
.rg-create-preview-label { font-size: 12px; color: #5f6368; margin-bottom: 6px; }
.rg-preview-hint { color: #1a73e8; }
.rg-create-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rg-create-chip { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #e8f0fe; color: #1a73e8; border-radius: 14px; font-size: 13px; font-weight: 500; }
.rg-chip-x { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 14px; padding: 0; line-height: 1; }
.rg-chip-x:hover { color: #d93025; }
.rg-direction-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.rg-direction-row label { font-size: 13px; font-weight: 500; color: #5f6368; }
.rg-dir-btns { display: flex; gap: 5px; }
.rg-dir-btns button { width: 40px; height: 40px; border: 2px solid #dadce0; border-radius: 50%; background: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; color: #5f6368; }
.rg-dir-btns button:hover { border-color: #1a73e8; color: #1a73e8; }
.rg-dir-btns button.active { background: #1a73e8; color: #fff; border-color: #1a73e8; }

.rg-hull-custom { background: #f8fafd; border: 1px solid #e8f0fe; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
.rg-hc-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.rg-hc-row:last-child { margin-bottom: 0; }
.rg-hc-row label { font-size: 13px; font-weight: 500; color: #5f6368; }
.rg-hc-palette { display: flex; gap: 5px; flex-wrap: wrap; }
.rg-hc-swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: transform 0.15s, border-color 0.15s; padding: 0; }
.rg-hc-swatch:hover { transform: scale(1.2); }
.rg-hc-swatch.active { border-color: #202124; transform: scale(1.2); box-shadow: 0 0 0 2px #fff, 0 0 0 4px #202124; }
.rg-hc-reset-btn { padding: 4px 11px; background: #fff; color: #5f6368; border: 1px solid #dadce0; border-radius: 14px; font-size: 12px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.rg-hc-reset-btn:hover { border-color: #1a73e8; color: #1a73e8; background: #e8f0fe; }
.rg-hc-hint { font-size: 11px; color: #999; }

.form-row { margin-bottom: 14px; }
.form-row label { display: block; font-size: 13px; font-weight: 500; color: #5f6368; margin-bottom: 4px; }
.form-input { width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; box-sizing: border-box; }
.form-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.1); }
.form-input-sm { padding: 6px 10px; font-size: 13px; width: 120px; }

.rg-picker-panel { background: #f8fafd; border: 1px solid #e8f0fe; border-radius: 10px; padding: 14px; margin-top: 8px; }
.rg-picker-header { font-size: 14px; font-weight: 500; margin-bottom: 10px; }
.rg-picker-filters { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
.rg-picker-list { display: flex; flex-direction: column; gap: 3px; max-height: 180px; overflow-y: auto; }
.rg-picker-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background 0.1s; }
.rg-picker-item:hover { background: #e8f0fe; }
.rg-picker-item.sel { background: #e8f0fe; }
.rg-picker-check { font-size: 14px; color: #1a73e8; width: 18px; }
.rg-picker-type { font-size: 11px; color: #1a73e8; background: rgba(26,115,232,0.08); padding: 1px 6px; border-radius: 8px; margin-left: auto; }

.type-chips { display: flex; gap: 5px; flex-wrap: wrap; }
.type-chip { padding: 4px 10px; border: 1px solid #dadce0; background: #fff; color: #5f6368; border-radius: 14px; font-size: 12px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.type-chip:hover { border-color: #1a73e8; color: #1a73e8; }
.type-chip.active { background: #1a73e8; color: #fff; border-color: #1a73e8; }

/* ===== ANIMATIONS ===== */
.modal-enter-active { transition: opacity 0.25s; }
.modal-enter-active .modal-box { transition: transform 0.3s, opacity 0.25s; }
.modal-leave-active { transition: opacity 0.2s; }
.modal-leave-active .modal-box { transition: transform 0.2s, opacity 0.15s; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-box { transform: translateY(20px) scale(0.96); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-box { transform: translateY(10px) scale(0.97); opacity: 0; }
</style>
