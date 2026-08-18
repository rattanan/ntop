"use client";

import { RotateCcw } from "lucide-react";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="dashboard-state dashboard-error" data-testid="dashboard-error" role="alert">
    <span className="dashboard-state-code">!</span>
    <h1>โหลด Dashboard ไม่สำเร็จ</h1>
    <p>ระบบไม่สามารถอ่านข้อมูลล่าสุดได้ โปรดลองใหม่อีกครั้ง หากยังเกิดปัญหาให้ส่ง Correlation ID จาก Network log แก่ผู้ดูแลระบบ</p>
    <button type="button" className="primary" onClick={reset}><RotateCcw aria-hidden="true"/>ลองใหม่</button>
  </section>;
}
