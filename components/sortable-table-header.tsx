import Link from "next/link";
import type { AriaAttributes, ReactNode } from "react";

type Props = {
  basePath: string;
  column: string;
  currentOrder: "asc" | "desc";
  currentSort: string;
  label: ReactNode;
  params?: Record<string, string>;
};

export function SortableTableHeader({ basePath, column, currentOrder, currentSort, label, params = {} }: Props) {
  const active = currentSort === column;
  const nextOrder = active && currentOrder === "asc" ? "desc" : "asc";
  const search = new URLSearchParams(params);
  search.set("sort", column);
  search.set("order", nextOrder);
  search.delete("page");
  const ariaSort: AriaAttributes["aria-sort"] = active ? (currentOrder === "asc" ? "ascending" : "descending") : "none";
  return <th aria-sort={ariaSort}><Link className="table-sort" href={`${basePath}?${search.toString()}`}>{label}<span aria-hidden="true">{active ? currentOrder === "asc" ? "↑" : "↓" : "↕"}</span></Link></th>;
}
