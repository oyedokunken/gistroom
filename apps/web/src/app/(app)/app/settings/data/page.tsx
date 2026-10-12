import { redirect } from "next/navigation";

/** Data saver sits with Appearance now. Old links still land in the right place. */
export default function DataSettingsPage() {
  redirect("/app/settings/appearance");
}
