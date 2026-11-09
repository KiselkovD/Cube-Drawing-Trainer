import { angleAtVertex, mulM3M3 } from './core/math.js'

export { angleAtVertex }

export function computeVPTriangle(box, camera) {
  if (!box) return null;
  const R_main = box.getRotationMatrix();
  const R_main_cam = mulM3M3(camera.R_wc, R_main);
  const ctx = camera.cameraContext();
  const { picCx, picCy, d } = ctx;

  function vpOf(colIdx) {
    const dir = [R_main_cam[0][colIdx], R_main_cam[1][colIdx], R_main_cam[2][colIdx]];
    if (Math.abs(dir[2]) < 1e-4) return null;
    return { x: picCx + d * dir[0] / dir[2], y: picCy - d * dir[1] / dir[2] };
  }

  const vps = { x: vpOf(0), y: vpOf(1), z: vpOf(2) };
  const cmPerPx = camera.pictureSizeCm / camera.pictureRect.w;
  const SP = { x: picCx, y: picCy };

  const distToSP = {};
  const distBetween = {};
  const dotProducts = {};

  for (const k of ['x', 'y', 'z'])
    distToSP[k] = vps[k] ? Math.hypot(vps[k].x - SP.x, vps[k].y - SP.y) * cmPerPx : null;

  for (const [a, b] of [['x', 'y'], ['y', 'z'], ['z', 'x']]) {
    distBetween[a + b] = (vps[a] && vps[b])
      ? Math.hypot(vps[a].x - vps[b].x, vps[a].y - vps[b].y) * cmPerPx : null;
    if (vps[a] && vps[b]) {
      dotProducts[a + b] =
        ((vps[a].x - SP.x) * cmPerPx) * ((vps[b].x - SP.x) * cmPerPx) +
        ((vps[a].y - SP.y) * cmPerPx) * ((vps[b].y - SP.y) * cmPerPx);
    } else {
      dotProducts[a + b] = null;
    }
  }

  const dCm = (camera.pictureRect.w / 2) / Math.tan(camera.fov * Math.PI / 360) * cmPerPx;
  const expectedDot = -dCm * dCm;

  const vals = Object.values(dotProducts).filter((v) => v !== null);
  let orthocentric = false, maxDev = 0;
  if (vals.length === 3) {
    const mean = vals.reduce((a, b) => a + b, 0) / 3;
    maxDev = Math.max(...vals.map((v) => Math.abs(v - mean)));
    orthocentric = maxDev < 0.02 * Math.max(Math.abs(mean), 1);
  }

  let orthocenter = null;
  if (vps.x && vps.y && vps.z) {
    const A = vps.x, B = vps.y, C = vps.z;
    const BC = { x: C.x - B.x, y: C.y - B.y };
    const AC = { x: C.x - A.x, y: C.y - A.y };
    const det = BC.x * AC.y - BC.y * AC.x;
    if (Math.abs(det) > 1e-4) {
      const rhsa = A.x * BC.x + A.y * BC.y;
      const rhsb = B.x * AC.x + B.y * AC.y;
      orthocenter = {
        x: (rhsa * AC.y - rhsb * BC.y) / det,
        y: (BC.x * rhsb - AC.x * rhsa) / det,
      };
    }
  }

  const orthoToSPcm = orthocenter
    ? Math.hypot(orthocenter.x - SP.x, orthocenter.y - SP.y) * cmPerPx
    : null;

  return {
    vps, distToSP, distBetween, dotProducts, expectedDot,
    dCm, orthocentric, maxDev, orthocenter, orthoToSPcm, cmPerPx,
  };
}

export function computeViewMetrics(camera) {
  return {
    fov: camera.fov,
    focalLength: camera.focalLength,
    distanceCm: camera.distanceToScreenCm,
    distanceM: camera.distanceToScreenCm / 100,
  };
}

export function recoveredFovDeg(vps, camera) {
  if (!vps) return null;
  const pp = camera.principalPoint;
  const finite = vps.filter((v) => v && v.type === 'finite'
    && isFinite(v.x) && isFinite(v.y));
  if (finite.length < 2) return null;
  const ds = [];
  for (let i = 0; i < finite.length; i++) {
    for (let j = i + 1; j < finite.length; j++) {
      const v1 = finite[i], v2 = finite[j];
      const dot = (v1.x - pp.x) * (v2.x - pp.x) + (v1.y - pp.y) * (v2.y - pp.y);
      if (dot < 0) ds.push(-dot);
    }
  }
  if (!ds.length) return null;
  const d2 = ds.reduce((a, b) => a + b, 0) / ds.length;
  if (!(d2 > 0)) return null;
  const d = Math.sqrt(d2);
  const w = camera.pictureRect.w;
  return 2 * Math.atan((w / 2) / d) * 180 / Math.PI;
}