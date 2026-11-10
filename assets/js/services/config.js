function configuredUrl(value, fallback) {
  return String(value || fallback).replace(/\/+$/, "");
}

// Browser-facing Cortex services. Keep local defaults useful for the sibling
// repository development layout; deployments should set the Vite variables.
export const SERVER_URL = configuredUrl(
  import.meta.env.VITE_CORTEX_CORE_URL || import.meta.env.VITE_SERVER_URL,
  "https://extra-details-contract-trustee.trycloudflare.com",
);

export const INFOVIZ_URL = configuredUrl(
  import.meta.env.VITE_CORTEX_INFOVIZ_URL,
  "/infoviz",
);

// Whole-brain inference is a separate service and remains independently
// configurable while its current deployment is migrated.
export const SERVER_URL_Whole_Brain = configuredUrl(
  import.meta.env.VITE_CORTEX_WHOLE_BRAIN_URL,
  "http://localhost:5557",
);
