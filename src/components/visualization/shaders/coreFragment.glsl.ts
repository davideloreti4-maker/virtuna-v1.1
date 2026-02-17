/**
 * Fragment shader for the inner glowing core.
 * Creates a bright, warm orange center with radial gradient.
 */
export const coreFragmentShader = /* glsl */ `
uniform vec3 uColorCenter;    // Bright orange/red center
uniform vec3 uColorEdge;      // Darker orange edge
uniform float uGlowIntensity;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vDisplacement;

void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

  // Radial gradient - brighter in center
  float facing = max(dot(viewDirection, vNormal), 0.0);
  facing = pow(facing, 0.6); // Softer falloff

  // Mix colors - bright center to darker edge
  vec3 color = mix(uColorEdge, uColorCenter, facing);

  // Add glow emission
  color *= uGlowIntensity;

  // Subtle variation from displacement
  color += vec3(vDisplacement * 0.05);

  // Fully opaque core
  gl_FragColor = vec4(color, 1.0);
}
`
