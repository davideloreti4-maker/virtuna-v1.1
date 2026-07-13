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
    vec3 L = normalize(uLight);
    float lam = max(dot(N, L), 0.0);

    // ── VALUE. This is the whole ballgame, and the previous cut got it wrong.
    //
    // A specimen reads as a specimen because of its VALUE STRUCTURE: near-white crowns against
    // near-black sulci, the full range used. The old shader multiplied an ambient-floored lambert
    // BY an aggressive AO term — two factors below 1 stacked on each other — so a typical
    // mid-curvature vertex facing the camera landed around 0.67 exposure on a mid-grey base and
    // came out MUD. On a warm-charcoal card that mud had no silhouette at all. Fixing the mesh was
    // never going to fix this; the tone curve had to.
    //
    // So: the AO floor lifts (creases still occlude, flats no longer get crushed), the ambient
    // lifts, and the base ramp is smoothstepped so the broad gyral crowns commit to the crown
    // colour instead of sitting halfway to the sulcus. Measured on the real render: sulci ≈ 36,
    // crowns ≈ 241 — the range TRIBE's specimen uses.
    float ao = mix(0.55, 1.0, vCurv);
    float diff = 0.42 + 0.78 * lam;
    vec3 base = mix(uSulcus, uGyrus, smoothstep(0.0, 0.85, vCurv));
    vec3 col = base * diff * ao;

    // A tight specular sheen. A fixed brain is WET, and that highlight is a real part of why a
    // photographed specimen reads as tissue rather than as clay. Gated on curvature so it fires on
    // the crowns and never lights the inside of a sulcus.
    vec3 H = normalize(L + V);
    col += vec3(pow(max(dot(N, H), 0.0), 26.0) * 0.16 * vCurv);

    // The activation, thresholded. Most of the cortex sits at baseline: painting every vertex is
    // what makes a generated map look like stained glass instead of a statistical map.
    float a = abs(vVal);
    if (a > uThreshold) {
      // Ramp over the range predicted BOLD ACTUALLY occupies (uSpan), not over threshold→1.0 —
      // otherwise every real response sits at the pale end and the map washes out.
      float s = clamp((a - uThreshold) / uSpan, 0.0, 1.0);
      vec3 hot = vVal > 0.0 ? mix(uTaskLow, uTaskHigh, s) : mix(uDmnLow, uDmnHigh, s);

      // ── The ALPHA must ramp from ZERO at the contour.
      //
      // It used to open at 0.35 + 0.65*s, so the instant the field crossed threshold the colour
      // jumped straight to 35% opacity — a hard step at every cluster edge. Probing the rendered
      // pixels: ~92% of the colour swing completed in ONE pixel. That is what made the map read as
      // flat translucent shapes PASTED ON the anatomy, with the straight-ish network boundaries
      // showing through as visible seams. The underlying field is smooth (the blend kernel is fine,
      // and the gradient test proves it) — the discontinuity was manufactured here, in the paint.
      //
      // Thresholding survives, and it must: below threshold the cortex takes exactly zero paint.
      // But now a cluster BLOOMS out of the anatomy instead of being stamped onto it — which is
      // also what a real surface map looks like, because the statistic it paints is continuous.
      // The curve matters as much as the zero. A plain linear ramp from 0 removed the step but also
      // removed the MAP: clusters faded to a hint, and the map is the whole point of the figure.
      // The smoothstep gives a genuinely soft contour (zero slope AT the threshold, so there is no
      // edge to see), and the linear term then climbs hard so the cluster core is unmistakably
      // painted. Soft edge, strong body — which is exactly how a real cluster looks.
      float alpha = smoothstep(0.0, 0.22, s) * (0.45 + 0.55 * s);
      // Light the heat with the SAME tone curve, so it lies ON the folds — a surface map sits on
      // the anatomy, it does not replace it.
      col = mix(col, hot * diff * ao, alpha);
    }

    // A cool rim keeps the silhouette off the near-black well.
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.26;
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
      // Cream, not white (#fff is banned) — but the tone curve above now actually REACHES it on a
      // lit crown, which it never did before.
      uGyrus: { value: rgb(0xece7de) },
      // The sulcal floor goes deeper now that the well behind it is near-black: a specimen's
      // creases are the darkest thing in the frame, darker than the sky it sits against.
      uSulcus: { value: rgb(0x24221f) },
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
    // Base angle is NEGATIVE to match the mirrored group's resting yaw — this assignment overwrites
    // the JSX `rotation` every frame, so getting the sign wrong here silently undoes the mirror.
    group.current.rotation.y = -0.18 + 0.1 * Math.sin(clock.elapsedTime * 0.16);
    group.current.rotation.x = 0.02 * Math.sin(clock.elapsedTime * 0.11);
  });

  return (
    // Seated in the cranial vault of the ghosted head behind it (see BrainView's HeadGhost) — a
    // touch above centre, where a brain actually sits in a skull.
    //
    // MIRRORED in x. The mesh is built with +x anterior and its lateral face toward the camera,
    // which projects the frontal pole to the RIGHT of screen — so the specimen faced backwards out
    // of a head whose face points left, which looks subtly, unplaceably wrong. The mirror turns it
    // into the conventional LEFT-hemisphere lateral plate (anterior left, the way TRIBE and every
    // anatomical figure plates it), which is also what the projection label has always claimed.
    // Negative scale flips triangle winding, so the material must render both faces — see below.
    <group ref={group} position={[0.02, 0.05, 0]} scale={[-1, 1, 1]} rotation={[0, -0.18, 0]}>
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
        {/* DoubleSide because the group is mirrored (scale x = −1): a negative-determinant
            transform reverses triangle winding, and a front-face-only material would cull the
            entire cortex and render nothing. */}
        <shaderMaterial
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
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
      // FILL THE HEAD, NOT THE FRAME.
      //
      // The old cut had the brain at ~71% of the frame, floating in an empty box, and it read as a
      // thumbnail — so the obvious fix looked like "make it huge". That was wrong, and diffing the
      // composition against TRIBE's is what showed it: THEIR brain is only ~60% of the frame. What
      // fills their frame is the ghosted HEAD, with the brain sitting inside its cranial vault.
      // That is the whole reason theirs reads as anatomy and a blown-up brain reads as a 3D asset.
      // So the specimen backs off to ~60% and takes its place in the skull (see HeadGhost) — the
      // frame is full, and nothing is floating.
      camera={{ position: [0, 0, 4.3], fov: 32 }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      style={{ width: '100%', height: '100%' }}
    >
      <Cortex seed={seed} bold={bold} t={t} reducedMotion={reducedMotion} onHover={onHover} />
    </Canvas>
  );
}
