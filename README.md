# Gacha Website Test — Asset Editing Touchpoints

This project renders a **static** 3D object with a **pre-baked appearance**. The only intended realtime effect is a **subtle specular highlight** driven by user input (light direction only).

This README lists the **only files you should edit** to change the object’s look.

---

## 1) Mesh (geometry)

**File**
- `public/assets/mesh/object.glb`

**What it controls**
- The object’s shape, UVs, tangents, and mesh topology.

**Rules / expectations**
- Mesh must be **static** (no animation, no skinning/morphs required).
- Keep **UVs stable** so textures continue to align.
- Include **tangents** if possible (recommended for normal-map-based specular).

**Do not rely on**
- Any materials embedded in the GLB (they are not authoritative for final look).

---

## 2) Textures (authoritative look + specular shaping)

All textures live in:
- `public/assets/textures/`

### A) Base color (authoritative baked appearance)
**File**
- `baseColor.png`

**What it controls**
- The final “baked” appearance (includes all shading/lighting baked by the artist).

**Non-negotiable**
- This must **not** be relit in realtime. Treat it as the final look.

---

### B) Normal map (specular-only normal influence)
**File**
- `normal.png`

**What it controls**
- Micro-surface detail that affects the **specular highlight only**.

**Notes**
- This normal map must not introduce diffuse shading (it only shapes specular).

---

### C) Roughness (optional; specular spread control only)
**File**
- `roughness.png` (optional)

**What it controls**
- How wide/tight the specular highlight is (higher roughness = broader/dimmer highlight).

**Notes**
- Used only to shape specular response; it must not enable any PBR/environment lighting.

---

### D) Alpha (optional; cutout only)
**File**
- `alpha.png` (optional)

**What it controls**
- Cutout/opacity masking only (hard discard/cutout intent).

**Notes**
- This is not intended for smooth/translucent blending—only cutout.

---

## Summary: “If you want to change X, edit Y”
- Change **shape / silhouette / UVs** → `public/assets/mesh/object.glb`
- Change **final baked look** → `public/assets/textures/baseColor.png`
- Change **specular detail / micro bumps** → `public/assets/textures/normal.png`
- Change **specular softness** → `public/assets/textures/roughness.png` (optional)
- Change **cutout areas** → `public/assets/textures/alpha.png` (optional)
