/**
 * Configuration for Trino environments
 */
export const environments = [
  {
    id: "local",
    name: "Local",
    cluster: "local",
  },
  {
    id: "uat",
    name: "UAT",
    cluster: "uat",
  },
  {
    id: "prod",
    name: "Prod",
    cluster: "prod",
  },
];

/**
 * Get default environment ID
 */
export function getDefaultEnvironment() {
  return "uat";
}

/**
 * Get environment by ID
 */
export function getEnvironmentById(id) {
  return environments.find((env) => env.id === id) || environments[0];
}
