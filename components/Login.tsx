 "use client";
import {useState} from "react";
import Image from "next/image";
import {LockKeyhole, UserRound, LogIn, Eye, EyeOff} from "lucide-react";

export default function Login({onLogin}:{onLogin:(username:string)=>void}){
 const [username,setUsername]=useState(""); const [password,setPassword]=useState(""); const [show,setShow]=useState(false); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});const j=await r.json();if(!r.ok)throw new Error(j.message);onLogin(j.username || username)}catch(err:any){setError(err.message||"Login failed")}finally{setBusy(false)}};
 return <main className="login-page">
  <section className="login-card">
   <div className="login-art"><Image src="/login-reference.png" alt="Professional login" width={671} height={646} priority/></div>
   <form className="login-form" onSubmit={submit}>
    <div className="eyebrow">12 Deeni Kaam</div><h1 className="title">Report Dashboard</h1><p className="muted">Secure access to monthly performance, targets and geographical analysis.</p>
    <label className="field-label" style={{marginTop:28}}>Username</label>
    <div style={{position:"relative"}}><UserRound size={17} style={{position:"absolute",left:13,top:13,color:"#718096"}}/><input className="input" style={{paddingLeft:40}} value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" autoComplete="username"/></div>
    <label className="field-label" style={{marginTop:16}}>Password</label>
    <div style={{position:"relative"}}><LockKeyhole size={17} style={{position:"absolute",left:13,top:13,color:"#718096"}}/><input className="input" style={{paddingLeft:40,paddingRight:42}} type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" autoComplete="current-password"/><button type="button" onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:9,border:0,background:"transparent",color:"#64748b"}}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
    {error&&<div style={{marginTop:14,color:"#b91c1c",background:"#fef2f2",border:"1px solid #fecaca",padding:10,borderRadius:9,fontSize:12}}>{error}</div>}
    <button className="btn-primary" style={{marginTop:20,display:"flex",justifyContent:"center",alignItems:"center",gap:8}} disabled={busy}><LogIn size={17}/>{busy?"Signing in...":"LOGIN"}</button>
    <div className="footer-note" style={{marginTop:18}}>Professional Multi-View Dashboard</div>
   </form>
  </section>
 </main>
}
