"use client";

import { useRouter } from "next/navigation";
import { Columns3 } from "lucide-react";

const columnOptions = [
  ["lead", "Lead / บริษัท"],
  ["source", "แหล่งที่มา"],
  ["status", "สถานะ"],
  ["score", "Score"],
  ["followUp", "ติดตาม"],
  ["owner", "ผู้รับผิดชอบ"],
  ["actions", "การทำงาน"],
] as const;

export function LeadColumnVisibilityControls({
  query,
  columns,
}: {
  query: Record<string, string>;
  columns: string[];
}) {
  const router = useRouter();

  const toggleColumn = (value: string) => {
    const next = columns.includes(value)
      ? columns.filter((column) => column !== value)
      : [...columns, value];
    if (next.length === 0) return;
    const parameters = new URLSearchParams(query);
    parameters.delete("page");
    parameters.set("columns", next.join(","));
    router.push(`/leads?${parameters}`);
  };

  return (
    <details className="column-visibility">
      <summary className="secondary"><Columns3 aria-hidden="true" />คอลัมน์</summary>
      <fieldset className="column-visibility-menu">
        <legend>คอลัมน์ที่แสดง</legend>
        {columnOptions.map(([value, label]) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={columns.includes(value)}
              disabled={columns.length === 1 && columns.includes(value)}
              onChange={() => toggleColumn(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
    </details>
  );
}
