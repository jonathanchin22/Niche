/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  swcMinify: true,
  transpilePackages: ["@niche/auth", "@niche/database", "@niche/shared-types", "@niche/ui"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Each app tells the shared auth package which app it is
  env: {
    NEXT_PUBLIC_APP_ID: "brew",
  },
}

module.exports = nextConfig
