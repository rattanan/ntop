import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function PortalLayout({ children }: { children: React.ReactNode }) { const user = await requireSession(); return <AppShell user={user}>{children}</AppShell>; }
