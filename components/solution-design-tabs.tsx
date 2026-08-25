"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type TabKey = "services" | "sites" | "components" | "surveys" | "boqs" | "traceability" | "versions";

const definitions: Array<{ key: TabKey; label: string; description: string }> = [
  { key: "services", label: "Services", description: "เลือกบริการและ Catalog Item" },
  { key: "sites", label: "Sites", description: "จุดติดตั้งของลูกค้า" },
  { key: "components", label: "Components", description: "องค์ประกอบทางเทคนิค" },
  { key: "surveys", label: "Surveys", description: "คำขอและผลสำรวจหน้างาน" },
  { key: "boqs", label: "BOQ", description: "รายการต้นทุนและราคาขาย" },
  { key: "traceability", label: "Traceability", description: "เชื่อม Requirement และความเสี่ยง" },
  { key: "versions", label: "Versions", description: "ประวัติ Version และ Review" },
];

export function SolutionDesignTabs({ panels }: { panels: Record<TabKey, ReactNode> }) {
  const [active, setActive] = useState<TabKey>("services");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % definitions.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + definitions.length) % definitions.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = definitions.length - 1;
    else return;
    event.preventDefault();
    setActive(definitions[next].key);
    tabRefs.current[next]?.focus();
  };
  return <div className="solution-design-tabs">
    <div className="solution-tab-list" role="tablist" aria-label="ส่วนงาน Solution Design">
      {definitions.map((tab, index) => <button key={tab.key} ref={(node) => { tabRefs.current[index] = node; }} type="button" role="tab" id={`solution-tab-${tab.key}`} aria-controls={`solution-panel-${tab.key}`} aria-selected={active === tab.key} tabIndex={active === tab.key ? 0 : -1} onClick={() => setActive(tab.key)} onKeyDown={(event) => selectFromKeyboard(event, index)}>
        <span>{tab.label}</span><small>{tab.description}</small>
      </button>)}
    </div>
    {definitions.map((tab) => <section key={tab.key} className="solution-tab-panel" role="tabpanel" id={`solution-panel-${tab.key}`} aria-labelledby={`solution-tab-${tab.key}`} hidden={active !== tab.key}>{active === tab.key ? panels[tab.key] : null}</section>)}
  </div>;
}
