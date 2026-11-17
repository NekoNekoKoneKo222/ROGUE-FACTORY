"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Shared=require("../public/industrial-shared");
const Industrial=require("../game/industrial-world");
const HQ=require("../game/headquarters");
const point=(x,y)=>Shared.key(x,y);
function fresh(){
 const base=HQ.starter(),world=Industrial.ensure(base);
 return {base,world};
}
function simulate(world,n=1){for(let i=0;i<n;i++)Industrial.advance(world,world.lastAt+1000);}
test("world is procedural and reproducible across distant chunks",()=>{
 const seed=827345;
 const a=Shared.tileAt(seed,1_000_000,-1_000_000);
 assert.deepEqual(a,Shared.tileAt(seed,1_000_000,-1_000_000));
 assert.equal(Shared.chunkKey(-1,37),"-1,1");
 assert.equal(Shared.tileAt(seed,-5,-3).ore,"ironOre");
 assert.equal(Shared.tileAt(seed,-5,4).ore===null||typeof Shared.tileAt(seed,-5,4).ore==="string",true);
});
test("new accounts receive a permanent central core and initial connected production chain",()=>{
 const {base,world}=fresh();
 assert.equal(world.version,2);
 assert.equal(world.entities["0,0"].type,"core");
 assert.equal(world.entities["-5,-3"].type,"drill");
 assert.equal(world.entities["-3,-3"].type,"furnace");
 assert.equal(world.entities["-1,-3"].type,"assembler");
 assert.equal(world.entities["0,-3"].type,"turret");
 assert.equal(world.radius,24);
 assert.equal(Industrial.ensure(base),world);
});
test("actual item belts smelt iron and assemble ammunition while power is available",()=>{
 const {world}=fresh();
 simulate(world,55);
 assert.ok(world.stats.mined>8,"miner must generate real ore items");
 assert.ok(world.stats.crafted>3,"furnace and assembler must craft real items");
 assert.ok(world.entities["-3,-3"].input.ironOre>=0);
 assert.ok(world.entities["-1,-3"].input.ironPlate>=0);
 assert.ok(world.entities["0,-3"].input.ammoPack>=8,"turret receives ammo from connected assembler");
 assert.ok(world.lastPower.supply>0,"coal generator must supply electricity");
});
test("disconnected machines do not receive items by magic",()=>{
 const {world}=fresh();
 delete world.entities["-4,-3"];
 simulate(world,15);
 assert.equal(world.entities["-3,-3"].input.ironOre||0,0);
 assert.ok(world.entities["-5,-3"].output.length>0);
});
test("technologies unlock advanced logistics and research points are consumed",()=>{
 const {base,world}=fresh();
 assert.equal(Industrial.command(base,{action:"build",machine:"splitter",x:3,y:1}).ok,false);
 const before=world.research.points;
 assert.equal(Industrial.command(base,{action:"research",tech:"logistics2"}).ok,true);
 assert.equal(world.research.points,before-12);
 assert.ok(world.research.unlocked.includes("logistics2"));
 assert.equal(Industrial.command(base,{action:"build",machine:"splitter",x:3,y:1}).ok,true);
});
test("land expansion increases the buildable area without finite stage boundaries",()=>{
 const {base,world}=fresh();
 const previous=world.radius;
 assert.equal(Industrial.command(base,{action:"expand"}).ok,true);
 assert.equal(world.radius,previous+12);
 assert.ok(Shared.tileAt(world.seed,-400000,400000));
 assert.equal(Industrial.command(base,{action:"build",machine:"drill",x:100000,y:10}).ok,false);
});
test("no buildings can be placed into water, outside land or on non-ore drills",()=>{
 const {base,world}=fresh();
 const empty=Array.from({length:25},(_,i)=>({x:i%5-2,y:Math.floor(i/5)-2}))
   .find(p=>!Shared.tileAt(world.seed,p.x,p.y).ore && !world.entities[point(p.x,p.y)]);
 assert.ok(empty,"A deterministic empty spot should be available near the HQ");
 assert.equal(Industrial.command(base,{action:"build",machine:"drill",x:empty.x,y:empty.y}).ok,false);
 assert.equal(Industrial.command(base,{action:"build",machine:"furnace",x:0,y:0}).ok,false);
 assert.equal(Industrial.command(base,{action:"build",machine:"furnace",x:3000,y:0}).ok,false);
 assert.equal(world.entities["0,0"].type,"core");
});
test("pollution spawns waves, turrets consume ammo and protect central base",()=>{
 const {world}=fresh();
 world.waveAt=world.lastAt+1000;
 simulate(world,5);
 assert.equal(world.wave,1);
 assert.ok(world.enemies.length>=1);
 const e=world.enemies[0];
 e.x=0;e.y=-4;
 e.hp=30;e.maxHp=30;
 const oldBullets=world.entities["0,-3"].input.ammoPack;
 simulate(world,3);
 assert.ok(world.entities["0,-3"].input.ammoPack<oldBullets,"Turret should expend real ammo");
 assert.ok(e.hp<30 || world.stats.kills>0,"Defense must target hostile machines");
});
test("persistent central core is never removed even if enemies attack it",()=>{
 const {world}=fresh(),core=world.entities["0,0"];
 core.hp=210;
 world.enemies=[{id:1,x:0,y:0,type:"armored",hp:999,maxHp:999,cooldown:0}];
 simulate(world,100);
 assert.ok(core.hp>=200);
 assert.equal(world.entities["0,0"].type,"core");
});
test("legacy HQ data remains intact and new world persists in the same account",()=>{
 const base=HQ.starter();base.resources.scrap=512;
 const legacy=JSON.stringify(base.board),oldArmy=JSON.stringify(base.army);
 const world=Industrial.ensure(base);
 assert.equal(world.warehouse.scrap,512);
 assert.equal(JSON.stringify(base.board),legacy);
 assert.equal(JSON.stringify(base.army),oldArmy);
 const snap=JSON.parse(JSON.stringify(base));
 assert.equal(Industrial.ensure(snap).entities["0,0"].type,"core");
});
test("client snapshots expose only serializable terrain seed, machinery and progress",()=>{
 const {base,world}=fresh();simulate(world,3);
 const s=JSON.parse(JSON.stringify(Industrial.snapshot(base)));
 assert.equal(s.seed,world.seed);
 assert.ok(s.entities["-5,-3"]);
 assert.ok(s.warehouse);
 assert.ok(Array.isArray(s.enemies));
 assert.equal(typeof s.power.supply,"number");
});

test("dragged conveyor and pipe routes charge exact resource costs and connect their directions",()=>{
 const {base,world}=fresh();
 const before=world.warehouse.scrap;
 const result=Industrial.command(base,{action:"line",machine:"belt",x:1,y:1,tx:4,ty:3});
 assert.equal(result.ok,true);
 assert.equal(result.built,6);
 assert.equal(world.warehouse.scrap,before-6*2);
 for(const pos of [[1,1],[2,1],[3,1],[4,1],[4,2],[4,3]])
   assert.equal(world.entities[point(...pos)].type,"belt");
 assert.equal(world.entities["4,1"].dir,2);
 assert.equal(world.entities["4,3"].dir,2);
});
test("line-building is atomic if an occupied tile blocks the path",()=>{
 const {base,world}=fresh();
 const before=world.warehouse.scrap,initial=Object.keys(world.entities).length;
 const result=Industrial.command(base,{action:"line",machine:"belt",x:-6,y:-3,tx:-1,ty:-3});
 assert.equal(result.ok,false);
 assert.equal(world.warehouse.scrap,before);
 assert.equal(Object.keys(world.entities).length,initial);
});
test("oil can move from the pump through the pipe to the refinery",()=>{
 const {base,world}=fresh();
 world.research.unlocked.push("automation2","oilProcessing");
 const pump=Industrial.makeEntity("oilPump",5,4,1);
 const pipe=Industrial.makeEntity("pipe",6,4,1);
 const refinery=Industrial.makeEntity("refinery",7,4,1);
 pump.online=true;refinery.online=true;pipe.online=true;pump.fluid=4;
 world.entities["5,4"]=pump;world.entities["6,4"]=pipe;world.entities["7,4"]=refinery;
 Industrial.transport(world);
 assert.equal(pipe.fluid,1,"Oil pump must feed adjacent pipe");
 Industrial.transport(world);
 assert.equal(refinery.fluid,1,"Pipe must feed adjacent refinery");
});
test("manufactured tanks can be dispatched as physical allied defenders",()=>{
 const {base,world}=fresh();
 world.research.unlocked.push("tanks");
 world.warehouse.tank=2;
 assert.equal(Industrial.command(base,{action:"dispatch",count:2}).ok,true);
 assert.equal(world.warehouse.tank,0);
 assert.equal(world.friendly.length,2);
 world.enemies=[{id:1,x:3,y:4,type:"biter",hp:140,maxHp:140,cooldown:0}];
 simulate(world,6);
 assert.ok(world.enemies[0].hp<140 || world.stats.kills>0);
});

test("industrial-world fortifications increase resistance to other player raids",()=>{
 const base=HQ.starter();
 const world=Industrial.ensure(base);
 const initial=HQ.defenseScore(base);
 world.entities["2,0"]=Industrial.makeEntity("wall",2,0);
 world.entities["3,0"]=Industrial.makeEntity("laser",3,0);
 world.entities["4,0"]=Industrial.makeEntity("generator",4,0);
 const after=HQ.defenseScore(base);
 assert.ok(after>initial,"Industrial machinery must contribute to persistent PvP defense");
});
test("player-made tanks can be used to raid another permanent factory without deleting it",()=>{
 const attacker=HQ.starter(),defender=HQ.starter();
 const wa=Industrial.ensure(attacker),wd=Industrial.ensure(defender);
 attacker.army.tank=0;wa.warehouse.tank=20;
 const original=Object.keys(wd.entities).sort();
 const outcome=HQ.raid(attacker,defender,"tank",20);
 assert.equal(outcome.ok,true);
 assert.ok(wa.warehouse.tank<20);
 assert.deepEqual(Object.keys(wd.entities).sort(),original,"A raid must not delete any permanent buildings");
 assert.ok(wd.entities["0,0"].hp>=200);
 assert.ok(defender.shieldUntil>Date.now());
});
