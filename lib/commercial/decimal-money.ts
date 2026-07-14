import { Prisma } from "@prisma/client";

export type DecimalInput = Prisma.Decimal | string | number;

export function decimal(value: DecimalInput) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error("Decimal values must be supplied as strings or Decimal instances.");
  }
  return new Prisma.Decimal(value);
}

export function money(value: DecimalInput) {
  return decimal(value).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function percent(value: DecimalInput) {
  return decimal(value).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export const ZERO = new Prisma.Decimal(0);
