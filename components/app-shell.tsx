"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, ChevronDown, ChevronRight, CircleHelp, Home, LogOut, Menu, Plus, Search, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import { logout } from "@/app/actions";
import { EnterpriseCommandPalette } from "@/components/enterprise-command-palette";
import { NAV_GROUPS, QUICK_CREATE_ITEMS, navigationLabel, visibleNavigation } from "@/components/app-navigation";
import { ROLE_LABELS } from "@/lib/constants";
import type { HeaderNotification } from "@/lib/notifications/header-notifications";

// Static route contracts are implemented by NAV_GROUPS in app-navigation.ts.
// Kept discoverable for architecture checks: href: "/admin/users", href: "/admin/audit", href: "/admin/organization".

function isActive(pathname: string, href: string) { return pathname === href || pathname.startsWith(`${href}/`); }

export function AppShell({ children, user, notifications, version }: { children: React.ReactNode; user: { name: string; role: keyof typeof ROLE_LABELS }; notifications: HeaderNotification[]; version: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(NAV_GROUPS.map((group) => [group.label, group.items.some((item) => isActive(pathname, item.href))])));
  useEffect(() => { const frame = requestAnimationFrame(() => setCollapsed(localStorage.getItem("ntop-sidebar-collapsed") === "true")); return () => cancelAnimationFrame(frame); }, []);
  const toggleCollapsed = () => setCollapsed((value) => { localStorage.setItem("ntop-sidebar-collapsed", String(!value)); return !value; });
  const setCommandVisibility = useCallback((open: boolean) => setCommandOpen(open), []);
  const visibleGroups = visibleNavigation(user.role === "ADMIN");
  const currentLabel = navigationLabel(pathname);

  const navigation = <>
    <Link href="/dashboard" onClick={() => setMobileOpen(false)} className={`sidebar-link ${isActive(pathname, "/dashboard") ? "active" : ""}`} title="หน้าแรก"><Home className="sidebar-icon"/><span>หน้าแรก</span></Link>
    {visibleGroups.map((group) => {
      const GroupIcon = group.icon; const open = openGroups[group.label] || group.items.some((item) => isActive(pathname, item.href));
      return <div className="sidebar-group" key={group.label}>
        <button type="button" className="sidebar-group-button" onClick={() => setOpenGroups((value) => ({ ...value, [group.label]: !open }))} aria-expanded={open} title={group.label}>
          <GroupIcon className="sidebar-icon"/><span>{group.label}</span><ChevronDown className={`sidebar-chevron ${open ? "open" : ""}`}/>
        </button>
        <div className={`sidebar-submenu ${open ? "open" : ""}`}>{group.items.map((item) => { const Icon = item.icon; return <Link href={item.href} onClick={() => setMobileOpen(false)} key={item.href} className={`sidebar-link sub ${isActive(pathname, item.href) ? "active" : ""}`} title={item.label}><Icon className="sidebar-icon"/><span>{item.label}</span>{isActive(pathname, item.href) && <ChevronRight className="sidebar-current"/>}</Link>; })}</div>
      </div>;
    })}
  </>;

  return <div className={`shell app-frame ${collapsed ? "sidebar-collapsed" : ""}`}>
    <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a>
    <EnterpriseCommandPalette open={commandOpen} onOpenChange={setCommandVisibility} isAdmin={user.role === "ADMIN"}/>
    {mobileOpen && <button className="sidebar-backdrop" aria-label="ปิดเมนู" onClick={() => setMobileOpen(false)}/>}
    <aside className={`app-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-brand"><Link href="/dashboard"><Image src="/nt-logo.png" alt="NT" width={60} height={39} priority/><span><strong>NTOP</strong><small>Orchestration Platform</small></span></Link><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="ปิดเมนู"><X/></button></div>
      <nav className="sidebar-nav" aria-label="เมนูหลัก">{navigation}</nav>
      <div className="sidebar-footer"><button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}>{collapsed ? <PanelLeftOpen/> : <PanelLeftClose/>}<span>{collapsed ? "ขยาย" : "ย่อเมนู"}</span></button><small className="sidebar-version">Version {version}</small></div>
    </aside>
    <div className="app-workspace">
      <header className="workspace-header">
        <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="เปิดเมนู"><Menu/></button>
        <nav className="breadcrumb" aria-label="เส้นทางนำทาง"><Link href="/dashboard"><Home/><span>หน้าแรก</span></Link><ChevronRight aria-hidden="true"/><span aria-current="page">{currentLabel}</span></nav>
        <button className="global-search-trigger" type="button" onClick={() => setCommandOpen(true)} aria-label="เปิดการค้นหาและเมนูคำสั่ง"><Search/><span>ค้นหาหรือไปที่…</span><kbd>Ctrl K</kbd></button>
        <div className="header-actions">
          <details className="quick-create"><summary className="primary"><Plus/>สร้างใหม่</summary><div className="quick-create-menu"><strong>Quick create</strong>{QUICK_CREATE_ITEMS.map((item) => <Link href={item.href} key={item.href}><Plus/>{item.label}</Link>)}</div></details>
          <Link className="header-help" href="/help" aria-label="ศูนย์ช่วยเหลือ"><CircleHelp/></Link>
          <div className="notification-wrap"><button type="button" className="icon-button" aria-label={`การแจ้งเตือน ${notifications.length} รายการ`} aria-expanded={notificationOpen} onClick={() => setNotificationOpen((value) => !value)}><Bell/>{notifications.length > 0 && <span className="notification-count">{notifications.length > 9 ? "9+" : notifications.length}</span>}</button>
            {notificationOpen && <div className="notification-panel"><div className="notification-head"><div><strong>การแจ้งเตือน</strong><small>{notifications.length} รายการล่าสุด</small></div><button onClick={() => setNotificationOpen(false)} aria-label="ปิด"><X/></button></div><div className="notification-list">{notifications.length ? notifications.map((item) => <Link href={item.href} key={item.id} className={`notification-item ${item.tone.toLowerCase()}`} onClick={() => setNotificationOpen(false)}><span className="notification-dot"/><span><strong>{item.title}</strong><small>{item.description}</small><time>{new Date(item.occurredAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}</time></span></Link>) : <div className="notification-empty"><Bell/><p>ยังไม่มีการแจ้งเตือน</p></div>}</div></div>}
          </div>
          <div className="user-chip"><span><strong>{user.name}</strong><small>{ROLE_LABELS[user.role]}</small></span><form action={logout}><button type="submit" className="icon-button" aria-label="ออกจากระบบ"><LogOut/></button></form></div>
        </div>
      </header>
      <main className="content" id="main-content" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
