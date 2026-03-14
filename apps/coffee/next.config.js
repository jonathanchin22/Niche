/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@niche/auth", "@niche/database", "@niche/shared-types", "@niche/ui"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Each app tells the shared auth package which app it is
  env: {
    NEXT_PUBLIC_APP_ID: "brew",
  },
}

module.exports = nextConfig
