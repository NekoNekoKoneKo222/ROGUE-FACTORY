"use strict";
(()=>{
const data=window.RogueWorldData,$=id=>document.getElementById(id),stages=data.stages;
const STORAGE="rogue-factory-world-v2",TOTAL_STARS=stages.length*3;
const machineIcons={drill:"⛏",belt:"➜",furnace:"♨",ammo:"⚙",turret:"✹",rocket:"➤",generator:"ϟ",wall:"▦",shield:"◈",repair:"✚"};
const masteryTitles={drill:"鉱石採掘",belt:"物流技術",furnace:"金属精錬",ammo:"弾薬製造",turret:"自動砲台",rocket:"ミサイル技術",generator:"発電技術",wall:"装甲建築",shield:"シールド制御",repair:"工場修理"};
const achievementList=[
{id:"training",icon:"◎",title:"はじめてのエンジニア",desc:"チュートリアルをクリア",test:p=>!!p.cleared.tutorial},
{id:"first",icon:"✹",title:"初めての防衛",desc:"通常ステージを初クリア",test:p=>stages.some(s=>s.type==="battle"&&p.cleared[s.id])},
{id:"explore",icon:"◈",title:"荒野の探検家",desc:"ステージを5つクリア",test:p=>Object.keys(p.cleared).length>=5},
{id:"boss",icon:"♛",title:"ボスハンター",desc:"ボスを3体撃退",test:p=>stages.filter(s=>s.type==="boss"&&p.cleared[s.id]).length>=3},
{id:"mastery",icon:"⚙",title:"工業マスター",desc:"設備マスタリーLv.5達成",test:p=>Object.values(p.mastery).some(x=>masteryLevel(x)>=5)},
{id:"stars",icon:"✦",title:"完璧な防衛",desc:"星を20個獲得",test:p=>totalStars(p)>=20},
{id:"collection",icon:"▣",title:"設計図コレクター",desc:"設計図を10種類回収",test:p=>p.blueprints.length>=10},
{id:"final",icon:"◇",title:"工業の解放者",desc:"最終ボスTHE FACTORYを倒す",test:p=>!!p.cleared["void-boss"]}
];
function fresh(){return {version:2,xp:0,credits:0,cleared:{},mastery:{},blueprints:[],wins:0,runs:0,lastMatchId:"",daily:""};}
function load(){try{
 const p=JSON.parse(localStorage.getItem(STORAGE)||"null");
 if(!p || p.version!==2 || typeof p!=="object")return fresh();
 return {...fresh(),...p,cleared:p.cleared&&typeof p.cleared==="object"?p.cleared:{},mastery:p.mastery&&typeof p.mastery==="object"?p.mastery:{},blueprints:Array.isArray(p.blueprints)?p.blueprints:[]};
}catch{return fresh();}}
let progress=load(),selected="tutorial",tab="map",guidedStep=-1,hideGuide=false;
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(progress));}catch{}}
function totalStars(p=progress){return stages.reduce((n,s)=>n+Math.max(0,Math.min(3,Number(p.cleared[s.id]?.stars)||0)),0);}
function countCleared(){return stages.filter(s=>!!progress.cleared[s.id]).length;}
function masteryLevel(x){return Math.min(50,1+Math.floor(Math.sqrt(Math.max(0,Number(x)||0)/18)));}
function playerLevel(){return 1+Math.floor(Math.sqrt(Math.max(0,progress.xp)/85));}
function openStage(s){return s.requires.every(k=>progress.cleared[k]?.stars>=1);}
function nextStage(){return stages.find(s=>openStage(s)&&!progress.cleared[s.id])?.id||"tutorial";}
function stars(n){return "★".repeat(n)+"☆".repeat(3-n);}
function text(id,v){const el=$(id);if(el)el.textContent=String(v);}
function makeRegions(){
 const root=$("worldLandmarks");root.replaceChildren();
 for(const region of data.regions){
  const div=document.createElement("div");div.className="world-region-name";
  div.style.left=region.x+"px";div.style.top=region.y+"px";
  div.style.setProperty("--region-color",region.color);
  div.innerHTML='<span>'+region.tag+'</span><b>'+region.icon+' '+region.name+'</b><small>'+region.subtitle+'</small>';
  root.append(div);
 }
 const landmarks=[[180,270,"◭"],[460,250,"⛰"],[680,970,"⚒"],[900,900,"♨"],[1230,420,"⚙"],[1660,1100,"ϟ"],[1950,330,"⛰"],[2300,900,"❄"],[2610,200,"⚡"],[2900,900,"◈"],[3220,210,"◇"]];
 for(const [x,y,icon] of landmarks){
  const el=document.createElement("span");el.className="world-landmark";el.textContent=icon;el.style.left=x+"px";el.style.top=y+"px";root.append(el);
 }
}
function makeRoads(){
 const svg=$("worldRoads");svg.replaceChildren();
 for(const s of stages)for(const dep of s.requires){
  const a=data.byId[dep];if(!a)continue;
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  const mx=(s.x+a.x)/2, curve=s.type==="challenge"?95:-55;
  path.setAttribute("d","M "+a.x+" "+a.y+" Q "+mx+" "+((s.y+a.y)/2+curve)+" "+s.x+" "+s.y);
  path.setAttribute("class","world-road"+(progress.cleared[s.id]?" complete":"")+(openStage(s)?" available":""));
  svg.append(path);
 }
}
function makeNodes(){
 const root=$("worldNodes");root.replaceChildren();
 for(let i=0;i<stages.length;i++){
  const s=stages[i],done=progress.cleared[s.id],can=openStage(s);
  const b=document.createElement("button");b.type="button";b.dataset.stage=s.id;
  b.className="world-node "+s.type+(done?" is-cleared":"")+(can?" is-open":" is-locked")+(selected===s.id?" is-selected":"");
  b.style.left=s.x+"px";b.style.top=s.y+"px";
  b.setAttribute("aria-label",s.name+(can?"、挑戦可能":"、未解放"));
  const ico=can?(s.type==="boss"?"♛":s.type==="tutorial"?"◎":s.type==="challenge"?"◇":s.type==="elite"?"✹":"⚙"):"⌁";
  b.innerHTML='<span class="node-inner">'+ico+'</span><span class="node-number">'+String(i).padStart(2,"0")+'</span><span class="node-name">'+s.name+'</span><span class="node-stars">'+(done?stars(done.stars):"")+'</span>';
  b.onclick=()=>selectStage(s.id);
  root.append(b);
 }
}
function selectStage(id){
 const s=data.byId[id];if(!s)return;
 selected=id;const record=progress.cleared[id],can=openStage(s);
 for(const b of $("worldNodes").children)b.classList.toggle("is-selected",b.dataset.stage===id);
 text("worldStageType",(s.type==="boss"?"BOSS":s.type==="challenge"?"OPTIONAL":s.type==="elite"?"ELITE":s.type==="tutorial"?"TRAINING":"DEFENSE")+" / "+s.region.toUpperCase());
 text("worldStageTitle",s.name);text("worldStageSubtitle",s.subtitle);text("worldStageStars",record?stars(record.stars):"☆☆☆");
 text("worldStageStory",s.story);text("worldStageDifficulty","★".repeat(Math.min(12,s.difficulty)));
 text("worldStageRule",s.type==="tutorial"?"設備をつないで敵を防衛":s.rule+" / 自動工場防衛");
 text("worldStageReward","+"+s.xp+" XP / ◆"+s.credits+(record?" (再戦は50%)":""));
 text("worldStageBlueprint",s.blueprint);
 const btn=$("worldStartBtn");btn.disabled=!can;
 btn.textContent=can?(record?"↻ 再挑戦する":s.id==="tutorial"?"◎ 工場入門を始める":"▶ 防衛戦を開始"):"🔒 前のステージをクリア";
 text("worldUnlockHint",can?(record?"クリア済み：最高評価 "+stars(record.stars):"開放済み：襲撃を防いで次の地域へ"):"解放条件："+s.requires.map(k=>data.byId[k]?.name||k).join(" / "));
 text("worldQuestText","制圧 "+countCleared()+"/"+stages.length+"　／　次の目標：工業世界の制圧");
 $("worldQuestProgress").style.width=Math.round(100*countCleared()/stages.length)+"%";
}
function renderMap(){
 text("worldLevel","LV."+playerLevel());text("worldCredits","◆ "+progress.credits.toLocaleString("ja-JP"));
 text("worldStars","★ "+totalStars()+" / "+TOTAL_STARS);
 makeRegions();makeRoads();makeNodes();selectStage(selected);
}
function renderExtra(){
 const root=$("worldExtraView");root.replaceChildren();
 const title=document.createElement("div");title.className="world-extras-title";
 const heading=document.createElement("h3");
 heading.textContent=tab==="mastery"?"工場マスタリー":"実績・設計図アーカイブ";
 title.append(heading);root.append(title);
 if(tab==="mastery"){
  const grid=document.createElement("div");grid.className="world-mastery-grid";
  for(const [type,name] of Object.entries(masteryTitles)){
   const xp=Math.floor(progress.mastery[type]||0),lv=masteryLevel(xp),base=18*(lv-1)*(lv-1),next=18*lv*lv;
   const card=document.createElement("div");card.className="world-mastery-card";
   card.innerHTML='<span class="mastery-icon">'+machineIcons[type]+'</span><div><b>'+name+'</b><small>'+type.toUpperCase()+'</small></div>'+
    '<span class="mastery-level">LV.'+lv+'</span><div class="mastery-track"><i style="width:'+Math.min(100,Math.max(0,(xp-base)/(next-base)*100))+'%"></i></div>'+
    '<span class="mastery-xp">'+xp+' / '+next+' XP</span>';
   grid.append(card);
  }
  root.append(grid);
  const p=document.createElement("p");p.className="world-extra-note";p.textContent="設備の使用回数や製造量で熟練度が上昇します。PvPの能力値には影響しません。";root.append(p);
 }else if(tab==="records"){
  const summary=document.createElement("p");summary.className="world-extra-note";
  summary.textContent="総出撃 "+progress.runs+"回 / 勝利 "+progress.wins+"回 / クリア "+countCleared()+"/"+stages.length+" / 設計図 "+progress.blueprints.length+"種類";
  root.append(summary);
  const cols=document.createElement("div");cols.className="world-record-columns";
  const ach=document.createElement("section");ach.className="world-record-panel";ach.innerHTML="<h4>✦ 達成実績</h4>";
  achievementList.forEach(item=>{
   const ok=item.test(progress),el=document.createElement("div");
   el.className="world-achievement"+(ok?" completed":"");
   el.innerHTML='<span class="ach-icon">'+(ok?item.icon:"◇")+'</span><div><b>'+item.title+'</b><small>'+item.desc+'</small></div><strong>'+(ok?"CLEAR":"LOCKED")+'</strong>';
   ach.append(el);
  });
  const collection=document.createElement("section");collection.className="world-record-panel";collection.innerHTML="<h4>▣ 設計図コレクション</h4>";
  stages.forEach(s=>{
   const ok=progress.blueprints.includes(s.blueprint),el=document.createElement("div");el.className="world-collection-item"+(ok?" collected":"");
   el.innerHTML='<span>'+(ok?"◈":"◇")+'</span><div><b>'+(ok?s.blueprint:"？？？ 未発見")+'</b><small>'+s.name+'</small></div>';
   collection.append(el);
  });
  cols.append(ach,collection);root.append(cols);
 }
}
function setTab(t){
 tab=t;
 document.querySelectorAll("[data-world-tab]").forEach(b=>b.classList.toggle("active",b.dataset.worldTab===t));
 $("worldMapView").hidden=t!=="map";$("worldExtraView").hidden=t==="map";
 if(t!=="map")renderExtra();
}
function open(id){
 selected=data.byId[id]?id:nextStage();renderMap();setTab("map");
 document.querySelectorAll(".overlay").forEach(el=>el.classList.toggle("is-visible",el.id==="worldOverlay"));
 const s=data.byId[selected],sc=$("worldMapScroll");
 sc.scrollLeft=Math.max(0,s.x-sc.clientWidth*.45);sc.scrollTop=Math.max(0,s.y-sc.clientHeight*.48);
}
function close(){
 $("worldOverlay").classList.remove("is-visible");
 $("welcomeOverlay").classList.add("is-visible");
}
function start(id){
 const s=data.byId[id];if(!s || !openStage(s))return;
 window.dispatchEvent(new CustomEvent("rogue-world-play",{detail:{stageId:s.id}}));
}
function masteryAdd(me,s){
 const gains={drill:me.stats.ore||0,furnace:me.stats.metal||0,ammo:me.stats.ammo||0,
  belt:Math.floor(((me.stats.ore||0)+(me.stats.metal||0))/3),turret:Math.floor((me.stats.damage||0)/5),
  rocket:0,generator:Math.floor(s.elapsed/12),wall:0,shield:0,repair:0};
 (me.board||[]).forEach(m=>{if(m && ["rocket","wall","shield","repair"].includes(m.type))gains[m.type]+=5;});
 for(const [type,xp] of Object.entries(gains))progress.mastery[type]=(progress.mastery[type]||0)+Math.max(0,Math.floor(xp));
}
function onFinish(s,index){
 if(s.mode!=="world" || !data.byId[s.stageId] || progress.lastMatchId===s.id)return null;
 const stage=data.byId[s.stageId],me=s.players[index],won=s.winner===me.id,best=progress.cleared[s.stageId];
 const star=won?(me.coreHp/me.maxCoreHp>=.85?3:me.coreHp/me.maxCoreHp>=.5?2:1):0;
 const first=won&&!best,xp=won?Math.round(stage.xp*(first?1:.5)):Math.ceil(stage.xp*.15);
 const credits=won?Math.round(stage.credits*(first?1:.5)):0;
 progress.xp+=xp;progress.credits+=credits;progress.runs++;if(won)progress.wins++;
 let daily=0;
 const date=new Date().toLocaleDateString("sv-SE");
 if(won&&progress.daily!==date){progress.daily=date;progress.xp+=80;progress.credits+=50;daily=50;}
 if(won){
  progress.cleared[stage.id]={stars:Math.max(star,best?.stars||0),clears:(best?.clears||0)+1,
    bestTime:Math.min(best?.bestTime||Infinity,Math.round(s.elapsed))};
  if(first&&!progress.blueprints.includes(stage.blueprint))progress.blueprints.push(stage.blueprint);
 }
 masteryAdd(me,s);progress.lastMatchId=s.id;save();renderMap();
 return {won,stage:stage.name,xp,credits,stars:star,daily,blueprint:first?stage.blueprint:null,next:stages.filter(t=>t.requires.includes(stage.id)&&openStage(t)).map(t=>t.name)};
}
function tutorialUpdate(s,index){
 const active=s.mode==="world" && s.stageId==="tutorial" && !s.ended;
 if(!active){$("tutorialGuide").hidden=true;$("tutorialShowBtn").hidden=true;
  document.querySelectorAll(".tutorial-target").forEach(el=>el.classList.remove("tutorial-target"));guidedStep=-1;return;}
 const board=s.players[index].board,steps=data.tutorials;
 let next=0;
 while(next<5){
  const p=steps[next];if(board[p.y*12+p.x]?.type!==p.type)break;next++;
 }
 const current=steps[Math.min(5,next)];
 if(guidedStep!==next){
  guidedStep=next;
  if(next<5)window.dispatchEvent(new CustomEvent("rogue-select-tool",{detail:{type:current.type}}));
 }
 text("tutorialTitle",current.title);text("tutorialText",current.description);text("tutorialHint",current.hint);
 $("tutorialDots").replaceChildren();
 for(let i=0;i<steps.length;i++){
  const dot=document.createElement("i");dot.className=i<next?"completed":i===next?"current":"";
  $("tutorialDots").append(dot);
 }
 document.querySelectorAll(".tutorial-target").forEach(el=>el.classList.remove("tutorial-target"));
 if(next<5){
  const tile=$("myGrid").children[current.y*12+current.x];tile?.classList.add("tutorial-target");
 }
 $("tutorialGuide").hidden=hideGuide;$("tutorialShowBtn").hidden=!hideGuide;
}
$("worldBtn").onclick=()=>open();
$("mapOpenBtn").onclick=()=>{if(!document.body.classList.contains("playing"))open();};
$("worldCloseBtn").onclick=close;
$("worldStartBtn").onclick=()=>start(selected);
$("tutorialBtn").onclick=()=>start("tutorial");
$("resultToMapBtn").onclick=()=>open(nextStage());
$("tutorialHideBtn").onclick=()=>{hideGuide=true;$("tutorialGuide").hidden=true;$("tutorialShowBtn").hidden=false;};
$("tutorialShowBtn").onclick=()=>{hideGuide=false;$("tutorialGuide").hidden=false;$("tutorialShowBtn").hidden=true;};
document.querySelectorAll("[data-world-tab]").forEach(b=>b.onclick=()=>setTab(b.dataset.worldTab));
window.RogueWorld={open,start,onFinish,tutorialUpdate,nextStage,get progress(){return progress;}};
})();
