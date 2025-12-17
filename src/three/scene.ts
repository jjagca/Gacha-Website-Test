// Minimal Three.js scene skeleton
// - renderer (no tone mapping)
// - fixed camera
// - scene
// - mesh loading via GLTFLoader from /public/assets/mesh/object.glb
// - resize handling
// - simple render loop (no animation logic beyond rendering)
// Explicitly: no lights, no materials setup, no environment maps.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;
let rafId: number | undefined;

function ensureCanvas(container: HTMLElement): HTMLCanvasElement {
  // Prefer an existing canvas if present to avoid duplicating on hot reloads.
  const existing = container.querySelector('canvas');
  if (existing && existing instanceof HTMLCanvasElement) return existing;

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);
  return canvas;
}

function resize(container: HTMLElement) {
  if (!renderer || !camera) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function render() {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}

function loop() {
  render();
  rafId = requestAnimationFrame(loop);
}

export function initThreeScene(container: HTMLElement) {
  // Basic scene graph
  scene = new THREE.Scene();

  // Fixed camera (no controls here)
  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  // Renderer (no tone mapping)
  const canvas = ensureCanvas(container);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NoToneMapping;

  // Initial sizing + resize handling
  resize(container);
  const onResize = () => resize(container);
  window.addEventListener('resize', onResize);

  // Load mesh (no lights/material/env setup here)
  const loader = new GLTFLoader();
  loader.load(
    '/assets/mesh/object.glb',
    (gltf) => {
      if (!scene) return;
      scene.add(gltf.scene);
      render();
    },
    undefined,
    (error) => {
      // Keep minimal: log and continue.
      // eslint-disable-next-line no-console
      console.error('Failed to load GLB:', error);
    }
  );

  // Start render loop
  loop();

  // Provide a cleanup hook for callers (optional but useful)
  return () => {
    if (rafId !== undefined) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);

    // Dispose renderer resources
    renderer?.dispose();

    renderer = undefined;
    scene = undefined;
    camera = undefined;
    rafId = undefined;
  };
}
