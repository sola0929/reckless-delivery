import * as THREE from 'three';

/** A watermelon's rind, over a square canvas: green, with darker wavy stripes running from one end to the other. */
export function drawMelonRind(g: CanvasRenderingContext2D, size: number): void {
  g.fillStyle = '#4f9a4a';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#1f5a2a';
  g.lineWidth = 6;
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = ((i + 0.5) * size) / 9;
    g.beginPath();
    for (let y = 0; y <= size; y += 8) g.lineTo(x + Math.sin(y * 0.22 + i * 1.7) * 3.2, y);
    g.stroke();
  }
}

const made = new Map<string, THREE.Texture>();

/** The surface given, for scenery and loose things drawn with one: the same as the cargo's of that kind. */
export function surfaceTexture(kind: 'melon'): THREE.Texture {
  let texture = made.get(kind);
  if (!texture) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    drawMelonRind(canvas.getContext('2d')!, 128);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    made.set(kind, texture);
  }
  return texture;
}
