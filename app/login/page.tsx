import Image from "next/image";
import { LoginForm } from "@/components/forms";
export default function LoginPage() { return <main className="login"><section className="card login-card"><div className="brand"><Image src="/nt-logo.png" alt="National Telecom" width={164} height={69} priority /></div><h1>เข้าสู่ระบบ</h1><p className="eyebrow">ระบบบริหารลูกค้าองค์กร National Telecom</p><LoginForm /></section></main>; }
