import type { ReactNode } from "react";

import type { FormState } from "@/app/action-types";

export type NoticeVariant = "info" | "warning" | "error" | "success";

export function Notice({ children, variant = "warning", className = "", role }: { children?: ReactNode; variant?: NoticeVariant; className?: string; role?: "alert" | "status" }) {
  const liveRole = variant === "error" ? "alert" : "status";
  return <div className={`notice notice-${variant} ${className}`.trim()} role={role ?? liveRole} aria-live={variant === "error" ? "assertive" : "polite"}>{children}</div>;
}

export function FormNotice({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <Notice variant={state.status ?? "error"}>{state.message}</Notice>;
}
