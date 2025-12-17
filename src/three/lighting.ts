import * as THREE from "three";

/**
 * lighting.ts
 *
 * Contract:
 * - Single realtime light used ONLY for specular highlights.
 * - No Three.js Light objects are created (avoids accidental diffuse/ambient contribution).
 * - No shadows, no ambient, no environment/IBL.
 * - Intensity is subtle and capped.
 *
 * This module provides a "light state" (direction + intensity) that other modules
 * can forward into the specular-only material uniforms.
 */

export type SpecularLight = {
  /**
   * Direction of light in world space, FROM the shaded point TOWARD the light.
   * Must be normalized.
   */
  directionWorld: THREE.Vector3;

  /**
   * Scalar intensity for specular highlight only.
   * Must remain subtle and clamped to maxIntensity.
   */
  intensity: number;

  /** Hard cap for safety (subtle spec only). */
  maxIntensity: number;
};

const DEFAULT_DIRECTION_WORLD = new THREE.Vector3(0.5, 0.5, 1.0).normalize();

// Keep this conservative; specular shader also has its own cap.
const DEFAULT_MAX_INTENSITY = 0.35;

export function createSpecularLight(opts?: {
  directionWorld?: THREE.Vector3;
  intensity?: number;
  maxIntensity?: number;
}): SpecularLight {
  const maxIntensity = Math.max(0, opts?.maxIntensity ?? DEFAULT_MAX_INTENSITY);

  const light: SpecularLight = {
    directionWorld: (opts?.directionWorld ?? DEFAULT_DIRECTION_WORLD).clone().normalize(),
    intensity: 0,
    maxIntensity,
  };

  setSpecularLightIntensity(light, opts?.intensity ?? 0);

  return light;
}

export function setSpecularLightDirection(light: SpecularLight, directionWorld: THREE.Vector3) {
  light.directionWorld.copy(directionWorld).normalize();
}

export function setSpecularLightIntensity(light: SpecularLight, intensity: number) {
  // Subtle and capped (hard clamp)
  const i = Number.isFinite(intensity) ? intensity : 0;
  light.intensity = THREE.MathUtils.clamp(i, 0, light.maxIntensity);
}

/**
 * Convert the light direction into VIEW SPACE for the shader uniform.
 * Since the camera is fixed, doing this explicitly keeps the contract clear and avoids
 * relying on Three.js light systems.
 */
export function getLightDirView(light: SpecularLight, camera: THREE.Camera): THREE.Vector3 {
  const dirView = light.directionWorld.clone();
  // Transform direction by camera view matrix (ignore translation -> w=0)
  dirView.transformDirection(camera.matrixWorldInverse);
  return dirView.normalize();
}
