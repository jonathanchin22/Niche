import { redirect } from "next/navigation"

// "My drinks" now lives on the profile grid.
export default function MyReviewsPage() {
  redirect("/profile")
}
