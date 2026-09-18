import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyFg2I6bniQnRRDDC3iV1hc92Q3rzWwqNuW3AdRecK5db3noX4yYavrBCla-Ev-KozN/exec";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    if (!body) {
      return NextResponse.json({ ok: false, error: "Empty request." }, { status: 400 });
    }

    const upstream = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      redirect: "follow",
      cache: "no-store",
    });

    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: `Google Apps Script returned an invalid response (HTTP ${upstream.status}). Check that the Web App deployment is active and accessible to anyone.`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: upstream.ok ? 200 : upstream.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Google Sheets connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 502 }
    );
  }
}
