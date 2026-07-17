'use client';

/**
 * CortexCanvas — a REAL cortical surface, lit.
 *
 * The geometry is no longer generated. It is `public/brain/cortex.glb`: a FreeSurfer surface
 * reconstructed from a T1-weighted MRI (CC-BY, dgallichan — see public/brain/LICENSE.txt), decimated
 * and levelled by `scripts/build-cortex-mesh.mjs`. Five rounds of this view were rejected while it was
 * an ellipsoid with Perlin noise on it, and the reason was never the constants: TRIBE and every other
 * reference DISPLAY a scanned brain, and you cannot noise your way to one.
 *
 * The stack is unchanged, and is the same one TRIBE's own viewer uses (fingerprinted from their
 * bundle): three.js + GLTFLoader + a custom ShaderMaterial + a perspective camera and a light rig.
 * Only the line where geometry comes from is different.
 *
 * Curvature is BAKED into the asset as `_curv` (the mesh's own COLOR_0 is all zeros). It drives every
 * bit of sulcal shading — gyral crowns catch the light, sulci fall into shadow — and computing it at
 * load would have re-introduced exactly the ~500ms main-thread stall this swap exists to delete.
 *
 * ── THE MAP (rebuilt 2026-07-14) ──────────────────────────────────────────────────────────────────
 * EVERY VERTEX IS PAINTED, from one continuous diverging ramp (see cortex-colormap.ts, whose ten
 * stops were measured off the reference's own canvas). There is no cream anatomical base and no
 * activation threshold: both existed for seven rounds, and between them they produced a white brain
 * with a single orange smudge — "only one color?", four rejections running.
 *
 * Warm = above that system's own resting level; cold = below it. The cold half only exists because
 * `contrastBold` became SIGNED in the same pass: it used to clamp below-rest values to zero, which
 * silently deleted default-mode suppression — the most reliable effect in the task-vs-rest
 * literature, and the only thing that can paint a cortex blue.
 *
 * The anatomy lives entirely in the LIGHT now — curvature, occlusion, key, fill and a real specular
 * lobe. Hue belongs to the data alone.
 */

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { buildField, surfaceValues, parcelTextures, type CortexField } from '@/lib/brain/cortex-field';
import { glslRamp, SPAN_WARM, SPAN_COLD } from '@/lib/brain/cortex-colormap';
import { type NetworkId } from '@/lib/brain/cortex-sim';

const MESH_URL = '/brain/cortex.glb';

const VERT = /* glsl */ `
  attribute float aCurv;
  attribute float aVal;
  varying float vCurv;
  varying float vVal;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vCurv = aCurv;
    vVal = aVal;
    vNormal = normalMatrix * normal;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uLight;
  uniform vec3 uRim;
  uniform vec3 uKeyCol;
  uniform vec3 uFillCol;
  uniform vec3 uFillDir;
  uniform vec3 uAmbient;
  uniform float uSpanWarm;
  uniform float uSpanCold;
  varying float vCurv;
  varying float vVal;
  varying vec3 vNormal;
  varying vec3 vView;

  // The diverging map, generated from CORTEX_RAMP so the surface and the colorbar cannot drift.
  // (NO BACKTICKS ANYWHERE IN THIS SHADER. They terminate the template literal and TS then parses
  //  the GLSL as JavaScript; it has broken the build twice.)
${glslRamp()}

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vView);
    vec3 L = normalize(uLight);

    // aCurv is mean curvature measured on the geometry, signed: negative in a sulcal depth,
    // positive on a gyral crown. Baked into the asset by scripts/build-cortex-mesh.mjs.
    float curv01 = clamp(vCurv * 0.5 + 0.5, 0.0, 1.0);

    // ══ EVERY VERTEX IS PAINTED. THIS IS THE REBUILD. ════════════════════════════════════════════
    //
    // The old shader kept a CREAM anatomical base and blended colour in only where |value| cleared
    // ACTIVATION_THRESHOLD (0.42) — a thresholded statistical map, which is a real neuroimaging
    // convention and is NOT the one the reference uses. The reference paints the WHOLE cortex with a
    // continuous diverging map, always. That is the entire difference between a specimen that reads
    // as a scan and one that reads as a cream sculpture with a smudge on it.
    //
    // MEASURED on our own render before this change: essentially none of the surface cleared the
    // threshold, so the cortex came back white with one orange patch on the occipital pole. The
    // owner's words were "color mesh doesnt look good at all and is only one color?" — literally
    // true, and it was this if-statement, not the mesh.
    //
    // The anatomy is not lost by painting over it: THE FOLDS READ THROUGH THE MAP, carried by the
    // shading term below, exactly as they do on the reference.
    //
    // ONE SPAN PER TAIL — this must stay identical to valueToRamp() in cortex-colormap.ts, or the
    // colorbar starts lying about the surface. The cold tail reaches nearly twice as far as the warm
    // one (the DMN suppresses hard, over a lot of cortex); a single span wide enough for it crushed
    // every warm value into one hue.
    float s = vVal >= 0.0
      ? 0.5 + vVal / (2.0 * uSpanWarm)
      : 0.5 + vVal / (2.0 * uSpanCold);
    vec3 mapCol = cortexRamp(clamp(s, 0.0, 1.0));

    // Curvature drives VALUE, never hue — sulci fall into shadow, crowns catch the key. Hue belongs
    // to the data; if curvature tinted it too, you could not tell a fold from a finding.
    float ao = mix(0.55, 1.0, smoothstep(0.04, 0.52, curv01));

    // Half-lambert wrap: the shadow side keeps reading as form instead of falling off a cliff.
    float hl = dot(N, L) * 0.5 + 0.5;
    float key = 0.82 * pow(hl, 1.25);
    float fill = 0.20 * max(dot(N, uFillDir), 0.0);
    vec3 light = (uAmbient * 0.52 + uKeyCol * key + uFillCol * fill) * ao;

    vec3 col = mapCol * light;

    // ── GLOSS, and why the matte law does not forbid it.
    //    The reference's specimen is WET: a real specular lobe, and it is most of what sells the
    //    thing as a physical object rather than a diagram. We had it at 0.05 — a "whisper of sheen"
    //    — because docs/DESIGN-SYSTEM.md says the system is matte. That law governs CHROME: cards,
    //    buttons, borders, the surfaces the UI is BUILT from. The cortex is a rendered specimen
    //    sitting INSIDE a frame, no more bound by it than a photograph of a wet object would be.
    vec3 H = normalize(L + V);
    col += vec3(1.0, 0.98, 0.94) * pow(max(dot(N, H), 0.0), 40.0) * 0.30 * mix(0.30, 1.0, curv01);

    // A cool rim keeps the silhouette off the near-black well. Quiet — it is separation, not a glow.
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.10;
    col += uRim * rim;

    // ⚠️ THE SPECIMEN IS ALWAYS DRAWN AT FULL BRIGHTNESS. THE ENTRANCE IS NOT IN HERE.
    //
    // It was, twice, and both were wrong. First as an alpha on a transparent material (the specimen
    // never appeared at all). Then as a brightness multiply on the colour, driven from useFrame —
    // which worked, until it did not: on /dev/cards, where several WebGL canvases compete, one
    // canvas's render loop stalls early and FREEZES ON THE FRAME IT LAST DREW. With the fade in the
    // shader, that frame is uFade ≈ 0, so the brain sat there as a PURE BLACK SILHOUETTE — the right
    // shape, perfectly lit, and completely invisible. Nothing threw.
    //
    // The lesson generalises: never gate whether an object is VISIBLE on a value that only advances
    // while the render loop is healthy. The entrance is now a CSS opacity/transform on the canvas
    // wrapper (see BrainView) — the compositor owns it, it cannot be starved by a stalled GL loop,
    // and a frozen canvas freezes on a fully-lit brain instead of a black one.
    gl_FragColor = vec4(col, 1.0);

    // ⚠️ CONVERT TO THE OUTPUT COLOUR SPACE. Without this the specimen renders BLACK.
    //
    // three colour-manages THREE.Color uniforms into LINEAR working space, but a custom ShaderMaterial
    // writes gl_FragColor raw — so we were dumping linear values straight at an sRGB display and every
    // mid-tone crushed. (Bisected: the light term looked fine because those uniforms are Vector3, which
    // three does NOT colour-manage; the BASE term, built from THREE.Colors, came out near-black. Two
    // rounds of "the lighting must be wrong" chased the wrong half of the shader.)
    #include <colorspace_fragment>
  }
`;

const rgb = (hex: number) => new THREE.Color(hex);

/**
 * The parcellation is a pure function of the geometry, and the geometry is now a FIXED asset — so it
 * is built ONCE per session and shared by every focus. (The old mesh was rebuilt per seed, which is
 * where the ~500ms open cost came from.)
 */
let FIELD: CortexField | null = null;
/**
 * `positions` are the FOLDED surface, already read through the accessors and baked to world space by
 * the loader below. The parcellation is anatomical, so it is built on the real cortex and then simply
 * travels with the vertices when they inflate — which is exactly what FreeSurfer does, and the reason
 * an inflated view could show the same map without recomputing anything (see docs — not shipped).
 *
 * (The old signature took the geometry and read the accessors itself, with a long warning about never
 * touching `pos.array` on a quantized mesh — that warning now lives at the one place that reads it.)
 */
function fieldFor(positions: Float32Array): CortexField {
  if (!FIELD) FIELD = buildField(positions);
  return FIELD;
}

/** Motion, in one place. Everything is a RATE (per second) so the feel does not change with the display. */
/** How fast the map chases the BOLD it has been given. Slow enough to read as haemodynamics, fast
 *  enough that a 372ms tick lands as a swell rather than a step. */
const BOLD_LERP_RATE = 5.5;
/** How long the specimen rests after you let go of it, before it starts turning again. */
const DRIFT_RESUME_S = 2.4;

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Whether a hand is currently on the specimen, and how long ago it let go. Shared with OrbitControls. */
export interface Interaction {
  grabbed: boolean;
  since: number;
}

function Cortex({
  seed,
  bold,
  t,
  reducedMotion,
  interaction,
  onHover,
  onReady,
}: {
  seed: number;
  bold: Record<NetworkId, number>;
  t: number;
  reducedMotion: boolean;
  interaction: React.RefObject<Interaction>;
  onHover?: (net: NetworkId | null) => void;
  onReady?: () => void;
}) {
  const gltf = useGLTF(MESH_URL);
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<THREE.Group>(null);

  const driftT = useRef(0);

  // The shipped mesh is a single joined primitive. Clone the geometry so our per-vertex `aVal` buffer
  // is ours to mutate — useGLTF caches the loaded scene across mounts.
  /**
   * ⚠️ REBUILD the geometry from the accessors. Do NOT clone it.
   *
   * The shipped asset is quantized, so three loads it as INTERLEAVED int16 attributes with the
   * dequantizing scale/offset on the node. Two things follow, and both bit:
   *   • `geometry.clone()` does not survive that layout — the drawn mesh came out as a shattered cube.
   *   • the node's matrix is the DEQUANTIZER, so geometry lifted out without it is thousands of units
   *     wide and the camera sits inside it (the well renders empty, and nothing throws).
   *
   * Reading through getX/getY/getZ and baking the world matrix in by hand is correct for every layout,
   * costs one pass over 64k vertices at load, and leaves us with plain buffers we own.
   */
  const { geometry, basePos } = useMemo(() => {
    let src: THREE.Mesh | null = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh;
    });
    if (!src) throw new Error('cortex.glb has no mesh');
    const mesh = src as THREE.Mesh;
    const srcGeo = mesh.geometry as THREE.BufferGeometry;

    const pos = srcGeo.getAttribute('position');
    const nrm = srcGeo.getAttribute('normal');
    const curv = srcGeo.getAttribute('_curv');
    const idx = srcGeo.getIndex();
    if (!curv) throw new Error('cortex.glb is missing the baked _CURV attribute — rebuild it');
    if (!idx) throw new Error('cortex.glb is not indexed');

    const n = pos.count;
    const positions = new Float32Array(n * 3);
    const normals = new Float32Array(n * 3);
    const curvature = new Float32Array(n);

    const m = mesh.matrixWorld;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
      positions[i * 3] = v.x; positions[i * 3 + 1] = v.y; positions[i * 3 + 2] = v.z;

      v.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i)).applyMatrix3(nm).normalize();
      normals[i * 3] = v.x; normals[i * 3 + 1] = v.y; normals[i * 3 + 2] = v.z;

      curvature[i] = curv.getX(i);
    }

    // ⚠️ RENORMALISE THE CURVATURE FROM THE DATA, not from the `normalized` flag.
    //
    // It is baked as int8 in [-1, 1], but whether the loader hands it back denormalised depends on the
    // three version and on whether the attribute is interleaved. Get it wrong and vCurv arrives as
    // ±127: the base-colour ramp clamps to its ends, the cortex renders BLACK with a few cream
    // patches, and the specimen looks burnt rather than lit. Measuring the range costs one pass and
    // is correct either way.
    let maxAbs = 0;
    for (let i = 0; i < n; i++) maxAbs = Math.max(maxAbs, Math.abs(curvature[i]!));
    if (maxAbs > 1.5) for (let i = 0; i < n; i++) curvature[i]! /= maxAbs;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    g.setAttribute('aCurv', new THREE.BufferAttribute(curvature, 1));
    g.setAttribute('aVal', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setIndex(Array.from(idx.array as ArrayLike<number>));
    return { geometry: g, basePos: positions };
  }, [gltf]);

  useEffect(() => () => geometry.dispose(), [geometry]);


  const field = useMemo(() => fieldFor(basePos), [basePos]);
  const textures = useMemo(() => parcelTextures(field, seed), [field, seed]);
  /**
   * The specimen is HERE — the mesh is parsed, the field is built, and the next frame will draw a
   * lit brain. This is what the card's entrance waits for; without it we would fade in an empty well
   * and let the brain pop into it, which is what the old `Suspense fallback={null}` did.
   */
  useEffect(() => {
    onReady?.();
  }, [onReady, geometry, field]);

  /**
   * ⚠️ THE TARGET, not the displayed value.
   *
   * The scan clock ticks every ~372ms (TR/4) and this used to be written STRAIGHT into the geometry —
   * so the activation jumped to a whole new buffer four times a second and the map moved in visible
   * steps. BOLD really is that slow, and that is honest; but the RENDERING of it has no business being
   * slow in the same way. So the tick sets a target and `useFrame` walks the surface toward it, every
   * frame, continuously.
   */
  const target = useMemo(() => surfaceValues(field, textures, bold, t), [field, textures, bold, t]);
  const settled = useRef(false);

  useEffect(() => {
    settled.current = false;
    invalidate();
  }, [target, invalidate]);

  /**
   * ⚠️ THERE IS NO BASE COLOUR HERE ANY MORE, and that is the point.
   *
   * `uGyrus` (cream) and `uSulcus` (grey) are gone: the surface no longer has an anatomical base
   * colour that activation is composited ON TOP OF. It is painted, everywhere, from CORTEX_RAMP —
   * the ten stops measured off the reference's own canvas (see cortex-colormap.ts). The pole colours
   * (uTaskLow/High, uDmnLow/High) are gone with them; a diverging ramp has no poles to mix between.
   *
   * The anatomy now lives entirely in the LIGHT — curvature, occlusion, key, fill, gloss — which is
   * where it lives on the reference too.
   */
  const uniforms = useMemo(
    () => ({
      uLight: { value: new THREE.Vector3(-0.45, 0.72, 0.85) },
      uRim: { value: rgb(0x8fa7bd) },
      // Warm key + cool fill is the oldest trick in specimen photography, and the reason a lit form
      // reads as SOLID: the shadow side is not merely darker, it is a different colour.
      uKeyCol: { value: new THREE.Vector3(1.0, 0.97, 0.92) },
      uFillCol: { value: new THREE.Vector3(0.62, 0.7, 0.82) },
      uFillDir: { value: new THREE.Vector3(0.65, -0.35, 0.35).normalize() },
      uAmbient: { value: new THREE.Vector3(0.85, 0.83, 0.8) },
      uSpanWarm: { value: SPAN_WARM },
      uSpanCold: { value: SPAN_COLD },
    }),
    [],
  );

  /**
   * ── THE FRAME. Everything that moves, moves here, and nothing here is linear.
   *
   * Three things are in flight at once, and they are deliberately on different clocks:
   *
   *  1. THE ENTRANCE. The well used to sit empty and then a brain would pop into it (`Suspense
   *     fallback={null}`). Now the specimen fades and settles up into frame — 700ms, ease-out — so it
   *     ARRIVES rather than appears.
   *  2. THE MAP. Walked toward its target every frame instead of being snapped four times a second
   *     (§14.2). The rate is per-second and frame-rate independent — `1 - exp(-k·dt)` rather than a
   *     fixed lerp factor, which would make the map faster on a 120Hz screen than on a 60Hz one.
   *  3. THE DRIFT. A slow turn, which now yields to the hand: grab the specimen and it stops; let go
   *     and it takes a breath before it starts breathing again.
   */
  useFrame((_, dt) => {
    // A frame can be arbitrarily long after a tab wakes up; an unclamped dt would teleport everything.
    const d = Math.min(dt, 1 / 20);
    let dirty = false;

    // 1 ── the map, flowing rather than stepping
    if (!settled.current) {
      const attr = geometry.getAttribute('aVal') as THREE.BufferAttribute;
      const cur = attr.array as Float32Array;
      const k = 1 - Math.exp(-BOLD_LERP_RATE * d);
      let maxDelta = 0;
      for (let i = 0; i < cur.length; i++) {
        const diff = target[i]! - cur[i]!;
        cur[i]! += diff * k;
        const a = Math.abs(diff);
        if (a > maxDelta) maxDelta = a;
      }
      // Snap and stop once the difference is below what a 8-bit-ish display could ever show. Without
      // this the loop runs forever, chasing an asymptote nobody can see.
      if (maxDelta < 0.002) {
        cur.set(target);
        settled.current = true;
      }
      attr.needsUpdate = true;
      dirty = true;
    }

    // 2 ── the drift, which yields to the hand
    if (group.current && !reducedMotion) {
      const hand = interaction.current;
      const idle = hand.grabbed ? 0 : Math.min(1, hand.since / DRIFT_RESUME_S);
      if (!hand.grabbed) hand.since += d;
      // The amplitude eases in and out — a drift that switches on at full strength the instant you let
      // go reads as the object twitching.
      const amp = easeInOutCubic(idle);
      driftT.current += d * amp;
      const yaw = BASE_YAW + 0.075 * Math.sin(driftT.current * 0.16);
      const pitch = BASE_PITCH + 0.02 * Math.sin(driftT.current * 0.11);
      // Applied as an OFFSET to whatever the user turned it to, so grabbing the specimen does not get
      // fought by the drift snapping it back to a canonical pose.
      group.current.rotation.y = yaw;
      group.current.rotation.x = pitch;
      if (amp > 0.001) dirty = true;
    }

    if (dirty) invalidate();
  });

  // FIT THE SPECIMEN TO THE FRAME, measured — do not hand-tune a magic number. The mesh is in
  // millimetres (bbox ~133 x 141 x 188), and the camera sees a half-height of z*tan(fov/2) = 1.23
  // world units at its distance. Scale the bounding sphere just inside that and the brain fills the
  // well at any aspect, from any yaw, without ever clipping its own occipital pole.
  const scale = useMemo(() => {
    geometry.computeBoundingSphere();
    const r = geometry.boundingSphere?.radius ?? 1;
    return FIT_RADIUS / r;
  }, [geometry]);

  return (
    <group
      ref={group}
      rotation={[BASE_PITCH, BASE_YAW, 0]}
      scale={scale}
    >
      <mesh
        geometry={geometry}
        onPointerMove={(e) => {
          if (!onHover || e.faceIndex == null) return;
          const idx = geometry.getIndex();
          const v = idx?.getX(e.faceIndex * 3);
          if (v == null) return;
          // The vertex's NEAREST parcel → that parcel's network.
          //
          // ⚠️ This used to read `blendIdx[v * blendK]`, which was only the nearest parcel because the
          // blend list happened to be kept sorted by distance. It is not sorted any more (keeping it
          // sorted is what cost 2.4 seconds), so index 0 is now just whichever parcel the grid handed
          // over first. Reading it would name a real but WRONG region — a hover readout that is subtly
          // lying, which nothing on screen would flag.
          const parcel = field.nearest[v];
          if (parcel === undefined) return;
          onHover(field.parcelNet[parcel] ?? null);
        }}
        onPointerOut={() => onHover?.(null)}
      >
        {/* OPAQUE, and always at full brightness. The entrance is a CSS fade on the wrapper (BrainView)
            — see the shader for the two ways doing it in here went wrong. */}
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} />
      </mesh>
    </group>
  );
}

/**
 * ── THE CAMERA, AND WHY THE OLD POSE WAS HIDING THE MAP.
 *
 * The mesh ships LEVELLED and in a known frame (build-cortex-mesh.mjs asserts it):
 *   +X = the subject's right   ·   +Y = superior   ·   −Z = ANTERIOR (the frontal pole)
 *
 * The old yaw (−0.62) looked down on the brain from the front — three-quarters, but three-quarters of
 * the TOP. That is not a cosmetic complaint: the Yeo network anchors are placed out on the LATERAL
 * surface (`cortex-field`, at 0.82 of the half-width), so the map LIVES on the side of the brain, and
 * we were pointing the camera at the part of it that carries almost none. The card looked unlit and the
 * model was innocent — the activation was simply facing away.
 *
 * 🔴 +1.72, NOT −1.72 — THE SPECIMEN WAS MIRRORED, AND THE COMMENT HERE ASSERTED OTHERWISE.
 *
 * The old value claimed "the left hemisphere in profile, frontal pole to the left". Work it out
 * against the frame above: anterior is −Z, and a yaw of θ maps −Z to screen-x = −sin(θ). At θ = −1.72
 * that is +0.99 — the frontal pole points screen-RIGHT. So the brain faced RIGHT inside a head facing
 * LEFT: a brain in a skull, back to front. It shipped for six rounds because nobody ever diffed the
 * specimen's orientation against the head's, and the comment SAID it was correct.
 *
 * At θ = +1.72 the frontal pole lands screen-LEFT and the subject's right hemisphere turns away, so
 * this is the true left-lateral plate — the view every anatomical figure uses, the view TRIBE opens
 * on, and the one that agrees with the silhouette it sits in.
 * (A comment is not a measurement. This one was wrong for as long as it existed.)
 */
const BASE_YAW = 1.72;
const BASE_PITCH = 0.16;
/**
 * The bounding-sphere radius the specimen is scaled to, in world units. The camera sits at z = 4.6
 * with a 30° fov, so it sees ±1.23 units at the origin.
 *
 * ⚠️ THE SPECIMEN MUST OWN THE FRAME. Measured against TRIBE's demo: their brain is ~600×550 in a
 * 1440px viewport — HALF THE SCREEN — while ours was ~430×310 in a 474px card, a quarter of the area.
 * Five rounds fought a fidelity war in a frame too small to show fidelity. This fills the (now square)
 * well, leaving only the margin the drift and a hand-turn need in order not to clip the occipital pole.
 */
// 0.74 → 1.08. The specimen used to BACK OFF to leave a cranium for it to sit in — a real trade,
// and it was paid to the head ghost, which is now deleted (see BrainView: three hand-authored
// silhouettes, three rejections, and a reference that has no head at all). With nothing to sit in,
// backing off only bought empty well: a small brain floating in a big black box, which is exactly
// what "doesn't look real" described. The specimen owns the frame again, keeping just the margin the
// drift and a hand-turn need in order not to clip the occipital pole.
const FIT_RADIUS = 1.08;

export interface CortexCanvasProps {
  seed: number;
  /** The predicted BOLD per network at the current scan time (from `predictedBold`). */
  bold: Record<NetworkId, number>;
  /** Scan time, seconds — the parcel drift rides on it. */
  t: number;
  reducedMotion?: boolean;
  onHover?: (net: NetworkId | null) => void;
  /** Fires once the mesh is parsed and the field is built — the card fades the well in on this. */
  onReady?: () => void;
}

export default function CortexCanvas({
  seed,
  bold,
  t,
  reducedMotion = false,
  onHover,
  onReady,
}: CortexCanvasProps) {
  const interaction = useRef<Interaction>({ grabbed: false, since: DRIFT_RESUME_S });

  return (
    <Canvas
      data-testid="cortex-canvas"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 4.6], fov: 30 }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <Cortex
          seed={seed}
          bold={bold}
          t={t}
          reducedMotion={reducedMotion}
          interaction={interaction}
          onHover={onHover}
          onReady={onReady}
        />
      </Suspense>

      {/**
       * ── YOU CAN PICK IT UP.
       *
       * TRIBE lets you GRAB the specimen and turn it; ours was a thing you watched. That is the
       * difference between an instrument and a picture, and it costs one component.
       *
       * Deliberately constrained: no pan and no zoom, because neither means anything here and both let
       * you lose the brain off the edge of a 400px card. What is left is the one gesture that does mean
       * something — turning the specimen over to look at the other side of the map. Damping is what
       * makes it feel like an object with mass rather than a value being edited.
       */}
      {!reducedMotion && (
        <OrbitControls
          makeDefault
          // The drift and the hand must not fight over the same object. Grab it and the turn stops
          // dead; let go and it waits (DRIFT_RESUME_S) before easing back into its slow rotation —
          // so the specimen never twitches out from under the cursor.
          onStart={() => {
            interaction.current.grabbed = true;
          }}
          onEnd={() => {
            interaction.current.grabbed = false;
            interaction.current.since = 0;
          }}
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.55}
          // Keep the specimen upright. A brain rolled onto its crown is not a view of anything, and
          // being able to reach it is how a viewer discovers it can be broken.
          minPolarAngle={Math.PI * 0.22}
          maxPolarAngle={Math.PI * 0.78}
        />
      )}
    </Canvas>
  );
}

useGLTF.preload(MESH_URL);
