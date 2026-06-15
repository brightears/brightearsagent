// The artist profile editor merged into the unified Control Room (Phase 2b).
// This route now only redirects to the Control Room's "Voice & profile"
// section so old links, bookmarks, and the profileStrength hints keep working.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ProfileRedirect() {
  redirect("/dashboard/settings#profile");
}
