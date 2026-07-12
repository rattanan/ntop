import { requireSession } from "@/lib/auth";

import {
  assertPermission,
  type Permission,
  type PermissionPolicy,
  permissionPolicy,
} from "./permission-policy";

export async function requirePermission(
  permission: Permission,
  policy: PermissionPolicy = permissionPolicy,
) {
  const session = await requireSession();

  assertPermission({ role: session.role }, permission, policy);

  return session;
}
