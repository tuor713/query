/**
 * Configuration for Trino environments — reads from ConfigService (loaded at startup).
 */
import { getConfig } from "../services/ConfigService.js";

/**
 * Get the list of available environments.
 */
export function getEnvironments() {
  return getConfig().environments;
}

/**
 * Get default environment ID
 */
export function getDefaultEnvironment() {
  return getConfig().defaultEnvironment;
}

/**
 * Get environment by ID
 */
export function getEnvironmentById(id) {
  const envs = getEnvironments();
  return envs.find((env) => env.id === id) || envs[0];
}
