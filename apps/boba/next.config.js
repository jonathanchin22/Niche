/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@niche/ui", "@niche/auth", "@niche/database", "@niche/shared-types"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google OAuth avatars
    ],
  },
  // Each app tells the shared auth package which app it is
  env: {
    NEXT_PUBLIC_APP_ID: "boba",
  },
}

module.exports = nextConfig
