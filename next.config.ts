import type { NextConfig } from "next";

// The backend URL is now used ONLY server-side (for the rewrite proxy below).
// The browser never sees it — every API call goes to the same origin as the
// customer app, and Next.js dev/prod server forwards `/api/*` to the backend.
// Per audit §4 architecture recommendations.
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Next.js dev mode requires 'unsafe-eval' for HMR/Fast Refresh.
const isDev = process.env.NODE_ENV !== "production";

// Same-origin API means connect-src 'self' is sufficient for backend calls.
// Stripe domains stay listed because we navigate to checkout.stripe.com.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://checkout.stripe.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  `connect-src 'self' https://api.stripe.com https://checkout.stripe.com${isDev ? " ws: wss:" : ""}`,
 
  `frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com`,
  `frame-ancestors 'none'`,
  `form-action 'self' https://checkout.stripe.com https://buy.stripe.com`,
  `base-uri 'self'`,
  `object-src 'none'`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")',
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    // Proxy every /api/* call through the Next.js server to the backend.
    // The browser only sees same-origin requests; the backend URL is hidden.
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
