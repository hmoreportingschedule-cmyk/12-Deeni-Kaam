"use client";
import React,{useEffect,useMemo,useState} from "react";
import {BarChart,Bar,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer} from "recharts";

type Row={Month:string;Year:number;Chain:string;Region:string;State:string;Division:string;Distric:string;Pincode:string;Category:string;Activity:string;Report:number;Target52:number;Target26:number;};
const API=process.env.NEXT_PUBLIC_GAS_API||"";
const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const years=Array.from({length:10},(_,i)=>2022+i);
const quarters=["Q1","Q2","Q3","Q4"];

function pct(n:number){return `${(n*100).toFixed(1)}%`}
function period(r:Row){return `${r.Month}-${r.Year}`}
function q(m:string){const i=months.indexOf(m);return i<3?"Q1":i<6?"Q2":i<9?"Q3":"Q4"}

export default function Home(){
 const [user,setUser]=useState<any>(null),[login,setLogin]=useState(true);
 const [email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [rows,setRows]=useState<Row[]>([]),[tab,setTab]=useState("12");
 const [target,setTarget]=useState<"52%"|"26%">("52%");
 const [month,setMonth]=useState("Jan"),[year,setYear]=useState(2026),[compareMonth,setCompareMonth]=useState("Feb"),[compareYear,setCompareYear]=useState(2026);
 const [level,setLevel]=useState("Country"),[region,setRegion]=useState("All"),[state,setState]=useState("All"),[division,setDivision]=useState("All"),[district,setDistrict]=useState("All");
 const [chain,setChain]=useState("12 Deeni Kaam"),[quarter,setQuarter]=useState("Q1"),[adminOpen,setAdminOpen]=useState(false),[users,setUsers]=useState<any[]>([]);
 const [busy,setBusy]=useState(false),[err,setErr]=useState("");

 useEffect(()=>{const u=localStorage.getItem("rpt_user");if(u){setUser(JSON.parse(u));setLogin(false);load(JSON.parse(u).token)}},[]);
 async function api(action:string,payload:any={},token?:string){
   if(!API) throw new Error("NEXT_PUBLIC_GAS_API is not configured.");
   const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload,token:token||user?.token})});
   const j=await r.json(); if(!j.ok) throw new Error(j.error||"API error"); return j;
 }
 async function doLogin(){
   setBusy(true);setErr("");try{const j=await api("login",{email,password});localStorage.setItem("rpt_user",JSON.stringify(j.user));setUser(j.user);setLogin(false);await load(j.user.token)}catch(e:any){setErr(e.message)}finally{setBusy(false)}
 }
 async function load(token?:string){
   setBusy(true);try{const j=await api("rows",{sheet:tab==="12"?"Row Data (12 Deeni)":"Row Data (Department)"},token);setRows(j.rows||[])}catch(e:any){setErr(e.message)}finally{setBusy(false)}
 }
 async function loadUsers(){try{const j=await api("users");setUsers(j.users||[])}catch(e:any){setErr(e.message)}}
 const filtered=useMemo(()=>rows.filter(r=>
   (r.Chain||"")===chain || tab==="dep"
 ).filter(r=>
   region==="All"||r.Region===region
 ).filter(r=>state==="All"||r.State===state)
 .filter(r=>division==="All"||r.Division===division)
 .filter(r=>district==="All"||r.Distric===district),[rows,chain,region,state,division,district,tab]);

 const selected=filtered.filter(r=>r.Month===month&&Number(r.Year)===Number(year));
 const comp=filtered.filter(r=>r.Month===compareMonth&&Number(r.Year)===Number(compareYear));
 const value=(r:Row)=>Number(target==="52%"?r.Target52:r.Target26)||0;
 const report=(a:Row[])=>a.reduce((s,r)=>s+(Number(r.Report)||0),0);
 const targ=(a:Row[])=>a.reduce((s,r)=>s+value(r),0);
 const ach=(a:Row[])=>targ(a)?report(a)/targ(a):0;
 const kpi={report:report(selected),target:targ(selected),achievement:ach(selected),comparison:ach(selected)-ach(comp)};
 const regions=[...new Set(rows.map(r=>r.Region).filter(Boolean))].sort();
 const states=[...new Set(rows.filter(r=>region==="All"||r.Region===region).map(r=>r.State).filter(Boolean))].sort();
 const divisions=[...new Set(rows.filter(r=>(region==="All"||r.Region===region)&&(state==="All"||r.State===state)).map(r=>r.Division).filter(Boolean))].sort();
 const districts=[...new Set(rows.filter(r=>(region==="All"||r.Region===region)&&(state==="All"||r.State===state)&&(division==="All"||r.Division===division)).map(r=>r.Distric).filter(Boolean))].sort();
 const activities=[...new Set(filtered.map(r=>r.Activity).filter(Boolean))];
 const activityData=activities.map(a=>{const rr=selected.filter(r=>r.Activity===a);return {name:a,achievement:ach(rr)*100,report:report(rr)}}).sort((a,b)=>b.achievement-a.achievement);
 const rank=(field:keyof Row,limit:number)=>{const m=new Map<string,Row[]>();selected.forEach(r=>{const k=String(r[field]||"");if(k)m.set(k,[...(m.get(k)||[]),r])});return [...m.entries()].map(([name,rr])=>({name,achievement:ach(rr)})).sort((a,b)=>b.achievement-a.achievement).slice(0,limit)};
 const monthly=months.map(m=>{const rr=filtered.filter(r=>r.Month===m&&Number(r.Year)===Number(year));return {month:m,achievement:ach(rr)*100}});
 const avgToMonth=months.length?monthly.reduce((s,x)=>s+x.achievement,0)/monthly.length:0;

 if(login) return <main className="login"><div className="card login-card"><h1>Reporting & Analise</h1><p>12 Deeni & Department Dashboard</p><input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={doLogin} disabled={busy}>{busy?"Signing in…":"Login"}</button>{err&&<div className="error">{err}</div>}<small>Admin/user accounts are managed in Google Sheets.</small></div></main>;

 return <main><header><div><h1>Reporting & Analise Dashboard</h1><span>{user?.name} · {user?.role}</span></div><div className="actions"><button onClick={()=>load()}>↻ Refresh</button>{user?.role==="admin"&&<button onClick={()=>{setAdminOpen(!adminOpen);if(!adminOpen)loadUsers()}}>Admin</button>}<button onClick={()=>{localStorage.removeItem("rpt_user");location.reload()}}>Logout</button></div></header>
 <nav><button className={tab==="12"?"active":""} onClick={()=>{setTab("12");setChain("12 Deeni Kaam");setTimeout(()=>load(),0)}}>12 Deeni Kaam Report</button><button className={tab==="dep"?"active":""} onClick={()=>{setTab("dep");setChain("Department");setTimeout(()=>load(),0)}}>Department Report</button></nav>
 {adminOpen&&user?.role==="admin"&&<Admin users={users} onDone={loadUsers}/>}
 <section className="filters card">
   <label>Chain<select value={chain} onChange={e=>setChain(e.target.value)}><option>12 Deeni Kaam</option><option>Department</option><option>Central</option></select></label>
   <label>Level<select value={level} onChange={e=>setLevel(e.target.value)}>{["Country","Region","State","Division","District"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Region<select value={region} onChange={e=>{setRegion(e.target.value);setState("All");setDivision("All");setDistrict("All")}}><option>All</option>{regions.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>State<select value={state} onChange={e=>{setState(e.target.value);setDivision("All");setDistrict("All")}}><option>All</option>{states.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Division<select value={division} onChange={e=>{setDivision(e.target.value);setDistrict("All")}}><option>All</option>{divisions.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>District<select value={district} onChange={e=>setDistrict(e.target.value)}><option>All</option>{districts.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Target<select value={target} onChange={e=>setTarget(e.target.value as any)}><option>52%</option><option>26%</option></select></label>
   <label>Month<select value={month} onChange={e=>setMonth(e.target.value)}>{months.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Year<select value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Quarter<select value={quarter} onChange={e=>setQuarter(e.target.value)}>{quarters.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Compare Month<select value={compareMonth} onChange={e=>setCompareMonth(e.target.value)}>{months.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Compare Year<select value={compareYear} onChange={e=>setCompareYear(Number(e.target.value))}>{years.map(x=><option key={x}>{x}</option>)}</select></label>
 </section>
 {err&&<div className="error global">{err}</div>}
 <section className="kpis"><Kpi title="Report" value={kpi.report.toLocaleString()}/><Kpi title={`Target ${target}`} value={kpi.target.toLocaleString()}/><Kpi title="Achievement" value={pct(kpi.achievement)}/><Kpi title="Month Comparison" value={(kpi.comparison>=0?"+":"")+pct(kpi.comparison)} cls={kpi.comparison>=0?"plus":"minus"}/></section>
 <section className="grid2"><div className="card chart"><h2>Activity Achievement</h2><ResponsiveContainer width="100%" height={320}><BarChart data={activityData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis/><Tooltip/><Legend/><Bar dataKey="achievement" name="Achievement %"/></BarChart></ResponsiveContainer></div><div className="card chart"><h2>Month Trend — {year}</h2><ResponsiveContainer width="100%" height={320}><LineChart data={monthly}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis/><Tooltip/><Line type="monotone" dataKey="achievement" name="Achievement %"/></LineChart></ResponsiveContainer></div></section>
 <section className="grid2"><Rank title="Top 3 Regions" data={rank("Region",3)}/><Rank title="Top 5 States" data={rank("State",5)}/><Rank title="Top 20 Divisions" data={rank("Division",20)}/><Rank title="Top 15 Districts" data={rank("Distric",15)}/></section>
 <section className="card"><h2>Average-to-Month & Quarter Comparison</h2><div className="statrow"><div><b>Average of monthly achievement:</b> {avgToMonth.toFixed(1)}%</div><div><b>Selected quarter:</b> {quarter}</div><div><b>Selected vs compare month:</b> <span className={kpi.comparison>=0?"plus":"minus"}>{kpi.comparison>=0?"+":""}{pct(kpi.comparison)}</span></div></div><p className="muted">Ranking is based on the selected month/year, target selection and current geographic filters. Comparison is kept separate from achievement so the two measures are not mixed.</p></section>
 </main>
}

function Kpi({title,value,cls=""}:{title:string,value:string,cls?:string}){return <div className={"kpi card "+cls}><span>{title}</span><strong>{value}</strong></div>}
function Rank({title,data}:{title:string,data:any[]}){return <div className="card rank"><h2>{title}</h2>{data.length?data.map((x,i)=><div className="rankrow" key={x.name}><b>{i+1}. {x.name}</b><span>{pct(x.achievement)}</span></div>):<div className="muted">No data</div>}</div>}

function Admin({users,onDone}:{users:any[],onDone:()=>void}){
 const [name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[role,setRole]=useState("user"),[msg,setMsg]=useState("");
 async function save(){try{const API=process.env.NEXT_PUBLIC_GAS_API||"";const token=JSON.parse(localStorage.getItem("rpt_user")||"{}").token;const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"user_create",token,name,email,password,role})});const j=await r.json();if(!j.ok)throw Error(j.error);setMsg("User created");setName("");setEmail("");setPassword("");onDone()}catch(e:any){setMsg(e.message)}}
 return <section className="card admin"><h2>Admin — User Management</h2><div className="adminform"><input placeholder="Name" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input placeholder="Temporary password" value={password} onChange={e=>setPassword(e.target.value)}/><select value={role} onChange={e=>setRole(e.target.value)}><option value="user">User</option><option value="admin">Admin</option></select><button onClick={save}>Create / Update User</button></div>{msg&&<p>{msg}</p>}<div className="userlist">{users.map(u=><div key={u.email}>{u.name} — {u.email} — <b>{u.role}</b> — {u.active?"Active":"Disabled"}</div>)}</div></section>
}
