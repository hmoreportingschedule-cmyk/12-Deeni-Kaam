import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function cleanUrl(input: string) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("URL is required.");
  const u = new URL(raw);

  // Google Drive shared-file URL -> direct download endpoint.
  const driveMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
  if (u.hostname.includes("drive.google.com") && driveMatch) {
    return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveMatch[1])}&export=download&confirm=t`;
  }

  // Google Sheets URL -> XLSX export.
  const sheetMatch = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if ((u.hostname === "docs.google.com" || u.hostname.endsWith(".docs.google.com")) && sheetMatch) {
    return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=xlsx`;
  }

  return raw;
}

function headerKey(v: unknown) {
  return String(v ?? "").trim().toLowerCase().replace(/[%()]/g, "").replace(/[^a-z0-9]+/g, "");
}

function normalizeRow(raw: Record<string, unknown>) {
  const keys = Object.keys(raw);
  const get = (names: string[]) => {
    const wanted = names.map(headerKey);
    const actual = keys.find(k => wanted.includes(headerKey(k)));
    return actual ? raw[actual] : "";
  };
  return {
    Month: String(get(["Month","Month Name"]) ?? "").trim(),
    Year: Number(String(get(["Year"]) ?? "").replace(/,/g,"")) || 0,
    Chain: String(get(["Chain"]) ?? "").trim(),
    Region: String(get(["Region"]) ?? "").trim(),
    State: String(get(["State"]) ?? "").trim(),
    Division: String(get(["Division"]) ?? "").trim(),
    Distric: String(get(["Distric","District"]) ?? "").trim(),
    Pincode: String(get(["Pincode","Pin Code","PIN Code"]) ?? "").trim(),
    Category: String(get(["Category"]) ?? "").trim(),
    Activity: String(get(["Deeni Activities","Activity","Activity/Work"]) ?? "").trim(),
    Report: Number(String(get(["Report"]) ?? "").replace(/,/g,"")) || 0,
    Target52: Number(String(get(["Target 52%","Target52","Target 52"]) ?? "").replace(/,/g,"")) || 0,
    Target26: Number(String(get(["Target 26%","Target26","Target 26"]) ?? "").replace(/,/g,"")) || 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sourceUrl = cleanUrl(body?.url);
    const mode = body?.mode === "dep" ? "dep" : "12";

    const response = await fetch(sourceUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 Reporting-Analise-Dashboard" },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`Source file returned HTTP ${response.status}. Make sure the Google Drive/Sheet file is accessible.`);
    }

    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error("Source file is empty.");

    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    if (!workbook.SheetNames.length) throw new Error("Source file has no worksheet.");

    const wanted = mode === "12" ? "Row Data (12 Deeni)" : "Row Data (Department)";
    const sheetName = workbook.SheetNames.includes(wanted) ? wanted : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (!raw.length) throw new Error("Source file has no data rows.");

    const rows = raw.map(normalizeRow).filter(r => r.Month || r.Year || r.Activity || r.Report || r.Region);
    if (!rows.length) throw new Error("Source file format does not contain valid Row Data.");

    const seen = new Set<string>();
    const geo = rows.map(r => ({Region:r.Region,State:r.State,Division:r.Division,Distric:r.Distric,Pincode:r.Pincode}))
      .filter(r => { const k=JSON.stringify(r); if(seen.has(k)) return false; seen.add(k); return true; });

    return NextResponse.json({
      ok: true,
      rows,
      geo,
      fileName: sourceUrl,
      sheetName,
      count: rows.length,
      cachedForSeconds: 60,
      contentType,
    }, { headers: { "Cache-Control": "private, max-age=0" } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "URL sync failed.",
    }, { status: 502 });
  }
}
