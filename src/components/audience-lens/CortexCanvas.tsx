'use client';

/**
 * CortexCanvas — the folded cortex, lit.
 *
 * This is the whole reason the brain view reads as an organ instead of a leaf: a real 3D surface
 * (`@/lib/brain/cortex-mesh`) with real normals, shaded so that gyral crowns catch the light and
 * sulci fall into shadow. The activation is painted as a smooth PER-VERTEX field — no polygons, no
 * cell edges — and it is translucent enough that the folds stay visible underneath it, the way a
 * real surface map sits on the anatomy rather than replacing it.
 *
 * Client-only by construction: it is imported with `ssr: false`, so neither the mesh build nor WebGL
 * ever runs on the server.
 *
 * Dosage (LOCKED) survives: the map is DIVERGING on the task-positive / default-mode axis — a real
 * anticorrelation — so engaged cortex glows sage and only the default-mode system (mind-wandering:
 * the audience you are losing) glows coral. There is no red/yellow "hot" colormap here, and coral
 * still means exactly what it means everywhere else in the app.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BLEND_K, cortexMesh, parcelTextures, surfaceValues } from '@/lib/brain/cortex-mesh';
import { ACTIVATION_SPAN, ACTIVATION_THRESHOLD, type NetworkId } from '@/lib/brain/cortex-sim';

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
  uniform float uThreshold;
  uniform float uSpan;
  varying float vCurv;
  varying float vVal;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vView);
    float lam = max(dot(N, normalize(uLight)), 0.0);

    // Sulci are dark for TWO reasons, and both matter: the surface turns away from the light
    // (lambert), and the crease occludes its own ambient light (this AO term). Without the AO the
    // folds flatten out the moment they face the lamp.
    float ao = 0.30 + 0.70 * vCurv;
    float k = (0.32 + 0.90 * lam) * ao;

    vec3 base = mix(uSulcus, uGyrus, vCurv);
    vec3 col = base * k;

    // The activation, thresholded. Most of the cortex sits at baseline: painting every vertex is
    // what makes a generated map look like stained glass instead of a statistical map.
    float a = abs(vVal);
    if (a > uThreshold) {
      // Ramp over the range predicted BOLD ACTUALLY occupies (uSpan), not over threshold→1.0 —
      // otherwise every real response sits at the pale end and the map washes out.
      float s = clamp((a - uThreshold) / uSpan, 0.0, 1.0);
      vec3 hot = vVal > 0.0 ? mix(uTaskLow, uTaskHigh, s) : mix(uDmnLow, uDmnHigh, s);
      // Light the heat too, so it lies ON the folds instead of floating above them.
      col = mix(col, hot * k, 0.35 + 0.65 * s);
    }

    // A cool rim keeps the silhouette off the background.
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.30;
    col += uRim * rim;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const rgb = (hex: number) => new THREE.Color(hex);

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
  const mesh = useMemo(() => cortexMesh(seed), [seed]);

  const textures = useMemo(() => parcelTextures(mesh, seed), [mesh, seed]);
  const values = useMemo(() => surfaceValues(mesh, textures, bold, t), [mesh, textures, bold, t]);

  const group = useRef<THREE.Group>(null);
  // Reduced motion runs the canvas on `demand` (no idle repaint), so a new scan has to ask for the
  // one frame it needs — a buffer mutation is invisible to React and would otherwise never show.
  const invalidate = useThree((s) => s.invalidate);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    g.setAttribute('aCurv', new THREE.BufferAttribute(mesh.curv, 1));
    g.setAttribute('aVal', new THREE.BufferAttribute(new Float32Array(mesh.vertexCount), 1));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    return g;
  }, [mesh]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Push the new predicted BOLD into the surface. The attribute is reused — a fresh buffer every
  // tick would churn the GPU for nothing.
  useEffect(() => {
    const attr = geometry.getAttribute('aVal') as THREE.BufferAttribute;
    (attr.array as Float32Array).set(values);
    attr.needsUpdate = true;
    invalidate();
  }, [geometry, values, invalidate]);

  const uniforms = useMemo(
    () => ({
      uGyrus: { value: rgb(0xece7de) },
      uSulcus: { value: rgb(0x3a3835) },
      uTaskLow: { value: rgb(0xa9c6a0) },
      uTaskHigh: { value: rgb(0x3f7a4a) },
      uDmnLow: { value: rgb(0xe6a99d) },
      uDmnHigh: { value: rgb(0xc44236) },
      uLight: { value: new THREE.Vector3(-0.45, 0.72, 0.85) },
      uRim: { value: rgb(0x8fa7bd) },
      uThreshold: { value: ACTIVATION_THRESHOLD },
      uSpan: { value: ACTIVATION_SPAN },
    }),
    [],
  );

  // A slow parallax drift — enough to read as a solid being turned, never a spinning gimmick.
  useFrame(({ clock }) => {
    if (!group.current || reducedMotion) return;
    group.current.rotation.y = 0.18 + 0.1 * Math.sin(clock.elapsedTime * 0.16);
    group.current.rotation.x = 0.02 * Math.sin(clock.elapsedTime * 0.11);
  });

  return (
    <group ref={group} rotation={[0, 0.18, 0]}>
      <mesh
        geometry={geometry}
        onPointerMove={(e) => {
          if (!onHover || e.faceIndex == null) return;
          // The face's first vertex → its nearest parcel → that parcel's network.
          const v = mesh.indices[e.faceIndex * 3];
          if (v === undefined) return;
          const parcel = mesh.blendIdx[v * BLEND_K];
          if (parcel === undefined) return;
          onHover(mesh.parcelNet[parcel] ?? null);
        }}
        onPointerOut={() => onHover?.(null)}
      >
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} />
      </mesh>
    </group>
  );
}

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
      camera={{ position: [0, 0, 3.45], fov: 32 }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      style={{ width: '100%', height: '100%' }}
    >
      <Cortex seed={seed} bold={bold} t={t} reducedMotion={reducedMotion} onHover={onHover} />
    </Canvas>
  );
}
