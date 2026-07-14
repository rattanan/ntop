export class BangkokDateTimeError extends Error {
  constructor() {
    super("Date and time must be a valid ISO value.");
    this.name = "BangkokDateTimeError";
  }
}

export function parseBangkokDateTime(value: string) {
  if (!value) return null;
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value)
    ? value
    : value + (value.length === 16 ? ":00" : "") + "+07:00";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new BangkokDateTimeError();
  return date;
}
