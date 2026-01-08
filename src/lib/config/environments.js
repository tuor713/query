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
    id: "uat-mw",
    name: "UAT MW",
    cluster: "uat-mw",
  },
  {
    id: "prod",
    name: "Prod",
    cluster: "prod",
  },
  {
    id: "prod-nj",
    name: "Prod NJ",
    cluster: "prod-nj",
  },
  {
    id: "prod-mw",
    name: "Prod MW",
    cluster: "prod-mw",
  },
  {
    id: "starburst-prod-mw",
    name: "Starburst Prod MW",
    cluster: "starburst-prod-mw",
  },
  {
    id: "starburst-prod-nj",
    name: "Starburst Prod NJ",
    cluster: "starburst-prod-nj",
  },
  {
    id: "starburst-uat",
    name: "Starburst UAT",
    cluster: "starburst-uat",
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
