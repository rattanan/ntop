import Link from "next/link";

export type ModuleTab = {
  label: string;
  href: string;
  active: boolean;
};

export function ModuleTabs({ label, items }: { label: string; items: ModuleTab[] }) {
  return (
    <nav className="module-tabs" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={item.active ? "active" : ""}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
