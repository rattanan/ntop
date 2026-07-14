import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth";

export default async function ProspectImportPage() {
  await requireSession();
  redirect("/prospects?tab=import");
}
