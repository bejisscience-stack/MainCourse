/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Performance optimizations
  compress: true,

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // SECURITY (CSP-02): dangerouslyAllowSVG enabled for next/image SVG rendering.
    // Mitigated by restrictive contentSecurityPolicy below (script-src 'none', sandbox).
    // Current SVG sources: admin-uploaded course thumbnails and platform assets only.
    // No user-uploaded SVGs are accepted. If user SVG uploads are added in the future,
    // implement DOMPurify sanitization in the upload handler before storage.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "bvptqdmhuumjbyfnjxdt.supabase.co" },
      { protocol: "https", hostname: "nbecbsbuerdtakxkrduw.supabase.co" },
    ],
  },

  // Enable SWC minification
  swcMinify: true,

  // Optimize production builds
  productionBrowserSourceMaps: false,

  // Redirects for removed pages
  async redirects() {
    return [
      {
        source: "/coming-soon",
        destination: "/courses",
        permanent: true,
      },
    ];
  },

  // Headers for performance and security
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Prevent browsers/CDN from caching HTML pages so middleware always runs
        source:
          "/((?!_next/static|_next/image|.*\\.(?:jpg|jpeg|png|gif|webp|avif|svg|ico|js|css)).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
        ],
      },
      {
        source: "/:path*\\.(jpg|jpeg|png|gif|webp|avif|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
