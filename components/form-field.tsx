import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function FormField({ label, name, required, error, help, children }: { label: string; name: string; required?: boolean; error?: string[]; help?: string; children: ReactNode }) {
  return <div className="field"><label htmlFor={name}>{label}{required && <span className="required" aria-label="จำเป็น">*</span>}</label>{children}{help && !error?.length && <p className="help">{help}</p>}{error?.map((item) => <p className="error" id={`${name}-error`} key={item}>{item}</p>)}</div>;
}
export function Input({ error, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) { return <input {...props} aria-invalid={error || undefined} aria-describedby={error ? `${props.name}-error` : undefined} className={`control ${error ? "error-control" : ""} ${props.className ?? ""}`} />; }
export function Textarea({ error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) { return <textarea {...props} aria-invalid={error || undefined} aria-describedby={error ? `${props.name}-error` : undefined} className={`control ${error ? "error-control" : ""} ${props.className ?? ""}`} rows={4} />; }
