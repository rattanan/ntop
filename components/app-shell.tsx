import Link from "next/link";
import Image from "next/image";
import { logout } from "@/app/actions";
import { ROLE_LABELS } from "@/lib/constants";

export function AppShell({ children, user }: { children: React.ReactNode; user: { name: string; role: keyof typeof ROLE_LABELS } }) {
  return <div className="shell"><header className="topbar"><div className="brand"><Image src="/nt-logo.png" alt="NT" width={60} height={39} priority /><span className="brand-divider" aria-hidden="true" /><span className="brand-title">NT Orchestration Platform</span></div><nav className="nav" aria-label="เมนูหลัก"><Link href="/dashboard">หน้าแรก</Link><Link href="/leads">Lead</Link><Link href="/customers">ลูกค้า</Link><Link href="/opportunities">โอกาสขาย</Link><Link href="/coverage">Coverage</Link><Link href="/products">บริการ</Link><Link href="/quotes">ใบเสนอราคา</Link><Link href="/activities">กิจกรรม</Link></nav><div className="user-actions"><span>{user.name} · {ROLE_LABELS[user.role]}</span><form action={logout}><button className="secondary" type="submit">ออกจากระบบ</button></form></div></header><main className="content">{children}</main></div>;
}
