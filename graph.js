import { THRESHOLDS, graphColors } from './config.js'
import {
  lineAngleDeg,
  lineIntersect, projectOnLine,
} from './core/math.js'

export function componentize(segments) {
  const n = segments.length;
  const parent = [...Array(n).keys()];
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const uni = (i, j) => { parent[find(i)] = find(j); };
  const close = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < THRESHOLDS.graphSnapPx;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s1 = segments[i], s2 = segments[j];
      if (close(s1.a, s2.a) || close(s1.a, s2.b) || close(s1.b, s2.a) || close(s1.b, s2.b)) {
        uni(i, j); continue;
      }
      const it = lineIntersect(s1.a, s1.b, s2.a, s2.b);
      if (it && it.t > 0.01 && it.t < 0.99 && it.u > 0.01 && it.u < 0.99) uni(i, j);
    }
  }
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!map.has(r)) map.set(r, []);
    map.get(r).push(segments[i]);
  }
  return [...map.values()];
}

export function buildGraph(segments) {
  const EPS_SNAP = THRESHOLDS.graphSnapPx;
  const EPS_LINE = THRESHOLDS.graphLinePx;
  const EPS_PARAM = THRESHOLDS.graphParamEps;
  const EPS_MIN = THRESHOLDS.graphMinEdgePx;
  const EPS_PAR = THRESHOLDS.graphParallelEps;

  const raw = [];
  for (const s of segments) {
    raw.push({ x: s.a.x, y: s.a.y });
    raw.push({ x: s.b.x, y: s.b.y });
  }
  for (let i = 0; i < segments.length; i++) {
    const s1 = segments[i];
    const d1x = s1.b.x - s1.a.x, d1y = s1.b.y - s1.a.y;
    const len1 = Math.hypot(d1x, d1y);
    if (len1 < 1e-6) continue;
    for (let j = i + 1; j < segments.length; j++) {
      const s2 = segments[j];
      const d2x = s2.b.x - s2.a.x, d2y = s2.b.y - s2.a.y;
      const len2 = Math.hypot(d2x, d2y);
      if (len2 < 1e-6) continue;
      const den = d1x * d2y - d1y * d2x;
      if (Math.abs(den) / (len1 * len2) < EPS_PAR) continue;
      const t = ((s2.a.x - s1.a.x) * d2y - (s2.a.y - s1.a.y) * d2x) / den;
      const u = ((s2.a.x - s1.a.x) * d1y - (s2.a.y - s1.a.y) * d1x) / den;
      if (t < -EPS_PARAM || t > 1 + EPS_PARAM) continue;
      if (u < -EPS_PARAM || u > 1 + EPS_PARAM) continue;
      raw.push({ x: s1.a.x + t * d1x, y: s1.a.y + t * d1y });
    }
  }

  const parent = raw.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const uni = (i, j) => { parent[find(i)] = find(j); };
  const cell = EPS_SNAP;
  const grid = new Map();
  for (let i = 0; i < raw.length; i++) {
    const gx = Math.floor(raw[i].x / cell), gy = Math.floor(raw[i].y / cell);
    const k = gx + ',' + gy;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  for (let i = 0; i < raw.length; i++) {
    const gx = Math.floor(raw[i].x / cell), gy = Math.floor(raw[i].y / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const b = grid.get((gx + dx) + ',' + (gy + dy));
      if (!b) continue;
      for (const j of b) {
        if (j <= i) continue;
        if (Math.hypot(raw[i].x - raw[j].x, raw[i].y - raw[j].y) < EPS_SNAP) uni(i, j);
      }
    }
  }

  const groups = new Map();
  for (let i = 0; i < raw.length; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, { sx: 0, sy: 0, n: 0 });
    const g = groups.get(r);
    g.sx += raw[i].x; g.sy += raw[i].y; g.n++;
  }
  const vertices = [];
  for (const [, g] of groups) vertices.push({ id: vertices.length, x: g.sx / g.n, y: g.sy / g.n });

  const segSplits = segments.map(() => []);
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) continue;
    for (const v of vertices) {
      const t = ((v.x - s.a.x) * dx + (v.y - s.a.y) * dy) / len2;
      if (t < -EPS_PARAM || t > 1 + EPS_PARAM) continue;
      const proj = projectOnLine(v, s.a, s.b);
      if (Math.hypot(v.x - proj.x, v.y - proj.y) > EPS_LINE) continue;
      segSplits[i].push({ t, vertexId: v.id });
    }
    segSplits[i].sort((p, q) => p.t - q.t);
  }

  const edges = [], seen = new Set();
  for (let i = 0; i < segments.length; i++) {
    for (let k = 0; k < segSplits[i].length - 1; k++) {
      const a = segSplits[i][k].vertexId, b = segSplits[i][k + 1].vertexId;
      if (a === b) continue;
      const va = vertices[a], vb = vertices[b];
      if (Math.hypot(va.x - vb.x, va.y - vb.y) < EPS_MIN) continue;
      const key = Math.min(a, b) + '-' + Math.max(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ aId: a, bId: b, segIdx: i });
    }
  }

  return { vertices, edges, segSplits };
}

export function normalizeIds(g) {
  const idMap = new Map();
  const vertices = g.vertices.map((v, i) => { idMap.set(v.id, i); return { x: v.x, y: v.y, id: i }; });
  const edges = g.edges.map((e) => ({ aId: idMap.get(e.aId), bId: idMap.get(e.bId), segIdx: e.segIdx }));
  return { vertices, edges };
}

export function pruneDegree1(g) {
  let edges = g.edges.slice();
  let changed = true;
  while (changed) {
    changed = false;
    const deg = new Map();
    for (const e of edges) {
      deg.set(e.aId, (deg.get(e.aId) || 0) + 1);
      deg.set(e.bId, (deg.get(e.bId) || 0) + 1);
    }
    const next = [];
    for (const e of edges) {
      if (deg.get(e.aId) >= 2 && deg.get(e.bId) >= 2) next.push(e);
      else changed = true;
    }
    edges = next;
  }
  const active = new Set();
  for (const e of edges) { active.add(e.aId); active.add(e.bId); }
  const vertices = g.vertices.filter((v) => active.has(v.id));
  return normalizeIds({ vertices, edges });
}

export function mergeSmallTriangles(g, threshold = THRESHOLDS.mergeTrianglePx) {
  const adj = new Map();
  for (const v of g.vertices) adj.set(v.id, new Set());
  for (const e of g.edges) { adj.get(e.aId).add(e.bId); adj.get(e.bId).add(e.aId); }
  const vMap = new Map(g.vertices.map((v) => [v.id, v]));
  const seen = new Set(), candidates = [];
  for (const [a, nbrs] of adj) {
    const arr = [...nbrs];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (!nbrs.has(arr[j])) continue;
        const b = arr[i], c = arr[j];
        const key = [a, b, c].sort((x, y) => x - y).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const va = vMap.get(a), vb = vMap.get(b), vc = vMap.get(c);
        if (!va || !vb || !vc) continue;
        const mx = Math.max(
          Math.hypot(vb.x - va.x, vb.y - va.y),
          Math.hypot(vc.x - vb.x, vc.y - vb.y),
          Math.hypot(va.x - vc.x, va.y - vc.y));
        if (mx < threshold) candidates.push([a, b, c]);
      }
    }
  }
  if (!candidates.length) return normalizeIds(g);

  const used = new Set(), toMerge = [];
  for (const tri of candidates) {
    if (tri.some((id) => used.has(id))) continue;
    toMerge.push(tri);
    tri.forEach((id) => used.add(id));
  }
  if (!toMerge.length) return normalizeIds(g);

  const idMap = new Map();
  const newVertices = g.vertices.filter((v) => !used.has(v.id)).map((v) => ({ ...v }));
  let nextId = Math.max(...newVertices.map((v) => v.id), -1) + 1;
  for (const tri of toMerge) {
    const cx = tri.reduce((s, id) => s + vMap.get(id).x, 0) / 3;
    const cy = tri.reduce((s, id) => s + vMap.get(id).y, 0) / 3;
    const cid = nextId++;
    newVertices.push({ id: cid, x: cx, y: cy });
    for (const id of tri) idMap.set(id, cid);
  }
  const newEdges = [], edgeSeen = new Set();
  for (const e of g.edges) {
    const a = idMap.get(e.aId) ?? e.aId, b = idMap.get(e.bId) ?? e.bId;
    if (a === b) continue;
    const key = Math.min(a, b) + '-' + Math.max(a, b);
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    newEdges.push({ aId: a, bId: b, segIdx: e.segIdx });
  }
  return normalizeIds({ vertices: newVertices, edges: newEdges });
}

export function simplifyGraph(g) {
  let cur = normalizeIds(g);
  for (let it = 0; it < THRESHOLDS.mergeMaxIter; it++) {
    const bV = cur.vertices.length, bE = cur.edges.length;
    cur = pruneDegree1(cur);
    cur = mergeSmallTriangles(cur);
    if (cur.vertices.length === bV && cur.edges.length === bE) break;
  }
  return cur;
}

export function findStructure(g) {
  const deg = new Map(), adj = new Map();
  for (const e of g.edges) {
    deg.set(e.aId, (deg.get(e.aId) || 0) + 1);
    deg.set(e.bId, (deg.get(e.bId) || 0) + 1);
    if (!adj.has(e.aId)) adj.set(e.aId, new Set());
    if (!adj.has(e.bId)) adj.set(e.bId, new Set());
    adj.get(e.aId).add(e.bId);
    adj.get(e.bId).add(e.aId);
  }
  const V = deg.size, E = g.edges.length;
  const ds = [...deg.values()].sort((a, b) => a - b).join(',');

  if (V === 4 && E === 4 && ds === '2,2,2,2') return { type: 1 };

  if (V === 6 && E === 7 && ds === '2,2,2,2,3,3') {
    const deg3 = [];
    for (const [v, d] of deg) if (d === 3) deg3.push(v);
    if (deg3.length !== 2) return null;
    const [A, B] = deg3;
    const Ay = [...adj.get(A)].filter((x) => x !== B);
    const Bx = [...adj.get(B)].filter((x) => x !== A);
    if (Ay.length !== 2 || Bx.length !== 2) return null;
    const cycles = [];
    for (const y of Ay) {
      const x = Bx.find((xx) => adj.get(y).has(xx));
      if (x === undefined) return null;
      cycles.push({ Y: y, X: x });
    }
    if (cycles.length !== 2) return null;
    return { type: 2, A, B, cycles };
  }

  if (V === 7 && E === 9 && ds === '2,2,2,3,3,3,3') {
    let C = null;
    for (const [v, d] of deg) {
      if (d !== 3) continue;
      const nbrs = [...adj.get(v)];
      if (nbrs.every((n) => deg.get(n) === 3)) { C = v; break; }
    }
    if (C === null) return null;
    const N = [...adj.get(C)];
    if (N.length !== 3) return null;
    const X = {};
    for (const [i, j, key] of [[0, 1, 'X12'], [0, 2, 'X13'], [1, 2, 'X23']]) {
      const common = [...adj.get(N[i])].filter((n) => n !== C && adj.get(N[j]).has(n) && deg.get(n) === 2);
      if (common.length !== 1) return null;
      X[key] = common[0];
    }
    return { type: 3, C, N, X12: X.X12, X13: X.X13, X23: X.X23 };
  }
  return null;
}

export function makeGroups(structure) {
  if (structure.type === 2) {
    const { A, B, cycles } = structure;
    const [c1, c2] = cycles;
    return [
      { edges: [[A, B], [c1.X, c1.Y], [c2.X, c2.Y]] },
      { edges: [[A, c1.Y], [B, c1.X]] },
      { edges: [[A, c2.Y], [B, c2.X]] },
    ];
  }
  if (structure.type === 3) {
    const { C, N, X12, X13, X23 } = structure;
    return [
      { edges: [[C, N[0]], [X12, N[1]], [X13, N[2]]] },
      { edges: [[C, N[1]], [X12, N[0]], [X23, N[2]]] },
      { edges: [[C, N[2]], [X13, N[0]], [X23, N[1]]] },
    ];
  }
  return [];
}

export function classifyPerspective(groups, V) {
  const angles = groups.map((g) => {
    let m = 0;
    for (let i = 0; i < g.edges.length; i++)
      for (let j = i + 1; j < g.edges.length; j++) {
        const [a1, b1] = g.edges[i], [a2, b2] = g.edges[j];
        m = Math.max(m, lineAngleDeg(
          { x: V[b1].x - V[a1].x, y: V[b1].y - V[a1].y },
          { x: V[b2].x - V[a2].x, y: V[b2].y - V[a2].y }));
      }
    return m;
  });
  const minAngle = Math.min(...angles);
  const parallelGroups = angles.map((a) => a === minAngle && a < THRESHOLDS.parallelAngleDeg);
  return {
    perspective: parallelGroups.some(Boolean) ? '2-point' : '3-point',
    parallelGroups,
    angles,
  };
}

function averageDir2D(edges, V) {
  let sx = 0, sy = 0, refx = null, refy = null;
  for (const [a, b] of edges) {
    let dx = V[b].x - V[a].x, dy = V[b].y - V[a].y;
    const n = Math.hypot(dx, dy);
    if (n < 1e-9) continue;
    dx /= n; dy /= n;
    if (refx === null) { refx = dx; refy = dy; sx = dx; sy = dy; continue; }
    const dot = dx * refx + dy * refy;
    const sign = dot >= 0 ? 1 : -1;
    sx += sign * dx; sy += sign * dy;
  }
  const n = Math.hypot(sx, sy);
  if (n < 1e-9) return null;
  return [sx / n, sy / n];
}

export function groupVP(group, V, camera, isParallel) {
  if (isParallel) {
    const d = averageDir2D(group.edges, V);
    return d ? { type: 'infinity', dir2D: d } : { type: 'fail' };
  }
  const pairs = [];
  for (let i = 0; i < group.edges.length; i++) {
    for (let j = i + 1; j < group.edges.length; j++) {
      const e1 = group.edges[i], e2 = group.edges[j];
      const ang = lineAngleDeg(
        { x: V[e1[1]].x - V[e1[0]].x, y: V[e1[1]].y - V[e1[0]].y },
        { x: V[e2[1]].x - V[e2[0]].x, y: V[e2[1]].y - V[e2[0]].y });
      if (ang < 0.5) continue;
      const vp = lineIntersect(V[e1[0]], V[e1[1]], V[e2[0]], V[e2[1]]);
      if (vp) pairs.push({ ang, vp });
    }
  }
  if (!pairs.length) {
    const d = averageDir2D(group.edges, V);
    return d ? { type: 'infinity', dir2D: d } : { type: 'fail' };
  }
  let wx = 0, wy = 0, wsum = 0;
  for (const p of pairs) {
    const w = Math.sin(p.ang * Math.PI / 180);
    if (w < 0.05) continue;
    wx += p.vp.x * w; wy += p.vp.y * w; wsum += w;
  }
  if (wsum < 1e-6) {
    const d = averageDir2D(group.edges, V);
    return d ? { type: 'infinity', dir2D: d } : { type: 'fail' };
  }
  const vp = { x: wx / wsum, y: wy / wsum };
  const pp = camera.principalPoint;
  const d = camera.focalLength;
  if (Math.hypot(vp.x - pp.x, vp.y - pp.y) > 100 * d) {
    const dir = averageDir2D(group.edges, V);
    return dir ? { type: 'infinity', dir2D: dir } : { type: 'fail' };
  }
  return { type: 'finite', x: vp.x, y: vp.y };
}

export function dirFromVP(vp, camera) {
  const pp = camera.principalPoint;
  const d = camera.focalLength;
  if (vp.type === 'infinity') {
    if (!vp.dir2D) return null;
    const [ux, uy] = vp.dir2D;
    return [ux, -uy, 0];
  }
  const dx = vp.x - pp.x, dy = pp.y - vp.y, dz = d;
  const n = Math.hypot(dx, dy, dz);
  if (n < 1e-9) return null;
  return [dx / n, dy / n, dz / n];
}

// ===== Fixed camera helpers =====

export function getCameraVPs(camera) {
  const R = camera.R_wc;
  const pp = camera.principalPoint;
  const d = camera.focalLength;
  function vpOf(colIdx) {
    const dir = [R[0][colIdx], R[1][colIdx], R[2][colIdx]];
    if (Math.abs(dir[2]) < 1e-6) return null;
    return { x: pp.x + d * dir[0] / dir[2], y: pp.y - d * dir[1] / dir[2] };
  }
  return [vpOf(0), vpOf(1), vpOf(2)];
}

function assignVPsToGroups(groups, V, cameraVPs, camera) {
  const naturalVPs = groups.map((g) => groupVP(g, V, camera, false));
  const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  let best = null, bestScore = Infinity;

  for (const perm of perms) {
    let score = 0, ok = true;
    for (let i = 0; i < 3; i++) {
      const axisIdx = perm[i];
      const nat = naturalVPs[i];
      const cvp = cameraVPs[axisIdx];
      if (nat && nat.type === 'finite' && cvp) {
        score += Math.hypot(cvp.x - nat.x, cvp.y - nat.y);
      } else if (nat && nat.type === 'finite' && !cvp) {
        score += 10000;
      } else if ((!nat || nat.type !== 'finite') && !cvp) {
        score += 0;
      } else {
        ok = false; break;
      }
    }
    if (ok && score < bestScore) { bestScore = score; best = perm; }
  }
  if (!best) return null;
  return best.map((axisIdx, groupIdx) => ({ axisIdx, groupIdx }));
}

// ===== orientDir / solveL / buildT2 / buildT3 =====

function orientDir(d3, edge, V, vp) {
  if (!d3) return null;
  const ex = V[edge[1]].x - V[edge[0]].x, ey = V[edge[1]].y - V[edge[0]].y;
  let rx, ry;
  if (vp.type === 'infinity' || vp.type === 'axisInf') {
    rx = d3[0]; ry = -d3[1];
  } else {
    rx = vp.x - V[edge[0]].x; ry = vp.y - V[edge[0]].y;
  }
  return (rx * ex + ry * ey) >= 0 ? d3 : [-d3[0], -d3[1], -d3[2]];
}

function solveL(centerCam, dir, target, camera) {
  const ctx = camera.cameraContext();
  const { picCx, picCy, d } = ctx;
  const [Xc, Yc, Zc] = centerCam;
  const [dx, dy, dz] = dir;
  const px = target.x - picCx, py = picCy - target.y;
  const denX = px * dz - d * dx, numX = d * Xc - px * Zc;
  const Lx = Math.abs(denX) > 1e-3 ? numX / denX : null;
  const denY = py * dz - d * dy, numY = d * Yc - py * Zc;
  const Ly = Math.abs(denY) > 1e-3 ? numY / denY : null;
  const cands = [Lx, Ly].filter((v) => v != null && v > 1e-3 && isFinite(v));
  if (!cands.length) return null;
  return cands.reduce((a, b) => a + b, 0) / cands.length;
}

function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale3(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }

function buildT3(structure, rawDirs, vps, camera, V) {
  const { C, N, X12, X13, X23 } = structure;
  const refs = [[C, N[0]], [C, N[1]], [C, N[2]]];
  const d = rawDirs.map((dir, i) => orientDir(dir, refs[i], V, vps[i]));
  if (d.some((x) => !x)) return { ok: false, reason: 'направление' };

  const pp = camera.principalPoint;
  const focal = camera.focalLength;
  const Z0 = 2 * focal;
  const Cpt = V[C];
  const Ccam = [(Cpt.x - pp.x) * Z0 / focal, (pp.y - Cpt.y) * Z0 / focal, Z0];

  const L = [0, 1, 2].map((i) => solveL(Ccam, d[i], V[N[i]], camera));
  if (L.some((l) => l == null)) return { ok: false, reason: 'L' };

  const Ncam = [0, 1, 2].map((i) => add3(Ccam, scale3(d[i], L[i])));
  const X12cam = add3(add3(Ncam[0], Ncam[1]), scale3(Ccam, -1));
  const X13cam = add3(add3(Ncam[0], Ncam[2]), scale3(Ccam, -1));
  const X23cam = add3(add3(Ncam[1], Ncam[2]), scale3(Ccam, -1));
  const back = add3(add3(add3(Ncam[0], Ncam[1]), Ncam[2]), scale3(Ccam, -2));

  const pos3D = new Map([
    [C, Ccam], [N[0], Ncam[0]], [N[1], Ncam[1]], [N[2], Ncam[2]],
    [X12, X12cam], [X13, X13cam], [X23, X23cam],
  ]);
  const fullVertices = new Map(pos3D);
  fullVertices.set('__back__', back);
  const allEdges = [
    [C, N[0]], [C, N[1]], [C, N[2]],
    [N[0], X12], [N[0], X13], [N[1], X12], [N[1], X23], [N[2], X13], [N[2], X23],
    [X12, '__back__'], [X13, '__back__'], [X23, '__back__'],
  ];
  return { ok: true, pos3D, fullVertices, allEdges };
}

function buildT2(structure, rawDirs, vps, camera, V) {
  const { A, B, cycles } = structure;
  const [c1, c2] = cycles;
  const Y1 = c1.Y, X1 = c1.X, Y2 = c2.Y, X2 = c2.X;

  const dC = orientDir(rawDirs[0], [A, B], V, vps[0]);
  const dL = orientDir(rawDirs[1], [A, Y1], V, vps[1]);
  const dR = orientDir(rawDirs[2], [A, Y2], V, vps[2]);
  if (!dC || !dL || !dR) return { ok: false, reason: 'направление' };

  const pp = camera.principalPoint;
  const focal = camera.focalLength;
  const Z0 = 2 * focal;
  const Apt = V[A];
  const Acam = [(Apt.x - pp.x) * Z0 / focal, (pp.y - Apt.y) * Z0 / focal, Z0];

  const Lc = solveL(Acam, dC, V[B], camera);
  const Ll = solveL(Acam, dL, V[Y1], camera);
  const Lr = solveL(Acam, dR, V[Y2], camera);
  if ([Lc, Ll, Lr].some((l) => l == null)) return { ok: false, reason: 'L' };

  const Bcam = add3(Acam, scale3(dC, Lc));
  const Y1cam = add3(Acam, scale3(dL, Ll));
  const X1cam = add3(Bcam, scale3(dL, Ll));
  const Y2cam = add3(Acam, scale3(dR, Lr));
  const X2cam = add3(Bcam, scale3(dR, Lr));
  const btCam = add3(Y1cam, scale3(dR, Lr));
  const bbCam = add3(X1cam, scale3(dR, Lr));

  const pos3D = new Map([
    [A, Acam], [B, Bcam], [Y1, Y1cam], [X1, X1cam], [Y2, Y2cam], [X2, X2cam],
  ]);
  const fullVertices = new Map(pos3D);
  fullVertices.set('__bt__', btCam);
  fullVertices.set('__bb__', bbCam);
  const allEdges = [
    [A, B], [A, Y1], [B, X1], [Y1, X1], [A, Y2], [B, X2], [Y2, X2],
    [Y1, '__bt__'], [Y2, '__bt__'],
    [X1, '__bb__'], [X2, '__bb__'],
    ['__bt__', '__bb__'],
  ];
  return { ok: true, pos3D, fullVertices, allEdges };
}

function computeError(pos3D, V, camera) {
  let total = 0, max = 0, count = 0;
  for (const [id, p] of pos3D) {
    const proj = camera.project3D(p);
    if (!proj) return { ok: false };
    const vert = V[id];
    if (!vert) continue;
    const err = Math.hypot(proj.x - vert.x, proj.y - vert.y);
    total += err; max = Math.max(max, err); count++;
  }
  if (count === 0) return { ok: false };
  return { ok: true, avg: total / count, max };
}

// ===== analyze =====
export function analyze(segments, camera, options = {}) {
  const { fixedCamera = false } = options;
  const solid = segments.filter((s) => s.style !== 'dashed');
  if (solid.length < 1) return [];
  const comps = componentize(solid);
  const results = [];

  comps.forEach((comp, idx) => {
    const raw = buildGraph(comp);
    const merged = simplifyGraph(raw);
    const colors = graphColors(idx);
    const res = {
      idx, raw, merged, colors,
      type: null, structure: null, groups: null, vps: null,
      perspective: null, parallelGroups: null, angles: null,
      pos3D: null, fullVertices: null, allEdges: null,
      error: null, success: false, reason: '', fixedCamera,
    };

    if (merged.vertices.length === 0 || merged.edges.length === 0) {
      res.reason = 'пустой граф'; results.push(res); return;
    }

    const structure = findStructure(merged);
    if (!structure) {
      res.reason = `V=${merged.vertices.length} E=${merged.edges.length}`;
      results.push(res); return;
    }
    res.type = structure.type;
    res.structure = structure;

    if (structure.type === 1) { res.reason = 'T1'; results.push(res); return; }

    const groups = makeGroups(structure);
    res.groups = groups;
    const persp = classifyPerspective(groups, merged.vertices);
    res.perspective = persp.perspective;
    res.parallelGroups = persp.parallelGroups;
    res.angles = persp.angles;

    let vps, rawDirs;

    if (fixedCamera) {
      const cameraVPs = getCameraVPs(camera);
      const assignment = assignVPsToGroups(groups, merged.vertices, cameraVPs, camera);
      if (!assignment) { res.reason = 'VP match'; results.push(res); return; }
      res.vps = assignment.map((a) => cameraVPs[a.axisIdx]
        ? { type: 'finite', x: cameraVPs[a.axisIdx].x, y: cameraVPs[a.axisIdx].y, axisIdx: a.axisIdx }
        : { type: 'axisInf', axisIdx: a.axisIdx });
      const R = camera.R_wc;
      rawDirs = assignment.map((a) => [R[0][a.axisIdx], R[1][a.axisIdx], R[2][a.axisIdx]]);
      vps = res.vps;
    } else {
      vps = groups.map((g, i) => groupVP(g, merged.vertices, camera, persp.parallelGroups[i]));
      res.vps = vps;
      if (vps.some((v) => v.type === 'fail')) { res.reason = 'VP'; results.push(res); return; }
      rawDirs = vps.map((v) => dirFromVP(v, camera));
      if (rawDirs.some((d) => !d)) { res.reason = 'направление'; results.push(res); return; }
    }

    const build = structure.type === 3
      ? buildT3(structure, rawDirs, vps, camera, merged.vertices)
      : buildT2(structure, rawDirs, vps, camera, merged.vertices);

    if (!build.ok) { res.reason = build.reason; results.push(res); return; }

    const err = computeError(build.pos3D, merged.vertices, camera);
    if (!err.ok) { res.reason = 'за камерой'; results.push(res); return; }

    res.pos3D = build.pos3D;
    res.fullVertices = build.fullVertices;
    res.allEdges = build.allEdges;
    res.error = err;
    res.success = true;
    results.push(res);
  });

  return results;
}