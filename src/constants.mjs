import { join } from "node:path";

export const APP_NAME = "WorkBuddy Theme Forge";
export const DEFAULT_CDP_PORT = 9223;
export const LOOPBACK_HOST = "127.0.0.1";
export const THEME_SCHEMA_VERSION = 1;
export const STYLE_ID = "wb-theme-forge-style";
export const SNAPSHOT_FILE = "snapshot.json";
export const STATE_FILE = "state.json";
// Keep state local by default so the CLI remains portable and sandbox-friendly.
export const DEFAULT_HOME = join(process.cwd(), ".wb-theme-forge");
export const THEME_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const COLOR = /^#[0-9a-f]{6}$/i;
export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export function getForgeHome() {
  return process.env.WB_THEME_FORGE_HOME || DEFAULT_HOME;
}
