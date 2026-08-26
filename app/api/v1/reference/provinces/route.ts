import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadProvinceOptions } from "@/lib/customer/province-reference";
export async function GET(){if(!await getSession())return NextResponse.json({error:{code:"UNAUTHENTICATED"}},{status:401});return NextResponse.json({data:await loadProvinceOptions()},{headers:{"cache-control":"private, max-age=300"}});}
