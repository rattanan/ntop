"use client";

import { useEffect } from "react";

import { getFormFieldMetadata } from "@/lib/form-field-metadata";

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
let assistanceId = 0;

function controlForLabel(label: HTMLLabelElement) {
  if (label.htmlFor) return document.getElementById(label.htmlFor) as FormControl | null;
  return label.querySelector<FormControl>("input:not([type=hidden]), select, textarea");
}

function helpElement(control: FormControl, labelText: string, standalone = false) {
  const help = getFormFieldMetadata(control.name, labelText);
  assistanceId += 1;
  const helpId = `${control.id || control.name.replace(/[^a-zA-Z0-9_-]/g, "-")}-field-help-${assistanceId}`;
  const wrapper = document.createElement("span");
  wrapper.className = `field-help${standalone ? " field-help-standalone" : ""}`;
  wrapper.dataset.fieldHelp = "true";
  const trigger = document.createElement("span");
  trigger.className = "field-help-trigger";
  trigger.tabIndex = 0;
  trigger.setAttribute("role", "button");
  trigger.setAttribute("aria-label", `คำอธิบายฟิลด์ ${labelText}`);
  trigger.setAttribute("aria-describedby", helpId);
  trigger.textContent = "?";
  const tooltip = document.createElement("span");
  tooltip.className = "field-help-tooltip";
  tooltip.id = helpId;
  tooltip.setAttribute("role", "tooltip");
  const description = document.createElement("strong");
  description.textContent = help.description;
  const example = document.createElement("span");
  example.textContent = `ตัวอย่าง: ${help.example}`;
  tooltip.append(description, example);
  wrapper.append(trigger, tooltip);
  return wrapper;
}

function decorate(root: ParentNode) {
  root.querySelectorAll<HTMLLabelElement>("form label").forEach((label) => {
    if (label.dataset.fieldAssistance === "true" || label.closest(".field-help")) return;
    const control = controlForLabel(label);
    if (!control?.name || ["checkbox", "radio", "hidden"].includes(control.type)) return;
    const labelText = (label.querySelector(":scope > span")?.textContent ?? label.childNodes[0]?.textContent ?? control.name).replace("*", "").trim();
    label.append(helpElement(control, labelText));
    label.dataset.fieldAssistance = "true";
    control.dataset.fieldAssistance = "true";
  });

  root.querySelectorAll<FormControl>("form input:not([type=hidden]):not([type=checkbox]):not([type=radio]), form select, form textarea").forEach((control) => {
    if (!control.name || control.dataset.fieldAssistance === "true") return;
    const labelText = control.getAttribute("aria-label") ?? control.getAttribute("placeholder") ?? control.name;
    const help = helpElement(control, labelText, true);
    const anchor = control.closest(".input-unit") ?? control;
    anchor.before(help);
    control.dataset.fieldAssistance = "true";
  });
}

export function FormFieldAssistance() {
  useEffect(() => {
    decorate(document);
    const observer = new MutationObserver((entries) => entries.forEach((entry) => entry.addedNodes.forEach((node) => {
      if (node instanceof HTMLElement) decorate(node);
    })));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
