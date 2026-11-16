/**
 * Central API configuration for Teorimaster Frontend on Vercel Services.
 *
 * - On the server (Vercel Functions / SSR / Route Handlers):
 *   Uses the Vercel internal service binding `BACKEND_URL` injected by vercel.json.
 * - In the browser:
 *   Defaults to "" (same-origin relative path) so requests route seamlessly
 *   through Vercel's top-level rewrite `/api/(.*) -> backend`.
 * - Standalone local development fallback:
 *   Uses NEXT_PUBLIC_API_URL or http://localhost:4000 when running Next.js without vercel dev.
 */
function resolveApiBaseUrl(): string {
  // Server-side: read Vercel's injected internal service binding
  if (typeof window === "undefined") {
    return (
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:4000"
    ).replace(/\/$/, "");
  }

  // Client-side: if an external backend URL was explicitly configured, use it
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }

  // Client-side standalone local fallback (when running `npm run dev` on port 3000 without vercel dev)
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
    window.location.port === "3000"
  ) {
    return "http://localhost:4000";
  }

  // Client-side on Vercel deployment: relative to current origin
  return "";
}

export const API_BASE_URL = resolveApiBaseUrl();
