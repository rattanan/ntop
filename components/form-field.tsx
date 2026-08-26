import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

import { getNumericFieldUnit } from "../lib/form-field-metadata";

export function FormField({ label, name, htmlFor = name, required, error, help, children }: { label: string; name: string; htmlFor?: string; required?: boolean; error?: string[]; help?: string; children: ReactNode }) {
  return <div className="field"><label htmlFor={htmlFor}>{label}{required && <><span className="required" aria-hidden="true">*</span><span className="sr-only"> (จำเป็น)</span></>}</label>{children}{help && !error?.length && <p className="help" id={`${name}-help`}>{help}</p>}{error?.map((item) => <p className="error" id={`${name}-error`} role="alert" key={item}>{item}</p>)}</div>;
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: boolean; unit?: string }>(function Input({ error, unit, ...props }, ref) {
  const resolvedUnit = unit ?? (props.type === "number" && props.name ? getNumericFieldUnit(props.name) : undefined);
  const input = <input {...props} ref={ref} id={props.id??props.name} aria-invalid={error || undefined} aria-describedby={error ? `${props.name}-error` : props["aria-describedby"]} className={`control ${error ? "error-control" : ""} ${props.className ?? ""}`} />;
  return resolvedUnit ? <span className="input-unit"><span className="input-unit-control">{input}</span><span aria-hidden="true" className="input-unit-label">{resolvedUnit}</span></span> : input;
});
export function Textarea({ error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) { return <textarea {...props} id={props.id??props.name} aria-invalid={error || undefined} aria-describedby={error ? `${props.name}-error` : props["aria-describedby"]} className={`control ${error ? "error-control" : ""} ${props.className ?? ""}`} rows={4} />; }
