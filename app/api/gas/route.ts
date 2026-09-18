import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google Apps Script Web App URL
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyFg2I6bniQnRRDDC3iV1hc92Q3rzWwqNuW3AdRecK5db3noX4yYavrBCla-Ev-KozN/exec";

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    if (!bodyText) {
      return NextResponse.json({ ok: false, error: "Empty request." }, { status: 400 });
    }

    let input: Record<string, unknown>;
    try {
      input = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request JSON." }, { status: 400 });
    }

    // Send the action as form data as well as a query parameter.
    // This is intentionally compatible with both the old and updated
    // Google Apps Script doPost implementations. It avoids the
    // intermittent "Unknown action" caused by JSON body parsing.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === null) continue;
      params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    }

    const action = String(input.action ?? "").trim();
    const target = action
      ? `${GAS_URL}?action=${encodeURIComponent(action)}`
      : GAS_URL;

    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json, text/plain, */*",
      },
      body: params.toString(),
      redirect: "follow",
      cache: "no-store",
    });

    const text = await upstream.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Google Apps Script returned an invalid response (HTTP ${upstream.status}). ` +
            "Please make sure the Web App deployment is active and accessible to anyone.",
        },
        { status: 502 }
      );
    }

    // If an old deployment still reports Unknown action, expose the
    // received action to make troubleshooting deterministic instead of
    // silently showing a generic dashboard error.
    if (data && data.ok === false && data.error === "Unknown action") {
      return NextResponse.json(
        {
          ok: false,
          error: `Google Apps Script did not recognize action: ${action || "(empty)"}. Please deploy the latest Code.gs version.`,
          receivedAction: data.receivedAction ?? action || null,
          receivedKeys: data.receivedKeys ?? [],
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: upstream.ok ? 200 : upstream.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `Google Sheets connection failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
      },
      { status: 502 }
    );
  }
}
