import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { loadDistrictOptions } from "@/lib/customer/district-reference";

export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }

  const provinceCode = new URL(request.url).searchParams.get("provinceCode")?.trim() ?? "";
  if (!/^\d{2}$/.test(provinceCode)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "provinceCode must contain 2 digits" } },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { data: await loadDistrictOptions(provinceCode) },
    { headers: { "cache-control": "private, max-age=300" } },
  );
}
