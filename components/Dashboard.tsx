 "use client";
import {useEffect,useMemo,useState} from "react";
import {LogOut,RefreshCw,CalendarDays,BarChart3,Table2,TrendingUp,Target,MapPinned,Activity,Download,Clock} from "lucide-react";

type Row={name:string;report:number;target26:number;target52:number;achievement26:number|null;achievement52:number|null;region:string;state:string;division:string;district:string;count:number;deeniActivities:string;fields:string;multipleFieldName:string;multipleFieldValue:string;};
type Meta={categories:string[];deeniActivities:string[];fields:string[];regions:string[];states:string[];divisions:string[];districts:string[];chains:string[];departments:string[];months:string[]};

const monthLabel=(m:string)=>{if(!m)return "Select month";const [y,mo]=m.split("-");return new Date(Number(y),Number(mo)-1,1).toLocaleString("en-IN",{month:"long",year:"numeric"})};
const pct=(v:number|null)=>v==null?"-":`${v.toFixed(1)}%`;
const num=(v:number)=>v.toLocaleString("en-IN",{maximumFractionDigits:2});

export default function Dashboard({onLogout,username}:{onLogout:()=>void;username:string}){
 const now=new Date(); const [date,setDate]=useState(now); const [tab,setTab]=useState<"table"|"graph">("table");
 const [month,setMonth]=useState(""); const [category,setCategory]=useState(""); const [deeni,setDeeni]=useState(""); const [field,setField]=useState("");
 const [region,setRegion]=useState(""); const [state,setState]=useState(""); const [division,setDivision]=useState(""); const [district,setDistrict]=useState("");
 const [chain,setChain]=useState(""); const [department,setDepartment]=useState(""); const [target,setTarget]=useState<"52"|"26">("52");
 const [level,setLevel]=useState<"COUNTRY"|"REGION"|"STATE"|"DIVISION">("COUNTRY");
 const [rows,setRows]=useState<Row[]>([]); const [meta,setMeta]=useState<Meta>({categories:[],deeniActivities:[],fields:[],regions:[],states:[],divisions:[],districts:[],chains:[],departments:[],months:[]});
 const [loading,setLoading]=useState(false); const [error,setError]=useState(""); const [total,setTotal]=useState(0);

 useEffect(()=>{const id=setInterval(()=>setDate(new Date()),1000);return()=>clearInterval(id)},[]);
 const load=async()=>{setLoading(true);setError("");try{const qs=new URLSearchParams();Object.entries({month,category,deeni,field,region,state,division,district,chain,department,level}).forEach(([k,v])=>{if(v)qs.set(k,v)});const r=await fetch("/api/report?"+qs.toString(),{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message||"Unable to load data");setRows(j.rows||[]);setMeta(j.meta||meta);setTotal(j.totalRows||0)}catch(e:any){setError(e.message||"Data load failed")}finally{setLoading(false)}};
 useEffect(()=>{load()},[month,category,deeni,field,region,state,division,district,chain,department,level]);

 const currentTarget=target==="52"?"target52":"target26"; const currentAch=target==="52"?"achievement52":"achievement26";
 const totalReport=rows.reduce((s,r)=>s+r.report,0), totalTarget=rows.reduce((s,r)=>s+r[currentTarget],0);
 const achievement=totalTarget?totalReport/totalTarget*100:null;
 const top=useMemo(()=>rows.slice(0,10),[rows]);
 const header = level;
 const headerValue = level === "COUNTRY" ? "India" : level === "REGION" ? (region || "All Regions") : level === "STATE" ? (state || "All States") : (division || "All Divisions");

 const changeFilters=(setter:any,clear:any[])=>{setter}; // no-op helper
 const setRegionAndClear=(v:string)=>{setRegion(v);setState("");setDivision("");setDistrict("")};
 const setStateAndClear=(v:string)=>{setState(v);setDivision("");setDistrict("")};
 const setDivisionAndClear=(v:string)=>{setDivision(v);setDistrict("")};

 const states=region?meta.states:meta.states; const divisions=state?meta.divisions:meta.divisions; const districts=division?meta.districts:meta.districts;
 const download=()=>{const headerRow=["Level","Name","Fields","Report Value","Target 26%","Target 52%","Achievement 26%","Achievement 52%"];const lines=[headerRow,...rows.map(r=>[header,r.name,"",r.report,r.target26,r.target52,pct(r.achievement26),pct(r.achievement52)])];const csv=lines.map(x=>x.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`12_Deeni_Kaam_${month||"Report"}.csv`;a.click();URL.revokeObjectURL(a.href)};

 return <div className="app-bg">
  <header className="topbar"><div className="shell card topbar-inner">
   <div className="brand"><div className="brand-icon"><Activity size={24}/></div><div><div className="brand-title">12 DEENI KAAM <span style={{fontWeight:400,color:"#0f766e"}}>REPORT HUB</span></div><div className="brand-sub">Professional Multi-View Dashboard</div></div></div>
   <div className="actions"><div className="btn" style={{display:"flex",alignItems:"center",gap:7,padding:"8px 10px",background:"#f6fbfa",borderColor:"#b8dcd8"}}><span style={{fontSize:10,fontWeight:900,letterSpacing:".12em",color:"#0f766e"}}>LEVEL</span><select value={level} onChange={e=>setLevel(e.target.value as any)} style={{border:0,outline:0,background:"transparent",fontWeight:900,fontSize:12,color:"#17324d",cursor:"pointer"}}><option value="COUNTRY">Country</option><option value="REGION">Region</option><option value="STATE">State</option><option value="DIVISION">Division</option></select></div><div className="topbar-clock"><Clock size={18}/><span>{date.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"})} • {date.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}</span></div><div className="btn">USER: <b>{username || "Admin"}</b></div><button className="btn" onClick={load} disabled={loading}><RefreshCw size={14} style={{verticalAlign:"middle",marginRight:5}} className={loading?"spin":""}/>SYNC</button><button className="btn" onClick={download}><Download size={14}/> CSV</button><button className="btn btn-danger" onClick={onLogout}><LogOut size={14}/> LOGOUT</button></div>
  </div></header>
  <main className="shell content">
   {error&&<div className="card" style={{padding:14,color:"#b91c1c",background:"#fff5f5",marginBottom:14}}>{error}</div>}
   <div className="card filters">
    <div className="section-head" style={{padding:"0 0 14px",border:0}}><div className="section-title">Report Filters & Date</div><div className="date-row"><CalendarDays size={17} color="#0f766e"/><input className="month" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div></div>
    <div className="filter-grid" style={{gridTemplateColumns:"repeat(8,1fr)"}}>
      <div><div className="field-label">Region</div><select className="select" value={region} onChange={e=>setRegionAndClear(e.target.value)}><option value="">All</option>{meta.regions.map(x=><option key={x}>{x}</option>)}</select></div>
      <div><div className="field-label">State</div><select className="select" value={state} onChange={e=>setStateAndClear(e.target.value)}><option value="">All</option>{states.map(x=><option key={x}>{x}</option>)}</select></div>
      <div><div className="field-label">Division</div><select className="select" value={division} onChange={e=>setDivisionAndClear(e.target.value)}><option value="">All</option>{divisions.map(x=><option key={x}>{x}</option>)}</select></div>
      <div><div className="field-label">District</div><select className="select" value={district} onChange={e=>setDistrict(e.target.value)}><option value="">All</option>{districts.map(x=><option key={x}>{x}</option>)}</select></div>
      <div><div className="field-label">Category</div><select className="select" value={category} onChange={e=>{setCategory(e.target.value);setDeeni("");setField("")}}><option value="">All</option>{meta.categories.map(x=><option key={x}>{x}</option>)}</select></div>
      <div><div className="field-label">Deeni Activities</div><select className="select" value={deeni} onChange={e=>{setDeeni(e.target.value);setField("")}}><option value="">All</option>{meta.deeniActivities.map(x=><option key={x}>{x}</option>)}</select></div>
      <div><div className="field-label">Fields</div><select className="select" value={field} onChange={e=>setField(e.target.value)}><option value="">All</option>{meta.fields.map(x=><option key={x}>{x}</option>)}</select></div>
      <div><div className="field-label">Target</div><select className="select" value={target} onChange={e=>setTarget(e.target.value as any)}><option value="52">52%</option><option value="26">26%</option></select></div>
    </div>
   </div>

   <div className="kpis">
    <div className="card kpi"><div className="kpi-label">Report Date</div><div className="kpi-value" style={{fontSize:20}}>{monthLabel(month)}</div><div className="kpi-note">Selected reporting month</div></div>
    <div className="card kpi"><div className="kpi-label">Total Report</div><div className="kpi-value">{num(totalReport)}</div><div className="kpi-note">{rows.length.toLocaleString("en-IN")} grouped rows</div></div>
    <div className="card kpi"><div className="kpi-label">Target {target}%</div><div className="kpi-value">{num(totalTarget)}</div><div className="kpi-note">Configured target value</div></div>
    <div className="card kpi"><div className="kpi-label">Achievement</div><div className="kpi-value">{pct(achievement)}</div><div className="kpi-note">Report ÷ Target × 100</div></div>
   </div>

   <div className="tabs"><button className={`tab ${tab==="table"?"active":""}`} onClick={()=>setTab("table")}><Table2 size={14} style={{verticalAlign:"middle",marginRight:5}}/>Report By Table</button><button className={`tab ${tab==="graph"?"active":""}`} onClick={()=>setTab("graph")}><BarChart3 size={14} style={{verticalAlign:"middle",marginRight:5}}/>Report By Graph</button></div>

   {tab==="table"&&<section className="card table-card"><div className="section-head"><div><div className="section-title">Detailed Report</div><div className="legend">LEVEL: <b>{header}</b> • {header}: <b>{headerValue}</b> • Source rows: {total.toLocaleString("en-IN")}</div></div></div>
    <div className="table-wrap"><table className="table"><thead><tr><th>{header}</th><th>REGION</th><th>STATE</th><th>DIVISION</th><th>DISTRICT</th><th>DEENI ACTIVITIES</th><th>FIELDS</th><th>REPORT VALUE</th><th>TARGET {target}%</th><th>ACHIEVEMENT</th></tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={i}><td><b>{r.name || (header === "COUNTRY" ? "India" : "-")}</b></td><td>{r.region||"-"}</td><td>{r.state||"-"}</td><td>{r.division||"-"}</td><td><b>{r.district||r.name||"-"}</b></td><td>{r.deeniActivities||deeni||"All"}</td><td>{r.fields||field||"All"}{r.multipleFieldName&&<div style={{fontSize:9,color:"#64748b"}}>{r.multipleFieldName}: {r.multipleFieldValue||"-"}</div>}</td><td><b>{num(r.report)}</b></td><td>{num(r[currentTarget])}</td><td className={(r[currentAch]||0)>=100?"good":"bad"}>{pct(r[currentAch])}</td></tr>):<tr><td colSpan={10} className="empty">{loading?"Loading report...":"No data found. Select a Report Month & Year."}</td></tr>}</tbody></table></div>
   </section>}

   {tab==="graph"&&<div className="graph-grid"><section className="card chart"><div className="section-title">Top Report Distribution</div><div className="legend" style={{marginTop:5}}>Top 10 results for the selected month and geography</div><div className="bars">{top.map((r,i)=>{const max=Math.max(...top.map(x=>x.report),1);return <div className="bar-item" key={i}><div className="bar-value">{num(r.report)}</div><div className="bar" style={{height:`${Math.max(4,r.report/max*88)}%`}}/><div className="bar-name">{r.name}</div></div>})}</div></section><section className="card chart"><div className="section-title">Professional Analysis</div><div style={{display:"grid",gap:14,marginTop:20}}><div className="kpi" style={{background:"#f6fbfa"}}><div className="kpi-label">Performance Status</div><div className="kpi-value" style={{fontSize:22}}>{achievement==null?"No Target":achievement>=100?"Above Target":"Below Target"}</div></div><div className="kpi" style={{background:"#f6fbfa"}}><div className="kpi-label">Target Gap</div><div className="kpi-value" style={{fontSize:22}}>{totalTarget?num(totalReport-totalTarget):"-"}</div></div><div className="kpi" style={{background:"#f6fbfa"}}><div className="kpi-label">Coverage</div><div className="kpi-value" style={{fontSize:22}}>{rows.length.toLocaleString("en-IN")}</div><div className="kpi-note">Grouped reporting units</div></div></div></section></div>}
  </main>
 </div>
}
