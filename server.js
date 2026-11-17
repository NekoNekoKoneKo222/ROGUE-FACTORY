"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { WebSocketServer, WebSocket } = require("ws");
const { Pool } = require("pg");
const engine = require("./game/engine");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname, "public");
const MIME = {".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon"};
const pool = process.env.DATABASE_URL ? new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:5000}) : null;
const games = new Map();
let waiting = null;

const server = http.createServer((req,res)=>{
  let url;
  try { url = new URL(req.url, "http://localhost"); } catch { res.writeHead(400).end(); return; }
  if(url.pathname==="/health"){
    res.writeHead(200,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
    res.end(JSON.stringify({ok:true,activeMatches:games.size,db:!!pool}));
    return;
  }
  if(req.method!=="GET" && req.method!=="HEAD"){res.writeHead(405).end();return;}
  let filepath;
  try { filepath=path.resolve(ROOT,"."+decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname)); }
  catch { res.writeHead(400).end(); return; }
  if(!filepath.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}
  fs.stat(filepath,(error,stat)=>{
    if(error || !stat.isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{"content-type":MIME[path.extname(filepath)] || "application/octet-stream","cache-control":"no-store","x-content-type-options":"nosniff"});
    if(req.method==="HEAD")res.end();else fs.createReadStream(filepath).pipe(res);
  });
});

const wss = new WebSocketServer({server,maxPayload:12*1024,perMessageDeflate:false});
const send = (ws,payload) => {if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(payload));};
function safeName(name){
  return String(name || "ENGINEER").normalize("NFKC").slice(0,20).replace(/[<>&"']/g,"").trim() || "ENGINEER";
}
async function recordMatch(match){
  if(!pool || match.saved) return;
  match.saved=true;
  const {game}=match;
  const [a,b]=game.players;
  try{
    await pool.query(
      "INSERT INTO matches (public_id,mode,player_a,player_b,winner,result,seconds,damage_a,damage_b) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (public_id) DO NOTHING",
      [game.id,b.bot?"solo":"pvp",a.name,b.name,game.winner,game.finishReason,Math.round(game.elapsed),a.stats.damage,b.stats.damage]
    );
  }catch(e){ console.error("Unable to save match:",e.message); }
}
function stopMatch(match){
  if(match.timer)clearInterval(match.timer);
  games.delete(match.game.id);
}
function startGame(sockets,players){
  const game=engine.newGame(players[0],players[1]);
  const match={game,sockets,saved:false,timer:null};
  games.set(game.id,match);
  sockets.forEach((ws,index)=>{
    ws.match=match;ws.index=index;
    send(ws,{type:"start",playerIndex:index,id:game.id,definitions:engine.DEFINITIONS,upgrades:engine.UPGRADES});
  });
  const broadcast=()=>{
    const snap=engine.snapshot(game);
    sockets.forEach(ws=>send(ws,{type:"state",state:snap}));
  };
  broadcast();
  match.timer=setInterval(()=>{
    engine.step(game,0.25);
    broadcast();
    if(game.ended){
      recordMatch(match);
      stopMatch(match);
      sockets.forEach(ws=>{ws.match=null;ws.index=undefined;});
    }
  },250);
}
wss.on("connection",ws=>{
  ws.id=crypto.randomUUID();ws.name="ENGINEER";ws.isAlive=true;
  ws.on("pong",()=>{ws.isAlive=true;});
  send(ws,{type:"hello",message:"ROGUE FACTORY ONLINE"});
  ws.on("message",raw=>{
    let msg;
    try{msg=JSON.parse(String(raw));}catch{return;}
    if(!msg || typeof msg!=="object")return;
    if(msg.type==="join"){
      if(ws.match || ws===waiting)return;
      ws.name=safeName(msg.name);
      if(msg.mode==="solo"){
        startGame([ws],[{id:ws.id,name:ws.name},{id:"cpu-"+crypto.randomUUID(),name:"AUTOMATON CPU",bot:true}]);
      }else if(msg.mode==="pvp"){
        if(waiting && waiting.readyState===WebSocket.OPEN && waiting!==ws){
          const partner=waiting;waiting=null;
          startGame([partner,ws],[{id:partner.id,name:partner.name},{id:ws.id,name:ws.name}]);
        }else{
          waiting=ws;
          send(ws,{type:"waiting"});
        }
      }
      return;
    }
    if(msg.type==="cancel" && waiting===ws){
      waiting=null;send(ws,{type:"cancelled"});return;
    }
    const match=ws.match;
    if(!match || match.game.ended)return;
    const who=ws.index;
    if(!Number.isInteger(who))return;
    let result;
    switch(msg.type){
      case "build": result=engine.build(match.game,who,msg.machine,msg.x,msg.y,msg.dir);break;
      case "dismantle":result=engine.dismantle(match.game,who,msg.x,msg.y);break;
      case "rotate":result=engine.rotate(match.game,who,msg.x,msg.y);break;
      case "choose":result=engine.choose(match.game,who,msg.id);break;
      case "focus":match.game.players[who].focus=msg.target==="production"?"production":"core";result={ok:true};break;
      default:return;
    }
    if(!result?.ok)send(ws,{type:"error",message:result?.error || "操作できません"});
    else send(ws,{type:"ack",action:msg.type,x:msg.x,y:msg.y,machine:msg.machine,id:msg.id});
  });
  ws.on("close",()=>{
    if(waiting===ws)waiting=null;
    const match=ws.match;
    if(match && !match.game.ended && !match.game.players[1].bot){
      match.game.ended=true;
      match.game.finishReason="disconnect";
      const opponent=match.sockets.find(s=>s!==ws);
      match.game.winner=opponent?.id || null;
      send(opponent,{type:"state",state:engine.snapshot(match.game)});
      recordMatch(match);
      stopMatch(match);
      if(opponent){opponent.match=null;opponent.index=undefined;}
    }else if(match && match.game.players[1].bot){
      stopMatch(match);
    }
  });
});
const heartbeat=setInterval(()=>{
  for(const ws of wss.clients) {
    if(!ws.isAlive){ws.terminate();continue;}
    ws.isAlive=false;ws.ping();
  }
},30000);
heartbeat.unref();
server.listen(PORT,"0.0.0.0",()=>console.log("ROGUE FACTORY listening on",PORT));
process.on("SIGTERM",()=>{
  clearInterval(heartbeat);
  for(const game of games.values())stopMatch(game);
  wss.close();server.close();pool?.end();
});
