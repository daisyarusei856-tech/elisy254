const express=require("express");
const path=require("path");
const fs=require("fs");
const crypto=require("crypto");
const cookieSession=require("cookie-session");
const multer=require("multer");
const Database=require("better-sqlite3");

const app=express();
const PORT=process.env.PORT||10000;
const BASE_URL=process.env.BASE_URL||`http://localhost:${PORT}`;
const DB_PATH=process.env.DATABASE_PATH||path.join(__dirname,"data","elisy254.db");
const UPLOAD_DIR=path.join(__dirname,"uploads");
fs.mkdirSync(path.dirname(DB_PATH),{recursive:true});
fs.mkdirSync(UPLOAD_DIR,{recursive:true});

const db=new Database(DB_PATH);
db.pragma("journal_mode=WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS bots(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 image_url TEXT NOT NULL DEFAULT '',
 color TEXT NOT NULL DEFAULT '#b9ff3d',
 active INTEGER NOT NULL DEFAULT 1,
 filename TEXT,
 original_name TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.use(cookieSession({
 name:"elisy254_session",
 secret:process.env.SESSION_SECRET||"CHANGE_ME_IN_PRODUCTION",
 httpOnly:true,
 sameSite:"lax",
 secure:process.env.NODE_ENV==="production",
 maxAge:7*24*60*60*1000
}));
app.use(express.static(path.join(__dirname,"public")));

const upload=multer({
 storage:multer.diskStorage({
  destination:UPLOAD_DIR,
  filename:(req,file,cb)=>cb(null,crypto.randomUUID()+"-"+file.originalname.replace(/[^a-zA-Z0-9._-]/g,"_"))
 }),
 limits:{fileSize:10*1024*1024}
});

function adminOnly(req,res,next){
 if(req.session?.admin) return next();
 return res.status(401).json({error:"Admin authentication required"});
}
function safeEq(a,b){
 if(typeof a!=="string"||typeof b!=="string") return false;
 const aa=Buffer.from(a),bb=Buffer.from(b);
 return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function base64url(buf){return buf.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function pkceChallenge(v){return base64url(crypto.createHash("sha256").update(v).digest());}

app.get("/api/config",(req,res)=>{
 res.json({
  authenticated:!!req.session?.user,
  admin:!!req.session?.admin,
  oauthConfigured:!!process.env.DERIV_CLIENT_ID && !!process.env.DERIV_REDIRECT_URI,
  baseUrl:BASE_URL
 });
});

app.get("/auth/deriv/start",(req,res)=>{
 if(!process.env.DERIV_CLIENT_ID||!process.env.DERIV_REDIRECT_URI)
  return res.status(503).send("Deriv OAuth is not configured. Add DERIV_CLIENT_ID and DERIV_REDIRECT_URI in Render Environment.");
 const verifier=base64url(crypto.randomBytes(48));
 const state=base64url(crypto.randomBytes(32));
 req.session.oauth={verifier,state};
 const u=new URL("https://auth.deriv.com/oauth2/auth");
 u.searchParams.set("response_type","code");
 u.searchParams.set("client_id",process.env.DERIV_CLIENT_ID);
 u.searchParams.set("redirect_uri",process.env.DERIV_REDIRECT_URI);
 u.searchParams.set("scope","trade account_manage application_read");
 u.searchParams.set("state",state);
 u.searchParams.set("code_challenge",pkceChallenge(verifier));
 u.searchParams.set("code_challenge_method","S256");
 res.redirect(u.toString());
});

app.get("/auth/deriv/signup",(req,res)=>{
 if(!process.env.DERIV_CLIENT_ID||!process.env.DERIV_REDIRECT_URI)
  return res.status(503).send("Deriv OAuth is not configured.");
 const verifier=base64url(crypto.randomBytes(48));
 const state=base64url(crypto.randomBytes(32));
 req.session.oauth={verifier,state};
 const u=new URL("https://auth.deriv.com/oauth2/auth");
 u.searchParams.set("response_type","code");
 u.searchParams.set("client_id",process.env.DERIV_CLIENT_ID);
 u.searchParams.set("redirect_uri",process.env.DERIV_REDIRECT_URI);
 u.searchParams.set("scope","trade account_manage application_read");
 u.searchParams.set("state",state);
 u.searchParams.set("code_challenge",pkceChallenge(verifier));
 u.searchParams.set("code_challenge_method","S256");
 u.searchParams.set("prompt","registration");
 if(process.env.DERIV_SIGNUP_TRACKING_TOKEN) u.searchParams.set("t",process.env.DERIV_SIGNUP_TRACKING_TOKEN);
 if(process.env.DERIV_AFFILIATE_ID) u.searchParams.set("utm_source",process.env.DERIV_AFFILIATE_ID);
 u.searchParams.set("utm_medium","affiliate");
 u.searchParams.set("utm_campaign","elisy254");
 res.redirect(u.toString());
});

app.get("/auth/deriv/callback",async(req,res)=>{
 try{
  if(req.query.error) return res.redirect("/?auth_error="+encodeURIComponent(req.query.error_description||req.query.error));
  const o=req.session.oauth;
  if(!o||!safeEq(o.state,String(req.query.state||""))) return res.status(400).send("Invalid OAuth state.");
  const code=String(req.query.code||"");
  const body=new URLSearchParams({
   grant_type:"authorization_code",
   client_id:process.env.DERIV_CLIENT_ID,
   code,
   code_verifier:o.verifier,
   redirect_uri:process.env.DERIV_REDIRECT_URI
  });
  const r=await fetch("https://auth.deriv.com/oauth2/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  const data=await r.json();
  if(!r.ok||!data.access_token) return res.status(502).send("Deriv token exchange failed.");
  req.session.oauth=null;
  req.session.user={provider:"deriv",accessToken:data.access_token,expiresAt:Date.now()+(Number(data.expires_in||3600)*1000)};
  res.redirect("/");
 }catch(e){res.status(500).send("OAuth callback error.");}
});

app.post("/api/admin/login",(req,res)=>{
 const email=process.env.ADMIN_EMAIL||"";
 const password=process.env.ADMIN_PASSWORD||"";
 if(safeEq(req.body.email||"",email)&&safeEq(req.body.password||"",password)){
  req.session.admin=true;
  return res.json({ok:true});
 }
 res.status(401).json({error:"Invalid admin credentials"});
});
app.post("/api/admin/logout",adminOnly,(req,res)=>{req.session.admin=false;res.json({ok:true})});

app.get("/api/bots",(req,res)=>{
 const rows=db.prepare("SELECT id,name,description,image_url,color,active,filename,original_name,created_at,updated_at FROM bots WHERE active=1 ORDER BY id DESC").all();
 res.json(rows);
});
app.get("/api/admin/bots",adminOnly,(req,res)=>res.json(db.prepare("SELECT * FROM bots ORDER BY id DESC").all()));

app.post("/api/admin/bots",adminOnly,upload.single("file"),(req,res)=>{
 const {name,description="",image_url="",color="#b9ff3d",active="1"}=req.body;
 if(!name?.trim()) return res.status(400).json({error:"Name required"});
 const f=req.file;
 const info=db.prepare(`INSERT INTO bots(name,description,image_url,color,active,filename,original_name) VALUES(?,?,?,?,?,?,?)`)
  .run(name.trim(),description.trim(),image_url.trim(),color,active==="1"?1:0,f?.filename||null,f?.originalname||null);
 res.json(db.prepare("SELECT * FROM bots WHERE id=?").get(info.lastInsertRowid));
});
app.put("/api/admin/bots/:id",adminOnly,upload.single("file"),(req,res)=>{
 const old=db.prepare("SELECT * FROM bots WHERE id=?").get(req.params.id);
 if(!old) return res.status(404).json({error:"Bot not found"});
 const f=req.file;
 if(f && old.filename) try{fs.unlinkSync(path.join(UPLOAD_DIR,old.filename))}catch{}
 db.prepare(`UPDATE bots SET name=?,description=?,image_url=?,color=?,active=?,filename=?,original_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
 .run((req.body.name||old.name).trim(),(req.body.description??old.description).trim(),(req.body.image_url??old.image_url).trim(),req.body.color||old.color,req.body.active==="1"?1:0,f?f.filename:old.filename,f?f.originalname:old.original_name,req.params.id);
 res.json(db.prepare("SELECT * FROM bots WHERE id=?").get(req.params.id));
});
app.delete("/api/admin/bots/:id",adminOnly,(req,res)=>{
 const old=db.prepare("SELECT * FROM bots WHERE id=?").get(req.params.id);
 if(!old) return res.status(404).json({error:"Bot not found"});
 if(old.filename) try{fs.unlinkSync(path.join(UPLOAD_DIR,old.filename))}catch{}
 db.prepare("DELETE FROM bots WHERE id=?").run(req.params.id);
 res.json({ok:true});
});
app.get("/api/bots/:id/file",(req,res)=>{
 const b=db.prepare("SELECT * FROM bots WHERE id=? AND active=1").get(req.params.id);
 if(!b?.filename) return res.status(404).send("Bot file unavailable");
 res.download(path.join(UPLOAD_DIR,b.filename),b.original_name||"bot.file");
});
app.get("/api/admin/bots/:id/file",adminOnly,(req,res)=>{
 const b=db.prepare("SELECT * FROM bots WHERE id=?").get(req.params.id);
 if(!b?.filename) return res.status(404).send("Bot file unavailable");
 res.download(path.join(UPLOAD_DIR,b.filename),b.original_name||"bot.file");
});

app.get(/.*/,(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`ELISY254 running on ${PORT}`));
