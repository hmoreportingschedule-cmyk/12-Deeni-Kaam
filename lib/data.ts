import Papa from "papaparse";
import fs from "fs";
import path from "path";

export type Row = Record<string,string>;

let cache: { rows: Row[]; loadedAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

// Google Sheet used as the default live data source.
// DATA_SOURCE_URL in Vercel can still override this value.
const DEFAULT_DATA_SOURCE_URL =
  "https://docs.google.com/spreadsheets/d/1rNQuQ93JH4Yj1a7lCZ-WI58FFDXIxGPa/export?format=csv";

type TaxonomyRow = { category: string; deeniActivities: string; fields: string };

function loadTaxonomy(): TaxonomyRow[] {
  try {
    const file = path.join(process.cwd(), "public/data/fields-category.json");
    return JSON.parse(fs.readFileSync(file, "utf8")) as TaxonomyRow[];
  } catch {
    return [];
  }
}

const norm = (v: unknown) => String(v ?? "").trim();
const lower = (v: unknown) => norm(v).toLowerCase();

function pick(row: Row, names: string[]) {
  for (const n of names) {
    if (Object.prototype.hasOwnProperty.call(row,n) && norm(row[n]) !== "") return norm(row[n]);
  }
  return "";
}

export function canonicalize(r: Row): Row {
  const monthRaw = pick(r, ["Month","Report Month","Month Name"]);
  const yearRaw = pick(r, ["Year","Report Year"]);
  let month = "";

  // The Google Sheet uses separate Month + Year columns (e.g. January + 2026).
  // Build YYYY-MM directly so named months do not get interpreted as year 2001
  // by JavaScript's Date.parse().
  const monthNames=["january","february","march","april","may","june","july","august","september","october","november","december"];
  const monthShort=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

  const yMatch = yearRaw.match(/\b(20\d{2})\b/);
  const year = yMatch ? yMatch[1] : "";

  const monthText = monthRaw.toLowerCase().trim();
  let monthNumber = 0;

  if (/^\d{4}[-/]\d{1,2}$/.test(monthRaw)) {
    const parts=monthRaw.replace(/\//g,"-").split("-");
    month = `${parts[0]}-${parts[1].padStart(2,"0")}`;
  } else if (/^\d{1,2}$/.test(monthText)) {
    monthNumber=Number(monthText);
  } else {
    const fullIndex=monthNames.indexOf(monthText);
    const shortIndex=monthShort.indexOf(monthText.slice(0,3));
    monthNumber=fullIndex>=0 ? fullIndex+1 : shortIndex>=0 ? shortIndex+1 : 0;
  }

  if (!month && monthNumber>=1 && monthNumber<=12 && year) {
    month=`${year}-${String(monthNumber).padStart(2,"0")}`;
  }

  // Handle a true date value only when Month itself contains a date.
  if (!month && monthRaw) {
    const parsed=Date.parse(monthRaw);
    if (!Number.isNaN(parsed)) {
      const d=new Date(parsed);
      const parsedYear=year || String(d.getFullYear());
      month=`${parsedYear}-${String(d.getMonth()+1).padStart(2,"0")}`;
    }
  }

  // IMPORTANT: In the Google Sheet, Report Value is Column K.
  // Read Column K directly instead of relying on the header text.
  // Object.keys() preserves the CSV column order returned by Papa Parse.
  const sourceColumns = Object.keys(r);
  const reportValueColumnK = sourceColumns.length >= 11
    ? norm(r[sourceColumns[10]])
    : "";
  const valueRaw = reportValueColumnK;
  const target26 = pick(r, ["Target 26% (Value)","Target 26%","Target_26Pct","Target 26"]);
  const target52 = pick(r, ["Target 52% (Value)","Target 52%","Target_52Pct","Target 52"]);

  return {
    Month: month,
    Year: year || (month.match(/^\d{4}/)?.[0] || ""),
    Category: pick(r, ["Category"]),
    DeeniActivities: pick(r, ["Deeni Activities","Deeni Activity","Deeni Kaam"]),
    Fields: pick(r, ["Fields","Fileds","Field"]),
    MultipleFieldName: pick(r, ["Multiple Field Name","Multiple_Field_Name"]),
    MultipleFieldValue: pick(r, ["Multiple Field Value","Multiple_Field_Value"]),
    Chain: pick(r, ["Chain"]),
    Department: pick(r, ["Department"]),
    Region: pick(r, ["Region"]),
    State: pick(r, ["State"]),
    Division: pick(r, ["Division"]),
    District: pick(r, ["District"]),
    ReportValue: valueRaw.replace(/,/g,""),
    Target26: target26.replace(/,/g,""),
    Target52: target52.replace(/,/g,"")
  };
}

async function getSourceText(url: string) {
  if (url === "local") {
    return fs.readFileSync(path.join(process.cwd(),"public/data/report.csv"),"utf8");
  }
  const u = url.trim();
  let target = u;
  const match = u.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  if (match && !/export\?format=csv/i.test(u)) {
    target = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
  }
  const res = await fetch(target,{cache:"no-store"});
  if (!res.ok) throw new Error(`Source returned ${res.status}`);
  return res.text();
}

export async function loadRows() {
  if (cache && Date.now()-cache.loadedAt < CACHE_MS) return cache.rows;
  const configured = (process.env.DATA_SOURCE_URL || DEFAULT_DATA_SOURCE_URL).split(",").map(s=>s.trim()).filter(Boolean);
  const all: Row[] = [];
  for (const url of configured) {
    const text = await getSourceText(url);
    const parsed = Papa.parse<Row>(text,{header:true,skipEmptyLines:true});
    for (const row of parsed.data) all.push(canonicalize(row));
  }
  cache={rows:all,loadedAt:Date.now()};
  return all;
}

const num=(v:string)=>Number(String(v||"0").replace(/,/g,""))||0;
const eq=(a:string,b:string)=>!b || lower(a)===lower(b);

function displayGeoName(value: string, level: string) {
  const v = norm(value);
  if (!v) return "India";
  if (level === "REGION") return v.replace(/\s+Region$/i, "");
  if (level === "DIVISION") return v.replace(/\s+Division$/i, "");
  return v;
}

export function aggregate(rows: Row[], params: Record<string,string>) {
  // A report month is mandatory. After the month is selected, aggregate the
  // Google Sheet's Report Value column (Column K / canonical ReportValue)
  // instead of displaying one raw source row.
  if (!params.month) return [];

  const monthRows = rows.filter(r => eq(r.Month, params.month));

  // The detailed report is always district-wise after a month is selected.
  // Region / State / Division filters only narrow the district list; they do
  // not change the table into a State/Division summary. This keeps the full
  // district report in one table and lets Report Value be totaled field-wise.
  const level: "DISTRICT" = "DISTRICT";
  const levelKey = "District";

  const scoped = monthRows.filter(r =>
    eq(r.Region, params.region) &&
    eq(r.State, params.state) &&
    eq(r.Division, params.division) &&
    eq(r.District, params.district) &&
    eq(r.Category, params.category) &&
    eq(r.DeeniActivities, params.deeni) &&
    eq(r.Fields, params.field) &&
    eq(r.Chain, params.chain) &&
    eq(r.Department, params.department)
  );

  // Keep every geographic unit visible even if its filtered report value is 0.
  // This is what makes a Region/State/Division filter show all of its units.
  const sourceScope = monthRows.filter(r =>
    eq(r.Region, params.region) &&
    eq(r.State, params.state) &&
    eq(r.Division, params.division) &&
    eq(r.District, params.district)
  );

  const geoValues = Array.from(
    new Set(sourceScope.map(r => r.District).filter(Boolean))
  ).sort((a,b)=>a.localeCompare(b));

  // Field-wise aggregation: each selected geography is grouped by the
  // Deeni Activity + Field shown in the filters/master hierarchy.
  type Agg = {
    key:string; name:string; report:number; target26:number; target52:number; count:number;
    region:string; state:string; division:string; district:string;
    deeniActivities:string; fields:string; multipleFieldName:string; multipleFieldValue:string;
  };
  const map = new Map<string,Agg>();

  const getGeoKey=(r:Row)=>r.District;
  const getGeoBase=(geo:string)=> sourceScope.find(r => r.District === geo);

  // For the table to show the selected dropdown names, use them when selected.
  // Otherwise use the actual field/activity names from the source rows.
  const groupRows = scoped.length ? scoped : [];
  for (const r of groupRows) {
    const geo = getGeoKey(r);
    if (!geo) continue;
    const activity = params.deeni || r.DeeniActivities || "-";
    const fld = params.field || r.Fields || "-";
    const key = `${geo}|||${activity}|||${fld}`;
    const prev = map.get(key);
    if (prev) {
      prev.report += num(r.ReportValue);
      prev.target26 += num(r.Target26);
      prev.target52 += num(r.Target52);
      prev.count++;
      continue;
    }
    const base = getGeoBase(geo) || r;
    map.set(key, {
      key,
      name: displayGeoName(geo, level),
      report: num(r.ReportValue),
      target26: num(r.Target26),
      target52: num(r.Target52),
      count: 1,
      region: displayGeoName(base.Region || r.Region, "REGION"),
      state: base.State || r.State || "",
      division: displayGeoName(base.Division || r.Division, "DIVISION"),
      district: base.District || r.District || "",
      deeniActivities: activity,
      fields: fld,
      multipleFieldName: r.MultipleFieldName || "",
      multipleFieldValue: r.MultipleFieldValue || ""
    });
  }

  // If the filters return no report rows, still return one zero row per
  // geographic unit so the user can see the complete coverage.
  if (!map.size) {
    for (const geo of geoValues) {
      const base=getGeoBase(geo);
      if (!base) continue;
      const activity=params.deeni || "-";
      const fld=params.field || "-";
      const key=`${geo}|||${activity}|||${fld}`;
      map.set(key, {
        key,
        name: displayGeoName(geo, level),
        report:0,target26:0,target52:0,count:0,
        region:displayGeoName(base.Region,"REGION"),
        state:base.State || "",
        division:displayGeoName(base.Division,"DIVISION"),
        district:base.District || "",
        deeniActivities:activity,fields:fld,multipleFieldName:"",multipleFieldValue:""
      });
    }
  }

  // If multiple fields are selected by leaving the Field filter on All,
  // the rows above are already field-wise. Sort geography first, then activity/field.
  return Array.from(map.values())
    .map(x => ({
      ...x,
      achievement26: x.target26 ? x.report/x.target26*100 : null,
      achievement52: x.target52 ? x.report/x.target52*100 : null
    }))
    .sort((a,b)=>a.name.localeCompare(b.name) || a.deeniActivities.localeCompare(b.deeniActivities) || a.fields.localeCompare(b.fields));
}

export function meta(rows: Row[], params: Record<string,string>) {
  const dataFiltered = rows.filter(r=>
    eq(r.Category,params.category) &&
    eq(r.DeeniActivities,params.deeni) &&
    eq(r.Fields,params.field) &&
    eq(r.Region,params.region) &&
    eq(r.State,params.state) &&
    eq(r.Division,params.division) &&
    eq(r.District,params.district)
  );

  const uniq=(key:string)=>Array.from(new Set(dataFiltered.map(r=>r[key]).filter(Boolean))).sort((a,b)=>a.localeCompare(b));

  // The uploaded Fields With Category file is the master hierarchy.
  // Use it for Category → Deeni Activities → Fields so options are available
  // even when a particular item has no report row in the selected month.
  const taxonomy=loadTaxonomy();
  const taxBySelection=taxonomy.filter(t=>
    (!params.category || lower(t.category)===lower(params.category)) &&
    (!params.deeni || lower(t.deeniActivities)===lower(params.deeni)) &&
    (!params.field || lower(t.fields)===lower(params.field))
  );

  const taxCategories=Array.from(new Set(taxonomy.map(t=>t.category).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const taxDeeni=Array.from(new Set(taxBySelection.map(t=>t.deeniActivities).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const taxFields=Array.from(new Set(taxBySelection.map(t=>t.fields).filter(Boolean))).sort((a,b)=>a.localeCompare(b));

  return {
    categories: taxCategories.length ? taxCategories : uniq("Category"),
    deeniActivities: taxDeeni.length ? taxDeeni : uniq("DeeniActivities"),
    fields: taxFields.length ? taxFields : uniq("Fields"),
    regions: uniq("Region"),
    states: uniq("State"),
    divisions: uniq("Division"),
    districts: uniq("District"),
    chains: uniq("Chain"),
    departments: uniq("Department"),
    months:Array.from(new Set(rows.map(r=>r.Month).filter(Boolean))).sort()
  };
}
