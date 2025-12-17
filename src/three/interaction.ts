// src/three/interaction.ts
// Interaction module: maps pointer position and (optional) device orientation
// to a normalized light direction vector. Does not move camera or mesh.

import * as THREE from 'three';

export type InteractionOptions = {
  /** Optional smoothing factor in [0..1]. 0 = no smoothing (immediate). */
  smoothing?: number;
  /** If true, tries to enable device orientation (mobile) immediately. */
  enableDeviceOrientation?: boolean;
  /** Max tilt in degrees used to map beta/gamma to XY. */
  maxTiltDeg?: number;
};

export type InteractionState = {
  /** Current normalized light direction (world-ish). */
  direction: THREE.Vector3;
  /** True if device orientation input is enabled and actively being used. */
  deviceOrientationEnabled: boolean;
};

export type InteractionController = InteractionState & {
  /** Enable or disable device orientation input at runtime. */
  setDeviceOrientationEnabled(enabled: boolean): Promise<void>;
  /** Update internal direction; call once per frame if you want smoothing time-based. */
  update(): void;
  /** Remove listeners and stop using sensors. */
  dispose(): void;
};

type OrientationSample = {
  beta: number; // [-180..180]
  gamma: number; // [-90..90]
  hasSample: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Creates an interaction controller.
 *
 * - Pointer maps to (x,y) in [-1..1]
 * - Device orientation (beta/gamma) maps to (x,y) in [-1..1] using maxTiltDeg
 * - Final light direction is normalize(vec3(x, y, 1))
 * - Optional smoothing (lerp) towards target
 */
export function createInteraction(options: InteractionOptions = {}): InteractionController {
  const smoothing = clamp(options.smoothing ?? 0, 0, 1);
  const maxTiltDeg = options.maxTiltDeg ?? 35;

  const direction = new THREE.Vector3(0, 0, 1); // current
  const targetDirection = new THREE.Vector3(0, 0, 1); // desired

  // Input sources
  const pointerXY = new THREE.Vector2(0, 0); // normalized [-1..1]
  const orientation: OrientationSample = { beta: 0, gamma: 0, hasSample: false };

  let disposed = false;
  let deviceOrientationEnabled = false;

  // Pointer handling
  const onPointerMove = (ev: PointerEvent) => {
    // Map screen to [-1..1] where center is 0
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const x = (ev.clientX / w) * 2 - 1;
    const y = -((ev.clientY / h) * 2 - 1);
    pointerXY.set(clamp(x, -1, 1), clamp(y, -1, 1));
    if (!deviceOrientationEnabled) recomputeTarget();
  };

  // Device orientation handling
  const onDeviceOrientation = (ev: DeviceOrientationEvent) => {
    if (!deviceOrientationEnabled) return;
    if (typeof ev.beta !== 'number' || typeof ev.gamma !== 'number') return;
    orientation.beta = ev.beta;
    orientation.gamma = ev.gamma;
    orientation.hasSample = true;
    recomputeTarget();
  };

  function computeXYFromPointer(): THREE.Vector2 {
    return pointerXY.clone();
  }

  function computeXYFromOrientation(): THREE.Vector2 {
    // beta: front-back (-180..180), gamma: left-right (-90..90)
    const maxTilt = Math.max(1e-3, maxTiltDeg);
    const x = clamp((orientation.gamma || 0) / maxTilt, -1, 1);
    const y = clamp((orientation.beta || 0) / maxTilt, -1, 1);
    return new THREE.Vector2(x, y);
  }

  function recomputeTarget() {
    if (disposed) return;

    let xy: THREE.Vector2;
    if (deviceOrientationEnabled && orientation.hasSample) {
      xy = computeXYFromOrientation();
    } else {
      xy = computeXYFromPointer();
    }

    // Build direction: forward Z with XY offsets; normalize.
    targetDirection.set(xy.x, xy.y, 1).normalize();
  }

  async function requestDeviceOrientationPermissionIfNeeded(): Promise<void> {
    // iOS 13+ requires explicit permission.
    const anyDeviceOrientationEvent = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof anyDeviceOrientationEvent?.requestPermission === 'function') {
      const res = await anyDeviceOrientationEvent.requestPermission();
      if (res !== 'granted') {
        throw new Error('DeviceOrientation permission not granted');
      }
    }
  }

  async function setDeviceOrientationEnabled(enabled: boolean): Promise<void> {
    if (disposed) return;
    if (enabled === deviceOrientationEnabled) return;

    if (enabled) {
      await requestDeviceOrientationPermissionIfNeeded();
      deviceOrientationEnabled = true;
      // If we don't have a sample yet, direction will continue to follow pointer.
      recomputeTarget();
    } else {
      deviceOrientationEnabled = false;
      // Fall back to pointer target immediately.
      recomputeTarget();
    }
  }

  function update() {
    if (disposed) return;

    // In case window size/orientation changes without pointermove.
    // We only recompute from pointer when orientation is disabled.
    if (!deviceOrientationEnabled) {
      recomputeTarget();
    }

    if (smoothing <= 0) {
      direction.copy(targetDirection);
    } else {
      direction.lerp(targetDirection, smoothing);
      direction.normalize();
    }
  }

  function dispose() {
    disposed = true;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('deviceorientation', onDeviceOrientation as EventListener);
  }

  // Register listeners
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('deviceorientation', onDeviceOrientation as EventListener, { passive: true });

  // Initialize
  recomputeTarget();
  void (async () => {
    if (options.enableDeviceOrientation) {
      try {
        await setDeviceOrientationEnabled(true);
      } catch {
        // Keep device orientation disabled if permission fails.
        deviceOrientationEnabled = false;
        recomputeTarget();
      }
    }
  })();

  return {
    get direction() {
      return direction;
    },
    get deviceOrientationEnabled() {
      return deviceOrientationEnabled;
    },
    setDeviceOrientationEnabled,
    update,
    dispose,
  };
}
