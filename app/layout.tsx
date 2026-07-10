import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "NTOP | NT Orchestration Platform", description: "ระบบบริหารลูกค้าองค์กร NT" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="th"><body>{children}</body></html>; }
