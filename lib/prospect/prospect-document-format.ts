export function formatDocumentSize(sizeBytes: number, locale = "th-TH") {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return "—";
  if (sizeBytes < 1_000) return `${sizeBytes} B`;
  if (sizeBytes < 1_000_000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(sizeBytes / 1_000)} KB`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(sizeBytes / 1_000_000)} MB`;
}
