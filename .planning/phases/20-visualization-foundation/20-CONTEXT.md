# Phase 20 Context — What Failed

## Reference Target
**Dribbble:** https://dribbble.com/shots/24801507-Relax-Ai-Motion-Visual

The reference shows:
- **Transparent glass outer shell** — thin soap-bubble-like membrane, pink/salmon tint
- **Bright glowing inner core** — warm orange/red, clearly visible through shell
- **Internal flow/wisps** — swirling movement inside the orb
- **Strong rim highlight** — soft pink/white glow at edges where light catches
- **Organic blob morphing** — smooth, languid deformation
- **Depth and layers** — clear 3D sense, not flat

## What We Tried (Failed)

### Attempt 1: Canvas 2D
- Flat 2D rendering, no real 3D depth
- Could not achieve the glass/translucent effect
- Abandoned for Three.js/R3F

### Attempt 2: R3F with Custom GLSL Shaders
**Architecture:**
- Inner glowing core mesh (opaque, smaller)
- Outer glass shell mesh (transparent, fresnel rim)
- Multi-octave Perlin noise for vertex displacement
- Fresnel-based rim lighting

**Problems:**
1. **Flat appearance** — looked like solid colored blob, no glass quality
2. **Inner sphere artifacts** — when using dual spheres, created ugly orange patches showing through
3. **Colors wrong** — magenta dominated instead of orange core with subtle pink rim
4. **No internal flow** — missing the swirling wisps visible in reference
5. **Morphing too harsh** — jagged edges instead of smooth organic deformation
6. **No true glass effect** — just colored meshes, not translucent/refractive

**Shader approach issues:**
- Simple fresnel rim glow is NOT enough to create glass look
- Need actual subsurface scattering or refraction for glass membrane
- Additive blending created wrong colors
- Two separate meshes (core + shell) created visual artifacts

## What the New Approach Needs

1. **True glass/translucent material** — not just transparency, needs light transmission
2. **Volumetric inner glow** — the core should glow from within, not just be a colored sphere
3. **Proper rim lighting** — soft, diffuse pink highlight at edges
4. **Internal motion** — flowing wisps or subsurface animation
5. **Smooth morphing** — organic blob deformation without harsh edges
6. **Single cohesive look** — not two separate meshes creating artifacts

## Technical Considerations

- May need post-processing (bloom, glow effects)
- Consider MeshTransmissionMaterial from drei for glass
- Consider volumetric rendering for internal glow
- Look at Spline3D or similar tools for inspiration
- Research how similar "AI brain" orbs are implemented
- Performance must stay 60fps on mobile

## Key Insight

The reference is NOT just a shader trick — it's a carefully crafted 3D scene with proper lighting, materials, and possibly post-processing. Simple GLSL fresnel + noise displacement cannot achieve this quality.
