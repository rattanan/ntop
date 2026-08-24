"use client";

import { useId, useMemo, useState } from "react";

import { findProductOption, productOptionLabel, type ProductSearchOption } from "@/lib/presales/product-option-search";

type SearchableProductSelectProps<T extends ProductSearchOption> = {
  id?: string;
  name?: string;
  options: T[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, option: T | undefined) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
};

export function SearchableProductSelect<T extends ProductSearchOption>({
  id,
  name,
  options,
  value,
  defaultValue = "",
  onChange,
  placeholder = "ค้นหาด้วยรหัสหรือชื่อ Product",
  required,
  disabled,
  ariaLabel,
}: SearchableProductSelectProps<T>) {
  const generatedId = useId();
  const inputId = id ?? `product-search-${generatedId}`;
  const listId = `${inputId}-options`;
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const selectedValue = controlled ? value : internalValue;
  const selected = useMemo(() => options.find((option) => option.id === selectedValue), [options, selectedValue]);
  const [text, setText] = useState(selected ? productOptionLabel(selected) : "");

  const select = (next: T | undefined) => {
    if (!controlled) setInternalValue(next?.id ?? "");
    onChange?.(next?.id ?? "", next);
  };

  return <div className="searchable-product-select">
    <input
      id={inputId}
      className="control"
      type="search"
      role="combobox"
      aria-label={ariaLabel}
      aria-autocomplete="list"
      aria-controls={listId}
      aria-expanded={focused && options.length > 0}
      aria-required={required || undefined}
      autoComplete="off"
      list={listId}
      placeholder={placeholder}
      value={focused ? text : selected ? productOptionLabel(selected) : ""}
      disabled={disabled}
      onFocus={(event) => {
        setText(selected ? productOptionLabel(selected) : "");
        setFocused(true);
        event.currentTarget.select();
      }}
      onChange={(event) => {
        const nextText = event.target.value;
        setText(nextText);
        select(findProductOption(options, nextText) as T | undefined);
      }}
      onBlur={() => {
        setFocused(false);
      }}
    />
    <datalist id={listId}>
      {options.map((option) => <option key={option.id} value={productOptionLabel(option)}>{option.category}</option>)}
    </datalist>
    {name && <input type="hidden" name={name} value={selectedValue}/>}
  </div>;
}
