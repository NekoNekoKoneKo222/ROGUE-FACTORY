"use strict";
(function(){
const $=id=>document.getElementById(id),FX=window.FactoryFX;
const KEY="rogue-factory-base-token-v1",SIZE=12;
let send=null,base=null,types={},units={},oreSites=new Set(),selectedType="tankPlant",selectedTile=null;
let accountId=null,name="ENGINEER",targets=[],history=[],pendingOpen=false,connected=false,tab="army",lastRefresh=0;
const token=()=>{try{return localStorage.getItem(KEY)}catch{return null}};
const saveToken=value=>{try{localStorage.setItem(KEY,value)}catch{}};
function notify(message){
 const el=$("toast");el.textContent=message;el.classList.add("visible");
 clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>el.classList.remove("visible"),3300);
}
function visible(){return $("hqOverlay").classList.contains("is-visible");}
function command(type,extra={}){
 if(!send || !connected){notify("サーバーに接続中です");return false;}
 return send({type,...extra});
}
function login(){
 const given=$("playerName").value.slice(0,20).trim()||"ENGINEER";
 if(!connected){pendingOpen=true;notify("サーバーへ接続中です");return;}
 command("home:login",{token:token()||undefined,name:given});
}
function open(){
 pendingOpen=true;
 if(!base){login();return;}
 pendingOpen=false;
 document.querySelectorAll(".overlay").forEach(el=>el.classList.toggle("is-visible",el.id==="hqOverlay"));
 showTab(tab);render();
 loadState();
}
function close(){
 $("hqOverlay").classList.remove("is-visible");
 $("welcomeOverlay").classList.add("is-visible");
}
function onConnected(sendFunction){
 send=sendFunction;connected=true;
 if(token())login();
 else if(pendingOpen)login();
}
function onDisconnected(){
 connected=false;
}
function receive(msg){
 if(msg.type==="home:welcome"){
  if(msg.token)saveToken(msg.token);
  accountId=msg.id;name=msg.name;base=msg.base;
  types=msg.buildings||{};units=msg.units||{};
  oreSites=new Set(msg.oreSites||[]);
  prepareGrid();preparePalette();render();
  if(pendingOpen || !document.body.classList.contains("playing"))open();
  return true;
 }
 if(msg.type==="home:state"){
  if(msg.base)base=msg.base;
  if(Array.isArray(msg.targets))targets=msg.targets;
  if(Array.isArray(msg.history))history=msg.history;
  render();
  return true;
 }
 if(msg.type==="home:error"){
  if(msg.message?.includes("認証情報")){
   // The original token may have been cleared on the provider side.
   // Never automatically silently create a different account.
   notify("保存済み基地の認証に失敗しました。データを確認してください。");
  }else notify(msg.message||"基地の操作に失敗しました");
  return true;
 }
 if(msg.type==="home:raid-result"){
  const result=msg.result;
  const div=$("hqRaidResult");div.hidden=false;div.replaceChildren();
  const label=document.createElement("strong");label.textContent=result.victory?"襲撃成功！":"防衛側が撃退しました";
  const body=document.createElement("p");body.textContent=result.defenderName+" / 攻撃 "+result.attack+"・防衛 "+result.defense+
    " / 損失 "+result.casualties+"台 / 獲得スクラップ "+result.loot;
  div.append(label,body);
  notify(result.victory?"襲撃成功！戦利品を獲得":"攻撃は撃退されました");
  FX?.burst(div,result.victory?"energy":"impact",1.2);
  return true;
 }
 if(msg.type==="home:raided"){
  notify("⚠ "+msg.attackerName+" が基地を襲撃しました！戦報を確認してください");
  if(base)loadState();
  return true;
 }
 return false;
}
function loadState(){
 if(!connected||!accountId)return;
 command("home:load");
 lastRefresh=Date.now();
}
function sendAction(action,extra={}){
 if(!accountId){notify("基地にログインしてください");return;}
 command("home:action",{action,...extra});
}
function selectedPosition(){
 if(!selectedTile)return null;
 return {x:Number(selectedTile.dataset.x),y:Number(selectedTile.dataset.y)};
}
function prepareGrid(){
 const root=$("hqGrid");root.replaceChildren();
 for(let i=0;i<SIZE*SIZE;i++){
  const el=document.createElement("button");
  el.className="tile";el.type="button";el.dataset.i=i;el.dataset.x=i%SIZE;el.dataset.y=Math.floor(i/SIZE);
  el.setAttribute("role","gridcell");el.setAttribute("aria-label","空きマス");
  el.onclick=()=>{
   selectedTile=el;
   const item=base?.board[i];
   if(!item && selectedType){
    sendAction("place",{machine:selectedType,x:Number(el.dataset.x),y:Number(el.dataset.y),dir:1});
    FX?.burst(el,"build",.35);
   }else if(item){
    notify((types[item.type]?.name||"HQ")+" / Lv."+item.level+" / HP"+Math.ceil(item.hp));
   }
   drawGrid();
  };
  el.oncontextmenu=e=>{
   e.preventDefault();selectedTile=el;
   const pos=selectedPosition();if(pos)sendAction("rotate",pos);
  };
  root.append(el);
 }
}
function preparePalette(){
 const root=$("hqPalette");root.replaceChildren();
 for(const [type,def] of Object.entries(types)){
  if(type==="core")continue;
  const b=document.createElement("button");b.type="button";b.className="hq-build-tool";b.dataset.type=type;
  b.innerHTML='<span>'+def.icon+'</span><small>'+def.name+'</small><b>◆ '+def.price+'</b>';
  b.onclick=()=>{selectedType=type;selectedTile=null;renderPalette();
   $("hqSelected").textContent=def.name+"を選択中 — 空きマスをタップして建設 (◆"+def.price+")";};
  root.append(b);
 }
 renderPalette();
}
function renderPalette(){
 for(const b of $("hqPalette").children){
  b.classList.toggle("active",b.dataset.type===selectedType);
  b.classList.toggle("poor",!!base&&base.resources.scrap<(types[b.dataset.type]?.price||0));
 }
}
function drawGrid(){
 if(!base)return;
 for(let i=0;i<144;i++){
  const m=base.board[i],tile=$("hqGrid").children[i];if(!tile)continue;
  const type=m?.type||"",dir=m?.dir||0;
  if(tile.dataset.type!==type||tile.dataset.dir!==String(dir)){
   tile.dataset.type=type;tile.dataset.dir=String(dir);tile.replaceChildren();
   if(m){
    const glyph=document.createElement("span");glyph.className="machine-glyph";
    glyph.textContent=types[type]?.icon||"◆";
    glyph.style.setProperty("--rotation",["belt","turret","rocket"].includes(type)?dir*90+"deg":"0deg");
    tile.append(glyph);
   }
  }
  tile.classList.toggle("occupied",!!m);
  tile.classList.toggle("resource-node",oreSites.has(i));
  tile.classList.toggle("hq-selected-tile",selectedTile===tile);
  tile.setAttribute("aria-label",m?(types[type]?.name||type)+" Lv"+m.level:"空きマス");
 }
}
function num(n){return Math.floor(Number(n)||0).toLocaleString("ja-JP");}
function render(){
 if(!base)return;
 $("hqPlayer").textContent=name;
 $("hqScrap").textContent=num(base.resources.scrap);
 $("hqOre").textContent=num(base.resources.ore);
 $("hqMetal").textContent=num(base.resources.metal);
 $("hqAmmo").textContent=num(base.resources.ammo);
 $("hqTanks").textContent=num(base.army.tank);
 $("hqArtillery").textContent=num(base.army.artillery);
 $("hqHealth").textContent=Math.ceil(base.hp)+" / "+base.maxHp;
 $("hqHealthBar").style.width=Math.max(0,100*base.hp/base.maxHp)+"%";
 $("hqSelected").textContent=selectedTile?.dataset.type?
   (types[selectedTile.dataset.type]?.name||"設備")+" / マス "+(Number(selectedTile.dataset.x)+1)+","+(Number(selectedTile.dataset.y)+1):
   "設備を選択して空きマスへ配置。鉱脈は金色で表示されます。";
 const count={ore:0,metal:0,ammo:0};
 // The server calculates actual conveyor connectivity and offline production.
 // Display only estimates until the next server sync.
 for(const m of base.board)if(m){
  if(m.type==="drill")count.ore++;
  if(m.type==="furnace")count.metal++;
  if(m.type==="ammo")count.ammo++;
 }
 $("hqProduction").textContent="⚙ 設備 "+base.board.filter(Boolean).length+"基　⛏ 採掘機 "+count.ore+
 "　♨ 精錬機 "+count.metal+"　▣ 弾薬工場 "+count.ammo+
 "　│　接続された設備が自動的に資源を生産します。";
 drawGrid();renderPalette();renderArmy();renderTargets();renderHistory();
}
function renderArmy(){
 if(!base)return;
 const q=$("hqQueue");q.replaceChildren();
 if(!base.queue.length){q.textContent="生産予約はありません。";return;}
 for(const item of base.queue){
  const div=document.createElement("div");div.className="hq-queue-item";
  div.textContent=(units[item.type]?.name||item.type)+" ×"+item.count+" / 完成まで "+Math.max(0,Math.ceil((item.readyAt-Date.now())/1000))+"秒";
  q.append(div);
 }
}
function renderTargets(){
 const root=$("hqTargets");root.replaceChildren();
 if(!targets.length){root.textContent="他の基地が見つかりません。別のプレイヤーが基地を開設すると表示されます。";return;}
 for(const target of targets){
  const row=document.createElement("div");row.className="hq-target-row";
  const text=document.createElement("div");
  const n=document.createElement("b");n.textContent=target.name;
  const stats=document.createElement("small");stats.textContent="Lv."+target.level+" / 防衛力 "+target.defense+" / 戦績 "+target.trophies;
  text.append(n,stats);
  const button=document.createElement("button");button.type="button";button.textContent="襲撃";
  button.onclick=()=>{
   const unit=$("hqRaidUnit").value,count=Number($("hqRaidCount").value);
   if((base?.army[unit]||0)<count){notify("出撃部隊が足りません");return;}
   command("home:raid",{targetId:target.id,unit,count});
  };
  row.append(text,button);root.append(row);
 }
}
function renderHistory(){
 const root=$("hqHistory");root.replaceChildren();
 if(!history.length){root.textContent="まだ戦闘履歴はありません。";return;}
 for(const match of history){
  const div=document.createElement("div");div.className="hq-history-row";
  const label=match.role==="attacker"?"出撃":"被襲撃";
  const win=match.role==="attacker"?match.victory:!match.victory;
  const title=document.createElement("b");title.textContent=(win?"防衛・攻撃成功":"戦闘敗北")+" / "+label;
  const d=document.createElement("small");d.textContent=match.other+"　戦利品 ◆"+match.loot+"　"+new Date(match.at).toLocaleString("ja-JP");
  div.append(title,d);root.append(div);
 }
 const t=base?.shieldUntil||0;
 $("hqShield").textContent=t>Date.now()?"あと "+Math.ceil((t-Date.now())/60000)+"分":"なし";
}
function showTab(next){
 tab=next;
 document.querySelectorAll("[data-hq-tab]").forEach(b=>b.classList.toggle("active",b.dataset.hqTab===next));
 for(const name of ["army","raid","log"])$("hq"+name[0].toUpperCase()+name.slice(1)+"Panel").hidden=next!==name;
 if(next==="raid"||next==="log")loadState();
}
$("hqStartBtn").onclick=open;
$("hqOpenBtn").onclick=()=>{if(!document.body.classList.contains("playing"))open();};
$("hqReturnBtn").onclick=close;
$("hqRotate").onclick=()=>{const p=selectedPosition();if(p)sendAction("rotate",p);else notify("設備を選択してください");};
$("hqUpgrade").onclick=()=>{const p=selectedPosition();if(p)sendAction("upgrade",p);else notify("設備を選択してください");};
$("hqDemolish").onclick=()=>{const p=selectedPosition();if(p)sendAction("demolish",p);else notify("設備を選択してください");};
$("hqRepair").onclick=()=>sendAction("repair");
$("hqBuildTank").onclick=()=>sendAction("train",{unit:"tank",count:1});
$("hqBuildArtillery").onclick=()=>sendAction("train",{unit:"artillery",count:1});
$("hqRefreshTargets").onclick=loadState;
document.querySelectorAll("[data-hq-tab]").forEach(b=>b.onclick=()=>showTab(b.dataset.hqTab));
$("hqToWorld").onclick=()=>{window.RogueWorld?.open(window.RogueWorld?.nextStage());};
$("hqToDefense").onclick=()=>{window.RogueWorld?.open(window.RogueWorld?.nextStage());};
setInterval(()=>{if(visible()&&accountId&&Date.now()-lastRefresh>15000)loadState();},15000);
window.RogueHQ={onConnected,onDisconnected,receive,open,close,get accountId(){return accountId;},get hasHome(){return !!base;}};
})();
