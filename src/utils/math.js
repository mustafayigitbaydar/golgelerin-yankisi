export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
