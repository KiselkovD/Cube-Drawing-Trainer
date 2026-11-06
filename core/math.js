// ===== Vec2 =====
export const v2 = (x, y) => ({ x, y });
export const add2 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub2 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const scale2 = (v, k) => ({ x: v.x * k, y: v.y * k });
export const len2 = (v) => Math.hypot(v.x, v.y);
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dot2 = (a, b) => a.x * b.x + a.y * b.y;
export const norm2 = (v) => { const n = len2(v); return n > 1e-9 ? scale2(v, 1 / n) : { x: 0, y: 0 }; };

// ===== Vec3 =====
export const v3 = (x, y, z) => [x, y, z];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm3 = (a) => { const n = len3(a); return n > 1e-9 ? scale3(a, 1 / n) : [0, 0, 0]; };

export function rotateAroundAxis3(v, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const d = dot3(v, axis);
  const cr = cross3(axis, v);
  return [
    v[0] * c + cr[0] * s + axis[0] * d * (1 - c),
    v[1] * c + cr[1] * s + axis[1] * d * (1 - c),
    v[2] * c + cr[2] * s + axis[2] * d * (1 - c),
  ];
}

// ===== Mat3 (row-major) =====
export const identity3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

export const mulM3V3 = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
];

export const mulM3M3 = (A, B) => {
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
  return C;
};

export const rotationMatrixXYZ = (rx, ry, rz) => {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
};

// ===== Line intersection =====
export function lineIntersect(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y, t, u };
}

export function projectOnLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return { x: a.x, y: a.y, t: 0 };
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy, t };
}

export function pointLineDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

// ===== Angles =====
export const deg2rad = (d) => d * Math.PI / 180;
export const rad2deg = (r) => r * 180 / Math.PI;

export function lineAngleDeg(d1, d2) {
  const c = d1.x * d2.x + d1.y * d2.y;
  const n1 = Math.hypot(d1.x, d1.y), n2 = Math.hypot(d2.x, d2.y);
  if (n1 < 1e-9 || n2 < 1e-9) return 0;
  return Math.acos(Math.min(1, Math.abs(c) / (n1 * n2))) * 180 / Math.PI;
}

export function angleAtVertex(V, A, B) {
  const ux = A.x - V.x, uy = A.y - V.y;
  const wx = B.x - V.x, wy = B.y - V.y;
  const lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
  if (lu < 1e-6 || lw < 1e-6) return null;
  return Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (lu * lw)))) * 180 / Math.PI;
}

export function angleAltitudeSide(V, P, Q, S) {
  const pqx = Q.x - P.x, pqy = Q.y - P.y;
  const vsx = S.x - V.x, vsy = S.y - V.y;
  const altx = -pqy, alty = pqx;
  const la = Math.hypot(altx, alty), ls = Math.hypot(vsx, vsy);
  if (la < 1e-6 || ls < 1e-6) return null;
  return Math.acos(Math.max(0, Math.min(1, Math.abs(altx * vsx + alty * vsy) / (la * ls)))) * 180 / Math.PI;
}