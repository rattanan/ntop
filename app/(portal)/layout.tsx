import { AppShell } from "@/components/app-shell";
import { FormFieldAssistance } from "@/components/form-field-assistance";
import { ExpandableTextAssistance } from "@/components/expandable-text-assistance";
import { ProvinceInputAssistance } from "@/components/province-input-assistance";
import { requireSession } from "@/lib/auth";
import { loadAuthorizationContext, loadGrantedPermissions } from "@/lib/authorization/authorization-context";
import { loadHeaderNotifications } from "@/lib/notifications/header-notifications";
import packageMetadata from "@/package.json";
export const dynamic = "force-dynamic";
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const authorization = await loadAuthorizationContext({ actorId: user.id, legacyRole: user.role });
  const [notifications, grantedPermissions] = await Promise.all([
    loadHeaderNotifications(authorization),
    loadGrantedPermissions(authorization),
  ]);
  const roles = [...new Set(authorization.assignments.map((assignment) => assignment.role))];

  return (
    <AppShell
      user={{ name: user.name, roles, grantedPermissions }}
      notifications={notifications}
      version={packageMetadata.version}
    >
      <FormFieldAssistance />
      <ExpandableTextAssistance />
      <ProvinceInputAssistance />
      {children}
    </AppShell>
  );
}
