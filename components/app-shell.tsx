import Link from "next/link";
import { logout } from "@/app/actions";
import { ROLE_LABELS } from "@/lib/constants";

export function AppShell({ children, user }: { children: React.ReactNode; user: { name: string; role: keyof typeof ROLE_LABELS } }) {
  return <div className="shell"><header className="topbar"><div className="brand"><span className="brand-mark">NT</span> NT Orchestration Platform</div><span>{user.name} · {ROLE_LABELS[user.role]}</span></header><nav className="nav"><Link href="/dashboard">หน้าแรก</Link><Link href="/customers">ลูกค้า</Link><Link href="/opportunities">โอกาสขาย</Link><form action={logout} style={{marginLeft:"auto"}}><button className="secondary" type="submit">ออกจากระบบ</button></form></nav><main className="content">{children}</main></div>;
}
