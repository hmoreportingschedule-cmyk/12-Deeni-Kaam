 "use client";
import {useEffect,useState} from "react";
import Login from "@/components/Login";
import Dashboard from "@/components/Dashboard";
export default function Home(){
 const [ready,setReady]=useState(false); const [logged,setLogged]=useState(false); const [username,setUsername]=useState("");
 const check=async()=>{try{const r=await fetch("/api/report?month=",{cache:"no-store"});setLogged(r.status!==401)}catch{setLogged(false)}finally{setReady(true)}};
 useEffect(()=>{check()},[]);
 if(!ready)return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#eef9f8"}}>Loading...</div>;
 if(!logged)return <Login onLogin={(u)=>{setUsername(u);setLogged(true)}}/>;
 return <Dashboard username={username} onLogout={async()=>{await fetch("/api/logout",{method:"POST"});setLogged(false);setUsername("")}}/>;
}
