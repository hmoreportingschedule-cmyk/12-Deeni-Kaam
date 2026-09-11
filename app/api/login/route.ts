import { NextResponse } from "next/server";
import { makeSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(()=>({}));
  const username = String(body.username||"");
  const password = String(body.password||"");
  const ok = username === (process.env.DASHBOARD_USERNAME || "admin") &&
             password === (process.env.DASHBOARD_PASSWORD || "change-me");
  if (!ok) return NextResponse.json({ok:false,message:"Invalid username or password."},{status:401});
  const res=NextResponse.json({ok:true});
  res.cookies.set("dashboard_session",makeSession(username),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*12});
  return res;
}
