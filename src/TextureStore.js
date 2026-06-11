const _custom = new Map(); // level → THREE.CanvasTexture

export function setCustomTexture(level, texture) {
  const old = _custom.get(level);
  if (old) old.dispose();
  _custom.set(level, texture);
}

export function getCustomTexture(level) {
  return _custom.get(level) ?? null;
}
