"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const E=require("../game/engine");
const WORLD=require("../public/world-data");
function player(id,bot=false){return {id,name:id,bot};}
const solo=()=>E.newGame(player("engineer"),player("waves",true));
const versus=()=>E.newGame(player("alpha"),player("beta"));
const campaign=id=>E.newGame(player("engineer"),player("waves",true),{stage:WORLD.byId[id]});
function run(g,seconds){for(let i=0;i<seconds*4&&!g.ended;i++)E.step(g,0.25);return g;}
test("factory begins with a playable ore-to-ammunition production chain on a 12x12 map",()=>{
 const g=solo(),p=g.players[0],s=E.snapshot(g);
 assert.equal(E.SIZE,12);
 assert.equal(p.board.length,144);
 assert.equal(s.players[0].deposits.length,10);
 assert.equal(p.coreHp,400);
 assert.equal(s.maxWaves,4);
 assert.equal(s.phase,"defense");
 assert.equal(s.mode,"solo");
});
test("mining and belt transport actually refine ore and manufacture ammo",()=>{
 const g=solo();run(g,35);
 const stats=g.players[0].stats;
 assert.ok(stats.ore>=10,"A drill should produce ore");
 assert.ok(stats.metal>=7,"The furnace should refine ore delivered by conveyors");
 assert.ok(stats.ammo>=6,"The ammo machine should craft bullets from refined metal");
});
test("PvE produces approaching enemies and turrets spend manufactured ammo to defend",()=>{
 const g=solo();run(g,70);
 assert.ok(g.wave>=1,"First enemy wave must arrive");
 assert.ok(g.players[0].stats.damage>0,"Turret must shoot real approaching enemies");
 assert.ok(g.players[0].stats.ammo>0);
});
test("ore miners are restricted to visible ore deposits",()=>{
 const g=solo(),p=g.players[0];
 assert.equal(E.build(g,0,"drill",7,7).ok,false);
 assert.equal(E.build(g,0,"drill",1,3).ok,true);
 assert.equal(E.build(g,0,"drill",1,3).ok,false);
 assert.equal(E.build(g,0,"generator",7,7).ok,true);
 assert.equal(E.dismantle(g,0,7,7).ok,true);
 assert.equal(E.dismantle(g,0,5,10).ok,false,"Core cannot be dismantled");
 assert.equal(p.board.length,144);
});
test("PvP forbids combat for precisely 180 seconds, then locks construction",()=>{
 const g=versus();
 assert.equal(g.phase,"build");
 assert.equal(g.buildTime,180);
 run(g,179.75);
 assert.equal(g.phase,"build");
 assert.equal(g.players[0].coreHp,400);
 assert.equal(g.players[1].coreHp,400);
 assert.equal(E.build(g,0,"wall",8,8).ok,true);
 run(g,.5);
 assert.equal(g.phase,"battle");
 assert.equal(E.build(g,0,"wall",9,8).ok,false,"Cannot build once battle starts");
 assert.equal(E.rotate(g,0,8,8).ok,false);
 run(g,10);
 assert.ok(g.players[0].stats.damage>0||g.players[1].stats.damage>0,"Autonomous battle should start");
 assert.equal(g.length,330);
});
test("PvP ranks both factories by core integrity when time expires",()=>{
 const g=versus();g.phase="battle";g.elapsed=329.9;
 g.players[0].coreHp=100;g.players[1].coreHp=200;
 E.step(g,.25);
 assert.equal(g.ended,true);
 assert.equal(g.winner,"beta");
 assert.equal(g.finishReason,"time");
});
test("tutorial requires placing the missing line and firing at the wave",()=>{
 const g=campaign("tutorial"),p=g.players[0];
 assert.equal(g.stageId,"tutorial");
 assert.equal(p.board[1*12+2],null);
 for(const [x,y,type] of [[2,1,"belt"],[3,1,"furnace"],[4,1,"belt"],[5,1,"ammo"],[6,1,"turret"]]){
   assert.equal(E.build(g,0,type,x,y,1).ok,true);
 }
 assert.ok(g.nextWaveAt<=9,"Completing the line should bring the tutorial attack forward");
 run(g,170);
 assert.equal(g.ended,true);
 assert.equal(g.winner,"engineer");
 assert.ok(g.players[0].stats.damage>0);
});
test("research selection modifies core health and drains the choice list",()=>{
 const g=versus(),p=g.players[0];
 p.options=["core","mine","energy"];
 const old=p.maxCoreHp;
 assert.equal(E.choose(g,0,"core").ok,true);
 assert.equal(p.coreHp,old+60);
 assert.equal(p.maxCoreHp,old+60);
 assert.equal(p.options.length,0);
 assert.equal(E.choose(g,0,"core").ok,false);
});
test("world contains 24 connected mission nodes across 5 distinct territories",()=>{
 assert.equal(WORLD.regions.length,5);
 assert.equal(WORLD.stages.length,24);
 const seen=new Set();
 for(const stage of WORLD.stages){
   assert.ok(!seen.has(stage.id),"Duplicate stage ID: "+stage.id);
   seen.add(stage.id);
   assert.ok(stage.x>=0&&stage.x<=3500&&stage.y>=0&&stage.y<=1250);
   for(const req of stage.requires){
     assert.ok(WORLD.byId[req],"Unresolved prerequisite: "+req);
     assert.ok(WORLD.byId[req].order<stage.order,"Stage graph must be ordered");
   }
 }
 assert.ok(WORLD.byId["void-boss"]);
});
test("snapshots are JSON-safe and include live defensive state",()=>{
 const g=solo();run(g,55);
 const s=JSON.parse(JSON.stringify(E.snapshot(g)));
 assert.equal(s.players[0].board.length,144);
 assert.equal(typeof s.players[0].board[1*12+1].output,"number");
 assert.ok(Array.isArray(s.enemies));
 assert.equal(s.length,360);
});
