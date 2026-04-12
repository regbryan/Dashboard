import { NextResponse } from "next/server";
import { importCalendar } from "@/lib/import-calendar";

export async function POST() {
  try {
    const result = importCalendar();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
