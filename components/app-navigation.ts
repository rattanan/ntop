import type { ComponentType } from "react";
import {
  Activity,
  ArchiveRestore,
  Boxes,
  Building2,
  FileCheck2,
  FileText,
  Gauge,
  Handshake,
  History,
  LayoutDashboard,
  PackageSearch,
  Settings,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  keywords?: string;
};

export type NavGroup = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  items: NavItem[];
  adminOnly?: boolean;
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "งานขาย",
    icon: Handshake,
    items: [
      { label: "Prospect", href: "/prospects", icon: PackageSearch, keywords: "ผู้มุ่งหวัง" },
      { label: "Lead", href: "/leads", icon: Target, keywords: "ลูกค้าเป้าหมาย" },
      { label: "ลูกค้า", href: "/customers", icon: Users, keywords: "customer account" },
      { label: "โอกาสขาย", href: "/opportunities", icon: Gauge, keywords: "opportunity deal" },
      { label: "กิจกรรม", href: "/activities", icon: Activity, keywords: "meeting task" },
    ],
  },
  {
    label: "Commercial",
    icon: FileCheck2,
    items: [
      { label: "Sales Pipeline", href: "/pipeline", icon: LayoutDashboard },
      { label: "Coverage", href: "/coverage", icon: PackageSearch },
      { label: "บริการและราคา", href: "/products", icon: Boxes, keywords: "product service" },
      { label: "ใบเสนอราคา", href: "/quotes", icon: FileText, keywords: "quote quotation" },
      { label: "การอนุมัติ", href: "/approvals", icon: ShieldCheck, keywords: "approval" },
    ],
  },
  {
    label: "ผู้ดูแลระบบ",
    icon: Settings,
    adminOnly: true,
    items: [
      { label: "Users & Roles", href: "/admin/users", icon: Users },
      { label: "Organization & Approvers", href: "/admin/organization", icon: Building2 },
      { label: "Login & Audit Log", href: "/admin/audit", icon: History },
      { label: "Deleted Records", href: "/admin/deleted-records", icon: ArchiveRestore },
      { label: "AI Settings", href: "/admin/ai-settings", icon: Settings },
      { label: "Risk Rules", href: "/admin/ai-risk", icon: Gauge },
      { label: "Workflow & Authority", href: "/admin/workflow", icon: ShieldCheck },
      { label: "Lead Assignment Rules", href: "/admin/lead-management", icon: Target },
    ],
  },
];

export const QUICK_CREATE_ITEMS = [
  { label: "สร้าง Prospect", href: "/prospects/new" },
  { label: "สร้าง Lead", href: "/leads/new" },
  { label: "สร้างลูกค้า", href: "/customers/new" },
  { label: "สร้างโอกาสขาย", href: "/opportunities/new" },
  { label: "บันทึกกิจกรรม", href: "/activities/new" },
  { label: "สร้างใบเสนอราคา", href: "/quotes/new" },
];

export function visibleNavigation(isAdmin: boolean) {
  return NAV_GROUPS.filter((group) => !group.adminOnly || isAdmin);
}

export function navigationLabel(pathname: string) {
  const candidates = NAV_GROUPS.flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return candidates[0]?.label ?? "หน้าหลัก";
}
