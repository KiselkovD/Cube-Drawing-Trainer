import { COLORS, THRESHOLDS, withAlpha } from './config.js'
import {
  add3,
  mulM3M3, mulM3V3,
  rotateAroundAxis3,
  scale3,
} from './core/math.js'
import { computeVPTriangle, recoveredFovDeg } from './perspective.js'

// ============ helpers ============

function drawMarker(ctx, x, y, color, label, r) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (label) {
    ctx.fillStyle = color;
    ctx.font = '11px monospace';
    ctx.fillText(label, x + r + 5, y + 4);
  }
  ctx.restore();
}

function projectCubeCorners(center_cam, R_box_cam, size, camera) {
  const { w, h, dep } = size;
  const hw = w / 2, hh = h / 2, hd = dep / 2;
  const local = [
    [-hw, -hh, -hd], [hw, -hh, -hd], [hw, hh, -hd], [-hw, hh, -hd],
    [-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd],
  ];
  const corners_cam = local.map((p) => add3(center_cam, mulM3V3(R_box_cam, p)));
  const proj = corners_cam.map((c) => camera.project3D(c));
  return { corners_cam, proj };
}

function classifyEdges(R_box_cam, center_cam, size) {
  const { w, h, dep } = size;
  const faces = [
    { n: [0, 0, -1], c: [0, 0, -dep / 2] },
    { n: [0, 0, 1], c: [0, 0, dep / 2] },
    { n: [0, -1, 0], c: [0, -h / 2, 0] },
    { n: [0, 1, 0], c: [0, h / 2, 0] },
    { n: [-1, 0, 0], c: [-w / 2, 0, 0] },
    { n: [1, 0, 0], c: [w / 2, 0, 0] },
  ];
  const front = faces.map((f) => {
    const N = mulM3V3(R_box_cam, f.n);
    const rp = mulM3V3(R_box_cam, f.c);
    const C = add3(center_cam, rp);
    return N[0] * C[0] + N[1] * C[1] + N[2] * C[2] < 0;
  });
  const edgeDefs = [
    [0, 1, 0, 2], [1, 2, 0, 5], [2, 3, 0, 3], [3, 0, 0, 4],
    [4, 5, 1, 2], [5, 6, 1, 5], [6, 7, 1, 3], [7, 4, 1, 4],
    [0, 4, 4, 2], [1, 5, 5, 2], [2, 6, 5, 3], [3, 7, 4, 3],
  ];
  return edgeDefs.map(([a, b, fa, fb]) => ({ a, b, hidden: !front[fa] && !front[fb] }));
}

function drawCubeWireframe(ctx, center_cam, R_box_cam, size, camera, selected, colorMain) {
  const { corners_cam, proj } = projectCubeCorners(center_cam, R_box_cam, size, camera);
  if (proj.some((p) => !p)) return null;
  const edges = classifyEdges(R_box_cam, center_cam, size);

  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = selected ? 'rgba(255,216,136,0.45)'
    : (colorMain ? 'rgba(122,184,255,0.45)' : 'rgba(192,160,255,0.45)');
  for (const e of edges) {
    if (!e.hidden) continue;
    ctx.beginPath();
    ctx.moveTo(proj[e.a].x, proj[e.a].y);
    ctx.lineTo(proj[e.b].x, proj[e.b].y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.lineJoin = 'round';
  ctx.strokeStyle = selected ? COLORS.box.selected : (colorMain ? COLORS.box.main : COLORS.box.link);
  ctx.lineWidth = selected ? 2.4 : 1.6;
  for (const e of edges) {
    if (e.hidden) continue;
    ctx.beginPath();
    ctx.moveTo(proj[e.a].x, proj[e.a].y);
    ctx.lineTo(proj[e.b].x, proj[e.b].y);
    ctx.stroke();
  }
  return { corners_cam, proj };
}

function getLinkGeometry(box, camera) {
  if (!box.link) return null;
  const link = box.link;
  const M = box.getMainCenterCam(camera);
  const R_main = box.getRotationMatrix();
  const R_main_cam = mulM3M3(camera.R_wc, R_main);

  const u_cam = [R_main_cam[0][0], R_main_cam[1][0], R_main_cam[2][0]];
  const ey_main = [R_main_cam[0][1], R_main_cam[1][1], R_main_cam[2][1]];
  const ez_main = [R_main_cam[0][2], R_main_cam[1][2], R_main_cam[2][2]];

  const cosT = Math.cos(link.theta), sinT = Math.sin(link.theta);
  const v_base = [
    cosT * u_cam[0] + sinT * ey_main[0],
    cosT * u_cam[1] + sinT * ey_main[1],
    cosT * u_cam[2] + sinT * ey_main[2],
  ];
  const v = rotateAroundAxis3(v_base, u_cam, link.alpha);

  const P = add3(M, scale3(u_cam, link.d1));
  const Q = add3(P, scale3(v, link.d2));

  const ey_tilt = [
    -sinT * u_cam[0] + cosT * ey_main[0],
    -sinT * u_cam[1] + cosT * ey_main[1],
    -sinT * u_cam[2] + cosT * ey_main[2],
  ];
  const ey_pre = rotateAroundAxis3(ey_tilt, u_cam, link.alpha);
  const ez_pre = rotateAroundAxis3(ez_main, u_cam, link.alpha);
  const ey_final = rotateAroundAxis3(ey_pre, v, link.beta);
  const ez_final = rotateAroundAxis3(ez_pre, v, link.beta);

  const R_sec_cam = [
    [v[0], ey_final[0], ez_final[0]],
    [v[1], ey_final[1], ez_final[1]],
    [v[2], ey_final[2], ez_final[2]],
  ];
  return { M, P, Q, R_sec_cam, R_main_cam };
}

function drawLinkLine(ctx, geo, camera) {
  const { M, P, Q } = geo;
  const Mp = camera.project3D(M), Pp = camera.project3D(P), Qp = camera.project3D(Q);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,106,213,0.85)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([6, 4]);
  if (Mp && Pp) { ctx.beginPath(); ctx.moveTo(Mp.x, Mp.y); ctx.lineTo(Pp.x, Pp.y); ctx.stroke(); }
  if (Pp && Qp) { ctx.beginPath(); ctx.moveTo(Pp.x, Pp.y); ctx.lineTo(Qp.x, Qp.y); ctx.stroke(); }
  ctx.setLineDash([]);
  if (Pp) {
    ctx.fillStyle = '#00ffe0';
    ctx.beginPath();
    ctx.moveTo(Pp.x, Pp.y - 7); ctx.lineTo(Pp.x + 7, Pp.y);
    ctx.lineTo(Pp.x, Pp.y + 7); ctx.lineTo(Pp.x - 7, Pp.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#00ffe0'; ctx.font = 'bold 10px monospace';
    ctx.fillText('P', Pp.x + 10, Pp.y + 4);
  }
  if (Mp) { ctx.fillStyle = '#ff6ad5'; ctx.beginPath(); ctx.arc(Mp.x, Mp.y, 3, 0, Math.PI * 2); ctx.fill(); }
  if (Qp) { ctx.fillStyle = '#ff6ad5'; ctx.beginPath(); ctx.arc(Qp.x, Qp.y, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawBoxVPsAndExtensions(ctx, camera, corners_cam, corners_screen, R_cam, alpha) {
  let nearest = 0;
  for (let i = 1; i < 8; i++)
    if (corners_cam[i][2] < corners_cam[nearest][2]) nearest = i;
  const ns = corners_screen[nearest];
  const pp = camera.principalPoint;
  const d = camera.focalLength;

  function vpOf(c) {
    const dir = [R_cam[0][c], R_cam[1][c], R_cam[2][c]];
    if (Math.abs(dir[2]) < 1e-6) return null;
    return { x: pp.x + d * dir[0] / dir[2], y: pp.y - d * dir[1] / dir[2] };
  }
  const vps = { x: vpOf(0), y: vpOf(1), z: vpOf(2) };
  const cols = COLORS.vp;
  const lbls = { x: 'VPx', y: 'VPy', z: 'VPz' };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  for (const ax of ['x', 'y', 'z']) {
    const vp = vps[ax];
    if (!vp) continue;
    const dx = vp.x - ns.x, dy = vp.y - ns.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const ext = Math.min(len, 2000);
    ctx.save();
    ctx.strokeStyle = rgba(cols[ax], 0.6 * alpha);
    ctx.lineWidth = 1.3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(ns.x, ns.y);
    ctx.lineTo(ns.x + dx / len * ext, ns.y + dy / len * ext);
    ctx.stroke();
    ctx.restore();
  }

  for (const ax of ['x', 'y', 'z']) {
    const vp = vps[ax];
    if (!vp) continue;
    if (vp.x < -500 || vp.x > camera.viewportWidth + 500) continue;
    if (vp.y < -500 || vp.y > camera.viewportHeight + 500) continue;
    ctx.save();
    ctx.fillStyle = rgba(cols[ax], alpha);
    ctx.beginPath(); ctx.arc(vp.x, vp.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba([255, 255, 255], 0.9 * alpha);
    ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = rgba(cols[ax], alpha);
    ctx.font = 'bold 10px monospace';
    ctx.fillText(lbls[ax], vp.x + 8, vp.y + 3);
    ctx.restore();
  }
}

function drawVPTriangleFor(ctx, box, camera) {
  const info = computeVPTriangle(box, camera);
  if (!info || !info.vps.x || !info.vps.y || !info.vps.z) return;
  const { vps, orthocenter } = info;
  const A = vps.x, B = vps.y, C = vps.z;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,184,0,0.75)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  if (orthocenter) {
    ctx.strokeStyle = 'rgba(255,184,0,0.32)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    for (const [V, P, Q] of [[A, B, C], [B, C, A], [C, A, B]]) {
      const dx = Q.x - P.x, dy = Q.y - P.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1) continue;
      const t = ((V.x - P.x) * dx + (V.y - P.y) * dy) / len2;
      ctx.beginPath();
      ctx.moveTo(V.x, V.y);
      ctx.lineTo(P.x + t * dx, P.y + t * dy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,184,0,0.9)';
    ctx.beginPath(); ctx.arc(orthocenter.x, orthocenter.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,184,0,1)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('H', orthocenter.x + 9, orthocenter.y - 5);
  }
  ctx.restore();
}

// ============ exported draws ============

export function drawPictureFrame(ctx, camera) {
  const r = camera.pictureRect;
  ctx.strokeStyle = COLORS.frame;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([]);
}

export function drawHorizon(ctx, camera) {
  const r = camera.pictureRect;
  const hy = camera.horizonY;
  ctx.strokeStyle = COLORS.horizon;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(r.x - 400, hy);
  ctx.lineTo(r.x + r.w + 400, hy);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawSP(ctx, camera) {
  const pp = camera.principalPoint;
  drawMarker(ctx, pp.x, pp.y, COLORS.sp, 'SP', 5);
}

export function drawVP3(ctx, state, camera) {
  const r = camera.pictureRect;
  const pp = camera.principalPoint;
  const d = camera.focalLength;
  const tanTheta = camera.horizonOffset * r.w / d;

  if (Math.abs(tanTheta) < 1e-6) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,138,74,0.7)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VP3 ∞', pp.x, r.y - 10);
    ctx.restore();
    return;
  }

  const vpY = pp.y + d / tanTheta;
  const vpX = pp.x;

  if (state.ui.showGuides) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,138,74,0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    const dx = vpX - pp.x, dy = vpY - pp.y;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      ctx.beginPath();
      ctx.moveTo(pp.x - dx / len * 3000, pp.y - dy / len * 3000);
      ctx.lineTo(pp.x + dx / len * 3000, pp.y + dy / len * 3000);
      ctx.stroke();
    }
    ctx.restore();
  }

  const margin = THRESHOLDS.vp3MinMarginPx;
  if (vpY > margin && vpY < camera.viewportHeight - margin) {
    ctx.save();
    ctx.fillStyle = COLORS.vp3;
    ctx.beginPath(); ctx.arc(vpX, vpY, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vpX - 12, vpY); ctx.lineTo(vpX + 12, vpY);
    ctx.moveTo(vpX, vpY - 12); ctx.lineTo(vpX, vpY + 12);
    ctx.stroke();
    ctx.fillStyle = COLORS.vp3;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('VP3', vpX + 16, vpY + 4);
    ctx.restore();
  } else {
    const cx = camera.viewportWidth / 2, cy = camera.viewportHeight / 2;
    const dx = vpX - cx, dy = vpY - cy;
    const k = Math.max(Math.abs(dx) / (cx - 40), Math.abs(dy) / (cy - 40), 1e-6);
    const ex = Math.max(30, Math.min(camera.viewportWidth - 30, cx + dx / k));
    const ey = Math.max(30, Math.min(camera.viewportHeight - 30, cy + dy / k));
    ctx.save();
    ctx.fillStyle = 'rgba(255,138,74,0.9)';
    ctx.beginPath(); ctx.arc(ex, ey, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    const ang = Math.atan2(vpY - cy, vpX - cx);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(ang + Math.PI * 0.75) * 6, ey + Math.sin(ang + Math.PI * 0.75) * 6);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex + Math.cos(ang - Math.PI * 0.75) * 6, ey + Math.sin(ang - Math.PI * 0.75) * 6);
    ctx.stroke();
    ctx.fillStyle = COLORS.vp3;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    const dist = Math.hypot(vpX - pp.x, vpY - pp.y);
    ctx.fillText('VP3 ' + Math.round(dist) + 'px', ex, ey + 26);
    ctx.restore();
  }
}

export function drawBoxes(ctx, state, camera) {
  for (const box of state.document.boxes) {
    const sel = box.id === state.document.selectedBoxId;
    const main_cam = box.getMainCenterCam(camera);
    const R_main = box.getRotationMatrix();
    const R_main_cam = mulM3M3(camera.R_wc, R_main);

    let linkGeo = null;
    if (box.hasLink()) {
      linkGeo = getLinkGeometry(box, camera);
      if (linkGeo) drawLinkLine(ctx, linkGeo, camera);
    }

    const mainGeo = drawCubeWireframe(ctx, main_cam, R_main_cam, box.size, camera, sel, true);

    if (sel && mainGeo) {
      if (state.ui.showTri) drawVPTriangleFor(ctx, box, camera);
      ctx.fillStyle = COLORS.box.selected;
      ctx.beginPath(); ctx.arc(box.center.x, box.center.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.2; ctx.stroke();
      drawBoxVPsAndExtensions(ctx, camera, mainGeo.corners_cam, mainGeo.proj, R_main_cam, state.ui.showGuides ? 1.0 : 0.0);
    }

    if (linkGeo) {
      const secProj = camera.project3D(linkGeo.Q);
      if (secProj) {
        const secSize = { w: box.link.secW, h: box.link.secH, dep: box.link.secDep };
        const secGeo = drawCubeWireframe(ctx, linkGeo.Q, linkGeo.R_sec_cam, secSize, camera, false, false);
        if (sel && secGeo && state.ui.showGuidesSec) {
          drawBoxVPsAndExtensions(ctx, camera, secGeo.corners_cam, secGeo.proj, linkGeo.R_sec_cam, 0.65);
        }
      }
    }
  }
}

export function drawSegments(ctx, state, mode) {
  const list = mode === 'exam' ? state.document.examSegments : state.document.segments;
  const selId = mode === 'exam'
    ? state.document.selectedExamSegmentId
    : state.document.selectedSegmentId;

  for (const s of list) {
    const selected = s.id === selId;
    const isDashed = s.style === 'dashed';
    const color = selected ? COLORS.segment.selected : (isDashed ? COLORS.segment.dashed : COLORS.segment.solid);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 2.5 : 2;
    if (isDashed) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(s.a.x, s.a.y);
    ctx.lineTo(s.b.x, s.b.y);
    ctx.stroke();
    ctx.restore();

    for (const pt of [s.a, s.b]) {
      ctx.fillStyle = selected ? COLORS.segment.selected : (isDashed ? COLORS.segment.dashed : '#7ab8ff');
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1; ctx.stroke();
    }
  }
}

export function drawDraft(ctx, state) {
  const d = state.interaction.draft;
  if (!d) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(138,255,184,0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(d.startX, d.startY);
  ctx.lineTo(d.cursorX, d.cursorY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#8affb8';
  ctx.beginPath(); ctx.arc(d.startX, d.startY, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2; ctx.stroke();

  if (d.cursorSnapType) {
    const color = d.cursorSnapType === 'point' ? '#ffd888' : '#ff8a4a';
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(d.cursorX, d.cursorY, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(d.cursorX, d.cursorY, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(138,255,184,0.65)';
    ctx.beginPath(); ctx.arc(d.cursorX, d.cursorY, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawRawGraph(ctx, analysis) {
  for (const r of analysis) {
    const color = r.colors.raw;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.2;
    for (const e of r.raw.edges) {
      const a = r.raw.vertices[e.aId], b = r.raw.vertices[e.bId];
      if (!a || !b) continue;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();

    for (const v of r.raw.vertices) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(v.x, v.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
    }
    if (r.raw.vertices.length) {
      const p0 = r.raw.vertices[0];
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = 'bold 10px monospace';
      ctx.fillText('#' + (r.idx + 1), p0.x + 8, p0.y - 6);
      ctx.restore();
    }
  }
}

export function drawSimplifiedGraph(ctx, analysis) {
  for (const r of analysis) {
    const color = r.colors.simp;
    const active = new Set();
    for (const e of r.merged.edges) { active.add(e.aId); active.add(e.bId); }
    if (!active.size) continue;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    for (const e of r.merged.edges) {
      const a = r.merged.vertices[e.aId], b = r.merged.vertices[e.bId];
      if (!a || !b) continue;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();

    for (const v of r.merged.vertices) {
      if (!active.has(v.id)) continue;
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(v.x, v.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }

    const firstId = [...active][0];
    if (firstId != null) {
      const fp = r.merged.vertices[firstId];
      if (fp) {
        let label;
        if (r.success) {
          const fit = r.error.avg < 5 ? '✓' : r.error.avg < 15 ? '⚠' : '✗';
          const persp = r.perspective === '2-point' ? '2' : '3';
          label = `T${r.type}·${persp} ${fit}${r.error.avg.toFixed(0)}px`;
        } else if (r.type) {
          label = `T${r.type} ✗ ${r.reason}`;
        } else {
          label = `? ${r.reason}`;
        }
        ctx.save();
        ctx.font = 'bold 10px monospace';
        const m = ctx.measureText(label);
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(fp.x + 8, fp.y - 20, m.width + 8, 14);
        ctx.fillStyle = color;
        ctx.fillText(label, fp.x + 12, fp.y - 9);
        ctx.restore();
      }
    }
  }
}

function drawRecognizedGuideLines(ctx, r, camera, color) {
  if (!r.fullVertices || !r.vps) return;
  let nearest = null, minZ = Infinity;
  for (const [, p] of r.fullVertices) {
    if (p[2] < minZ) { minZ = p[2]; nearest = p; }
  }
  if (!nearest) return;
  const ns = camera.project3D(nearest);
  if (!ns) return;
  ctx.save();
  ctx.strokeStyle = withAlpha(color, 0.55);
  ctx.lineWidth = 1.3;
  ctx.setLineDash([5, 5]);
  for (const vp of r.vps) {
    if (!vp) continue;
    if (vp.type === 'finite' && isFinite(vp.x) && isFinite(vp.y)) {
      const dx = vp.x - ns.x, dy = vp.y - ns.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const ext = Math.min(len, 2000);
      ctx.beginPath();
      ctx.moveTo(ns.x, ns.y);
      ctx.lineTo(ns.x + dx / len * ext, ns.y + dy / len * ext);
      ctx.stroke();
    } else if (vp.type === 'infinity' && vp.dir2D) {
      const [ux, uy] = vp.dir2D;
      ctx.beginPath();
      ctx.moveTo(ns.x, ns.y);
      ctx.lineTo(ns.x + ux * 1500, ns.y + uy * 1500);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawRecognized(ctx, analysis, camera, showGuides) {
  for (const r of analysis) {
    if (!r.success) continue;
    const color = r.colors.graph;
    const hiddenColor = withAlpha(color, 0.35);

    const visible = new Set();
    for (const e of r.merged.edges) {
      visible.add(e.aId + '-' + e.bId);
      visible.add(e.bId + '-' + e.aId);
    }
    for (const [a, b] of r.allEdges) {
      const pa = r.fullVertices.get(a), pb = r.fullVertices.get(b);
      if (!pa || !pb) continue;
      const sa = camera.project3D(pa), sb = camera.project3D(pb);
      if (!sa || !sb) continue;
      const isVisible = visible.has(a + '-' + b) || visible.has(b + '-' + a);
      ctx.strokeStyle = isVisible ? color : hiddenColor;
      ctx.lineWidth = isVisible ? 2 : 1.2;
      ctx.setLineDash(isVisible ? [] : [4, 4]);
      ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
    }
    ctx.setLineDash([]);

    if (showGuides) drawRecognizedGuideLines(ctx, r, camera, color);

    for (const [id, p] of r.fullVertices) {
      if (typeof id === 'string') continue;
      const sp = camera.project3D(p);
      if (!sp) continue;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2); ctx.fill();
    }

    const centerVid = r.structure.type === 3 ? r.structure.C : r.structure.A;
    const centerPos = r.fullVertices.get(centerVid);
    if (!centerPos) continue;
    const sc = camera.project3D(centerPos);
    if (!sc) continue;
    const persp = r.perspective === '2-point' ? '2' : '3';
    const fit = r.error.avg < 5 ? '✓' : r.error.avg < 15 ? '⚠' : '✗';
    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = color;
    ctx.fillText(`T${r.type}·${persp} ${fit}${r.error.avg.toFixed(1)}px`,
      sc.x + 8, sc.y - 6);
    ctx.restore();
  }
}

export function drawAnalysisVPs(ctx, analysis, camera, view) {
  const pp = camera.principalPoint;
  const vw = camera.viewportWidth, vh = camera.viewportHeight;
  const margin = 40;
  const vx = view ? view.x : 0, vy = view ? view.y : 0;
  const axes = ['x', 'y', 'z'];

  const onScreen = (wx, wy) => {
    const sx = wx + vx, sy = wy + vy;
    return sx >= margin && sx <= vw - margin && sy >= margin && sy <= vh - margin;
  };

  const normalMarker = (wx, wy, color, label) => {
    ctx.save();
    ctx.fillStyle = withAlpha(color, 0.9);
    ctx.beginPath(); ctx.arc(wx, wy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = withAlpha(color, 1);
    ctx.font = 'bold 11px monospace';
    ctx.fillText(label, wx + 9, wy + 4);
    ctx.restore();
  };

  const edgeArrow = (wx, wy, color, label) => {
    const sx = wx + vx, sy = wy + vy;
    const cx = vw / 2, cy = vh / 2;
    const dx = sx - cx, dy = sy - cy;
    const k = Math.max(
      Math.abs(dx) / (vw / 2 - margin),
      Math.abs(dy) / (vh / 2 - margin), 1e-6);
    const ex = Math.max(margin, Math.min(vw - margin, cx + dx / k));
    const ey = Math.max(margin, Math.min(vh - margin, cy + dy / k));
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(-vx, -vy);
    ctx.fillStyle = withAlpha(color, 0.9);
    ctx.beginPath(); ctx.arc(ex, ey, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(ang + Math.PI * 0.75) * 6, ey + Math.sin(ang + Math.PI * 0.75) * 6);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex + Math.cos(ang - Math.PI * 0.75) * 6, ey + Math.sin(ang - Math.PI * 0.75) * 6);
    ctx.stroke();
    ctx.fillStyle = withAlpha(color, 1);
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    const dist = Math.hypot(wx - pp.x, wy - pp.y);
    ctx.fillText(label + ' ' + Math.round(dist) + 'px', ex, ey + 26);
    ctx.restore();
  };

  for (const r of analysis) {
    if (!r.success || !r.vps) continue;
    const color = r.colors.graph;
    for (let i = 0; i < r.vps.length; i++) {
      const vp = r.vps[i];
      if (!vp) continue;
      const ax = axes[i % 3];
      const label = 'VP' + ax.toUpperCase();

      if (vp.type === 'finite' && isFinite(vp.x) && isFinite(vp.y)) {
        if (onScreen(vp.x, vp.y)) normalMarker(vp.x, vp.y, color, label);
        else edgeArrow(vp.x, vp.y, color, label);
      } else if ((vp.type === 'infinity' || vp.type === 'axisInf') && vp.dir2D) {
        const [ux, uy] = vp.dir2D;
        const len = 110;
        ctx.save();
        ctx.strokeStyle = withAlpha(color, 0.7);
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(pp.x, pp.y);
        ctx.lineTo(pp.x + ux * len, pp.y + uy * len);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = withAlpha(color, 0.95);
        ctx.beginPath();
        ctx.arc(pp.x + ux * len, pp.y + uy * len, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 10px monospace';
        ctx.fillText(label + ' ∞', pp.x + ux * len + 7, pp.y + uy * len + 4);
        ctx.restore();
      }
    }
  }
}

export function drawAnalysisInfo(ctx, analysis, camera) {
  const pp = camera.principalPoint;
  for (const r of analysis) {
    if (!r.success) continue;
    const centerVid = r.structure.type === 3 ? r.structure.C : r.structure.A;
    const centerPos = r.fullVertices.get(centerVid);
    if (!centerPos) continue;
    const sc = camera.project3D(centerPos);
    if (!sc) continue;

    const lines = [];
    const fov = recoveredFovDeg(r.vps, camera);
    if (fov != null && isFinite(fov)) lines.push(`FOV≈${fov.toFixed(1)}°`);
    if (r.vps) {
      r.vps.forEach((vp, i) => {
        const ax = ['X', 'Y', 'Z'][i % 3];
        if (!vp) return;
        if (vp.type === 'finite' && isFinite(vp.x) && isFinite(vp.y))
          lines.push(`VP${ax}(${vp.x.toFixed(0)},${vp.y.toFixed(0)})`);
        else if (vp.type === 'infinity' || vp.type === 'axisInf')
          lines.push(`VP${ax} ∞`);
      });
    }
    lines.push(`SP(${pp.x.toFixed(0)},${pp.y.toFixed(0)})`);
    if (!lines.length) continue;

    ctx.save();
    ctx.font = 'bold 10px monospace';
    let maxW = 0;
    for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
    const boxH = lines.length * 13 + 6;
    const bx = sc.x + 8, by = sc.y + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(bx, by, maxW + 12, boxH);
    ctx.strokeStyle = withAlpha(r.colors.graph, 0.7);
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, maxW + 12, boxH);
    ctx.fillStyle = r.colors.graph;
    lines.forEach((l, i) => ctx.fillText(l, bx + 6, by + 13 + i * 13));
    ctx.restore();
  }
}

export function drawGroupRadius(ctx, state) {
  if (state.ui.tool !== 'move') return;
  if (!state.ui.groupMove) return;
  const hw = state.interaction.hoverWorld;
  if (!hw) return;
  const r = THRESHOLDS.groupMovePx;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,138,74,0.55)';
  ctx.fillStyle = 'rgba(255,138,74,0.08)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(hw.x, hw.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}