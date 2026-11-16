/**
 * Central API configuration for Teorimaster Frontend
 * Uses NEXT_PUBLIC_API_URL in production (e.g., https://api.teorimaster.se or Render/Railway backend)
 * Defaults to http://localhost:4000 for local development.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
