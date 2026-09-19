const F=[
["dashboard","⌂","Dashboard","Workspace overview"],["bot_builder","🤖","Bot Builder","Build and test bots"],["auto_trades","⚡","Auto Trades","Automation controls"],["manual","💹","Manual Trading","Manual contract workspace"],["tradingview","📊","TradingView","Charts"],["bulk","▦","Bulk Trader","Multiple contracts"],["copy","👥","Copy Trading","Copy workspace"],["ai","🧠","AI Scanner","AI analysis"],["free","🆓","Free Bots","Bot library"],["analysis","🛠","Analysis Tools","Market tools"],["calculator","🧮","Calculator","Calculator"],["digits","●","Digit Analysis","Live digit intelligence"]
];
let page="dashboard",ticks=[],latest=null,symbol="R_75",ws=null;

function el(s){return document.querySelector(s)}
function nav(){
 el("#nav").innerHTML=F.map(f=>`<button class="nav ${page===f[0]?"active":""}" onclick="go('${f[0]}')">${f[1]} &nbsp; ${f[2]}</button>`).join("");
 el("#bottom").innerHTML=[F[0],F[7],F[1],F[3],["menu","☰","Menu"]].map(f=>`<button class="${page===f[0]?"active":""}" onclick="${f[0]==="menu"?"toggleSide()":"go('"+f[0]+"')"}">${f[1]}<br>${f[2]}</button>`).join("");
}
function go(p){page=p;el("#side").classList.remove("open");nav();render()}
function toggleSide(){el("#side").classList.toggle("open")}
function lastDigit(q){const s=String(q);const m=s.match(/(\d)(?!.*\d)/);return m?Number(m[1]):null}
function connectTicks(){
 ws=new WebSocket("wss://api.derivws.com/trading/v1/options/ws/public");
 ws.onopen=()=>ws.send(JSON.stringify({ticks:symbol,subscribe:1}));
 ws.onmessage=e=>{
  try{const x=JSON.parse(e.data);if(x.msg_type==="tick"){const d=lastDigit(x.tick.quote);if(d!==null){latest=d;ticks.push(d);if(ticks.length>300)ticks.shift();render();}}}catch{}
 };
 ws.onclose=()=>setTimeout(connectTicks,2500);
}
function digitsPanel(){
 let c=Array(10).fill(0);ticks.forEach(x=>c[x]++);
 let order=[...Array(10).keys()].sort((a,b)=>c[b]-c[a]||a-b);
 let high=order[0], total=ticks.length||1;
 return `<div class="panel"><div class="digits">${order.map((d,i)=>`<div class="d rank${i+1} ${latest===d?"hit":""}"><span class="n">${d}</span><span class="r">#${i+1} · ${(c[d]/total*100).toFixed(1)}%</span></div>`).join("")}</div><div class="movement">LATEST DIGIT: <b>${latest??"WAITING"}</b> &nbsp; · &nbsp; HIGH MOMENTUM: <b>${ticks.length?high:"WAITING"}</b> &nbsp; · &nbsp; MOVEMENT: <b>${ticks.length<10?"WAITING FOR DATA":latest===high?"ON COURSE":"OFF COURSE"}</b></div></div>`;
}
function dashboard(){
 return `<div class="welcome"><h1>Welcome back 👋</h1><p class="muted">ELISY254 professional workspace · real public Deriv tick stream</p></div>
 <div class="stats"><div class="stat">Connection<b style="color:#baff3d">LIVE</b></div><div class="stat">Market<b>${symbol}</b></div><div class="stat">Latest digit<b>${latest??"—"}</b></div><div class="stat">Ticks<b>${ticks.length}</b></div></div>
 <div class="section"><h2>Trading tools</h2><span class="pill">12 modules</span></div><div class="tools">${F.slice(1).map(f=>`<button class="tool" onclick="go('${f[0]}')"><div class="ico">${f[1]}</div><h3>${f[2]}</h3><p>${f[3]}</p></button>`).join("")}</div>
 <div class="section"><h2>Digit Analysis</h2><span class="pill">REAL TICKS</span></div>${digitsPanel()}`;
}
function pageShell(f,body){return `<div class="welcome"><h1>${f[2]}</h1><p class="muted">${f[3]}</p></div>${body}`}
function render(){
 const f=F.find(x=>x[0]===page)||F[0];el("#title").textContent=f[2];let c="";
 if(page==="dashboard")c=dashboard();
 else if(page==="digits")c=pageShell(f,digitsPanel());
 else if(page==="bot_builder")c=pageShell(f,`<div class="panel"><div class="flow">${["LIVE MARKET","TICK DATA","ANALYSIS","CONDITION","SIGNAL","RISK CHECK","EXECUTION"].map((x,i)=>`<div class="step ${i<3?"active":""}">${x}</div>`).join("")}</div><div class="section"><h2>Bot controls</h2></div><div class="actions"><button class="action">Save Bot</button><button class="action">Test Bot</button><button class="action" onclick="go('free')">Import / Free Bots</button></div></div>`);
 else if(page==="ai")c=pageShell(f,`<div class="panel"><h2>AI ANALYSIS</h2><p class="muted">AI results are shown only when a real provider is configured. No fabricated AI signal is displayed.</p><div class="movement">Current digit engine: real Deriv tick data · ${ticks.length} ticks received.</div></div>`);
 else if(page==="free")c=pageShell(f,`<div id="bots" class="botadmin"></div>`);
 else c=pageShell(f,`<div class="panel"><h2>${f[3]}</h2><p class="muted">Production module shell. Account-scoped actions require authenticated Deriv authorization and explicit user confirmation.</p></div>`);
 el("#content").innerHTML=c;
 if(page==="free")loadBots();
}
async function loadBots(){
 const r=await fetch("/api/bots");const bots=await r.json();
 el("#bots").innerHTML=bots.length?bots.map(b=>`<div class="panel"><div class="circle-preview" style="background:${b.color}">${(b.name||"B").slice(0,1).toUpperCase()}</div><h3>${esc(b.name)}</h3><p class="muted">${esc(b.description)}</p>${b.filename?`<a class="action" href="/api/bots/${b.id}/file">Download bot</a>`:""}</div>`).join(""):`<div class="panel"><h3>No free bots yet</h3><p class="muted">Admin can publish bots from /admin.</p></div>`;
}
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function tokenModal(){el("#modal").className="modal";el("#modal").innerHTML=`<div class="modalbox"><h2>API token</h2><p class="muted">PAT authentication is supported by the backend integration layer. Do not send your token to anyone.</p><div class="field"><input type="password" placeholder="Deriv API token"></div><button class="primary" onclick="el('#modal').className='modal hidden'">Continue</button></div>`}
nav();render();connectTicks();