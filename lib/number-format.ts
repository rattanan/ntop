type NumericDisplayValue = string | number | bigint | { toString(): string } | null | undefined;

function decimalParts(value: NumericDisplayValue) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  return match ? { negative: match[1] === "-", whole: match[2], fraction: match[3] ?? "" } : null;
}

export function formatDecimal(value: NumericDisplayValue, fractionDigits = 2) {
  const parts = decimalParts(value);
  if (!parts) return "—";
  const scale = BigInt(10) ** BigInt(fractionDigits);
  const kept = parts.fraction.slice(0, fractionDigits).padEnd(fractionDigits, "0");
  let scaled = BigInt(parts.whole) * scale + BigInt(kept || "0");
  if ((parts.fraction[fractionDigits] ?? "0") >= "5") scaled += BigInt(1);
  const roundedWhole = scaled / scale;
  const roundedFraction = fractionDigits ? (scaled % scale).toString().padStart(fractionDigits, "0") : "";
  const grouped = roundedWhole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = parts.negative && scaled !== BigInt(0) ? "-" : "";
  return `${sign}${grouped}${fractionDigits ? `.${roundedFraction}` : ""}`;
}

export function formatMoney(value: NumericDisplayValue, currency = "THB") {
  const formatted = formatDecimal(value, 2);
  return formatted === "—" ? formatted : `${formatted} ${currency}`;
}

export function formatCount(value: NumericDisplayValue) {
  return formatDecimal(value, 0);
}
