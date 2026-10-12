import { redirect } from "next/navigation";

/** The password lives under Security now. Old links still land in the right place. */
export default function PasswordSettingsPage() {
  redirect("/app/settings/security");
}
