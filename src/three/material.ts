import * as THREE from "three";

export type SpecularOnlyMaterialParams = {
  baseColorMap: THREE.Texture;          // required (authoritative)
  normalMap?: THREE.Texture;            // optional, specular-only
  roughnessMap?: THREE.Texture;         // optional (controls specular width)
  alphaMap?: THREE.Texture;             // optional (cutout only)
  alphaCutoff?: number;                 // optional, default 0.5

  // Specular tuning (subtle & capped)
  specularColor?: THREE.Color | string | number; // default white
  specularIntensity?: number;           // multiplier; default 0.15
  specularCap?: number;                 // max additive spec; default 0.12
  normalScale?: number;                 // default 1.0

  // Light uniforms (set by lighting/interaction later)
  lightDirection?: THREE.Vector3;       // default (0.5,0.5,1) normalized
  lightIntensity?: number;              // default 0.0 (so baked-only by default)
};

export type SpecularOnlyMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uBaseColorMap: { value: THREE.Texture };
    uNormalMap: { value: THREE.Texture | null };
    uRoughnessMap: { value: THREE.Texture | null };
    uAlphaMap: { value: THREE.Texture | null };
    uAlphaCutoff: { value: number };

    uSpecularColor: { value: THREE.Color };
    uSpecularIntensity: { value: number };
    uSpecularCap: { value: number };
    uNormalScale: { value: number };

    uLightDirView: { value: THREE.Vector3 };
    uLightIntensity: { value: number };
  };
};

/**
 * Creates a specular-only material:
 * outColor = baseColor + specular
 * (no diffuse term, no ambient/env, no AO, no shadows)
 */
export function createSpecularOnlyMaterial(params: SpecularOnlyMaterialParams): SpecularOnlyMaterial {
  const specColor = new THREE.Color(params.specularColor ?? 0xffffff);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    depthTest: true,
    uniforms: {
      uBaseColorMap: { value: params.baseColorMap },
      uNormalMap: { value: params.normalMap ?? null },
      uRoughnessMap: { value: params.roughnessMap ?? null },
      uAlphaMap: { value: params.alphaMap ?? null },
      uAlphaCutoff: { value: params.alphaCutoff ?? 0.5 },

      uSpecularColor: { value: specColor },
      uSpecularIntensity: { value: params.specularIntensity ?? 0.15 },
      uSpecularCap: { value: params.specularCap ?? 0.12 },
      uNormalScale: { value: params.normalScale ?? 1.0 },

      // Light direction is stored in *view space* for stable shading with a fixed camera.
      uLightDirView: { value: (params.lightDirection ?? new THREE.Vector3(0.5, 0.5, 1)).clone().normalize() },
      uLightIntensity: { value: params.lightIntensity ?? 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vViewPos;
      varying mat3 vTBN;

      attribute vec4 tangent;

      void main() {
        vUv = uv;

        // View-space position
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mvPos.xyz;

        // Build TBN in view space so normal mapping affects specular only (in fragment)
        vec3 N = normalize(normalMatrix * normal);
        vec3 T = normalize(normalMatrix * tangent.xyz);
        vec3 B = normalize(cross(N, T) * tangent.w);
        vTBN = mat3(T, B, N);

        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;

      varying vec2 vUv;
      varying vec3 vViewPos;
      varying mat3 vTBN;

      uniform sampler2D uBaseColorMap;
      uniform sampler2D uNormalMap;
      uniform sampler2D uRoughnessMap;
      uniform sampler2D uAlphaMap;

      uniform float uAlphaCutoff;

      uniform vec3  uSpecularColor;
      uniform float uSpecularIntensity;
      uniform float uSpecularCap;
      uniform float uNormalScale;

      uniform vec3  uLightDirView;     // normalized, view space
      uniform float uLightIntensity;   // 0 => baked-only output (acceptance test)

      float saturate(float x) { return clamp(x, 0.0, 1.0); }

      vec3 getSpecularNormal() {
        vec3 N = normalize(vTBN[2]);

        if (uNormalScale <= 0.0) return N;

        vec3 nTS = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
        nTS.xy *= uNormalScale;
        nTS = normalize(nTS);

        return normalize(vTBN * nTS);
      }

      float getPerPixelRoughness() {
        float r = 0.6;
        r = texture2D(uRoughnessMap, vUv).r;
        return clamp(r, 0.04, 1.0);
      }

      void main() {
        vec4 base = texture2D(uBaseColorMap, vUv);

        float alpha = base.a;
        alpha *= texture2D(uAlphaMap, vUv).r;
        if (alpha < uAlphaCutoff) discard;

        float li = uLightIntensity;
        if (li <= 0.0) {
          gl_FragColor = vec4(base.rgb, alpha);
          return;
        }

        vec3 V = normalize(-vViewPos);
        vec3 L = normalize(uLightDirView);
        vec3 N = getSpecularNormal();

        float rough = getPerPixelRoughness();
        float shininess = mix(256.0, 8.0, rough);

        vec3 H = normalize(L + V);

        float NoH = saturate(dot(N, H));
        float spec = pow(NoH, shininess);

        float NoL = saturate(dot(N, L));
        spec *= NoL;

        float specAdd = spec * uSpecularIntensity * li;
        specAdd = min(specAdd, uSpecularCap);

        vec3 outRgb = base.rgb + (uSpecularColor * specAdd);

        gl_FragColor = vec4(outRgb, alpha);
      }
    `,
  }) as SpecularOnlyMaterial;

  return mat;
}

/**
 * Update the light direction/intensity uniforms.
 * Note: expects a direction already expressed in VIEW SPACE (lighting.ts can convert later).
 */
export function setSpecularLight(
  mat: SpecularOnlyMaterial,
  lightDirView: THREE.Vector3,
  intensity: number
) {
  mat.uniforms.uLightDirView.value.copy(lightDirView).normalize();
  mat.uniforms.uLightIntensity.value = intensity;
}
