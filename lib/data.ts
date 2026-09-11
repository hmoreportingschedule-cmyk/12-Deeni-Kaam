import Papa from "papaparse";
import fs from "fs";
import path from "path";

export type Row = Record<string,string>;

let cache: { rows: Row[]; loadedAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

const norm = (v: unknown) => String(v ?? "").trim();
const lower = (v: unknown) => norm(v).toLowerCase();

function pick(row: Row, names: string[]) {
  for (const n of names) {
    if (Object.prototype.hasOwnProperty.call(row,n) && norm(row[n]) !== "") return norm(row[n]);
  }
  return "";
}

export function canonicalize(r: Row): Row {
  const monthRaw = pick(r, ["Month","Report Month","Month Name","Date","Report Date"]);
  let month = monthRaw;
  if (/^\d{4}-\d{1,2}$/.test(monthRaw)) {
    const [y,m] = monthRaw.split("-");
    month = `${y}-${m.padStart(2,"0")}`;
  } else {
    const parsed = Date.parse(monthRaw);
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      month = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    } else {
      const m = monthRaw.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{4})/i);
      if (m) {
        const names=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
        month=`${m[2]}-${String(names.indexOf(m[1].slice(0,3).toLowerCase())+1).padStart(2,"0")}`;
      }
    }
  }
  const valueRaw = pick(r, ["Report Value","Report_Value","Value","Report","Total","Qty","Quantity"]);
  const target26 = pick(r, ["Target 26% (Value)","Target 26%","Target_26Pct","Target 26"]);
  const target52 = pick(r, ["Target 52% (Value)","Target 52%","Target_52Pct","Target 52"]);
  return {
    Month: month,
    Year: pick(r, ["Year"]) || month.slice(0,4),
    Category: pick(r, ["Category"]),
    DeeniActivities: pick(r, ["Deeni Activities","Deeni Activity","Deeni Kaam","Deeni Activities"]),
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
  const configured = (process.env.DATA_SOURCE_URL || "local").split(",").map(s=>s.trim()).filter(Boolean);
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

export function aggregate(rows: Row[], params: Record<string,string>) {
  const filtered=rows.filter(r=>
    eq(r.Month,params.month) &&
    eq(r.Category,params.category) &&
    eq(r.DeeniActivities,params.deeni) &&
    eq(r.Fields,params.field) &&
    eq(r.Region,params.region) &&
    eq(r.State,params.state) &&
    eq(r.Division,params.division) &&
    eq(r.District,params.district) &&
    eq(r.Chain,params.chain) &&
    eq(r.Department,params.department)
  );

  const level=params.district ? "district" : params.division ? "division" : params.state ? "state" : params.region ? "region" : "country";
  const map=new Map<string,{name:string;report:number;target26:number;target52:number;count:number;region:string;state:string;division:string;district:string;deeniActivities:string;fields:string;multipleFieldName:string;multipleFieldValue:string}>();

  for(const r of filtered){
    const name=level==="country" ? "India" :
      level==="region" ? r.State || "Unknown State" :
      level==="state" ? r.Division || "Unknown Division" :
      level==="division" ? r.District || "Unknown District" :
      r.District || "Unknown District";
    const key=`${name}|${r.Fields}|${r.DeeniActivities}|${r.MultipleFieldName}|${r.MultipleFieldValue}`;
    const prev=map.get(key)||{name,report:0,target26:0,target52:0,count:0,region:r.Region,state:r.State,division:r.Division,district:r.District,deeniActivities:r.DeeniActivities,fields:r.Fields,multipleFieldName:r.MultipleFieldName,multipleFieldValue:r.MultipleFieldValue};
    prev.report+=num(r.ReportValue); prev.target26+=num(r.Target26); prev.target52+=num(r.Target52); prev.count++;
    map.set(key,prev);
  }

  return Array.from(map.values()).map(x=>({
    ...x,
    achievement26:x.target26?x.report/x.target26*100:null,
    achievement52:x.target52?x.report/x.target52*100:null,
    deeniActivities: x.deeniActivities || "",
    fields: x.fields || "",
    multipleFieldName: x.multipleFieldName || "",
    multipleFieldValue: x.multipleFieldValue || ""
  })).sort((a,b)=>b.report-a.report);
}

export function meta(rows: Row[], params: Record<string,string>) {
  const filtered=rows.filter(r=>
    eq(r.Category,params.category)&&eq(r.DeeniActivities,params.deeni)&&eq(r.Fields,params.field)&&
    eq(r.Region,params.region)&&eq(r.State,params.state)&&eq(r.Division,params.division)&&eq(r.District,params.district)
  );
  const uniq=(key:string)=>Array.from(new Set(filtered.map(r=>r[key]).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  return {
    categories:uniq("Category"),
    deeniActivities:uniq("DeeniActivities"),
    fields:uniq("Fields"),
    regions:uniq("Region"),
    states:uniq("State"),
    divisions:uniq("Division"),
    districts:uniq("District"),
    chains:uniq("Chain"),
    departments:uniq("Department"),
    months:Array.from(new Set(rows.map(r=>r.Month).filter(Boolean))).sort()
  };
}
