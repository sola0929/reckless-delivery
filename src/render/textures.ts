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

/**
 * Block ice off a can: clear, faintly blue, with the cloud of white in its middle that block ice freezes with, feathers of
 * it reaching out, a few strings of bubbles and a crack or two; frosted toward its edges.
 */
function drawBlockIce(g: CanvasRenderingContext2D, size: number): void {
  const rand = (() => { let s = 13; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();
  const edge = g.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.72);
  edge.addColorStop(0, '#cfe9f2');
  edge.addColorStop(1, '#eef8fb');
  g.fillStyle = edge;
  g.fillRect(0, 0, size, size);
  // The white heart, and its feathers.
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(size / 2, size / 2, size * 0.3, size * 0.11, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.6)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) {
    const x = size * (0.22 + rand() * 0.56), y = size / 2 + (rand() - 0.5) * size * 0.18, a = (rand() - 0.5) * 1.4 + (y < size / 2 ? -Math.PI / 2 : Math.PI / 2);
    const long = size * (0.06 + rand() * 0.12);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * long, y + Math.sin(a) * long);
    g.stroke();
  }
  // Strings of bubbles; cracks.
  g.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 5; i++) {
    const x = size * (0.1 + rand() * 0.8);
    for (let y = size * 0.08; y < size * 0.92; y += 5 + rand() * 6) if (Math.abs(y - size / 2) > size * 0.14) g.fillRect(x + (rand() - 0.5) * 2, y, 1.5, 1.5);
  }
  g.strokeStyle = 'rgba(160,200,215,0.9)';
  g.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    let x = rand() * size, y = rand() * size;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) g.lineTo((x += (rand() - 0.5) * 30), (y += (rand() - 0.5) * 30));
    g.stroke();
  }
}

/** A woven plastic sack of crushed ice: its weave, a blue band, the ice plant's print on it. */
function drawIceSack(g: CanvasRenderingContext2D, size: number): void {
  g.fillStyle = '#eef0ec';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(150,155,150,0.35)';
  g.lineWidth = 1;
  for (let k = 0; k < size; k += 3) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k, size); g.stroke();
    g.beginPath(); g.moveTo(0, k + 1); g.lineTo(size, k + 1); g.stroke();
  }
  g.fillStyle = '#2f62a8';
  g.fillRect(0, size * 0.1, size, size * 0.07);
  g.fillRect(0, size * 0.83, size, size * 0.07);
  g.fillStyle = '#c8372d';
  g.font = `bold ${Math.round(size * 0.22)}px "Microsoft JhengHei", "Noto Sans TC", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('食用碎冰', size / 2, size * 0.42);
  g.fillStyle = '#2f62a8';
  g.font = `bold ${Math.round(size * 0.13)}px "Microsoft JhengHei", "Noto Sans TC", sans-serif`;
  g.fillText('順發製冰', size / 2, size * 0.66);
  // Wet where it has sat in the melt.
  g.fillStyle = 'rgba(120,130,130,0.18)';
  g.fillRect(0, size * 0.9, size, size * 0.1);
}

const made = new Map<string, THREE.Texture>();

/** The surface given, for scenery and loose things drawn with one: the same as the cargo's of that kind. */
export function surfaceTexture(kind: 'melon' | 'ice' | 'iceSack'): THREE.Texture {
  let texture = made.get(kind);
  if (!texture) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = kind === 'melon' ? 128 : 256;
    const g = canvas.getContext('2d')!;
    if (kind === 'ice') drawBlockIce(g, 256);
    else if (kind === 'iceSack') drawIceSack(g, 256);
    else drawMelonRind(g, 128);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    made.set(kind, texture);
  }
  return texture;
}
