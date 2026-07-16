import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { loadHeaderNotifications } from "@/lib/notifications/header-notifications";
import packageMetadata from "@/package.json";
export const dynamic = "force-dynamic";
export default async function PortalLayout({ children }: { children: React.ReactNode }) { const user = await requireSession(); const notifications = await loadHeaderNotifications(user.id); return <AppShell user={user} notifications={notifications} version={packageMetadata.version}>{children}</AppShell>; }
