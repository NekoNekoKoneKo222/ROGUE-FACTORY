"use strict";

const SIZE = 8;
const LENGTH = 180;
const DIRECTIONS = [[0,-1],[1,0],[0,1],[-1,0]];
const DEFINITIONS = Object.freeze({
  core:      { name: "コア", icon: "◆", hp: 400, cost: 0, power: 0 },
  generator: { name: "発電機", icon: "⚡", hp: 110, cost: 16, power: 0 },
  drill:     { name: "採掘機", icon: "⛏", hp: 75, cost: 12, power: 2 },
  belt:      { name: "コンベア", icon: "➜", hp: 35, cost: 3, power: 0 },
  furnace:   { name: "精錬機", icon: "♨", hp: 75, cost: 15, power: 3 },
  ammo:      { name: "弾薬工場", icon: "⚙", hp: 75, cost: 18, power: 3 },
  turret:    { name: "機関砲", icon: "✹", hp: 95, cost: 22, power: 4 },
  rocket:    { name: "ミサイル", icon: "🚀", hp: 90, cost: 38, power: 6 },
  wall:      { name: "装甲壁", icon: "▦", hp: 160, cost: 9, power: 0 },
  shield:    { name: "シールド", icon: "◈", hp: 90, cost: 28, power: 5 },
  repair:    { name: "修復機", icon: "✚", hp: 80, cost: 30, power: 4 }
});
const UPGRADES = [
  { id:"mine", name:"高速採掘", icon:"⛏", rarity:"RARE", description:"採掘機の生産速度+40%" },
  { id:"forge", name:"高温精錬", icon:"♨", rarity:"RARE", description:"精錬機の加工速度+45%" },
  { id:"ammo", name:"弾薬増殖", icon:"⚙", rarity:"EPIC", description:"弾薬工場の生産量+1" },
  { id:"fire", name:"徹甲弾", icon:"✹", rarity:"RARE", description:"砲台とミサイルのダメージ+30%" },
  { id:"economy", name:"再利用技術", icon:"♻", rarity:"RARE", description:"設備の建設コスト-20%" },
  { id:"energy", name:"強化発電", icon:"⚡", rarity:"EPIC", description:"発電機1基あたり電力+6" },
  { id:"core", name:"コア装甲", icon:"◆", rarity:"EPIC", description:"コアの最大HPと現在HP+60" },
  { id:"speed", name:"超高速物流", icon:"➜", rarity:"RARE", description:"コンベアの搬送速度+60%" },
  { id:"scrap", name:"資源投資", icon:"◉", rarity:"EPIC", description:"スクラップ+30、収入+0.3/秒" },
  { id:"repair", name:"緊急再生", icon:"✚", rarity:"LEGENDARY", description:"コアが毎秒1HP回復" },
  { id:"crit", name:"不安定な弾頭", icon:"💥", rarity:"LEGENDARY", description:"攻撃が15%の確率で2倍ダメージ" },
  { id:"overclock", name:"暴走動力", icon:"◈", rarity:"ANOMALY", description:"工場生産速度+35%、設備消費電力+20%" }
];
const idx = (x,y) => y*SIZE+x;
const valid = (x,y) => Number.isInteger(x) && Number.isInteger(y) && x>=0 && x<SIZE && y>=0 && y<SIZE;
const randomId = () => Math.random().toString(36).slice(2,10);
function machine(type, dir=1) {
  return { type, hp:DEFINITIONS[type].hp, dir, level:1, buf:0, cargo:null, output:0, timer:0, transit:0, active:true };
}
function makePlayer(id, name, bot=false) {
  const board=Array(SIZE*SIZE).fill(null);
  for (const [x,y,type] of [[3,7,"core"],[0,6,"generator"],[1,1,"drill"],[2,1,"belt"],[3,1,"furnace"],[4,1,"belt"],[5,1,"ammo"],[6,1,"turret"]]) board[idx(x,y)]=machine(type);
  return {
    id, name, bot, board, scrap:36, coreHp:400, maxCoreHp:400,
    upgrades:[], options:[], optionTime:0, focus:"core", powerUsed:0, powerTotal:0,
    stats:{ore:0,metal:0,ammo:0,damage:0}, aiStep:0
  };
}
function offer(player, time) {
  const pool=UPGRADES.filter(u=>player.upgrades.filter(k=>k===u.id).length<2);
  const choices=[];
  while (choices.length<3 && pool.length) choices.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  player.options=choices.map(u=>u.id);
  player.optionTime=time;
}
function newGame(a,b) {
  const game={id:randomId(), elapsed:0, ended:false, winner:null, finishReason:null, event:null, players:[
    makePlayer(a.id,a.name,!!a.bot), makePlayer(b.id,b.name,!!b.bot)
  ]};
  game.players.forEach(p=>offer(p,0));
  return game;
}
function costFor(player,type) {
  const initial=DEFINITIONS[type].cost;
  return Math.max(1,Math.ceil(initial*(player.upgrades.includes("economy")?0.8:1)));
}
function build(game,who,type,x,y,dir=1) {
  const p=game.players[who];
  if(game.ended || !valid(x,y) || !DEFINITIONS[type] || type==="core" || p.board[idx(x,y)]) return {ok:false,error:"設置できない場所です"};
  const cost=costFor(p,type);
  if(p.scrap+0.001<cost) return {ok:false,error:"スクラップが足りません"};
  p.scrap-=cost;
  p.board[idx(x,y)]=machine(type,(Number.isInteger(dir)?dir:1)+4>>>0 & 3);
  return {ok:true};
}
function dismantle(game,who,x,y) {
  const p=game.players[who];
  if(game.ended || !valid(x,y)) return {ok:false,error:"操作できません"};
  const m=p.board[idx(x,y)];
  if(!m || m.type==="core") return {ok:false,error:"この設備は解体できません"};
  p.scrap+=Math.floor(DEFINITIONS[m.type].cost*0.5);
  p.board[idx(x,y)]=null;
  return {ok:true};
}
function rotate(game,who,x,y) {
  const p=game.players[who];
  if(game.ended || !valid(x,y)) return {ok:false,error:"操作できません"};
  const m=p.board[idx(x,y)];
  if(!m || m.type==="core") return {ok:false,error:"回転できません"};
  m.dir=(m.dir+1)%4;
  return {ok:true};
}
function choose(game,who,id) {
  const p=game.players[who];
  if(game.ended || !p.options.includes(id)) return {ok:false,error:"選択できない研究です"};
  p.options=[];
  p.upgrades.push(id);
  if(id==="core") {p.coreHp+=60;p.maxCoreHp+=60;p.board[idx(3,7)].hp+=60;}
  if(id==="scrap") p.scrap+=30;
  return {ok:true};
}
function powered(p) {
  let supply=0;
  for(const m of p.board) if(m && m.type==="generator") supply+=12+(p.upgrades.includes("energy")?6:0);
  let available=supply,draw=0;
  const priorities={shield:0,repair:1,turret:2,rocket:2,ammo:3,furnace:4,drill:5};
  const sorted=p.board.filter(Boolean).sort((a,b)=>(priorities[a.type]??10)-(priorities[b.type]??10));
  for(const m of sorted) {
    const base=DEFINITIONS[m.type].power;
    const required=Math.ceil(base*(p.upgrades.includes("overclock")?1.2:1));
    m.active=available>=required;
    if(m.active){available-=required;draw+=required;}
  }
  p.powerUsed=draw;p.powerTotal=supply;
}
function accept(target, item) {
  if(!target || target.hp<=0)return false;
  if(target.type==="belt") {
    if(target.cargo!==null)return false;
    target.cargo=item;return true;
  }
  const expected={furnace:"ore",ammo:"metal",turret:"bullet",rocket:"bullet",repair:"metal"}[target.type];
  if(expected===item && target.buf<10){target.buf++;return true;}
  return false;
}
function handoff(p,x,y,m,item) {
  const d=DIRECTIONS[m.dir], nx=x+d[0],ny=y+d[1];
  if(!valid(nx,ny))return false;
  return accept(p.board[idx(nx,ny)],item);
}
function activeInterval(p,type,base) {
  let factor=1;
  if(type==="drill" && p.upgrades.includes("mine"))factor*=1.4;
  if(type==="furnace" && p.upgrades.includes("forge"))factor*=1.45;
  if(p.upgrades.includes("overclock"))factor*=1.35;
  return base/factor;
}
function damage(game,who,base,mode) {
  const attacker=game.players[who], defender=game.players[1-who];
  const shields=defender.board.filter(m=>m&&m.type==="shield"&&m.active).length;
  let points=base*(attacker.upgrades.includes("fire")?1.3:1);
  if(attacker.upgrades.includes("crit") && Math.random()<0.15)points*=2;
  points*=Math.max(0.5,1-shields*0.18);
  const targets=defender.board.map((m,i)=>({m,i})).filter(v=>v.m && v.m.type!=="core");
  const damageEquipment=mode==="rocket" && targets.length>0 && (attacker.focus==="production"?Math.random()<0.85:Math.random()<0.32);
  if(damageEquipment){
    const target=targets[Math.floor(Math.random()*targets.length)];
    target.m.hp-=points;
    if(target.m.hp<=0){
      defender.board[target.i]=null;
      attacker.scrap+=5;
    }
  }else{
    defender.coreHp=Math.max(0,defender.coreHp-points);
    defender.board[idx(3,7)].hp=defender.coreHp;
  }
  attacker.stats.damage+=points;
}
function processPlayer(game,who,dt) {
  const p=game.players[who];
  p.scrap=Math.min(250,p.scrap+dt*(1.6+(p.upgrades.includes("scrap")?0.3:0)));
  powered(p);
  // A machine holds a small input buffer and one output item. Only a direct
  // neighbor or a conveyor can receive it; there is no global teleporting.
  for(let i=0;i<p.board.length;i++){
    const m=p.board[i];if(!m || !m.active)continue;
    const x=i%SIZE,y=Math.floor(i/SIZE);
    if(m.type==="belt"){
      if(m.cargo!==null){
        m.transit+=dt;
        if(m.transit>=activeInterval(p,"belt",0.5) && handoff(p,x,y,m,m.cargo)){
          m.cargo=null;m.transit=0;
        }
      }else m.transit=0;
      continue;
    }
    if(m.output>0 && handoff(p,x,y,m,m.type==="drill"?"ore":m.type==="furnace"?"metal":"bullet"))m.output--;
    m.timer+=dt;
    if(m.type==="drill" && m.output<5 && m.timer>=activeInterval(p,"drill",1.8)){
      m.output++;m.timer=0;p.stats.ore++;
    }
    if(m.type==="furnace" && m.buf>0 && m.output<5 && m.timer>=activeInterval(p,"furnace",2)){
      m.buf--;m.output++;m.timer=0;p.stats.metal++;
    }
    if(m.type==="ammo" && m.buf>0 && m.output<6 && m.timer>=activeInterval(p,"ammo",2)){
      m.buf--;m.output+=p.upgrades.includes("ammo")?3:2;m.timer=0;p.stats.ammo+=p.upgrades.includes("ammo")?3:2;
    }
    if(m.type==="turret" && m.buf>0 && m.timer>=2.8){
      m.buf--;m.timer=0;damage(game,who,10,"turret");
    }
    if(m.type==="rocket" && m.buf>=2 && m.timer>=5){
      m.buf-=2;m.timer=0;damage(game,who,27,"rocket");
    }
    if(m.type==="repair" && m.buf>0 && m.timer>=2){
      const damaged=p.board.filter(n=>n && n.type!=="core" && n.hp<DEFINITIONS[n.type].hp);
      if(damaged.length) {
        damaged.sort((a,b)=>a.hp-b.hp);damaged[0].hp=Math.min(DEFINITIONS[damaged[0].type].hp,damaged[0].hp+18);
        m.buf--;m.timer=0;
      }
    }
  }
  if(p.upgrades.includes("repair") && p.coreHp<p.maxCoreHp){
    p.coreHp=Math.min(p.maxCoreHp,p.coreHp+dt);
    p.board[idx(3,7)].hp=p.coreHp;
  }
}
function botAction(game,dt) {
  const p=game.players[1];if(!p.bot || game.ended)return;
  if(p.options.length)choose(game,1,p.options[Math.floor(Math.random()*p.options.length)]);
  // Build an additional complete production chain, then reinforce its defense.
  const plan=[[0,4,"generator"],[1,3,"drill"],[2,3,"belt"],[3,3,"furnace"],[4,3,"belt"],[5,3,"ammo"],[6,3,"turret"],[0,5,"generator"],[6,5,"wall"],[4,5,"shield"]];
  p.aiStep=Math.min(p.aiStep,plan.length);
  const next=plan[p.aiStep];
  if(next && p.scrap>=costFor(p,next[2]) && (p.powerUsed<p.powerTotal || next[2]==="generator")){
    const r=build(game,1,next[2],next[0],next[1],1);if(r.ok)p.aiStep++;
  }
}
function step(game,dt=0.25) {
  if(game.ended)return game;
  dt=Math.max(0,Math.min(0.5,dt));
  const before=game.elapsed;
  game.elapsed=Math.min(LENGTH,game.elapsed+dt);
  for(const p of game.players) {
    if(p.options.length && game.elapsed-p.optionTime>=9) choose(game,game.players.indexOf(p),p.options[0]);
  }
  for(const marker of [30,60,90,120,150]){
    if(before<marker && game.elapsed>=marker)game.players.forEach(p=>offer(p,game.elapsed));
  }
  if(before<90 && game.elapsed>=90)game.event="鉱石フィーバー！ 残り90秒";
  if(before<150 && game.elapsed>=150)game.event="最終決戦！ 残り30秒";
  botAction(game,dt);
  // Alternating first processing player reduces first-mover advantages.
  if(Math.floor(game.elapsed/dt)%2){processPlayer(game,0,dt);processPlayer(game,1,dt);}
  else{processPlayer(game,1,dt);processPlayer(game,0,dt);}
  if(game.players.some(p=>p.coreHp<=0) || game.elapsed>=LENGTH){
    game.ended=true;
    const [a,b]=game.players;
    const r=a.coreHp/a.maxCoreHp-b.coreHp/b.maxCoreHp;
    game.winner=Math.abs(r)<0.00001?"draw":r>0?a.id:b.id;
    game.finishReason=game.elapsed>=LENGTH?"time":"core";
  }
  return game;
}
function snapshot(game) {
  return {id:game.id,elapsed:Math.round(game.elapsed*10)/10,length:LENGTH,ended:game.ended,winner:game.winner,
    finishReason:game.finishReason,event:game.event,
    players:game.players.map(p=>({
      id:p.id,name:p.name,bot:p.bot,board:p.board.map(m=>m && ({
        type:m.type,hp:Math.ceil(m.hp),dir:m.dir,buf:m.buf,cargo:m.cargo,output:m.output,active:m.active
      })),scrap:Math.floor(p.scrap),coreHp:Math.ceil(p.coreHp),maxCoreHp:p.maxCoreHp,
      powerUsed:p.powerUsed,powerTotal:p.powerTotal,stats:p.stats,options:p.options,upgrades:p.upgrades,focus:p.focus
    }))};
}
module.exports={SIZE,LENGTH,DEFINITIONS,UPGRADES,newGame,step,build,dismantle,rotate,choose,snapshot,costFor};
