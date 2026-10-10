export interface CspInput {
  nonce: string;
  isDev: boolean;
  realtimeUrl: string;
  livekitUrl?: string;
  supabaseUrl?: string;
}

function origins(url: string | undefined): string[] {
  if (!url) return [];
  try {
    const u = new URL(url);
    const ws = u.protocol === "https:" ? "wss:" : "ws:";
    return [u.origin, `${ws}//${u.host}`];
  } catch {
    return [];
  }
}

/** Hashes of style tags injected by third party libraries that cannot take a nonce. See tests/unit/vaul-style-hash.test.ts. */
export const EXTERNAL_STYLE_HASHES = [
  // vaul drawer styles
  "sha256-YIjArHm2rkb5J7hX9lUM1bnQ3Kp61MTfluMGkuyKwDw=",
  // empty style tag: vaul inserts the element before it appends the text node
  "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=",
] as const;

/** Content Security Policy from Section 20. A fresh nonce is generated per request. */
export function buildCsp({ nonce, isDev, realtimeUrl, livekitUrl, supabaseUrl }: CspInput): string {
  const connect = [
    "'self'",
    ...origins(realtimeUrl),
    ...origins(livekitUrl),
    ...origins(supabaseUrl),
    "https://*.supabase.co",
  ];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", `'nonce-${nonce}'`, ...EXTERNAL_STYLE_HASHES.map((h) => `'${h}'`)],
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://*.supabase.co"],
    "media-src": ["'self'", "blob:", "https://*.supabase.co"],
    "font-src": ["'self'"],
    "connect-src": connect,
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://accounts.google.com"],
    "frame-ancestors": ["'none'"],
    "report-uri": ["/api/csp-report"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** Static security headers that do not depend on the request. */
export const staticSecurityHeaders: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "microphone=(self), camera=(self), geolocation=(), payment=()",
};
