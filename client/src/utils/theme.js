export const DEFAULT_ACCENT_COLOR = "#22d3ee";
const THEME_STORAGE_KEY = "pocketlan-accent-color";

function hexToRgb(hex) {
  const normalized = normalizeAccentColor(hex);
  const value = Number.parseInt(normalized.slice(1), 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function contrastFor({ r, g, b }) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#07111f" : "#ffffff";
}

export function normalizeAccentColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color : DEFAULT_ACCENT_COLOR;
}

export function getStoredAccentColor() {
  try {
    return normalizeAccentColor(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_ACCENT_COLOR;
  }
}

export function storeAccentColor(color) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizeAccentColor(color));
  } catch {
    // Storage can be unavailable in private or embedded browser modes.
  }
}

export function applyAccentColor(color) {
  const normalized = normalizeAccentColor(color);
  const rgb = hexToRgb(normalized);
  const root = document.documentElement;

  root.style.setProperty("--accent", normalized);
  root.style.setProperty("--accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.style.setProperty("--accent-contrast", contrastFor(rgb));
}
