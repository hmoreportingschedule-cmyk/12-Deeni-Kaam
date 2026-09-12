import Papa from "papaparse";
import fs from "fs";
import path from "path";

export type Row = Record<string,string>;

let cache: { rows: Row[]; loadedAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

// Google Sheet used as the default live data source.
// DATA_SOURCE_URL in Vercel can still override this value.
const DEFAULT_DATA_SOURCE_URL =
  "https://docs.google.com/spreadsheets/d/1rNQuQ93JH4Yj1a7lCZ-WI58FFDXIxGPa/gviz/tq?tqx=out:csv&sheet=Row%20Data%202026&headers=1";

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

function column(row: Row, index: number) {
  const keys = Object.keys(row);
  return index < keys.length ? norm(row[keys[index]]) : "";
}

export function canonicalize(r: Row): Row {
  // IMPORTANT: The supplied Google Sheet has a fixed A:M layout:
  // A Month, B Year, C Chain, D Department, E Region, F State,
  // G Division, H District, I Category, J Fileds, K Report Value,
  // L Target 26% (Value), M Target 52% (Value).
  // Read these columns by position so Report Value can never be taken from
  // the wrong field because of a header spelling/wrapping difference.

  const monthRaw = column(r, 0);
  const yearRaw = column(r, 1);
  const chain = column(r, 2);
  const department = column(r, 3);
  const region = column(r, 4);
  const state = column(r, 5);
  const division = column(r, 6);
  const district = column(r, 7);
  const category = column(r, 8);
  const fields = column(r, 9);

  // Column K = index 10. Do NOT substitute another column.
  const reportValue = column(r, 10); // GOOGLE SHEET COLUMN K

  // Column L = index 11, Column M = index 12.
  const target26 = column(r, 11);
  const target52 = column(r, 12);

  const monthNames=["january","february","march","april","may","june","july","august","september","october","november","december"];
  const monthShort=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const yearMatch=yearRaw.match(/\b(20\d{2})\b/);
  const year=yearMatch ? yearMatch[1] : "";

  let month="";
  const mt=monthRaw.toLowerCase().trim();

  if (/^\d{4}[-/]\d{1,2}$/.test(monthRaw)) {
    const parts=monthRaw.replace(/\//g,"-").split("-");
    month=`${parts[0]}-${parts[1].padStart(2,"0")}`;
  } else {
    const full=monthNames.indexOf(mt);
    const short=monthShort.indexOf(mt.slice(0,3));
    const n=/^\d{1,2}$/.test(mt) ? Number(mt) : full>=0 ? full+1 : short>=0 ? short+1 : 0;
    if(n>=1 && n<=12 && year) month=`${year}-${String(n).padStart(2,"0")}`;
  }

  return {
    Month: month,
    Year: year,
    Category: category,
    DeeniActivities: "",
    Fields: fields,
    MultipleFieldName: "",
    MultipleFieldValue: "",
    Chain: chain,
    Department: department,
    Region: region,
    State: state,
    Division: division,
    District: district,
    ReportValue: reportValue,
    Target26: target26,
    Target52: target52
  };
}

async function getSourceText(url: string) {
  if (url === "local") {
    return fs.readFileSync(path.join(process.cwd(),"public/data/report.csv"),"utf8");
  }
  const res = await fetch(url.trim(),{cache:"no-store"});
  if (!res.ok) throw new Error(`Source returned ${res.status}`);
  return res.text();
}

export async function loadRows() {
  if (cache && Date.now()-cache.loadedAt < CACHE_MS) return cache.rows;
  const configured = [DEFAULT_DATA_SOURCE_URL];
  const all: Row[] = [];
  for (const url of configured) {
    const text = await getSourceText(url);
    const parsed = Papa.parse<Row>(text,{header:true,skipEmptyLines:true});
    for (const row of parsed.data) all.push(canonicalize(row));
  }
  cache={rows:all,loadedAt:Date.now()};
  return all;
}

const num=(v:string)=>{
  const raw=String(v??"").trim();
  if(!raw) return 0;
  const negative=/^\(.*\)$/.test(raw);
  const cleaned=raw.replace(/[(),\s₹$%]/g,"");
  const n=Number(cleaned);
  return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : 0;
};
const eq=(a:string,b:string)=>!b || lower(a)===lower(b);

function displayGeoName(value: string, level: string) {
  const v = norm(value);
  if (!v) return "India";
  if (level === "REGION") return v.replace(/\s+Region$/i, "");
  if (level === "DIVISION") return v.replace(/\s+Division$/i, "");
  return v;
}

export function aggregate(rows: Row[], params: Record<string,string>) {
  if (!params.month) return [];

  const monthRows = rows.filter(r => eq(r.Month, params.month));
  const level = (params.level || "COUNTRY").toUpperCase() as "COUNTRY" | "REGION" | "STATE" | "DIVISION";

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

  type Agg = {
    key:string; name:string; report:number; target26:number; target52:number; count:number;
    region:string; state:string; division:string; district:string;
    deeniActivities:string; fields:string; multipleFieldName:string; multipleFieldValue:string;
  };

  const taxonomy=loadTaxonomy();
  const activityByField=new Map<string,string>();
  for(const t of taxonomy){
    if(t.fields && t.deeniActivities && !activityByField.has(lower(t.fields))){
      activityByField.set(lower(t.fields), t.deeniActivities);
    }
  }

  const map = new Map<string,Agg>();

  const getLevelValue=(r:Row)=>{
    if(level === "REGION") return r.Region;
    if(level === "STATE") return r.State;
    if(level === "DIVISION") return r.Division;
    return "India";
  };

  const getLevelDisplay=(r:Row)=>{
    const value=getLevelValue(r);
    return level === "COUNTRY" ? "India" : displayGeoName(value, level);
  };

  for (const r of scoped) {
    const geoValue=getLevelValue(r);
    if(level !== "COUNTRY" && !geoValue) continue;

    const activity = params.deeni || r.DeeniActivities || activityByField.get(lower(r.Fields)) || "-";
    const fld = params.field || r.Fields || "-";
    const geoKey = level === "COUNTRY" ? "India" : lower(geoValue);
    const key = `${geoKey}|||${lower(activity)}|||${lower(fld)}`;
    const prev = map.get(key);

    if (prev) {
      prev.report += num(r.ReportValue);
      prev.target26 += num(r.Target26);
      prev.target52 += num(r.Target52);
      prev.count++;
      continue;
    }

    map.set(key, {
      key,
      name: getLevelDisplay(r),
      report: num(r.ReportValue),
      target26: num(r.Target26),
      target52: num(r.Target52),
      count: 1,
      // Keep the hierarchy columns meaningful for the selected report level.
      // Non-selected lower levels are shown as All because the values are totals.
      region: level === "REGION" ? displayGeoName(r.Region, "REGION") : level === "COUNTRY" ? "All" : level === "STATE" || level === "DIVISION" ? displayGeoName(r.Region, "REGION") : "All",
      state: level === "STATE" ? r.State : level === "DIVISION" ? r.State : "All",
      division: level === "DIVISION" ? displayGeoName(r.Division, "DIVISION") : "All",
      district: "All",
      deeniActivities: activity,
      fields: fld,
      multipleFieldName: r.MultipleFieldName || "",
      multipleFieldValue: r.MultipleFieldValue || ""
    });
  }

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
    eq(r.Region,params.region) &&
    eq(r.State,params.state) &&
    eq(r.Division,params.division) &&
    eq(r.District,params.district) &&
    eq(r.Category,params.category) &&
    eq(r.Fields,params.field)
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
