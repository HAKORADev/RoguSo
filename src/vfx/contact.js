// Contact shadows: the grounded darkening under every named character (the tech that stops a standing figure from
// looking like it floats). One soft radial blob per unit, a child of the unit's own root so it follows for free,
// hugging the ground just above the feet. Always on — never an option (the owner's law: shadows must feel grounded).
import * as THREE from 'three';

let tex = null;
function blobTex() {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 3, 32, 32, 30);
  r.addColorStop(0, 'rgba(8,5,3,0.66)');
  r.addColorStop(0.45, 'rgba(8,5,3,0.44)');
  r.addColorStop(0.75, 'rgba(8,5,3,0.2)');
  r.addColorStop(1, 'rgba(8,5,3,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Add a contact blob to a unit root (its origin is the feet). Returns the mesh. */
export function attachContact(root, size = 2.1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  m.renderOrder = 2;
  root.add(m);
  return m;
}
