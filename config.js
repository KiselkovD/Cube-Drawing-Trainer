export const COLORS = {
  rainbow: ['#ff5c5c', '#ff8a4a', '#ffd888', '#8affb8', '#7ab8ff', '#c0a0ff', '#ff6ad5'],
  segment: { solid: '#8affb8', dashed: '#c0a0ff', selected: '#ffd888' },
  box: { main: '#7ab8ff', link: '#c0a0ff', selected: '#ffd888' },
  vp: {
    x: [122, 184, 255],
    y: [255, 138, 74],
    z: [138, 255, 184],
  },
  sp: '#8affb8',
  vp3: '#ff8a4a',
  horizon: 'rgba(255,200,100,0.7)',
  frame: 'rgba(140,140,170,0.55)',
  ortho: '#ffb800',
  recognized: 'rgba(255,138,74,0.9)',
  recognizedHidden: 'rgba(255,138,74,0.35)',
  background: '#1a1a1f',
};

export const THRESHOLDS = {
  snapPointPx: 22,
  snapLinePx: 15,
  minSegLenPx: 5,
  dragThresholdPx: 8,
  hitVP3Px: 32,
  hitBoxPx: 28,
  hitSegBodyPx: 14,
  hitSegEndpointPx: 15,
  groupMovePx: 20,
  graphSnapPx: 10,
  graphLinePx: 2.5,
  graphParamEps: 0.02,
  graphMinEdgePx: 3,
  graphParallelEps: 1e-3,
  mergeTrianglePx: 30,
  mergeMaxIter: 20,
  parallelAngleDeg: 4,
  groupAngleDeg: 18,
  maxHistorySteps: 60,
  vp3MinMarginPx: 50,
};

export const DEFAULTS = {
  fov: 90,
  horizonOffset: 0.3,
  pictureSizeCm: 20,
  boxSize: { w: 200, h: 200, dep: 200 },
  linkDefaults: { d1: 200, d2: 200, theta: Math.PI / 3, alpha: 0, beta: 0, secW: 200, secH: 200, secDep: 200 },
  bottomBarHeightPx: 148,
};

export function graphColors(idx) {
  const c = COLORS.rainbow[idx % COLORS.rainbow.length];
  return { graph: c, raw: c, simp: c };
}

export function withAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}