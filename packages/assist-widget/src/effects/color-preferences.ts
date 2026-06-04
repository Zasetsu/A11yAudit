export type ColorStepFeature = "saturation" | "smartContrast" | "brightness" | "contrast";

export const COLOR_CLASSES = {
  saturation: ["aa-assist-saturation-low", "aa-assist-saturation-high"],
  smartContrast: [
    "aa-assist-smart-contrast-invert",
    "aa-assist-smart-contrast-dark",
    "aa-assist-smart-contrast-light"
  ],
  brightness: ["aa-assist-brightness-low", "aa-assist-brightness-high"],
  contrast: ["aa-assist-contrast-low", "aa-assist-contrast-high"]
} as const;

export function colorClassForStep(feature: ColorStepFeature, step: 1 | 2 | 3): string {
  const className = COLOR_CLASSES[feature]?.[step - 1];
  if (!className) throw new Error(`Invalid ${feature} step ${step}`);
  return className;
}

export const COLOR_CSS = `
html.aa-assist-monochrome,
html.aa-assist-saturation-low,
html.aa-assist-saturation-high,
html.aa-assist-brightness-low,
html.aa-assist-brightness-high,
html.aa-assist-contrast-low,
html.aa-assist-contrast-high,
html.aa-assist-smart-contrast-invert {
  --aa-assist-filter-grayscale: grayscale(0);
  --aa-assist-filter-saturation: saturate(1);
  --aa-assist-filter-brightness: brightness(100%);
  --aa-assist-filter-contrast: contrast(100%);
  --aa-assist-filter-invert: invert(0);
  filter: var(--aa-assist-filter-grayscale) var(--aa-assist-filter-saturation) var(--aa-assist-filter-brightness) var(--aa-assist-filter-contrast) var(--aa-assist-filter-invert) !important;
}
html.aa-assist-monochrome { --aa-assist-filter-grayscale: grayscale(100%); }
html.aa-assist-saturation-low { --aa-assist-filter-saturation: saturate(.5); }
html.aa-assist-saturation-high { --aa-assist-filter-saturation: saturate(2); }
html.aa-assist-brightness-low { --aa-assist-filter-brightness: brightness(85%); }
html.aa-assist-brightness-high { --aa-assist-filter-brightness: brightness(115%); }
html.aa-assist-contrast-low { --aa-assist-filter-contrast: contrast(90%); }
html.aa-assist-contrast-high { --aa-assist-filter-contrast: contrast(125%); }
html.aa-assist-smart-contrast-invert { --aa-assist-filter-invert: invert(1); }
html.aa-assist-smart-contrast-dark,
html.aa-assist-smart-contrast-dark *:not(#aa-assist-root):not(#aa-assist-root *) {
  background: #000 !important;
  border-color: #fff !important;
  color: #fff !important;
  fill: #fff !important;
}
html.aa-assist-smart-contrast-light,
html.aa-assist-smart-contrast-light *:not(#aa-assist-root):not(#aa-assist-root *) {
  background: #fff !important;
  border-color: #000 !important;
  color: #000 !important;
  fill: #000 !important;
}
`;
