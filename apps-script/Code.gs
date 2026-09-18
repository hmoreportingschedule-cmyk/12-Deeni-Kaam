const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEETS = {
  users:"Users",
  deeni:"Row Data (12 Deeni)",
  dept:"Row Data (Department)",
  geo:"Geo Master",
  activities:"Activity Master",
  departments:"Department Master"
};

function setupSheets(){
  const configs = {
    [SHEETS.users]: [["Name","Email","PasswordHash","Role","Active","CreatedAt"]],
    [SHEETS.deeni]: [["Month","Year","Chain","Region","State","Division","Distric","Pincode","Category","Activity","Report","Target52","Target26"]],
    [SHEETS.dept]: [["Month","Year","Department","Frequency","Region","State","Division","Distric","Pincode","Activity/Work","Report","Target","Achievement"]],
    [SHEETS.geo]: [["Region","State","Division","Distric","Pincode"]],
    [SHEETS.activities]: [["Activity","Category"]],
    [SHEETS.departments]: [["Department","Frequency"]]
  };
  Object.entries(configs).forEach(([name,headers])=>{
    let sh=SS.getSheetByName(name)||SS.insertSheet(name);
    sh.clear(); sh.getRange(1,1,1,headers[0].length).setValues(headers);
    sh.setFrozenRows(1);
  });
  const u=SS.getSheetByName(SHEETS.users);
  u.appendRow(["Administrator","admin@example.com",hash_("ChangeMe123!"),"admin",true,new Date()]);
  SpreadsheetApp.flush();
}

function doGet(){return ContentService.createTextOutput(JSON.stringify({ok:true,service:"Reporting Dashboard API"})).setMimeType(ContentService.MimeType.JSON)}

function doPost(e){
  try{
    const p=JSON.parse(e.postData.contents||"{}");
    switch(p.action){
      case "login": return json_(login_(p.email,p.password));
      case "rows": return json_(rows_(p.token,p.sheet));
      case "users": return json_(users_(p.token));
      case "user_create": return json_(userCreate_(p));
      case "row_append": return json_(rowAppend_(p));
      default: return json_({ok:false,error:"Unknown action"});
    }
  }catch(err){return json_({ok:false,error:String(err)})}
}

function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}

function hash_(s){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8);
  return bytes.map(b=>("0"+(b&0xff).toString(16)).slice(-2)).join("");
}

function token_(){return Utilities.getUuid()+"."+new Date().getTime()}

function login_(email,password){
  const sh=SS.getSheetByName(SHEETS.users), vals=sh.getDataRange().getValues();
  const row=vals.slice(1).find(r=>String(r[1]).toLowerCase()===String(email).toLowerCase() && String(r[2])===hash_(password) && r[4]===true);
  if(!row) return {ok:false,error:"Invalid email/password or disabled user"};
  const tok=token_();
  PropertiesService.getScriptProperties().setProperty("SESSION_"+tok,JSON.stringify({email:row[1],role:row[3],expires:Date.now()+8*60*60*1000}));
  return {ok:true,user:{name:row[0],email:row[1],role:row[3],token:tok}};
}

function auth_(token,adminOnly){
  const raw=PropertiesService.getScriptProperties().getProperty("SESSION_"+token);
  if(!raw) throw new Error("Session expired");
  const s=JSON.parse(raw);
  if(Date.now()>s.expires){PropertiesService.getScriptProperties().deleteProperty("SESSION_"+token);throw new Error("Session expired")}
  if(adminOnly && s.role!=="admin") throw new Error("Admin permission required");
  return s;
}

function rows_(token,sheet){
  auth_(token,false);
  const sh=SS.getSheetByName(sheet);
  if(!sh) throw new Error("Sheet not found: "+sheet);
  const vals=sh.getDataRange().getValues();
  const headers=vals.shift();
  const rows=vals.filter(r=>r.join("")!=="").map(r=>{let o={};headers.forEach((h,i)=>o[h]=r[i]);return o});
  return {ok:true,rows};
}

function users_(token){
  auth_(token,true);
  const sh=SS.getSheetByName(SHEETS.users), vals=sh.getDataRange().getValues();
  return {ok:true,users:vals.slice(1).filter(r=>r[1]).map(r=>({name:r[0],email:r[1],role:r[3],active:r[4]}))};
}

function userCreate_(p){
  auth_(p.token,true);
  if(!p.email||!p.password||!p.name) throw new Error("Name, email and password are required");
  const sh=SS.getSheetByName(SHEETS.users), vals=sh.getDataRange().getValues();
  const idx=vals.findIndex((r,i)=>i>0 && String(r[1]).toLowerCase()===String(p.email).toLowerCase());
  const row=[p.name,p.email,hash_(p.password),p.role||"user",true,new Date()];
  if(idx>0) sh.getRange(idx+1,1,1,row.length).setValues([row]); else sh.appendRow(row);
  return {ok:true};
}

function rowAppend_(p){
  auth_(p.token,false);
  const map=p.sheet===SHEETS.dept?SHEETS.dept:SHEETS.deeni;
  const sh=SS.getSheetByName(map);
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  sh.appendRow(headers.map(h=>p.row[h]!==undefined?p.row[h]:""));
  return {ok:true};
}
