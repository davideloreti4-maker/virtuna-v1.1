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
 * Dosage (LOCKED) survives: the map is DIVERGING on the task-positive / default-mode axis — a real
 * anticorrelation — so engaged cortex glows sage and only the default-mode system (mind-wandering: the
 * audience you are losing) glows coral. There is no red/yellow "hot" colormap here, which is the one
 * thing of TRIBE's we deliberately did NOT take.
 */

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { buildField, surfaceValues, parcelTextures, type CortexField } from '@/lib/brain/cortex-field';
import { ACTIVATION_SPAN, ACTIVATION_THRESHOLD, type NetworkId } from '@/lib/brain/cortex-sim';

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
  uniform vec3 uGyrus;
  uniform vec3 uSulcus;
  uniform vec3 uTaskLow;
  uniform vec3 uTaskHigh;
  uniform vec3 uDmnLow;
  uniform vec3 uDmnHigh;
  uniform vec3 uLight;
  uniform vec3 uRim;
  uniform vec3 uKeyCol;
  uniform vec3 uFillCol;
  uniform vec3 uFillDir;
  uniform vec3 uAmbient;
  uniform float uThreshold;
  uniform float uSpan;
  varying float vCurv;
  varying float vVal;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vView);
    vec3 L = normalize(uLight);
    float lam = max(dot(N, L), 0.0);

    // ── VALUE. A specimen reads as a specimen because of its VALUE STRUCTURE: near-white crowns
    //    against near-black sulci, the full range used. Now that the folds are REAL, the curvature
    //    signal is real too: aCurv is mean curvature measured on the geometry, signed — negative in
    //    a sulcal depth, positive on a gyral crown.
    //    (NO BACKTICKS IN THIS SHADER. They terminate the template literal and TS parses the GLSL
    //     as JavaScript; it has broken the build twice.)
    float curv01 = clamp(vCurv * 0.5 + 0.5, 0.0, 1.0);
    float ao = mix(0.68, 1.0, curv01);
    float key = 0.62 * lam;
    float fill = 0.26 * max(dot(N, uFillDir), 0.0);
    vec3 light = (uAmbient * 0.46 + uKeyCol * key + uFillCol * fill) * ao;

    // The base ramp is centred on the curvature this mesh ACTUALLY has (measured: mean −0.18, so
    // curv01 sits around 0.41 with 75% of the surface in the mid band). The old 0.12→0.72 window was
    // tuned for the procedural mesh and left most of a real cortex down at the sulcal end.
    vec3 base = mix(uSulcus, uGyrus, smoothstep(0.05, 0.68, curv01));
    vec3 col = base * light;

    // A whisper of sheen, and no more. The system is MATTE — no glow, no shine (docs/DESIGN-SYSTEM).
    // At the old 0.18 the specimen read as wet chrome against the well, which is a different lie from
    // the one we started with but a lie all the same.
    vec3 H = normalize(L + V);
    col += uKeyCol * (pow(max(dot(N, H), 0.0), 30.0) * 0.05 * curv01);

    // The activation, THRESHOLDED. Most of the cortex sits at baseline: painting every vertex is what
    // makes a generated map look like stained glass instead of a statistical map.
    float lit = 0.42 + 0.78 * lam;
    float a = abs(vVal);
    if (a > uThreshold) {
      float s = clamp((a - uThreshold) / uSpan, 0.0, 1.0);
      vec3 hot = vVal > 0.0 ? mix(uTaskLow, uTaskHigh, s) : mix(uDmnLow, uDmnHigh, s);

      // The alpha ramps from ZERO at the contour: smoothstep gives a genuinely soft edge (zero slope
      // AT the threshold, so there is no edge to see), then the linear term climbs hard so the cluster
      // core is unmistakably painted. Soft edge, strong body — which is how a real cluster looks. A
      // hard opening step made the map read as flat shapes PASTED ON the anatomy.
      float alpha = smoothstep(0.0, 0.22, s) * (0.45 + 0.55 * s);
      col = mix(col, hot * lit * ao, alpha);
    }

    // A cool rim keeps the silhouette off the near-black well. Quiet — it is separation, not a glow.
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.12;
    col += uRim * rim;

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
function fieldFor(geometry: THREE.BufferGeometry): CortexField {
  if (!FIELD) {
    const pos = geometry.getAttribute('position');
    // ⚠️ Read through the ACCESSOR, never `pos.array`.
    //
    // The shipped mesh is quantized, and three loads quantized attributes as an INTERLEAVED buffer —
    // so `pos.array` is not positions, it is position+normal+curvature woven together. Copying it
    // straight into buildField fed it garbage: the bounding box was nonsense, every anchor failed to
    // find a vertex on its side of the midline, and the field came back with zero networks
    // ("Cannot read properties of undefined (reading 'net')"). getX/getY/getZ are correct for both
    // interleaved and plain layouts.
    const xyz = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      xyz[i * 3] = pos.getX(i);
      xyz[i * 3 + 1] = pos.getY(i);
      xyz[i * 3 + 2] = pos.getZ(i);
    }
    FIELD = buildField(xyz);
  }
  return FIELD;
}

function Cortex({
  seed,
  bold,
  t,
  reducedMotion,
  onHover,
}: {
  seed: number;
  bold: Record<NetworkId, number>;
  t: number;
  reducedMotion: boolean;
  onHover?: (net: NetworkId | null) => void;
}) {
  const gltf = useGLTF(MESH_URL);
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<THREE.Group>(null);

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
  const geometry = useMemo(() => {
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
    return g;
  }, [gltf]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const field = useMemo(() => fieldFor(geometry), [geometry]);
  const textures = useMemo(() => parcelTextures(field, seed), [field, seed]);
  const values = useMemo(() => surfaceValues(field, textures, bold, t), [field, textures, bold, t]);

  // Push the new predicted BOLD into the surface. The attribute is reused — a fresh buffer every tick
  // would churn the GPU for nothing.
  useEffect(() => {
    const attr = geometry.getAttribute('aVal') as THREE.BufferAttribute;
    (attr.array as Float32Array).set(values);
    attr.needsUpdate = true;
    invalidate();
  }, [geometry, values, invalidate]);

  const uniforms = useMemo(
    () => ({
      // Cream, not white (#fff is banned) — but a lit crown now actually REACHES it.
      uGyrus: { value: rgb(0xece7de) },
      // The sulcal floor. NOT near-black: TRIBE's specimen is near-white with mid-grey creases, and a
      // black-floored cortex on a near-black well loses its folds into the sky behind it.
      uSulcus: { value: rgb(0x514d46) },
      uTaskLow: { value: rgb(0xa9c6a0) },
      uTaskHigh: { value: rgb(0x3f7a4a) },
      uDmnLow: { value: rgb(0xe6a99d) },
      uDmnHigh: { value: rgb(0xc44236) },
      uLight: { value: new THREE.Vector3(-0.45, 0.72, 0.85) },
      uRim: { value: rgb(0x8fa7bd) },
      // Warm key + cool fill is the oldest trick in specimen photography, and the reason a lit form
      // reads as SOLID: the shadow side is not merely darker, it is a different colour.
      uKeyCol: { value: new THREE.Vector3(1.0, 0.97, 0.92) },
      uFillCol: { value: new THREE.Vector3(0.62, 0.7, 0.82) },
      uFillDir: { value: new THREE.Vector3(0.65, -0.35, 0.35).normalize() },
      uAmbient: { value: new THREE.Vector3(0.85, 0.83, 0.8) },
      uThreshold: { value: ACTIVATION_THRESHOLD },
      uSpan: { value: ACTIVATION_SPAN },
    }),
    [],
  );

  // A slow parallax drift — enough to read as a solid being turned, never a spinning gimmick.
  useFrame(({ clock }) => {
    if (!group.current || reducedMotion) return;
    group.current.rotation.y = BASE_YAW + 0.075 * Math.sin(clock.elapsedTime * 0.16);
    group.current.rotation.x = BASE_PITCH + 0.02 * Math.sin(clock.elapsedTime * 0.11);
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
    <group ref={group} rotation={[BASE_PITCH, BASE_YAW, 0]} scale={scale}>
      <mesh
        geometry={geometry}
        onPointerMove={(e) => {
          if (!onHover || e.faceIndex == null) return;
          const idx = geometry.getIndex();
          const v = idx?.getX(e.faceIndex * 3);
          if (v == null) return;
          // The vertex's dominant parcel → that parcel's network.
          const parcel = field.blendIdx[v * field.blendK];
          if (parcel === undefined) return;
          onHover(field.parcelNet[parcel] ?? null);
        }}
        onPointerOut={() => onHover?.(null)}
      >
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} />
      </mesh>
    </group>
  );
}

/**
 * ── THE CAMERA. A 3/4 view from slightly above, which is TRIBE's, and it is most of why theirs reads
 *    as a volumetric object while a flat lateral projection reads as a sticker.
 *
 * The mesh ships LEVELLED and in a known frame (see build-cortex-mesh.mjs, which asserts it):
 *   +X = the subject's right   ·   +Y = superior   ·   −Z = ANTERIOR (the frontal pole)
 * so yawing the specimen to bring its LEFT lateral face toward the camera — the surface every
 * anatomical plate shows, and the one our label claims — is a rotation about Y.
 */
const BASE_YAW = -0.62;
const BASE_PITCH = 0.16;
/**
 * The bounding-sphere radius the specimen is scaled to, in world units. The camera sits at z = 4.6
 * with a 30° fov, so it sees ±1.23 units at the origin; 1.06 fills the well with a small margin for
 * the parallax drift to move inside without the silhouette ever touching the frame.
 */
const FIT_RADIUS = 1.06;

export interface CortexCanvasProps {
  seed: number;
  /** The predicted BOLD per network at the current scan time (from `predictedBold`). */
  bold: Record<NetworkId, number>;
  /** Scan time, seconds — the parcel drift rides on it. */
  t: number;
  reducedMotion?: boolean;
  onHover?: (net: NetworkId | null) => void;
}

export default function CortexCanvas({ seed, bold, t, reducedMotion = false, onHover }: CortexCanvasProps) {
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
        <Cortex seed={seed} bold={bold} t={t} reducedMotion={reducedMotion} onHover={onHover} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MESH_URL);
