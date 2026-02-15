/**
 * ConfigService - fetches UI configuration from the backend /config endpoint.
 * Config is loaded once at startup and cached in module-level state.
 */

const DEFAULT_CONFIG = {
  disclaimer: "DISCLAIMER — AI can make mistakes, always check the results.",
  environments: [{ id: "local", name: "Local", cluster: "local" }],
  defaultEnvironment: "local",
  models: [{ id: "gpt-oss", name: "gpt-oss" }],
  defaultModel: "gpt-oss",
};

let _config = { ...DEFAULT_CONFIG };

/**
 * Fetch config from the backend. Call once at app startup before rendering.
 * Falls back to defaults if the fetch fails.
 */
export async function loadConfig(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/config`);
    if (!response.ok) {
      throw new Error(`Config fetch failed: ${response.status}`);
    }
    _config = await response.json();
  } catch (e) {
    console.warn("Failed to load config from backend, using defaults:", e);
    _config = { ...DEFAULT_CONFIG };
  }
}

/**
 * Returns the loaded config object.
 */
export function getConfig() {
  return _config;
}
