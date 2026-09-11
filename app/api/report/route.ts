import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { aggregate, loadRows, meta } from "@/lib/data";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req: Request) {
  const token=(await cookies()).get("dashboard_session")?.value;
  if(!verifySession(token)) return NextResponse.json({message:"Unauthorized"},{status:401});
  try{
    const rows=await loadRows();
    const u=new URL(req.url);
    const p=Object.fromEntries(u.searchParams.entries());
    const result=aggregate(rows,p);
    return NextResponse.json({ok:true,totalRows:rows.length,rows:result,meta:meta(rows,p)});
  }catch(e:any){
    return NextResponse.json({ok:false,message:e?.message||"Data source error"},{status:500});
  }
}
