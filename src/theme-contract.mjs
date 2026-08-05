export const EDITOR_COLOR_KEYS = ["primary", "secondary", "background", "surface", "text", "border", "error"];

export function themeTokens(theme, backgroundUrl = "") {
  const colors = theme.colors;
  const variables = theme.variables;
  const background = theme.background;
  const motion = theme.reducedMotion.enabled || !variables.animation ? "0ms" : `${Math.round(220 / variables.animationSpeed)}ms`;
  return {
    "--wb-primary": colors.primary,
    "--wb-secondary": colors.secondary,
    "--wb-background": colors.background,
    "--wb-surface": colors.surface,
    "--wb-text": colors.text,
    "--wb-border": colors.border,
    "--wb-error": colors.error,
    "--wb-radius": `${variables.radius}px`,
    "--wb-shadow": variables.shadow,
    "--wb-blur": `${variables.blur}px`,
    "--wb-font": variables.fontFamily,
    "--wb-font-size": `${variables.fontSize}px`,
    "--wb-line-height": String(variables.lineHeight),
    "--wb-transition": motion,
    "--wb-background-image": backgroundUrl ? `url(${JSON.stringify(backgroundUrl)})` : "none",
    "--wb-background-size": background.fit,
    "--wb-background-position": `${background.positionX}% ${background.positionY}%`,
    "--wb-background-opacity": String(background.opacity),
    "--wb-background-blur": `${background.blur}px`,
    "--wb-background-scale": String(background.zoom),
    "--wb-overlay": background.overlayColor,
    "--wb-overlay-opacity": String(background.overlayOpacity),
    "--wb-vignette": String(background.vignette)
  };
}

export function tokensToCss(tokens) {
  return Object.entries(tokens).map(([name, value]) => `${name}:${value}`).join(";");
}
