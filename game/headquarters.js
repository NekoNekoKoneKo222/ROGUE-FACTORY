"use strict";
const crypto=require("node:crypto");
const SIZE=12, CORE=125;
const ORES=new Set([13,37,39,20,33,74,81,110,116,130]);
const TYPES={
 generator:{name:"発電機",icon:"ϟ",price:15,hp:110,power:12},
 drill:{name:"採掘機",icon:"⛏",price:12,hp:75},
 belt:{name:"コンベア",icon:"➜",price:3,hp:35},
 furnace:{name:"精錬機",icon:"♨",price:15,hp:75},
 ammo:{name:"弾薬工場",icon:"⚙",price:18,hp:75},
 turret:{name:"防衛砲台",icon:"✹",price:22,hp:95},
 rocket:{name:"ミサイル",icon:"➤",price:36,hp:90},
 wall:{name:"装甲壁",icon:"▦",price:9,hp:160},
 shield:{name:"シールド",icon:"◈",price:28,hp:90},
 repair:{name:"修理設備",icon:"✚",price:30,hp:80},
 tankPlant:{name:"戦車工場",icon:"▣",price:78,hp:160}
};
const UNITS={
 tank:{name:"主力戦車",icon:"▰",metal:28,ammo:14,scrap:22,seconds:36,attack:45},
 artillery:{name:"自走砲",icon:"✷",metal:48,ammo:28,scrap:40,seconds:55,attack:75}
};
const make=(type,dir=1)=>({type,dir,level:1,hp:TYPES[type]?.hp||500});
const idx=(x,y)=>y*SIZE+x;
function starter(){
 const board=Array(144).fill(null);
 for(const [x,y,type] of [[5,10,"core"],[0,6,"generator"],[1,1,"drill"],[2,1,"belt"],[3,1,"furnace"],[4,1,"belt"],[5,1,"ammo"],[6,1,"turret"]])board[idx(x,y)]=make(type);
 return {version:1,board,level:1,hp:500,maxHp:500,
  resources:{scrap:180,ore:40,metal:40,ammo:35},army:{tank:1,artillery:0},queue:[],
  trophies:0,raidsWon:0,raidsLost:0,shieldUntil:0,attackAt:0,lastTick:Date.now()};
}
function next(pos,dir){
 const d=[[0,-1],[1,0],[0,1],[-1,0]][dir],x=pos%SIZE+d[0],y=Math.floor(pos/SIZE)+d[1];
 return x>=0&&x<SIZE&&y>=0&&y<SIZE?idx(x,y):-1;
}
function lines(board){
 const seenF=new Set(),seenA=new Set();let miners=0;
 function go(pos){
  const seen=new Set();
  while(pos>=0&&!seen.has(pos)){
   seen.add(pos);const m=board[pos];if(!m)return null;
   const dest=next(pos,m.dir);if(dest<0||!board[dest])return null;
   if(board[dest].type!=="belt")return {pos:dest,type:board[dest].type};
   pos=dest;
  }
  return null;
 }
 for(let pos=0;pos<144;pos++){
  if(board[pos]?.type!=="drill"||!ORES.has(pos))continue;
  miners++;
  const a=go(pos);if(a?.type!=="furnace")continue;
  seenF.add(a.pos);
  const b=go(a.pos);if(b?.type==="ammo")seenA.add(b.pos);
 }
 return {ore:miners,metal:seenF.size,ammo:seenA.size};
}
function tick(base,now=Date.now()){
 if(!base||!Array.isArray(base.board)||base.board.length!==144)throw Error("Invalid HQ");
 const dt=Math.max(0,Math.min(12*3600,(now-(Number(base.lastTick)||now))/1000));
 const production=lines(base.board);
 if(dt){
  base.resources.scrap=Math.min(50000,base.resources.scrap+dt*(0.16+base.level*.025));
  base.resources.ore=Math.min(50000,base.resources.ore+dt*production.ore*.11);
  base.resources.metal=Math.min(50000,base.resources.metal+dt*production.metal*.085);
  base.resources.ammo=Math.min(50000,base.resources.ammo+dt*production.ammo*.12);
  base.hp=Math.min(base.maxHp,base.hp+dt*.025);
 }
 for(let q=base.queue.length-1;q>=0;q--){
  if(base.queue[q].readyAt<=now){const item=base.queue[q];base.army[item.type]+=item.count;base.queue.splice(q,1);}
 }
 base.lastTick=now;
 return {production};
}
function valid(x,y){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<12&&y>=0&&y<12;}
function modify(base,msg){
 tick(base);
 if(msg.action==="place"){
  if(!valid(msg.x,msg.y)||!TYPES[msg.machine])return {ok:false,error:"不正な設備です"};
  const pos=idx(msg.x,msg.y),type=msg.machine,def=TYPES[type];
  if(base.board[pos])return {ok:false,error:"そのマスは埋まっています"};
  if(type==="drill"&&!ORES.has(pos))return {ok:false,error:"採掘機は鉱脈の上に配置してください"};
  if(base.resources.scrap<def.price)return {ok:false,error:"スクラップ不足"};
  base.resources.scrap-=def.price;base.board[pos]=make(type,Number.isInteger(msg.dir)?((msg.dir%4+4)%4):1);
  return {ok:true};
 }
 if(["rotate","demolish","upgrade"].includes(msg.action)){
  if(!valid(msg.x,msg.y))return {ok:false,error:"不正な位置です"};
  const pos=idx(msg.x,msg.y),m=base.board[pos];
  if(!m||m.type==="core")return {ok:false,error:"この設備は操作できません"};
  if(msg.action==="rotate"){m.dir=(m.dir+1)%4;return {ok:true};}
  if(msg.action==="demolish"){base.board[pos]=null;base.resources.scrap+=Math.floor(TYPES[m.type].price*.45);return {ok:true};}
  if(m.level>=5)return {ok:false,error:"設備は最大レベルです"};
  const cost=25*m.level+15;
  if(base.resources.scrap<cost)return {ok:false,error:"アップグレード資源が不足"};
  base.resources.scrap-=cost;m.level++;m.hp=TYPES[m.type].hp+(m.level-1)*18;return {ok:true};
 }
 if(msg.action==="train"){
  const def=UNITS[msg.unit],count=Number(msg.count||1);
  if(!def||!Number.isInteger(count)||count<1||count>5)return {ok:false,error:"兵器数が不正です"};
  const factories=base.board.filter(m=>m?.type==="tankPlant");
  if(!factories.length)return {ok:false,error:"まず戦車工場を建設してください"};
  if(msg.unit==="artillery"&&!factories.some(m=>m.level>=2))return {ok:false,error:"自走砲は戦車工場Lv.2で解放"};
  if(base.queue.length>=8)return {ok:false,error:"生産キューがいっぱいです"};
  for(const k of ["scrap","metal","ammo"])if(base.resources[k]<def[k]*count)return {ok:false,error:"資源が不足："+k};
  for(const k of ["scrap","metal","ammo"])base.resources[k]-=def[k]*count;
  base.queue.push({type:msg.unit,count,readyAt:Math.max(Date.now(),base.queue.at(-1)?.readyAt||0)+def.seconds*count*1000});
  return {ok:true};
 }
 if(msg.action==="repair"){
  const damage=base.maxHp-base.hp,cost=Math.ceil(damage*.13);
  if(base.resources.scrap<cost)return {ok:false,error:"修理用スクラップが不足"};
  base.resources.scrap-=cost;base.hp=base.maxHp;
  for(const m of base.board)if(m&&TYPES[m.type])m.hp=TYPES[m.type].hp+(m.level-1)*18;
  return {ok:true};
 }
 return {ok:false,error:"不正な操作です"};
}
function defenseScore(base){
 const counts={};for(const m of base.board)if(m)counts[m.type]=(counts[m.type]||0)+(m.level||1);
 const power=(counts.generator||0)*12;
 const draw=(counts.turret||0)*4+(counts.rocket||0)*6+(counts.shield||0)*5+(counts.tankPlant||0)*4;
 const grid=Math.min(1,power/Math.max(1,draw));
 let score=Math.round(((counts.turret||0)*27+(counts.rocket||0)*40)*grid+
  (counts.wall||0)*14+(counts.shield||0)*30+(base.army.tank||0)*30+
  (base.army.artillery||0)*45+base.hp*.15);
 const world=base.industry;
 if(world?.version===2 && world.entities){
   const industrial=Object.values(world.entities).filter(e=>e.hp>1);
   const number=t=>industrial.filter(e=>e.type===t).reduce((n,e)=>n+(e.level||1),0);
   const supply=number("generator")*45+number("solar")*12;
   const draw=number("turret")*3+number("laser")*16;
   const utilization=Math.min(1,supply/Math.max(1,draw));
   score+=Math.round((number("turret")*20+number("laser")*46)*utilization+
     number("wall")*11+number("repair")*16+
     (world.friendly?.length||0)*24+
     (world.warehouse?.tank||0)*27);
 }
 return score;
}
function raid(a,d,unit,count){
 tick(a);tick(d);
 const def=UNITS[unit],now=Date.now();
 if(!def||!Number.isInteger(count)||count<1||count>20)return {ok:false,error:"兵器数が不正です"};
 const stored=unit==="tank"?Math.max(0,Math.floor(a.industry?.warehouse?.tank||0)):0;
 if((a.army[unit]||0)+stored<count)return {ok:false,error:"戦車が足りません"};
 if(a.attackAt>now)return {ok:false,error:"出撃クールダウン中です"};
 if(d.shieldUntil>now)return {ok:false,error:"相手の防衛シールドが有効です"};
 const attack=count*def.attack+a.level*5,defense=defenseScore(d);
 const victory=attack>defense,dead=Math.min(count,Math.max(1,Math.ceil(defense/def.attack)));
 const usedFromWorld=Math.min(stored,dead);
 if(usedFromWorld)a.industry.warehouse.tank-=usedFromWorld;
 a.army[unit]-=dead-usedFromWorld;a.attackAt=now+2*60*1000;
 const loot=victory?Math.min(75,Math.floor(d.resources.scrap*.08)):0;
 if(victory){d.resources.scrap-=loot;a.resources.scrap+=loot;a.trophies+=12;a.raidsWon++;d.raidsLost++;}
 else a.trophies=Math.max(0,a.trophies-3);
 d.hp=Math.max(Math.round(d.maxHp*.4),d.hp-(victory?65:15));
 d.shieldUntil=now+15*60*1000;
 if(d.industry?.entities){
   const buildings=Object.values(d.industry.entities).filter(e=>e.type!=="core"&&e.hp>1);
   const pick=buildings.filter(e=>["wall","turret","laser"].includes(e.type))[0]||buildings[0];
   if(pick)pick.hp=Math.max(1,pick.hp-(victory?24:8));
   const industrialCore=d.industry.entities["0,0"];
   if(industrialCore)industrialCore.hp=Math.max(200,industrialCore.hp-(victory?35:12));
 }
 return {ok:true,victory,attack,defense,loot,casualties:dead,count,returned:count-dead};
}
const tokenHash=t=>crypto.createHash("sha256").update(t).digest("hex");
function api(pool){
 async function newAccount(name){
  const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString("hex");
  const base=starter(),safeName=String(name||"ENGINEER").slice(0,20);
  await pool.query("INSERT INTO home_accounts (id,token_hash,display_name,base) VALUES ($1,$2,$3,$4)",
    [id,tokenHash(token),safeName,JSON.stringify(base)]);
  return {id,token,name:safeName,base};
 }
 async function getToken(token){
  if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token))return null;
  const q=await pool.query("SELECT id,display_name,base FROM home_accounts WHERE token_hash=$1",[tokenHash(token)]);
  return q.rows[0]?{id:q.rows[0].id,name:q.rows[0].display_name,base:q.rows[0].base}:null;
 }
 async function get(id){
  const q=await pool.query("SELECT id,display_name,base FROM home_accounts WHERE id=$1",[id]);
  return q.rows[0]?{id:q.rows[0].id,name:q.rows[0].display_name,base:q.rows[0].base}:null;
 }
 async function mutate(id,callback){
  const db=await pool.connect();
  try{
   await db.query("BEGIN");
   const q=await db.query("SELECT display_name,base FROM home_accounts WHERE id=$1 FOR UPDATE",[id]);
   if(!q.rows[0]){await db.query("ROLLBACK");return {ok:false,error:"基地が見つかりません"};}
   const base=q.rows[0].base;
   tick(base);const result=await callback(base,db);
   if(result?.ok===false){await db.query("ROLLBACK");return result;}
   await db.query("UPDATE home_accounts SET base=$2,updated_at=now() WHERE id=$1",[id,JSON.stringify(base)]);
   await db.query("COMMIT");
   return {...result,base};
  }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}finally{db.release();}
 }
 async function targets(id){
  const r=await pool.query("SELECT id,display_name,base FROM home_accounts WHERE id<>$1 ORDER BY updated_at DESC LIMIT 40",[id]);
  return r.rows.filter(o=>o.base?.shieldUntil<Date.now()).slice(0,12).map(o=>({
   id:o.id,name:o.display_name,level:o.base.level||1,defense:defenseScore(o.base),trophies:o.base.trophies||0
  }));
 }
 async function history(id){
  const r=await pool.query("SELECT attacker_id,defender_id,attacker_name,defender_name,victory,loot,created_at FROM home_raids WHERE attacker_id=$1 OR defender_id=$1 ORDER BY created_at DESC LIMIT 20",[id]);
  return r.rows.map(row=>({role:row.attacker_id===id?"attacker":"defender",
   other:row.attacker_id===id?row.defender_name:row.attacker_name,
   victory:row.victory,loot:row.loot,at:row.created_at}));
 }
 async function attack(attackerId,defenderId,unit,count){
  if(attackerId===defenderId)return {ok:false,error:"自分の基地は攻撃できません"};
  const db=await pool.connect();
  try{
   await db.query("BEGIN");
   const ids=[attackerId,defenderId].sort();
   const r=await db.query("SELECT id,display_name,base FROM home_accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",[ids]);
   if(r.rows.length!==2){await db.query("ROLLBACK");return {ok:false,error:"対象が見つかりません"};}
   const a=r.rows.find(row=>row.id===attackerId),d=r.rows.find(row=>row.id===defenderId);
   const result=raid(a.base,d.base,unit,count);
   if(!result.ok){await db.query("ROLLBACK");return result;}
   if(d.base.industry?.log){
     d.base.industry.log.unshift({at:Date.now(),message:"⚔ "+
       a.display_name+" の戦車部隊が基地を襲撃しました"+(result.victory?"（一部設備が損傷）":"（防衛成功）")});
     d.base.industry.log=d.base.industry.log.slice(0,15);
   }
   for(const row of [a,d])await db.query("UPDATE home_accounts SET base=$2,updated_at=now() WHERE id=$1",[row.id,JSON.stringify(row.base)]);
   await db.query("INSERT INTO home_raids (attacker_id,defender_id,attacker_name,defender_name,victory,loot,attack_score,defense_score) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [a.id,d.id,a.display_name,d.display_name,result.victory,result.loot,result.attack,result.defense]);
   await db.query("COMMIT");
   return {...result,attacker:a.base,defender:d.base,attackerName:a.display_name,defenderName:d.display_name};
  }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}finally{db.release();}
 }
 return {newAccount,getToken,get,mutate,targets,history,attack};
}
module.exports={SIZE,CORE,ORES,TYPES,UNITS,starter,tick,lines,modify,raid,defenseScore,api};
