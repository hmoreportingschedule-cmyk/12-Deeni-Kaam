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
  const taxonomy=loadTaxonomy();
  const activityByField=new Map<string,string>();
  for(const t of taxonomy){
    if(t.fields && t.deeniActivities && !activityByField.has(lower(t.fields))){
      activityByField.set(lower(t.fields), t.deeniActivities);
    }
  }

  const map = new Map<string,Agg>();

  const getGeoKey=(r:Row)=>r.District;
  const getGeoBase=(geo:string)=> sourceScope.find(r => r.District === geo);

  // For the table to show the selected dropdown names, use them when selected.
  // Otherwise use the actual field/activity names from the source rows.
  const groupRows = scoped.length ? scoped : [];
  for (const r of groupRows) {
    const geo = getGeoKey(r);
    if (!geo) continue;
    const activity = params.deeni || r.DeeniActivities || activityByField.get(lower(r.Fields)) || "-";
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
