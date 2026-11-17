"use strict";

const SIZE = 12;
const LENGTH = 330;
const BUILD_TIME = 180;
const DEPOSIT_POINTS = Object.freeze([[1,1],[1,3],[3,3],[8,1],[9,2],[2,6],[9,6],[2,9],[8,9],[10,10]]);
const CORE_POS=[5,10];
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
  repair:    { name: "修復機", icon: "✚", hp: 80, cost: 30, power: 4 },
  tankPlant: { name: "戦車工場", icon: "▣", hp: 160, cost: 78, power: 4 }
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
  for (const [x,y,type] of [[...CORE_POS,"core"],[0,6,"generator"],[1,1,"drill"],[2,1,"belt"],[3,1,"furnace"],[4,1,"belt"],[5,1,"ammo"],[6,1,"turret"]]) board[idx(x,y)]=machine(type);
  return {
    id, name, bot, board, deposits:DEPOSIT_POINTS.map(p=>idx(...p)), scrap:36, coreHp:400, maxCoreHp:400,
    upgrades:[], options:[], optionTime:0, focus:"core", powerUsed:0, powerTotal:0,
    stats:{ore:0,metal:0,ammo:0,damage:0}, aiStep:0,
    damageFactor:1, incomeFactor:1, disableBotBuild:false
  };
}
function offer(player, time) {
  const pool=UPGRADES.filter(u=>player.upgrades.filter(k=>k===u.id).length<2);
  const choices=[];
  while (choices.length<3 && pool.length) choices.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  player.options=choices.map(u=>u.id);
  player.optionTime=time;
}
function newGame(a,b,options={}) {
  const stage=options.stage||null;
  const game={id:randomId(), elapsed:0, ended:false, winner:null, finishReason:null, event:null,
    mode:stage?"world":(b.bot?"solo":"pvp"),stageId:stage?.id||null,
    stageDifficulty:stage?.difficulty||1,stageType:stage?.type||"battle",
    stageName:stage?.name||null,stageRule:stage?.rule||null,
    length:stage?Math.max(300,stage.duration||320+(stage.difficulty||1)*36):(b.bot?360:LENGTH),
    buildTime:!b.bot&&!stage?BUILD_TIME:0, phase:!b.bot&&!stage?"build":"defense",
    enemies:[],wave:0,maxWaves:stage?(stage.id==="tutorial"?1:Math.min(7,3+Math.floor((stage.difficulty||1)/2))):4,
    nextWaveAt:stage?.id==="tutorial"?120:43,waveInterval:50,threatHits:0,
    players:[makePlayer(a.id,a.name,!!a.bot),makePlayer(b.id,b.name,!!b.bot)]
  };
  if(stage){
    const [human,enemy]=game.players;
    const base=options.homeBase;
    if(base?.board?.length===SIZE*SIZE && stage.id!=="tutorial"){
      human.board=base.board.map(item=>{
        if(!item)return null;
        const m=item.type==="core"?machine("core",0):machine(item.type,item.dir);
        m.hp=DEFINITIONS[m.type]?.hp||400;
        m.level=Math.max(1,Math.min(5,Number(item.level)||1));
        return m;
      });
      human.scrap=Math.max(40,Math.min(500,Math.floor(base.resources?.scrap||0)));
      game.tankGarrison=Math.min(20,Math.max(0,Math.floor(base.army?.tank||0))+
          Math.max(0,Math.floor(base.army?.artillery||0))*2));
      // Main HQ never gets removed or overwritten by a lost expedition.
      game.homeBaseActive=true;
    }
    human.scrap=base && stage.id!=="tutorial"?Math.max(40,Math.min(500,Math.floor(base.resources?.scrap||0))):(stage.playerScrap??36);
    enemy.scrap=stage.enemyScrap??36;
    enemy.incomeFactor=stage.enemyIncome??1;
    enemy.damageFactor=stage.enemyDamage??1;
    enemy.coreHp=stage.coreHp??400;
    enemy.maxCoreHp=enemy.coreHp;
    enemy.board[idx(...CORE_POS)].hp=enemy.coreHp;
    if(stage.id==="tutorial"){
      // Beginner exercise: construct the missing conveyor / furnace / ammo line.
      for(const [x,y] of [[2,1],[3,1],[4,1],[5,1],[6,1]])human.board[idx(x,y)]=null;
      for(const enemyMachine of enemy.board){
        if(enemyMachine && enemyMachine.type!=="core" && enemyMachine.type!=="generator")enemyMachine.hp=0;
      }
      enemy.board=enemy.board.map(m=>m?.hp<=0?null:m);
      enemy.disableBotBuild=true;
    }
  }
  if(game.stageId!=="tutorial")game.players.forEach(p=>offer(p,0));
  return game;
}
function costFor(player,type) {
  const initial=DEFINITIONS[type].cost;
  return Math.max(1,Math.ceil(initial*(player.upgrades.includes("economy")?0.8:1)));
}
function build(game,who,type,x,y,dir=1) {
  const p=game.players[who];
  if(game.ended || game.phase==="battle" || !valid(x,y) || !DEFINITIONS[type] || type==="core" || p.board[idx(x,y)]) return {ok:false,error:"建設できません（PvP戦闘中は建設不可）"};
  if(type==="drill"&&!p.deposits.includes(idx(x,y)))return {ok:false,error:"採掘機は鉱脈の上にのみ設置できます"};
  const cost=costFor(p,type);
  if(p.scrap+0.001<cost) return {ok:false,error:"スクラップが足りません"};
  p.scrap-=cost;
  p.board[idx(x,y)]=machine(type,(Number.isInteger(dir)?dir:1)+4>>>0 & 3);
  if(game.stageId==="tutorial" && who===0){
    const path=[[2,1,"belt"],[3,1,"furnace"],[4,1,"belt"],[5,1,"ammo"],[6,1,"turret"]];
    if(path.every(([px,py,t])=>p.board[idx(px,py)]?.type===t))game.nextWaveAt=Math.min(game.nextWaveAt,game.elapsed+9);
  }
  return {ok:true};
}
function dismantle(game,who,x,y) {
  const p=game.players[who];
  if(game.ended || game.phase==="battle" || !valid(x,y)) return {ok:false,error:"戦闘中は変更できません"};
  const m=p.board[idx(x,y)];
  if(!m || m.type==="core") return {ok:false,error:"この設備は解体できません"};
  p.scrap+=Math.floor(DEFINITIONS[m.type].cost*0.5);
  p.board[idx(x,y)]=null;
  return {ok:true};
}
function rotate(game,who,x,y) {
  const p=game.players[who];
  if(game.ended || game.phase==="battle" || !valid(x,y)) return {ok:false,error:"戦闘中は変更できません"};
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
  if(id==="core") {p.coreHp+=60;p.maxCoreHp+=60;p.board[idx(...CORE_POS)].hp+=60;}
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
  if(game.mode!=="pvp"){
    if(who===0)return damageWave(game,base,mode);
    return;
  }
  if(game.phase==="build")return;
  const attacker=game.players[who], defender=game.players[1-who];
  const shields=defender.board.filter(m=>m&&m.type==="shield"&&m.active).length;
  let points=base*(attacker.upgrades.includes("fire")?1.3:1)*(attacker.damageFactor??1);
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
    defender.board[idx(...CORE_POS)].hp=defender.coreHp;
  }
  attacker.stats.damage+=points;
}
function damageWave(game,base,mode) {
  const p=game.players[0];
  if(!game.enemies.length)return;
  game.enemies.sort((a,b)=>b.progress-a.progress);
  const target=game.enemies[0];
  let points=base*(p.upgrades.includes("fire")?1.3:1);
  if(p.upgrades.includes("crit") && Math.random()<0.15)points*=2;
  target.hp=Math.max(0,target.hp-points);
  p.stats.damage+=points;
  if(mode==="rocket"){
    for(const other of game.enemies.slice(1,4))other.hp=Math.max(0,other.hp-points*0.3);
  }
  game.enemies=game.enemies.filter(e=>e.hp>0);
}
function spawnWave(game){
  const wave=++game.wave, diff=game.mode==="world"?(game.stageDifficulty||1):2;
  const count=game.stageId==="tutorial"?2:Math.min(22,2+wave*2+Math.floor(diff/2));
  for(let i=0;i<count;i++){
    const boss=wave===game.maxWaves && (game.stageType==="boss" || game.stageId?.includes("boss")) && i===0;
    const hp=(boss?135+diff*34:12+diff*4+wave*3);
    game.enemies.push({id:wave*100+i,kind:boss?"boss":i%4===0?"armored":"raider",hp,maxHp:hp,
      progress:-(i*0.048),speed:(boss?0.009:0.021)+(Math.random()*0.002),
      damage:boss?45+diff*7:8+diff*2+wave});
  }
  game.event="WAVE "+wave+" / "+game.maxWaves+" — 襲撃開始！";
  game.nextWaveAt+=game.waveInterval;
}
function processEnemies(game,dt){
  if(!game.enemies.length)return;
  const human=game.players[0];
  // Tanks stationed at the permanent base help guard it against enemy assaults.
  // They are not consumed in campaign battles; PvP raids consume deployed units.
  if(game.tankGarrison>0){
    game.tankTimer=(game.tankTimer||0)+dt;
    if(game.tankTimer>=2){
      game.tankTimer=0;
      const target=game.enemies.reduce((a,b)=>b.progress>a.progress?b:a);
      target.hp=Math.max(0,target.hp-game.tankGarrison*2);
      human.stats.damage+=game.tankGarrison*2;
      game.enemies=game.enemies.filter(e=>e.hp>0);
    }
  }
  for(const enemy of game.enemies){
    enemy.progress+=enemy.speed*dt;
    if(enemy.progress<1)continue;
    const walls=human.board.map((m,i)=>({m,i})).filter(o=>o.m && o.m.type==="wall");
    if(walls.length){
      const target=walls[Math.floor(Math.random()*walls.length)];
      target.m.hp-=enemy.damage;
      if(target.m.hp<=0)human.board[target.i]=null;
    }else{
      const shields=human.board.filter(m=>m&&m.type==="shield"&&m.active).length;
      human.coreHp=Math.max(0,human.coreHp-enemy.damage*Math.max(.4,1-shields*.14));
      human.board[idx(...CORE_POS)].hp=human.coreHp;
    }
    game.threatHits++;
    enemy.hp=0;
  }
  game.enemies=game.enemies.filter(e=>e.hp>0);
}
function processPlayer(game,who,dt) {
  const p=game.players[who];
  p.scrap=Math.min(250,p.scrap+dt*(1.6*(p.incomeFactor??1)+(p.upgrades.includes("scrap")?0.3:0)));
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
    if(m.type==="turret" && m.buf>0 && (game.mode==="pvp"?game.phase==="battle":who===0 && game.enemies.length>0) && m.timer>=2.8){
      m.buf--;m.timer=0;damage(game,who,10,"turret");
    }
    if(m.type==="rocket" && m.buf>=2 && (game.mode==="pvp"?game.phase==="battle":who===0 && game.enemies.length>0) && m.timer>=5){
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
    p.board[idx(...CORE_POS)].hp=p.coreHp;
  }
}
function botAction(game,dt) {
  const p=game.players[1];if(!p.bot || game.ended || p.disableBotBuild)return;
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
  game.elapsed=Math.min(game.length,game.elapsed+dt);
  for(const p of game.players) {
    if(p.options.length && game.elapsed-p.optionTime>=9) choose(game,game.players.indexOf(p),p.options[0]);
  }
  if(game.mode==="pvp" && before<BUILD_TIME && game.elapsed>=BUILD_TIME){
    game.phase="battle";game.event="PvP戦闘開始！ 3分間で作った工場が戦います";
  }
  if(game.stageId!=="tutorial"){
    for(let marker=30;marker<(game.mode==="pvp"?BUILD_TIME:game.length);marker+=30){
      if(before<marker && game.elapsed>=marker)game.players.forEach(p=>offer(p,game.elapsed));
    }
  }
  if(before<game.length-30 && game.elapsed>=game.length-30)game.event="最終局面！ 残り30秒";
  if(game.mode==="pvp"){
    // Build for a full 180 seconds; the initial protected phase deals no damage.
    if(Math.floor(game.elapsed/dt)%2){processPlayer(game,0,dt);processPlayer(game,1,dt);}
    else{processPlayer(game,1,dt);processPlayer(game,0,dt);}
  }else{
    if(game.wave<game.maxWaves && game.elapsed>=game.nextWaveAt)spawnWave(game);
    processPlayer(game,0,dt);
    processEnemies(game,dt);
  }
  if(game.mode!=="pvp" && game.wave===game.maxWaves && game.enemies.length===0){
    game.ended=true;
    const success=game.players[0].coreHp>0 && (game.stageId!=="tutorial" || game.players[0].stats.damage>0);
    game.winner=success?game.players[0].id:game.players[1].id;
    game.finishReason=game.players[0].coreHp>0?"defense":"core";
    return game;
  }
  if(game.players.some((p,i)=>p.coreHp<=0&&(game.mode==="pvp"||i===0)) || game.elapsed>=game.length){
    game.ended=true;
    const [a,b]=game.players;
    const r=a.coreHp/a.maxCoreHp-b.coreHp/b.maxCoreHp;
    game.winner=game.mode==="pvp"?(Math.abs(r)<0.00001?"draw":r>0?a.id:b.id):(a.coreHp>0 && game.wave===game.maxWaves && !game.enemies.length?a.id:b.id);
    game.finishReason=game.elapsed>=game.length?"time":"core";
  }
  return game;
}
function snapshot(game) {
  return {id:game.id,elapsed:Math.round(game.elapsed*10)/10,length:game.length,
    mode:game.mode,stageId:game.stageId,stageName:game.stageName,stageRule:game.stageRule,
    phase:game.phase,buildTime:game.buildTime,wave:game.wave,maxWaves:game.maxWaves,threatHits:game.threatHits,
    tankGarrison:game.tankGarrison||0,
    enemies:game.enemies.map(e=>({id:e.id,kind:e.kind,hp:Math.ceil(e.hp),maxHp:e.maxHp,progress:e.progress})),
    ended:game.ended,winner:game.winner,
    finishReason:game.finishReason,event:game.event,
    players:game.players.map(p=>({
      id:p.id,name:p.name,bot:p.bot,deposits:p.deposits,board:p.board.map(m=>m && ({
        type:m.type,hp:Math.ceil(m.hp),dir:m.dir,buf:m.buf,cargo:m.cargo,output:m.output,active:m.active
      })),scrap:Math.floor(p.scrap),coreHp:Math.ceil(p.coreHp),maxCoreHp:p.maxCoreHp,
      powerUsed:p.powerUsed,powerTotal:p.powerTotal,stats:p.stats,options:p.options,upgrades:p.upgrades,focus:p.focus
    }))};
}
module.exports={SIZE,LENGTH,BUILD_TIME,DEFINITIONS,UPGRADES,newGame,step,build,dismantle,rotate,choose,snapshot,costFor};
