"use strict";
(()=>{
const $=id=>document.getElementById(id),FX=window.FactoryFX,SIZE=12,CORE_IDX=10*SIZE+5;
const icons={core:"◆",generator:"ϟ",drill:"⛏",belt:"➜",furnace:"♨",ammo:"⚙",turret:"✹",rocket:"➤",wall:"▦",shield:"◈",repair:"✚",tankPlant:"▣"};
const desc={generator:"発電機：工場に電力を供給。",drill:"採掘機：鉱石を掘り、矢印の方向へ出力。",belt:"コンベア：アイテムを隣の設備へ輸送。",furnace:"精錬機：鉱石から金属を作成。",ammo:"弾薬工場：金属から弾薬を製造。",turret:"機関砲：弾薬を使い敵を撃つ。",rocket:"ミサイル：弾薬を2つ消費し大ダメージ。",wall:"装甲壁：敵のミサイルから工場を守る。",shield:"シールド：コアへのダメージを軽減。",repair:"修復機：金属を消費して設備を修理。",tankPlant:"戦車工場：恒久基地の製造設備。兵器は基地メニューで製造。"};
const order=["generator","drill","belt","furnace","ammo","turret","rocket","wall","shield","repair","tankPlant"];
let ws=null,defs={},upgradeDefs=[],state=null,meIndex=0,selection="drill",selectedCell=null,mode=null,playing=false,lastUpgrade="",toastTimer,retryTimer;
$("playerName").value=localStorage.getItem("rf-name")||"ENGINEER";
const stored=localStorage.getItem("rf-effects")||FX.quality;
$("quality").value=stored;FX.setQuality(stored);
$("quality").onchange=e=>{FX.setQuality(e.target.value);localStorage.setItem("rf-effects",e.target.value);};
$("audioToggle").onclick=()=>{
 const el=$("audioToggle"),enabled=FX.setAudio(!el.classList.contains("is-on"));
 el.classList.toggle("is-on",enabled);el.querySelector("span").textContent=enabled?"ON":"OFF";
};
function notify(message){
 const el=$("toast");el.textContent=message;el.classList.add("visible");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("visible"),2300);
}
function overlay(id){document.querySelectorAll(".overlay").forEach(el=>el.classList.toggle("is-visible",el.id===id));}
function send(msg){if(ws?.readyState!==WebSocket.OPEN){notify("サーバーへ接続できません");return false;}ws.send(JSON.stringify(msg));return true;}
function connect(){
 if(ws&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING))return;
 ws=new WebSocket((location.protocol==="https:"?"wss:":"ws:")+"//"+location.host);
 $("connectionLabel").textContent="CONNECTING";
 ws.onopen=()=>{$("connectionLabel").textContent="ONLINE";$("connectionLight").classList.add("online");clearTimeout(retryTimer);window.RogueHQ?.onConnected(send);window.IndustrialWorld?.onConnected(send);};
 ws.onclose=()=>{
  $("connectionLabel").textContent="OFFLINE";$("connectionLight").classList.remove("online");
  playing=false;state=null;mode=null;document.body.classList.remove("playing");window.RogueHQ?.onDisconnected();window.IndustrialWorld?.onDisconnected();overlay("welcomeOverlay");
  retryTimer=setTimeout(connect,2200);
 };
 ws.onerror=()=>{$("connectionLabel").textContent="ERROR";};
 ws.onmessage=e=>{
  let msg;try{msg=JSON.parse(e.data)}catch{return}
  if(msg.type?.startsWith("home:")){window.RogueHQ?.receive(msg);return;}
  if(msg.type?.startsWith("industry:")){window.IndustrialWorld?.receive(msg);return;}
  if(msg.type==="start"){
   defs=msg.definitions;upgradeDefs=msg.upgrades;meIndex=msg.playerIndex;state=null;playing=true;mode=null;
   lastUpgrade="";document.body.classList.add("playing");makeTools();overlay(null);notify("対戦開始！工場を建設しよう");
  }else if(msg.type==="waiting")overlay("queueOverlay");
  else if(msg.type==="cancelled"){mode=null;overlay("welcomeOverlay")}
  else if(msg.type==="state")receive(msg.state);
  else if(msg.type==="error")notify(msg.message||"操作できません");
  else if(msg.type==="ack"&&(msg.action==="build"||msg.action==="dismantle")){
   const tile=getCell("myGrid",Number(msg.y)*8+Number(msg.x));FX.float(tile,msg.action==="build"?"BUILT":"RECYCLED");
  }
 };
}
function join(nextMode,stageId){
 const name=$("playerName").value.trim().slice(0,20)||"ENGINEER";
 localStorage.setItem("rf-name",name);mode=nextMode;
 if(send({type:"join",name,mode:nextMode,stageId})){overlay("queueOverlay");$("gameModeLabel").textContent=nextMode==="world"?"WORLD / FACTORY DEFENSE":nextMode==="solo"?"DEFENSE / FREE PLAY":"PVP / 3 MINUTE BUILD PHASE";}
}
$("soloBtn").onclick=()=>join("solo");
$("pvpBtn").onclick=()=>join("pvp");
window.addEventListener("rogue-world-play",e=>join("world",e.detail?.stageId));
window.addEventListener("rogue-select-tool",e=>{if(e.detail?.type)selectTool(e.detail.type);});
$("cancelQueueBtn").onclick=()=>{send({type:"cancel"});mode=null;overlay("welcomeOverlay");};
$("rematchBtn").onclick=()=>{state=null;playing=false;document.body.classList.remove("playing");overlay("welcomeOverlay");};
const getCell=(id,i)=>$(id).children[i]||null;
function makeGrid(id,isMine){
 const grid=$(id);grid.replaceChildren();
 for(let i=0;i<SIZE*SIZE;i++){
  const el=document.createElement("button");el.className="tile";el.type="button";el.dataset.i=i;el.dataset.x=i%SIZE;el.dataset.y=Math.floor(i/SIZE);
  el.disabled=!isMine;el.setAttribute("role","gridcell");el.setAttribute("aria-label","空きマス");
  grid.append(el);
 }
}
makeGrid("myGrid",true);makeGrid("enemyGrid",false);
function makeTools(){
 const root=$("toolGrid");root.replaceChildren();
 order.forEach(type=>{
  const d=defs[type];if(!d)return;
  const b=document.createElement("button");b.className="tool";b.type="button";b.dataset.type=type;
  b.innerHTML='<span class="tool-icon">'+icons[type]+'</span><span>'+d.name+'</span><strong>◆ '+d.cost+'</strong>';
  b.onclick=()=>selectTool(type);root.append(b);
 });
 selectTool(selection);
}
function selectTool(type){
 selection=type;
 for(const b of $("toolGrid").children)b.classList.toggle("selected",b.dataset.type===type);
 $("toolDesc").textContent=desc[type]||"";
 $("selectionHint").textContent=type?"選択中："+(defs[type]?.name||type):"設備を選択してください";
}
function chooseCell(tile){
 if(selectedCell)selectedCell.classList.remove("selected-tile");
 selectedCell=tile;if(tile)tile.classList.add("selected-tile");
}
$("myGrid").onclick=e=>{
 if(!playing||!state)return;
 const tile=e.target.closest(".tile");if(!tile)return;
 chooseCell(tile);
 const n=Number(tile.dataset.i),m=state.players[meIndex].board[n];
 if(!m&&selection)send({type:"build",machine:selection,x:Number(tile.dataset.x),y:Number(tile.dataset.y),dir:1});
 else if(m)notify((defs[m.type]?.name||m.type)+" / HP "+Math.ceil(m.hp)+" / 材料 "+m.buf);
};
$("myGrid").oncontextmenu=e=>{
 e.preventDefault();const tile=e.target.closest(".tile");
 if(playing&&tile){chooseCell(tile);send({type:"rotate",x:Number(tile.dataset.x),y:Number(tile.dataset.y)});}
};
function tileCommand(type){
 if(!playing||!selectedCell){notify("設備を選択してください");return;}
 send({type,x:Number(selectedCell.dataset.x),y:Number(selectedCell.dataset.y)});
}
$("rotateBtn").onclick=()=>tileCommand("rotate");
$("deleteBtn").onclick=()=>tileCommand("dismantle");
$("cancelToolBtn").onclick=()=>{chooseCell(null);selectTool(null);};
$("targetSelector").onclick=e=>{
 const btn=e.target.closest("button[data-target]");if(!btn)return;
 send({type:"focus",target:btn.dataset.target});
 $("targetCore").classList.toggle("active",btn.dataset.target==="core");
 $("targetProduction").classList.toggle("active",btn.dataset.target==="production");
};
document.addEventListener("keydown",e=>{
 if(["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName))return;
 if(e.key==="Escape")$("cancelToolBtn").click();
 else if(e.key.toLowerCase()==="r")tileCommand("rotate");
 else if(e.key==="Delete"||e.key==="Backspace")tileCommand("dismantle");
 else if(/^[0-9]$/.test(e.key)&&playing)selectTool(order[e.key==="0"?9:Number(e.key)-1]);
});
function renderGrid(board,id,deposits=[]){
 if(!Array.isArray(board))return;
 for(let i=0;i<SIZE*SIZE;i++){
  const m=board[i],el=getCell(id,i),type=m?.type||"",rotation=m?.dir??0;
  if(el.dataset.type!==type||el.dataset.dir!==String(rotation)){
   el.dataset.type=type;el.dataset.dir=String(rotation);el.replaceChildren();
   if(m){
    const glyph=document.createElement("span");glyph.className="machine-glyph";glyph.textContent=icons[type]||"?";
    if(["belt","turret","rocket"].includes(type))glyph.style.setProperty("--rotation",(rotation*90)+"deg");
    el.append(glyph);
    const hp=document.createElement("i");hp.className="health-indicator";el.append(hp);
    const cargo=document.createElement("i");cargo.className="cargo-dot";el.append(cargo);
   }
  }
  el.classList.toggle("occupied",!!m);el.classList.toggle("resource-node",deposits.includes(i));
  el.classList.toggle("machine-online",!!m&&m.active);el.classList.toggle("machine-offline",!!m&&!m.active);
  if(m){
   const bar=el.querySelector(".health-indicator");
   if(bar)bar.style.setProperty("--hp",(Math.max(0,Math.min(100,m.hp/(defs[type]?.hp||400)*100)))+"%");
   const cargo=el.querySelector(".cargo-dot");if(cargo)cargo.hidden=!(m.buf||m.output||m.cargo);
   el.setAttribute("aria-label",(defs[type]?.name||type)+" HP "+Math.ceil(m.hp));
  }else el.setAttribute("aria-label","空きマス");
 }
}
function setText(id,value){if($(id).textContent!==String(value))$(id).textContent=String(value);}
function showUpgrades(ids){
 $("upgradeChoices").replaceChildren();
 ids.forEach(id=>{
  const u=upgradeDefs.find(e=>e.id===id);if(!u)return;
  const btn=document.createElement("button");btn.type="button";btn.className="upgrade-card";btn.dataset.rarity=u.rarity;
  btn.innerHTML='<span class="up-rarity">'+u.rarity+'</span><span class="up-icon">'+u.icon+'</span><strong>'+u.name+'</strong><small>'+u.description+'</small>';
  btn.onclick=()=>{send({type:"choose",id});FX.burst(btn,"energy");overlay(null);notify("研究："+u.name);};
  $("upgradeChoices").append(btn);
 });
 overlay("upgradeOverlay");
}
function updateUI(s){
 const me=s.players[meIndex],op=s.players[1-meIndex];
 renderGrid(me.board,"myGrid",me.deposits||[]);renderGrid(op.board,"enemyGrid",op.deposits||[]);
 $("battleLayout").classList.toggle("defense-mode",s.mode!=="pvp");
 $("phaseBanner").classList.toggle("battle-phase",s.phase==="battle");
 if(s.mode==="pvp"){
   const building=s.phase==="build";
   const remain=Math.ceil(Math.max(0,building?s.buildTime-s.elapsed:s.length-s.elapsed));
   setText("phaseLabel",building?"⚙ 建設フェーズ：敵からの攻撃なし / 工場を完成させよう":"⚔ PVP戦闘フェーズ：建設不可 / 工場同士が交戦中");
   setText("phaseClock",String(Math.floor(remain/60)).padStart(2,"0")+":"+String(remain%60).padStart(2,"0"));
 }else{
   setText("phaseLabel","⚠ 工場防衛：製造した弾薬で敵ウェーブを迎撃しよう");
   setText("phaseClock","WAVE "+s.wave+" / "+s.maxWaves);
   renderWave(s);
 }
 $("deleteBtn").disabled=$("rotateBtn").disabled=s.phase==="battle";
 setText("myName",me.name);setText("enemyName",op.name);
 setText("myHp",Math.ceil(me.coreHp)+" / "+me.maxCoreHp);setText("enemyHp",Math.ceil(op.coreHp)+" / "+op.maxCoreHp);
 $("myHpBar").style.width=(100*Math.max(0,me.coreHp/me.maxCoreHp))+"%";
 $("enemyHpBar").style.width=(100*Math.max(0,op.coreHp/op.maxCoreHp))+"%";
 setText("myPower",me.powerUsed+" / "+me.powerTotal);setText("enemyPower",op.powerUsed+" / "+op.powerTotal);
 setText("myScrap",me.scrap);setText("enemyScrap",op.scrap);
 setText("myDamage",Math.round(me.stats.damage));setText("enemyDamage",Math.round(op.stats.damage));
 setText("oreStat",me.stats.ore);setText("metalStat",me.stats.metal);setText("ammoStat",me.stats.ammo);
 setText("powerLoad",me.powerTotal?Math.round(100*me.powerUsed/me.powerTotal)+"%":"OFFLINE");
 setText("combatEvent",s.event||"AUTO FIRE");
 const left=Math.ceil(Math.max(0,s.length-s.elapsed));
 setText("timer",String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0"));
 $("timer").classList.toggle("critical",left<=30);$("timeProgress").style.width=(100*left/s.length)+"%";
 for(const b of $("toolGrid").children)b.style.opacity=s.phase!=="battle"&&me.scrap>=(defs[b.dataset.type]?.cost||0)?"1":".45";
 $("targetCore").classList.toggle("active",me.focus==="core");
 $("targetProduction").classList.toggle("active",me.focus==="production");
 if(me.options?.length&&!s.ended){
  const key=s.id+":"+me.options.join(",");
  if(key!==lastUpgrade){lastUpgrade=key;showUpgrades(me.options);}
 }else if($("upgradeOverlay").classList.contains("is-visible"))overlay(null);
}
function attackSource(board,id){
 const list=board.map((m,i)=>({m,i})).filter(o=>o.m&&["turret","rocket"].includes(o.m.type));
 const i=list.length?list[Math.floor(Math.random()*list.length)].i:CORE_IDX;
 return {tile:getCell(id,i),kind:board[i]?.type==="rocket"?"rocket":"bullet"};
}
function targetCell(oldP,newP,id){
 for(let i=0;i<SIZE*SIZE;i++){
  const old=oldP.board[i],next=newP.board[i];
  if(old&&old.type!=="core"&&(!next||next.hp<old.hp))return getCell(id,i);
 }
 return getCell(id,CORE_IDX);
}
function animateDiff(old,s){
 for(let k=0;k<2;k++){
  const before=old.players[k],after=s.players[k],id=k===meIndex?"myGrid":"enemyGrid";
  for(let i=0;i<64;i++){
   const a=before.board[i],b=after.board[i],tile=getCell(id,i);
   if(!a&&b)FX.burst(tile,"build",.55);
   else if(a&&!b)FX.burst(tile,"destroy",1);
   else if(a&&b&&b.hp<a.hp&&b.type!=="core"){
    tile.classList.remove("damaged");void tile.offsetWidth;tile.classList.add("damaged");
   }
  }
  const damage=after.stats.damage-before.stats.damage;
  if(damage>0){
   const source=attackSource(before.board,id);
   const dest=s.mode==="pvp"?targetCell(old.players[1-k],s.players[1-k],k===meIndex?"enemyGrid":"myGrid"):$("waveDisplay");
   if(source.tile&&dest){
    source.tile.classList.remove("shooting");void source.tile.offsetWidth;source.tile.classList.add("shooting");
    FX.shot(source.tile,dest,damage>=20?"rocket":source.kind,k===meIndex?"ally":"enemy",damage);
   }
  }
 }
 if(s.mode!=="pvp" && s.threatHits>old.threatHits){
   const delta=Math.min(12,s.threatHits-old.threatHits),target=getCell("myGrid",CORE_IDX);
   for(let i=0;i<delta;i++)FX.shot($("waveDisplay"),target,"rocket","enemy",8);
 }
}
function renderWave(s){
 setText("waveCount","WAVE "+s.wave+" / "+s.maxWaves);
 const left=s.wave===s.maxWaves?"最終ウェーブ":s.wave===0?"第1ウェーブ準備中":"次の襲撃へ備えよう";
 setText("waveDesc",left+"。設備を効率よくつないで弾薬と電力を切らさないようにしよう。");
 const enemyList=s.enemies||[],near=enemyList.length?Math.max(...enemyList.map(e=>e.progress)):0;
 $("waveDanger").style.width=Math.min(100,Math.max(0,near*100))+"%";
 const root=$("waveEnemies");root.replaceChildren();
 for(const e of enemyList.slice(0,24)){
   const cell=document.createElement("div");cell.className="wave-enemy"+(e.kind==="boss"?" boss":"");
   const symbol=document.createElement("span");symbol.textContent=e.kind==="boss"?"♛":e.kind==="armored"?"◈":"✹";
   const hp=document.createElement("i");hp.className="hp";hp.style.setProperty("--enemy-hp",Math.min(100,Math.max(0,e.hp/e.maxHp*100))+"%");
   const progress=document.createElement("i");progress.className="enemy-progress";progress.style.setProperty("--progress",Math.max(0,Math.min(100,e.progress*100))+"%");
   const label=document.createElement("small");label.textContent=Math.max(0,Math.round(e.hp))+" HP";
   cell.append(symbol,hp,progress,label);root.append(cell);
 }
 setText("waveNext",enemyList.length?enemyList.length+" 機が接近中":s.wave===s.maxWaves?"すべて撃退するとクリア":"敵の襲撃に備えよう");
}
function finish(s){
 playing=false;document.body.classList.remove("playing");
 const me=s.players[meIndex],win=s.winner===me.id,draw=s.winner==="draw";
 const rewards=window.RogueWorld?.onFinish(s,meIndex);
 $("resultOverlay").querySelector(".modal").classList.toggle("is-loss",!win);
 setText("resultSymbol",win?"✦":draw?"◇":"✕");setText("resultTitle",win?"VICTORY":draw?"DRAW":"DEFEAT");
 setText("resultDetail",win?(s.mode==="pvp"?"敵工場を制圧しました！":"敵のウェーブをすべて撃退し工場を守り抜いた！"):draw?"両者互角の工業戦でした。":"工場の防衛に失敗しました。生産ラインを再設計しよう。");
 setText("resultDamage",Math.round(me.stats.damage));setText("resultOre",me.stats.ore);
 const worldRewards=$("worldReward"),returnBtn=$("resultToMapBtn");
 worldRewards.hidden=!rewards;returnBtn.hidden=!rewards;
 if(rewards){
   worldRewards.replaceChildren();
   const lines=[rewards.won?"防衛成功："+rewards.stage+" / "+("★".repeat(rewards.stars)):"防衛失敗："+rewards.stage,
     "獲得経験値 +"+rewards.xp+" XP / クレジット ◆"+rewards.credits];
   if(rewards.blueprint)lines.push("新設計図："+rewards.blueprint);
   if(rewards.daily)lines.push("デイリーボーナス：◆"+rewards.daily);
   if(rewards.next?.length)lines.push("新しいエリア解放："+rewards.next.join("、"));
   lines.forEach(line=>{const div=document.createElement("div");div.textContent=line;worldRewards.append(div);});
 }
 overlay("resultOverlay");if(win)FX.victory();
}
function receive(s){
 if(!s?.players||s.players.length!==2)return;
 const old=state;state=s;updateUI(s);window.RogueWorld?.tutorialUpdate(s,meIndex);
 if(old&&old.id===s.id)animateDiff(old,s);
 if(s.ended&&!old?.ended)finish(s);
}
connect();
})();
