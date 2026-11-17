"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const E=require("../game/engine");

function game(){return E.newGame({id:"player-1",name:"Player 1"},{id:"player-2",name:"Player 2",bot:true});}
function run(g,seconds){
 for(let t=0;t<seconds*4&&!g.ended;t++)E.step(g,0.25);
 return g;
}
test("new games have equal factory layouts and core health",()=>{
 const g=game();const [a,b]=g.players;
 assert.equal(a.coreHp,400);assert.equal(b.coreHp,400);
 assert.equal(a.board.length,64);assert.equal(b.board.length,64);
 assert.equal(a.options.length,3);
 assert.equal(b.options.length,3);
 assert.equal(g.ended,false);
});
test("factory actually mines, smelts, crafts ammo, and deals damage",()=>{
 const g=game();run(g,28);
 assert.ok(g.players[0].stats.ore>0,"Mining should produce ore");
 assert.ok(g.players[0].stats.metal>0,"Furnace should produce metal");
 assert.ok(g.players[0].stats.ammo>0,"Ammo factory should manufacture bullets");
 assert.ok(g.players[0].stats.damage>0,"Turret should spend bullets and fire");
 assert.ok(g.players[1].coreHp<400,"Opponent core should take damage");
});
test("construction validates scrap, occupied spaces, and salvage",()=>{
 const g=game(),p=g.players[0],start=p.scrap;
 assert.equal(E.build(g,0,"generator",3,7).ok,false,"The core tile must not be replaced");
 assert.equal(E.build(g,0,"nonsense",2,5).ok,false,"Unknown machines are invalid");
 assert.equal(E.build(g,0,"generator",2,5).ok,true);
 assert.equal(p.scrap,start-E.DEFINITIONS.generator.cost);
 assert.equal(E.dismantle(g,0,2,5).ok,true);
 assert.ok(p.scrap>start-E.DEFINITIONS.generator.cost);
 assert.equal(E.dismantle(g,0,3,7).ok,false,"Core cannot be scrapped");
});
test("upgrades change factory capabilities",()=>{
 const g=game(),a=g.players[0];
 a.options=["energy","core","mine"];
 const before=a.maxCoreHp;
 assert.equal(E.choose(g,0,"core").ok,true);
 assert.equal(a.maxCoreHp,before+60);
 assert.equal(a.coreHp,before+60);
 assert.equal(a.options.length,0);
 assert.equal(E.choose(g,0,"core").ok,false,"Upgrade may not be reselected");
});
test("CPU begins by adding power capacity",()=>{
 const g=game();run(g,1);
 assert.ok(g.players[1].board.filter(m=>m?.type==="generator").length>=2);
});
test("three-minute timeout uses remaining core percentage",()=>{
 const g=game();
 g.players[0].coreHp=100;g.players[1].coreHp=200;
 g.elapsed=179.9;
 E.step(g,0.25);
 assert.equal(g.ended,true);
 assert.equal(g.winner,"player-2");
 assert.equal(g.finishReason,"time");
});
test("snapshots are JSON-safe and include consumable resource buffers",()=>{
 const g=game();run(g,8);
 const snapshot=JSON.parse(JSON.stringify(E.snapshot(g)));
 assert.equal(snapshot.players[0].board.length,64);
 assert.equal(typeof snapshot.players[0].board[1*8+1].output,"number");
 assert.equal(snapshot.length,180);
});
