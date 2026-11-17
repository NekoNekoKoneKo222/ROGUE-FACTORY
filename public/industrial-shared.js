"use strict";
/* Deterministic procedural terrain shared by the Node server and browser.
   No terrain files are stored: every 32x32 chunk is calculated from seed+XY. */
(function(root,factory){
  const shared=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=shared;
  else root.IndustrialShared=shared;
})(typeof window==="undefined"?globalThis:window,function(){
  const CHUNK=32,DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
  function hash(seed,x,y,salt=0){
    let n=(Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed,1442695041)^Math.imul(salt,1274126177))|0;
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967295;
  }
  function tileAt(seed,x,y){
    const distance=Math.max(Math.abs(x),Math.abs(y));
    if(x===-5&&y===-3)return {terrain:"dirt",ore:"ironOre",richness:1400};
    if(x===-5&&y===-1)return {terrain:"dirt",ore:"copperOre",richness:900};
    if(x===-5&&y===1)return {terrain:"dirt",ore:"coal",richness:950};
    if(x===-5&&y===3)return {terrain:"dirt",ore:"stone",richness:850};
    if(x===5&&y===4)return {terrain:"dirt",ore:"oil",richness:1100};
    const zoneX=Math.floor(x/12),zoneY=Math.floor(y/12);
    const patchChance=hash(seed,zoneX,zoneY,11);
    const px=zoneX*12+2+Math.floor(hash(seed,zoneX,zoneY,12)*8);
    const py=zoneY*12+2+Math.floor(hash(seed,zoneX,zoneY,13)*8);
    const dx=x-px,dy=y-py,r=2+Math.floor(hash(seed,zoneX,zoneY,14)*3);
    const oreKinds=["ironOre","copperOre","coal","stone","oil"];
    let ore=null,richness=0;
    if(patchChance<.81 && dx*dx+dy*dy <=r*r && (distance>9 || hash(seed,zoneX,zoneY,15)>.45)){
      ore=oreKinds[Math.floor(hash(seed,zoneX,zoneY,16)*oreKinds.length)];
      richness=Math.round(220+hash(seed,x,y,17)*950+Math.floor(distance/30)*60);
    }
    const terrainHash=hash(seed,Math.floor(x/9),Math.floor(y/9),20);
    const detail=hash(seed,x,y,21);
    const water=distance>12 && terrainHash<.08 && detail<.58;
    const terrain=water?"water":terrainHash>.8?"sand":terrainHash<.25?"forest":terrainHash>.63?"rock":"grass";
    return {terrain,ore:water?null:ore,richness:water?0:richness};
  }
  function key(x,y){return String(x)+","+String(y);}
  function coords(text){
    const parts=String(text).split(",").map(Number);
    return parts.length===2 && parts.every(Number.isSafeInteger)?parts:null;
  }
  function chunk(x,y){return [Math.floor(x/CHUNK),Math.floor(y/CHUNK)];}
  function chunkKey(x,y){return chunk(x,y).join(",");}
  return Object.freeze({CHUNK,DIRS,hash,tileAt,key,coords,chunk,chunkKey});
});
