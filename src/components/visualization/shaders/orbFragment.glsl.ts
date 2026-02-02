/**
 * Fragment shader with gradient colors and fresnel rim lighting.
 * Creates the glass-like appearance with orange core to magenta rim.
 */
export const orbFragmentShader = /* glsl */ `
uniform vec3 uColorCore;      // Orange center
uniform vec3 uColorMid;       // Coral/Pink middle
uniform vec3 uColorRim;       // Magenta/Purple rim
uniform float uFresnelPower;
uniform float uFresnelIntensity;
uniform float uGlowIntensity;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying float vDisplacement;

void main() {
  // Calculate view direction for fresnel
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

  // Fresnel calculation - stronger at edges (grazing angles)
  float fresnel = 1.0 - max(dot(viewDirection, vNormal), 0.0);
  fresnel = pow(fresnel, uFresnelPower);

  // Gradient based on fresnel (center to rim)
  // Orange core -> Coral middle -> Magenta rim
  vec3 color = mix(uColorCore, uColorMid, fresnel * 0.6);
  color = mix(color, uColorRim, pow(fresnel, 1.5));

  // Add rim glow (stronger at edges)
  vec3 rimGlow = uColorRim * fresnel * uFresnelIntensity * uGlowIntensity;
  color += rimGlow;

  // Subtle color variation based on displacement for organic look
  color += vec3(vDisplacement * 0.08);

  // Alpha: slightly transparent in center, more opaque at edges
  float alpha = 0.85 + fresnel * 0.15;

  gl_FragColor = vec4(color, alpha);
}
`
