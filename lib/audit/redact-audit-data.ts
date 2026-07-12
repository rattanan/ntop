export type AuditJsonValue =
  | string
  | number
  | boolean
  | null
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue };

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /(^|_)(api_?key|authorization|cookie|credential|mfa|password|private_?key|secret|session|token)($|_)/i;

export function redactAuditData(value: AuditJsonValue): AuditJsonValue {
  if (Array.isArray(value)) {
    return value.map(redactAuditData);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : redactAuditData(nestedValue),
      ]),
    );
  }

  return value;
}
