"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const HQ=require("../game/headquarters");
const Engine=require("../game/engine");
const World=require("../public/world-data");

test("headquarters starts persistent with an actual ore to ammo conveyor line",()=>{
 const h=HQ.starter();
 assert.equal(h.board.length,144);
 assert.equal(h.board[HQ.CORE].type,"core");
 assert.equal(h.board[13].type,"drill");
 assert.deepEqual(HQ.lines(h.board),{ore:1,metal:1,ammo:1});
 assert.ok(h.resources.metal>0);
 assert.ok(h.army.tank>=1);
});
test("offline production improves resources from connected manufacturing machines",()=>{
 const h=HQ.starter(),start={...h.resources};
 HQ.tick(h,h.lastTick+120000);
 assert.ok(h.resources.scrap>start.scrap);
 assert.ok(h.resources.ore>start.ore);
 assert.ok(h.resources.metal>start.metal);
 assert.ok(h.resources.ammo>start.ammo);
});
test("HQ buildings are persistent; tanks require a dedicated factory",()=>{
 const h=HQ.starter();
 assert.equal(HQ.modify(h,{action:"train",unit:"tank",count:1}).ok,false);
 const before=h.resources.scrap;
 assert.equal(HQ.modify(h,{action:"place",machine:"tankPlant",x:8,y:7}).ok,true);
 assert.ok(Math.abs(h.resources.scrap-(before-HQ.TYPES.tankPlant.price))<0.1,
   "Construction cost should be correct, allowing tiny wall-clock offline-production increments");
 assert.equal(HQ.modify(h,{action:"train",unit:"tank",count:1}).ok,true);
 assert.equal(h.queue.length,1);
 assert.equal(HQ.modify(h,{action:"train",unit:"artillery",count:1}).ok,false);
 assert.equal(HQ.modify(h,{action:"upgrade",x:8,y:7}).ok,true);
 assert.equal(h.board[7*12+8].level,2);
 h.resources.metal=100;h.resources.ammo=100;h.resources.scrap=150;
 assert.equal(HQ.modify(h,{action:"train",unit:"artillery",count:1}).ok,true);
 HQ.tick(h,Date.now()+120000);
 assert.ok(h.army.tank>=2);
 assert.ok(h.army.artillery>=1);
 assert.equal(h.board[7*12+8].type,"tankPlant");
});
test("mining machine placement is restricted to ore deposits; the main core cannot be removed",()=>{
 const h=HQ.starter();
 assert.equal(HQ.modify(h,{action:"place",machine:"drill",x:5,y:5}).ok,false);
 assert.equal(HQ.modify(h,{action:"place",machine:"drill",x:1,y:3}).ok,true);
 assert.equal(HQ.modify(h,{action:"demolish",x:5,y:10}).ok,false);
 assert.equal(h.board[HQ.CORE].type,"core");
});
test("asynchronous player attacks never delete the victim base and create a cooldown shield",()=>{
 const attacker=HQ.starter(),defender=HQ.starter();
 attacker.army.tank=20;const snapshot=JSON.stringify(defender.board);
 const result=HQ.raid(attacker,defender,"tank",20);
 assert.equal(result.ok,true);
 assert.equal(result.victory,true);
 assert.equal(JSON.stringify(defender.board),snapshot,"All permanent buildings must survive");
 assert.ok(defender.hp>0,"Main headquarters must remain standing");
 assert.ok(defender.shieldUntil>Date.now(),"Victim receives temporary shield");
 const again=HQ.raid(attacker,defender,"tank",1);
 assert.equal(again.ok,false);
 assert.ok(defender.resources.scrap>=0);
});
test("player campaigns can use the existing HQ base and garrison tanks",()=>{
 const base=HQ.starter();
 assert.equal(HQ.modify(base,{action:"place",machine:"tankPlant",x:8,y:7}).ok,true);
 const game=Engine.newGame({id:"engineer",name:"ENGINEER"},{id:"cpu",name:"CPU",bot:true},
  {stage:World.byId["rust-1"],homeBase:base});
 assert.equal(game.mode,"world");
 assert.equal(game.tankGarrison,1);
 assert.equal(game.players[0].board[7*12+8].type,"tankPlant");
 assert.equal(base.board[7*12+8].type,"tankPlant");
});
