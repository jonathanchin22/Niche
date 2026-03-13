// Re-export everything — server components import from "@niche/auth"
// Client components MUST import from "@niche/auth/client" to avoid next/headers errors
export * from "./client"
export * from "./server"
