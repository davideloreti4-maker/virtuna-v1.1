/**
 * Fragment shader for the outer glass shell.
 * Creates a nearly invisible shell with soft pink rim glow only.
 * Reference: https://dribbble.com/shots/24801507
 */
export const shellFragmentShader = /* glsl */ `
uniform vec3 uRimColor;       // Soft pink rim color
uniform float uFresnelPower;
uniform float uGlowIntensity;
uniform float uOpacity;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vDisplacement;

void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

  // Fresnel - only visible at extreme rim
  float fresnel = 1.0 - max(dot(viewDirection, vNormal), 0.0);

  // Sharp falloff - only shows at very edge
  float rimFactor = pow(fresnel, uFresnelPower);

  // Soft outer glow extends slightly further
  float glowFactor = pow(fresnel, uFresnelPower * 0.5) * 0.3;

  // Color: soft pink glow at rim
  vec3 color = uRimColor * uGlowIntensity;

  // Alpha: almost completely transparent, only rim visible
  // rimFactor is 0 in center, ~1 at extreme edge
  float alpha = (rimFactor * 0.8 + glowFactor) * uOpacity;

  gl_FragColor = vec4(color, alpha);
}
`
