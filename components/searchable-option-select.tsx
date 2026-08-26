"use client";

import { useId, useMemo, useState } from "react";

export type SearchableOption = {
  id: string;
  label: string;
  description?: string;
};

type Props = {
  id?: string;
  name: string;
  options: SearchableOption[];
  defaultValue?: string;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
};

function optionText(option: SearchableOption) {
  return option.description ? `${option.label} — ${option.description}` : option.label;
}

export function SearchableOptionSelect({
  id,
  name,
  options,
  defaultValue = "",
  placeholder,
  required,
  disabled,
}: Props) {
  const generatedId = useId();
  const inputId = id ?? `searchable-option-${generatedId}`;
  const listId = `${inputId}-options`;
  const initial = options.find((option) => option.id === defaultValue);
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [query, setQuery] = useState(initial ? optionText(initial) : "");
  const selected = useMemo(() => options.find((option) => option.id === selectedId), [options, selectedId]);

  return <div className="searchable-product-select">
    <input
      id={inputId}
      className="control"
      type="search"
      role="combobox"
      aria-autocomplete="list"
      aria-controls={listId}
      aria-expanded={false}
      aria-required={required || undefined}
      autoComplete="off"
      list={listId}
      placeholder={placeholder}
      value={query}
      disabled={disabled}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const text = event.target.value;
        setQuery(text);
        const normalized = text.trim().toLocaleLowerCase("th-TH");
        const match = options.find((option) => optionText(option).toLocaleLowerCase("th-TH") === normalized);
        setSelectedId(match?.id ?? "");
      }}
      onBlur={() => {
        if (selected) setQuery(optionText(selected));
      }}
    />
    <datalist id={listId}>
      {options.map((option) => <option key={option.id} value={optionText(option)}/>) }
    </datalist>
    <input type="hidden" name={name} value={selectedId}/>
  </div>;
}
