"use strict";
const S=require("../public/industrial-shared");
const {tileAt,key,coords,DIRS}=S;
const COST={
  core:{scrap:0},drill:{scrap:16,ironPlate:4},belt:{scrap:2},splitter:{scrap:16,ironPlate:6},
  inserter:{scrap:12,ironPlate:4},chest:{scrap:10,ironPlate:6},depot:{scrap:18,ironPlate:8},
  furnace:{scrap:24,ironPlate:8},assembler:{scrap:36,ironPlate:12,gear:3},
  generator:{scrap:35,ironPlate:10},solar:{scrap:28,ironPlate:8,circuit:3},
  pole:{scrap:10,ironPlate:3},accumulator:{scrap:50,circuit:6},
  oilPump:{scrap:55,ironPlate:15,circuit:4},pipe:{scrap:4,ironPlate:1},
  refinery:{scrap:90,ironPlate:22,gear:8},chemical:{scrap:75,circuit:8,ironPlate:12},
  lab:{scrap:80,circuit:9,ironPlate:12},turret:{scrap:45,ironPlate:12},
  laser:{scrap:110,circuit:10,ironPlate:25},wall:{scrap:7,stone:4},
  repair:{scrap:65,ironPlate:16},radar:{scrap:70,circuit:10,ironPlate:15},
  tankPlant:{scrap:135,ironPlate:35,gear:8,circuit:6}
};
const DEFINITIONS={
 core:{name:"中枢コア",icon:"◆",hp:2000,power:0,category:"base"},
 drill:{name:"採掘機",icon:"⛏",hp:130,power:3,category:"mining",process:2},
 belt:{name:"コンベア",icon:"➜",hp:60,power:0,category:"logistics"},
 splitter:{name:"分配器",icon:"⇄",hp:75,power:0,category:"logistics",tech:"logistics2"},
 inserter:{name:"インサーター",icon:"↣",hp:65,power:1,category:"logistics"},
 chest:{name:"チェスト",icon:"▤",hp:90,power:0,category:"logistics"},
 depot:{name:"資源バンカー",icon:"▣",hp:200,power:1,category:"logistics"},
 furnace:{name:"電気炉",icon:"♨",hp:120,power:5,category:"craft"},
 assembler:{name:"組立機",icon:"⚙",hp:130,power:6,category:"craft"},
 generator:{name:"火力発電機",icon:"ϟ",hp:150,power:0,category:"energy"},
 solar:{name:"ソーラーパネル",icon:"☼",hp:100,power:0,category:"energy",tech:"solarPower"},
 pole:{name:"電柱",icon:"⊕",hp:75,power:0,category:"energy"},
 accumulator:{name:"蓄電池",icon:"▥",hp:120,power:0,category:"energy",tech:"solarPower"},
 oilPump:{name:"石油ポンプ",icon:"◉",hp:115,power:5,category:"fluid",tech:"oilProcessing"},
 pipe:{name:"パイプ",icon:"═",hp:60,power:0,category:"fluid",tech:"oilProcessing"},
 refinery:{name:"製油所",icon:"♜",hp:180,power:10,category:"fluid",tech:"oilProcessing"},
 chemical:{name:"化学プラント",icon:"♧",hp:140,power:7,category:"craft",tech:"oilProcessing"},
 lab:{name:"研究所",icon:"⌬",hp:135,power:7,category:"research",tech:"automation2"},
 turret:{name:"機関砲塔",icon:"✹",hp:170,power:3,category:"defense"},
 laser:{name:"レーザー砲",icon:"✦",hp:140,power:16,category:"defense",tech:"laserDefense"},
 wall:{name:"防壁",icon:"▦",hp:250,power:0,category:"defense"},
 repair:{name:"修理ロボット基地",icon:"✚",hp:130,power:6,category:"defense",tech:"automation2"},
 radar:{name:"レーダー",icon:"◎",hp:115,power:7,category:"base"},
 tankPlant:{name:"戦車製造所",icon:"▰",hp:200,power:12,category:"military",tech:"tanks"}
};
const RECIPES={
 ammoPack:{name:"小銃弾",inputs:{ironPlate:2},outputs:{ammoPack:2},seconds:4,tech:null},
 gear:{name:"歯車",inputs:{ironPlate:2},outputs:{gear:1},seconds:3},
 circuit:{name:"電子回路",inputs:{ironPlate:1,copperPlate:2},outputs:{circuit:1},seconds:5},
 sciencePack:{name:"研究パック",inputs:{gear:1,circuit:1},outputs:{sciencePack:1},seconds:7},
 explosive:{name:"爆薬",inputs:{coal:1,sulfur:1},outputs:{explosive:1},seconds:5,tech:"oilProcessing"},
 tank:{name:"戦車",inputs:{ironPlate:20,gear:10,circuit:5,ammoPack:8},outputs:{tank:1},seconds:24,tech:"tanks"}
};
const TECHS={
 logistics2:{name:"高速物流・分配器",points:12,needs:[],details:"分配器とベルト2倍速を解放"},
 automation2:{name:"高度な自動化",points:15,needs:[],details:"研究所・修理ロボットを解放"},
 solarPower:{name:"再生可能エネルギー",points:20,needs:[],details:"ソーラーパネル・蓄電池を解放"},
 military2:{name:"貫通弾薬",points:25,needs:[],details:"砲塔ダメージ30%増加"},
 oilProcessing:{name:"石油精製",points:25,needs:["automation2"],details:"油井・パイプ・製油所・化学プラントを解放"},
 laserDefense:{name:"レーザー防衛",points:34,needs:["solarPower","military2"],details:"電力で発射するレーザー砲塔を解放"},
 tanks:{name:"戦車工業",points:32,needs:["automation2","military2"],details:"研究された戦車製造所と戦車出撃を解放"},
 mining2:{name:"高性能採掘",points:25,needs:["logistics2"],details:"採掘速度1.5倍"},
 advancedIndustry:{name:"超高速生産",points:65,needs:["oilProcessing","logistics2"],details:"製造速度1.4倍"}
};
const MAX_BUILDINGS=1600,MAX_ENEMIES=65;
function makeEntity(type,x,y,dir=1,extra={}){
  const d=DEFINITIONS[type];
  return {type,x,y,dir:((dir%4)+4)%4,level:1,hp:d?.hp||100,
    input:{},output:[],item:null,fluid:0,progress:0,cooldown:0,online:false,
    recipe:type==="assembler"?"ammoPack":type==="tankPlant"?"tank":null,
    ...extra};
}
function makeState(base){
  const seed=Number.isInteger(base?.industry?.seed)?base.industry.seed:Math.floor(Math.random()*0x7fffffff);
  const entities={};
  const template=[
    ["core",0,0,0],["generator",-6,0,1],["pole",-2,-1,1],
    ["drill",-5,-3,1],["belt",-4,-3,1],["furnace",-3,-3,1],
    ["belt",-2,-3,1],["assembler",-1,-3,1],["turret",0,-3,1]
  ];
  const source=Array.isArray(base?.board)?base.board:[];
  const importer={ammo:"assembler",rocket:"turret",shield:"wall"};
  if(source.length===144 && source.filter(Boolean).length>8){
    for(let n=0;n<source.length;n++){
      const b=source[n];if(!b || b.type==="core")continue;
      const type=importer[b.type]||b.type;
      if(!DEFINITIONS[type])continue;
      const x=n%12-6,y=Math.floor(n/12)-4;
      const id=key(x,y);
      if(entities[id]||x===0&&y===0)continue;
      entities[id]=makeEntity(type,x,y,b.dir||1,{level:Math.max(1,Math.min(5,Number(b.level)||1)),
        hp:Math.max(1,Math.min(DEFINITIONS[type].hp,Number(b.hp)||100)),
        legacyOre:type==="drill"?"ironOre":undefined});
    }
    entities["0,0"]=makeEntity("core",0,0,0);
    if(!Object.values(entities).some(e=>e.type==="pole"))entities["-2,-1"]=makeEntity("pole",-2,-1);
    for(const e of Object.values(entities))if(e.type==="generator")e.input.coal=80;
  }else{
    for(const [type,x,y,dir] of template)entities[key(x,y)]=makeEntity(type,x,y,dir);
    entities["-6,0"].input.coal=120;
    entities["0,-3"].input.ammoPack=8;
  }
  return {version:2,seed,radius:24,entities,warehouse:{
      scrap:Math.max(350,Number(base?.resources?.scrap)||0),ironPlate:130,copperPlate:80,stone:80,coal:80,
      gear:28,circuit:20,ammoPack:24,plastic:0,sciencePack:0,ironOre:0,copperOre:0,fuel:0
    },research:{points:25,unlocked:[],totalSpent:0},
    stats:{mined:0,crafted:0,shipped:0,kills:0,waves:0,damage:0},
    pollution:0,waveAt:Date.now()+70000,wave:0,enemies:[],friendly:[],
    rates:{mined:0,crafted:0,shipped:0},rateSample:{mined:0,crafted:0,shipped:0},lastAt:Date.now(),tickNumber:0,lastOffline:0,log:[],
    worldLevel:1,expansions:0
  };
}
function ensure(base){
  if(!base.industry||base.industry.version!==2)base.industry=makeState(base);
  return base.industry;
}
function countResources(resources,item){return Math.max(0,Number(resources[item])||0);}
function hasCost(resources,cost){return Object.entries(cost).every(([item,n])=>countResources(resources,item)>=n);}
function charge(resources,cost){for(const [item,n] of Object.entries(cost))resources[item]-=n;}
function unlocked(w,tech){return !tech || w.research.unlocked.includes(tech);}
function inside(x,y,r){return Number.isSafeInteger(x)&&Number.isSafeInteger(y)&&Math.abs(x)<=r&&Math.abs(y)<=r;}
function dist(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function target(e){const d=DIRS[e.dir];return key(e.x+d[0],e.y+d[1]);}
function accepted(e,item){
  if(!e||e.hp<=0)return false;
  if(["belt","splitter","pipe"].includes(e.type))return false;
  if(e.type==="chest"||e.type==="depot")return Object.values(e.input).reduce((a,b)=>a+b,0)<300;
  if(e.type==="generator")return item==="coal" && countResources(e.input,"coal")<80;
  if(e.type==="turret")return item==="ammoPack" && countResources(e.input,"ammoPack")<70;
  if(e.type==="refinery")return item==="coal" && countResources(e.input,"coal")<40;
  if(["furnace","assembler","tankPlant","chemical","lab"].includes(e.type))
    return (e.type==="furnace"?["ironOre","copperOre","stone"]:
      e.type==="lab"?["sciencePack"]:
      e.type==="chemical"?["fuel","coal"]:
      Object.keys(RECIPES[e.recipe]?.inputs||{})).includes(item) && countResources(e.input,item)<100;
  return false;
}
function give(w,e,item){
  if(!e || e.hp<=0)return false;
  if(e.type==="belt"||e.type==="splitter"){
    if(e.item)return false;e.item=item;return true;
  }
  if(e.type==="depot"){
    w.warehouse[item]=Math.min(100000,countResources(w.warehouse,item)+1);
    w.stats.shipped++;return true;
  }
  if(accepted(e,item)){
    e.input[item]=countResources(e.input,item)+1;return true;
  }
  return false;
}
function product(w,e,item){
  if(e.output.length>=12)return false;
  e.output.push(item);w.stats.crafted++;return true;
}
function power(w,dt){
  const entries=Object.values(w.entities).filter(e=>e.hp>0);
  const anchors=entries.filter(e=>["generator","pole","solar","accumulator"].includes(e.type));
  const parents=anchors.map((e,i)=>i);
  function root(n){while(parents[n]!==n){parents[n]=parents[parents[n]];n=parents[n];}return n;}
  function join(a,b){a=root(a);b=root(b);if(a!==b)parents[b]=a;}
  for(let i=0;i<anchors.length;i++)for(let j=0;j<i;j++)if(dist(anchors[i],anchors[j])<=6)join(i,j);
  const groups=new Map();
  for(let i=0;i<anchors.length;i++){
    const n=root(i);if(!groups.has(n))groups.set(n,{nodes:[],members:[],supply:0,demand:0,used:0});
    groups.get(n).nodes.push(anchors[i]);
  }
  const networkOf=(e)=>{
    let nearest=null,nearestDist=9999;
    for(let i=0;i<anchors.length;i++){
      const d=dist(e,anchors[i]);
      if(d<=5 && d<nearestDist){nearestDist=d;nearest=groups.get(root(i));}
    }
    return nearest;
  };
  for(const e of entries){e.online=e.type==="core"||["belt","splitter","chest","wall","pipe","pole"].includes(e.type);}
  for(const e of entries){
    if(["generator","pole","solar","accumulator"].includes(e.type)){
      const group=networkOf(e);if(!group)continue;
      group.members.push(e);
      if(e.type==="generator"){
        e.fuelProgress=(e.fuelProgress||0)+dt;
        if(e.fuelProgress>=24){
          e.fuelProgress-=24;
          if(countResources(e.input,"coal")>0)e.input.coal--;
          else e.fuelProgress=24;
        }
        e.online=countResources(e.input,"coal")>0;
        if(e.online)group.supply+=45*e.level;
      }else if(e.type==="solar"){
        const daylight=.45+.55*Math.max(0,Math.sin((w.tickNumber%600)/600*Math.PI*2));
        e.online=true;group.supply+=15*daylight*e.level;
      }else e.online=true;
    }
  }
  const pri={turret:0,laser:0,repair:1,generator:0,radar:2,drill:3,furnace:3,assembler:3,lab:4,tankPlant:4};
  const consumers=entries.filter(e=>!["generator","pole","solar","accumulator","core","belt","splitter","chest","wall","pipe"].includes(e.type));
  for(const group of groups.values()){
    group.storages=group.nodes.filter(e=>e.type==="accumulator");
    group.reserve=group.storages.reduce((total,e)=>total+Math.min(30,e.charge||0),0);
  }
  consumers.sort((a,b)=>(pri[a.type]??3)-(pri[b.type]??3));
  for(const e of consumers){
    const group=networkOf(e),use=DEFINITIONS[e.type].power||0;
    if(group)group.demand+=use;
    e.online=!!group && (group.supply+group.reserve-group.used)>=use;
    if(e.online)group.used+=use;
  }
  let supply=0,demand=0,used=0,stored=0;
  for(const group of groups.values()){
    let difference=group.supply-group.used;
    if(difference>=0){
      for(const e of group.storages){
        const amount=Math.min(20,difference,1000-(e.charge||0));
        if(amount>0){e.charge=(e.charge||0)+amount;difference-=amount;}
      }
    }else{
      let needed=-difference;
      for(const e of group.storages){
        const amount=Math.min(30,e.charge||0,needed);
        e.charge=(e.charge||0)-amount;needed-=amount;
        if(needed<=0)break;
      }
    }
    stored+=group.storages.reduce((total,e)=>total+(e.charge||0),0);
    supply+=group.supply;demand+=group.demand;used+=group.used;
  }
  return {supply:Math.round(supply),demand:Math.round(demand),used:Math.round(used),
    stored:Math.round(stored),networks:groups.size};
}
function transport(w){
  const all=Object.values(w.entities),from=new Map(all.map(e=>[key(e.x,e.y),e]));
  // Snapshot planning ensures at most one belt hop per simulation tick.
  const steps=[];
  const carriers=all.filter(e=>e.hp>0 && (e.type==="belt"||e.type==="splitter"||e.type==="chest"||e.type==="inserter"||e.type==="pipe"||e.type==="oilPump"));
  for(const e of carriers){
    if(e.type==="belt"&&e.item){
      steps.push({e,item:e.item,to:from.get(target(e)),kind:"belt"});
    }else if(e.type==="splitter"&&e.item){
      const d=e.splitCounter%2===0?e.dir:(e.dir+1)%4;
      steps.push({e,item:e.item,to:from.get(key(e.x+DIRS[d][0],e.y+DIRS[d][1])),kind:"belt"});
    }else if(e.type==="chest"&&Object.keys(e.input).length){
      const item=Object.keys(e.input).find(k=>e.input[k]>0);
      if(item)steps.push({e,item,to:from.get(target(e)),kind:"chest"});
    }else if(e.type==="inserter"&&e.online){
      const d=DIRS[e.dir],src=from.get(key(e.x-d[0],e.y-d[1])),dst=from.get(target(e));
      const item=src?.item || src?.output?.[0] || Object.keys(src?.input||{}).find(k=>src.input[k]>0);
      if(item)steps.push({e,item,to:dst,kind:"inserter",src});
    }else if((e.type==="pipe"||e.type==="oilPump") && e.fluid>=1){
      const dest=from.get(target(e));
      if(dest && ["pipe","refinery"].includes(dest.type) && (dest.fluid||0)<20){
        steps.push({e,kind:"fluid",to:dest,item:"crude"});
      }
    }
  }
  const reserved=new Set();
  for(const step of steps){
    const {e,item,to}=step;
    if(!to||to.hp<=0||reserved.has(key(to.x,to.y)))continue;
    if(step.kind==="fluid"){
      to.fluid=(to.fluid||0)+1;e.fluid--;reserved.add(key(to.x,to.y));continue;
    }
    if(to.type==="belt"||to.type==="splitter"){
      if(to.item||to===e)continue;
    }else if(!accepted(to,item)&&to.type!=="depot")continue;
    if(!give(w,to,item))continue;
    if(step.kind==="belt"){e.item=null;if(e.type==="splitter")e.splitCounter=(e.splitCounter||0)+1;}
    else if(step.kind==="chest")e.input[item]--;
    else if(step.kind==="inserter"){
      if(step.src?.item===item)step.src.item=null;
      else if(step.src?.output?.[0]===item)step.src.output.shift();
      else if(step.src?.input?.[item]>0)step.src.input[item]--;
    }
    reserved.add(key(to.x,to.y));
  }
  for(const e of all){
    if(!e.output?.length || e.hp<=0)continue;
    const to=from.get(target(e));
    const item=e.output[0];
    if(to && !reserved.has(key(to.x,to.y)) && give(w,to,item)){
      e.output.shift();reserved.add(key(to.x,to.y));
    }
  }
}
function craft(w,dt,powerStatus){
  const entries=Object.values(w.entities);
  let pollution=0;
  const speed=w.research.unlocked.includes("advancedIndustry")?1.4:1;
  for(const e of entries){
    if(!e.online || e.hp<=0)continue;
    if(e.type==="drill"){
      const tile=tileAt(w.seed,e.x,e.y);
      const ore=e.legacyOre||tile.ore;
      if(!ore || ["oil"].includes(ore) || e.mined>=tile.richness&&!e.legacyOre)continue;
      e.progress+=dt*(w.research.unlocked.includes("mining2")?1.5:1)*speed*e.level;
      if(e.progress>=2 && e.output.length<8){
        e.progress-=2;e.mined=(e.mined||0)+1;product(w,e,ore);w.stats.mined++;pollution+=.75;
      }
    }else if(e.type==="furnace"){
      const raw=["ironOre","copperOre","stone"].find(k=>countResources(e.input,k)>0);
      if(!raw || e.output.length>=8)continue;
      e.progress+=dt*speed*e.level;
      if(e.progress>=2.5){
        e.progress-=2.5;e.input[raw]--;
        product(w,e,raw==="ironOre"?"ironPlate":raw==="copperOre"?"copperPlate":"brick");
        pollution+=.8;
      }
    }else if(["assembler","tankPlant"].includes(e.type)){
      const recipe=RECIPES[e.recipe];
      if(!recipe || e.type==="tankPlant"&&e.recipe!=="tank" || e.type==="assembler"&&e.recipe==="tank" || !unlocked(w,recipe.tech))continue;
      if(!hasCost(e.input,recipe.inputs)||e.output.length>=8)continue;
      e.progress+=dt*speed*e.level;
      if(e.progress>=recipe.seconds){
        e.progress-=recipe.seconds;charge(e.input,recipe.inputs);
        for(const [item,n] of Object.entries(recipe.outputs))for(let k=0;k<n;k++)product(w,e,item);
        pollution+=1.1;
      }
    }else if(e.type==="oilPump"){
      const tile=tileAt(w.seed,e.x,e.y);
      if(tile.ore!=="oil" || e.fluid>=20)continue;
      e.progress+=dt*speed*e.level;
      if(e.progress>=3){e.progress-=3;e.fluid=Math.min(20,e.fluid+2);pollution+=.5;}
    }else if(e.type==="refinery"){
      if((e.fluid||0)<2||e.output.length>=8)continue;
      e.progress+=dt*speed;
      if(e.progress>=5){
        e.progress-=5;e.fluid-=2;
        product(w,e,"fuel");product(w,e,"plastic");pollution+=1.6;
      }
    }else if(e.type==="chemical"){
      if(countResources(e.input,"fuel")<1 || countResources(e.input,"coal")<1 || e.output.length>=8)continue;
      e.progress+=dt*speed;
      if(e.progress>=6){e.progress-=6;e.input.fuel--;e.input.coal--;product(w,e,"sulfur");pollution+=1;}
    }else if(e.type==="lab"){
      if(countResources(e.input,"sciencePack")<1)continue;
      e.progress+=dt*speed;
      if(e.progress>=6){e.progress-=6;e.input.sciencePack--;w.research.points+=1;}
    }else if(e.type==="repair"){
      e.progress+=dt;
      if(e.progress>=7 && countResources(w.warehouse,"ironPlate")>0){
        const damaged=entries.find(m=>m.hp<DEFINITIONS[m.type].hp && dist(e,m)<=4);
        if(damaged){e.progress=0;w.warehouse.ironPlate--;damaged.hp=Math.min(DEFINITIONS[damaged.type].hp,damaged.hp+35);}
      }
    }
  }
  w.pollution=Math.max(0,Math.min(5000,w.pollution*.995+pollution));
}
function combat(w,dt){
  const entries=Object.values(w.entities),core=w.entities["0,0"];
  // Manufactured tanks can be dispatched from the warehouse to protect the real world.
  for(const tank of (w.friendly||[])){
    tank.cooldown=Math.max(0,(tank.cooldown||0)-dt);
    const nearby=w.enemies.filter(e=>e.hp>0).sort((a,b)=>dist(tank,a)-dist(tank,b))[0];
    if(!nearby){
      const home=Math.sqrt(tank.x*tank.x+tank.y*tank.y);
      if(home>8){tank.x-=tank.x/home*dt;tank.y-=tank.y/home*dt;}
      continue;
    }
    const range=dist(tank,nearby);
    if(range>4){
      const dx=nearby.x-tank.x,dy=nearby.y-tank.y,sum=Math.max(1,Math.abs(dx)+Math.abs(dy));
      tank.x+=(dx/sum)*dt*1.45;tank.y+=(dy/sum)*dt*1.45;
    }else if(tank.cooldown<=0){
      nearby.hp-=26;tank.cooldown=2.2;
      w.lastShot={from:[tank.x,tank.y],to:[nearby.x,nearby.y],at:Date.now(),kind:"tank"};
    }
  }
  const turrets=entries.filter(e=>e.hp>0 && e.online && ["turret","laser"].includes(e.type));
  for(const t of turrets){
    t.cooldown=Math.max(0,(t.cooldown||0)-dt);
    if(t.cooldown>0)continue;
    const range=t.type==="laser"?8:6;
    const enemy=w.enemies.filter(e=>e.hp>0 && dist(e,t)<=range).sort((a,b)=>a.hp-b.hp)[0];
    if(!enemy)continue;
    if(t.type==="turret"){
      if(countResources(t.input,"ammoPack")<=0)continue;
      t.input.ammoPack--;
    }
    enemy.hp-=t.type==="laser"?14:11*(w.research.unlocked.includes("military2")?1.3:1);
    t.cooldown=t.type==="laser"?1.6:1.8;
    w.lastShot={from:[t.x,t.y],to:[enemy.x,enemy.y],at:Date.now(),kind:t.type};
  }
  for(const e of w.enemies){
    if(e.hp<=0)continue;
    e.cooldown=Math.max(0,(e.cooldown||0)-dt);
    let closest=core,nearest=999;
    const guard=(w.friendly||[]).find(t=>dist(e,t)<1.5&&t.hp>0);
    if(guard){
      if(e.cooldown<=0){guard.hp=Math.max(0,guard.hp-8);e.cooldown=2.5;}
      continue;
    }
    // Intruders advance toward the permanent HQ, attacking intervening structures.
    for(const m of entries){
      if(m.hp<=0)continue;
      const d=dist(e,m);
      if(d<1.6 && d<nearest && m.type!=="core"){closest=m;nearest=d;}
    }
    if(nearest<1.6){
      if(e.cooldown<=0){
        closest.hp=Math.max(1,closest.hp-(e.type==="armored"?19:9));
        e.cooldown=2.5;w.stats.damage+=e.type==="armored"?19:9;
      }
      continue;
    }
    const towards=dist(e,core);
    if(towards>1.2){
      const dx=core.x-e.x,dy=core.y-e.y,total=Math.max(1,Math.abs(dx)+Math.abs(dy));
      const speed=(e.type==="armored"?.36:.62)*dt;
      e.x+=dx/total*speed;e.y+=dy/total*speed;
    }else if(e.cooldown<=0){
      core.hp=Math.max(200,core.hp-(e.type==="armored"?23:11));
      e.cooldown=3;
      w.stats.damage+=12;
    }
  }
  const alive=[];
  for(const enemy of w.enemies){
    if(enemy.hp<=0){w.stats.kills++;w.warehouse.scrap+=2+Math.floor(enemy.maxHp/12); }
    else alive.push(enemy);
  }
  w.enemies=alive;
  w.friendly=(w.friendly||[]).filter(t=>t.hp>0);
}
function spawn(w,now){
  const count=Math.min(10,2+Math.floor(w.wave/2)+Math.floor(w.pollution/90));
  for(let j=0;j<count && w.enemies.length<MAX_ENEMIES;j++){
    const angle=(w.wave*.618+j/Math.max(1,count))*Math.PI*2;
    const radius=Math.min(Math.max(15,w.radius-2),35);
    const elite=(w.wave+j)%5===0;
    const hp=elite?75+w.wave*3:30+w.wave*1.5;
    w.enemies.push({id:w.tickNumber*100+j,x:Math.round(Math.cos(angle)*radius),
      y:Math.round(Math.sin(angle)*radius),type:elite?"armored":"biter",
      hp,maxHp:hp,cooldown:0});
  }
  w.wave++;w.stats.waves++;
  addLog(w,"警報：敵機械群 WAVE "+w.wave+" が接近中");
  w.waveAt=now+Math.max(42000,85000-w.pollution*120);
}
function addLog(w,message){
  w.log.unshift({at:Date.now(),message});
  w.log=w.log.slice(0,15);
}
function step(w,now,dt=1){
  w.tickNumber++;w.lastAt=now;
  const pow=power(w,dt);
  transport(w);
  craft(w,dt,pow);
  if(now>=w.waveAt)spawn(w,now);
  combat(w,dt);
  w.lastPower=pow;
  if(w.tickNumber%10===0){
    const last=w.rateSample||{mined:0,crafted:0,shipped:0};
    w.rates={mined:Math.max(0,(w.stats.mined-last.mined)*6),
      crafted:Math.max(0,(w.stats.crafted-last.crafted)*6),
      shipped:Math.max(0,(w.stats.shipped-last.shipped)*6)};
    w.rateSample={mined:w.stats.mined,crafted:w.stats.crafted,shipped:w.stats.shipped};
  }
}
function advance(w,now=Date.now()){
  if(!w.lastAt || !Number.isFinite(w.lastAt)){w.lastAt=now;return w;}
  const elapsed=Math.max(0,Math.min(12*3600,Math.floor((now-w.lastAt)/1000)));
  const onlineTicks=Math.min(elapsed,30);
  let time=w.lastAt;
  for(let t=0;t<onlineTicks;t++){time+=1000;step(w,time);}
  if(elapsed>onlineTicks){
    // Offline progression is deliberately bounded and combat is paused.
    // Never simulate thousands of enemy ticks on an unattended account.
    const offline=elapsed-onlineTicks;
    const powered=w.lastPower?.supply>0;
    w.warehouse.scrap=Math.min(100000,w.warehouse.scrap+Math.min(offline,28800)*.04);
    if(powered){
      // Conservative output: only warehouses with an attached production flow
      // gain output while offline. No unconnected factory magically produces stock.
      for(const e of Object.values(w.entities)){
        if(e.type!=="depot")continue;
        const upstream=DIRS.map(d=>w.entities[key(e.x+d[0],e.y+d[1])])
          .filter(m=>m && ["belt","chest","assembler","furnace"].includes(m.type));
        if(upstream.length)w.warehouse.ironPlate=Math.min(100000,
          countResources(w.warehouse,"ironPlate")+Math.floor(Math.min(offline,28800)*.025));
      }
    }
    w.lastOffline=offline;w.lastAt=now;
  }
  return w;
}
function validSpot(w,x,y){
  if(!inside(x,y,w.radius))return false;
  if(Object.keys(w.entities).length>=MAX_BUILDINGS)return false;
  const t=tileAt(w.seed,x,y);
  if(t.terrain==="water")return false;
  const close=Object.values(w.entities).some(e=>Math.abs(e.x-x)+Math.abs(e.y-y)<=10);
  return close;
}
function command(base,msg,now=Date.now()){
  const w=ensure(base);advance(w,now);
  const kind=msg.action;
  if(kind==="build"){
    const x=msg.x,y=msg.y,type=msg.machine,d=DEFINITIONS[type];
    if(!d||type==="core"||!inside(x,y,Math.max(w.radius,0)))return {ok:false,error:"建設範囲外です"};
    if(w.entities[key(x,y)])return {ok:false,error:"すでに設備があります"};
    if(!validSpot(w,x,y))return {ok:false,error:"建設可能範囲外か、水面です。レーダーで開拓してください"};
    if(!unlocked(w,d.tech))return {ok:false,error:"先に研究を解放してください："+d.tech};
    const ore=tileAt(w.seed,x,y).ore;
    if(type==="drill"&&!["ironOre","copperOre","coal","stone"].includes(ore))
      return {ok:false,error:"採掘機は鉱脈の上に設置してください"};
    if(type==="oilPump"&&ore!=="oil")return {ok:false,error:"油井の上に設置してください"};
    if(!hasCost(w.warehouse,COST[type]))return {ok:false,error:"建設用資材が不足しています"};
    charge(w.warehouse,COST[type]);
    w.entities[key(x,y)]=makeEntity(type,x,y,Number.isInteger(msg.dir)?msg.dir:1);
    addLog(w,d.name+"を("+x+","+y+")に設置");
    return {ok:true};
  }
  if(["rotate","demolish","recipe","repair","upgrade"].includes(kind)){
    if(!inside(msg.x,msg.y,w.radius))return {ok:false,error:"範囲外です"};
    const e=w.entities[key(msg.x,msg.y)];
    if(!e||e.type==="core")return {ok:false,error:"中枢コアは変更できません"};
    if(kind==="rotate"){e.dir=(e.dir+1)%4;return {ok:true};}
    if(kind==="demolish"){
      delete w.entities[key(msg.x,msg.y)];
      w.warehouse.scrap+=Math.floor((COST[e.type]?.scrap||0)*.5);
      return {ok:true};
    }
    if(kind==="recipe"){
      const recipe=RECIPES[msg.recipe];
      if(!recipe||!unlocked(w,recipe.tech))return {ok:false,error:"未解放のレシピです"};
      if(e.type!=="assembler"&&e.type!=="tankPlant")return {ok:false,error:"この設備でレシピは変更できません"};
      if(e.type==="tankPlant"&&msg.recipe!=="tank")return {ok:false,error:"戦車工場専用のレシピです"};
      if(e.type==="assembler"&&msg.recipe==="tank")return {ok:false,error:"戦車は専用工場で生産してください"};
      e.recipe=msg.recipe;e.progress=0;return {ok:true};
    }
    if(kind==="repair"){
      const cost={ironPlate:Math.max(1,Math.ceil((DEFINITIONS[e.type].hp-e.hp)/12))};
      if(!hasCost(w.warehouse,cost))return {ok:false,error:"修理用の鉄板が足りません"};
      charge(w.warehouse,cost);e.hp=DEFINITIONS[e.type].hp;return {ok:true};
    }
    if(e.level>=5)return {ok:false,error:"Lv.5が最大です"};
    const cost={ironPlate:e.level*10,scrap:e.level*14};
    if(!hasCost(w.warehouse,cost))return {ok:false,error:"アップグレード資材が足りません"};
    charge(w.warehouse,cost);e.level++;e.hp=DEFINITIONS[e.type].hp;return {ok:true};
  }
  if(kind==="expand"){
    const cost={scrap:30+w.expansions*30,ironPlate:12+w.expansions*8};
    if(!hasCost(w.warehouse,cost))return {ok:false,error:"地域開拓に必要な素材が足りません"};
    charge(w.warehouse,cost);w.radius+=12;w.expansions++;
    addLog(w,"工場敷地を拡張：半径 "+w.radius+" タイル");
    return {ok:true};
  }
  if(kind==="dispatch"){
    const count=Number(msg.count||1);
    if(!Number.isInteger(count)||count<1||count>5)return {ok:false,error:"出撃台数は1〜5台です"};
    if(!unlocked(w,"tanks"))return {ok:false,error:"戦車工業の研究が必要です"};
    const available=countResources(w.warehouse,"tank")+(base.army?.tank||0);
    if(available<count)return {ok:false,error:"製造済み戦車が足りません"};
    if((w.friendly||[]).length+count>30)return {ok:false,error:"出撃中の戦車が多すぎます"};
    w.friendly=w.friendly||[];
    const fromStore=Math.min(countResources(w.warehouse,"tank"),count);
    w.warehouse.tank=(w.warehouse.tank||0)-fromStore;
    if(count>fromStore)base.army.tank-=count-fromStore;
    for(let i=0;i<count;i++)w.friendly.push({id:"tank-"+Date.now()+"-"+i,
      x:(i%3)-1,y:2+Math.floor(i/3),hp:120,maxHp:120,cooldown:0});
    addLog(w,"自動戦車 "+count+"台が防衛出撃");
    return {ok:true};
  }
  if(kind==="research"){
    const tech=TECHS[msg.tech];
    if(!tech)return {ok:false,error:"研究がありません"};
    if(w.research.unlocked.includes(msg.tech))return {ok:false,error:"すでに研究済みです"};
    if(tech.needs.some(t=>!w.research.unlocked.includes(t)))return {ok:false,error:"前提研究が未完了です"};
    if(w.research.points<tech.points)return {ok:false,error:"研究ポイントが不足しています"};
    w.research.points-=tech.points;w.research.totalSpent+=tech.points;
    w.research.unlocked.push(msg.tech);
    addLog(w,"新技術を解放："+tech.name);return {ok:true};
  }
  if(kind==="salvage"){
    // Trading battlefield scrap and materials into the HQ is an early shortcut,
    // but it cannot grant resources out of nothing.
    if(countResources(w.warehouse,"ironOre")<25)return {ok:false,error:"鉄鉱石が25必要です"};
    w.warehouse.ironOre-=25;w.warehouse.scrap+=15;return {ok:true};
  }
  return {ok:false,error:"操作できません"};
}
function snapshot(base){
  const w=ensure(base);
  return {version:w.version,seed:w.seed,radius:w.radius,
    entities:w.entities,warehouse:w.warehouse,research:w.research,stats:w.stats,
    power:w.lastPower||{supply:0,demand:0,used:0,networks:0},
    pollution:Math.round(w.pollution),wave:w.wave,waveIn:Math.max(0,Math.ceil((w.waveAt-Date.now())/1000)),
    enemies:w.enemies,friendly:w.friendly||[],lastShot:w.lastShot||null,log:w.log,expansions:w.expansions,
    rates:w.rates||{mined:0,crafted:0,shipped:0},
    army:{tank:(base.army?.tank||0)+countResources(w.warehouse,"tank"),
      artillery:base.army?.artillery||0},hphq:base.hp,worldLevel:w.worldLevel,
    machineCount:Object.keys(w.entities).length};
}
module.exports={COST,DEFINITIONS,RECIPES,TECHS,ensure,makeState,makeEntity,advance,command,snapshot,tileAt,step,power,transport,craft};
