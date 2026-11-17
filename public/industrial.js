"use strict";
/* High-DPI renderer and controls for the permanent, procedural factory world. */
(()=>{
 const $=id=>document.getElementById(id),S=window.IndustrialShared,FX=window.FactoryFX;
 const canvas=$("iwCanvas"),ctx=canvas.getContext("2d",{alpha:false}),mini=$("iwMini"),mc=mini.getContext("2d");
 const root=$("industrialOverlay"),body=$("iwInfoBody");
 const CATEGORIES=[["all","すべて"],["mining","採掘"],["logistics","物流"],["craft","加工"],["energy","電力"],
  ["fluid","石油"],["research","研究"],["defense","防衛"],["military","兵器"],["base","開拓"]];
 const ITEM_LABELS={scrap:"スクラップ",ironOre:"鉄鉱石",copperOre:"銅鉱石",ironPlate:"鉄板",
  copperPlate:"銅板",coal:"石炭",stone:"石",brick:"レンガ",gear:"歯車",circuit:"電子回路",
  ammoPack:"弾薬",sciencePack:"研究パック",fuel:"燃料",plastic:"プラスチック",sulfur:"硫黄",
  crude:"原油",explosive:"爆薬",tank:"戦車"};
 const ITEM_ICONS={scrap:"◆",ironPlate:"▤",copperPlate:"▥",coal:"●",stone:"◈",gear:"⚙",
  circuit:"⌘",ammoPack:"▣",sciencePack:"⌬",fuel:"◉",tank:"▰",ironOre:"⛏",plastic:"◉"};
 let transport=null,connected=false,wantsOpen=false,loading=false,ready=false,state=null;
 let defs={},costs={},recipes={},techs={},category="all",tool="drill",mode="build",dir=1,tab="overview";
 let selected=null,hover=null,camera={x:-2,y:-1},zoom=1,dpr=1,CW=800,CH=600;
 let mouse=null,moved=false,activePointers=new Map(),lastFrame=0,frames=0,lastMini=0,lastShot=0;
 let fxParticles=[],terrainCache=new Map(),lastPoll=0;
 const mobile=()=>window.matchMedia("(max-width:700px)").matches;
 const safe=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const num=n=>Math.floor(Number(n)||0).toLocaleString("ja-JP");
 const entries=()=>state?Object.values(state.entities||{}):[];
 const connectedTo=()=>window.RogueHQ?.hasHome && connected;
 function notice(message){
   $("iwStatusBanner").textContent=message;
   $("iwSaveStatus").textContent="NEON / "+message.slice(0,24);
 }
 function send(type,fields={}){
   if(!transport || !connected){notice("サーバーへ接続していません");return false;}
   return transport({type,...fields});
 }
 function visible(){return root.classList.contains("is-visible");}
 function onConnected(sendFn){
   transport=sendFn;connected=true;
   if(wantsOpen && window.RogueHQ?.hasHome)open();
 }
 function onDisconnected(){
   connected=false;loading=false;
   notice("通信が切れました。再接続を待っています");
 }
 function onHomeReady(){if(wantsOpen)open();}
 function open(){
   wantsOpen=true;
   if(!window.RogueHQ?.hasHome){
     window.RogueHQ?.open();return;
   }
   if(!connected){notice("サーバーへ接続中...");return;}
   document.querySelectorAll(".overlay").forEach(el=>el.classList.toggle("is-visible",el.id==="industrialOverlay"));
   if(!ready && !loading){loading=true;send("industry:open");}
   else if(ready)send("industry:poll");
   resize();paintPanel();renderPalette();
 }
 function close(){
   wantsOpen=false;
   root.classList.remove("is-visible");
   $("welcomeOverlay").classList.add("is-visible");
 }
 function receive(msg){
   if(msg.type==="industry:welcome"){
     state=msg.state;defs=msg.defs||{};costs=msg.costs||{};recipes=msg.recipes||{};techs=msg.techs||{};
     ready=true;loading=false;
     renderPalette();updateInterface();
     if(wantsOpen){
       root.classList.add("is-visible");
       resize();
       if(!localStorage.getItem("rf-infinite-guide-v1"))showHelp();
     }
     notice("Neonに接続。永久工場を読み込みました。");
     return true;
   }
   if(msg.type==="industry:state"){
     const before=state;
     state=msg.state;loading=false;
     if(before&&msg.action==="build"){
       const c=Array.isArray(msg.coord)?msg.coord:null;
       if(c&&Number.isInteger(c[0])&&Number.isInteger(c[1])){
         const p=toScreen(c[0],c[1]);
         FX?.burst({x:p.x,y:p.y},"build",.6);
       }
     }
     if(before && state?.lastShot?.at && state.lastShot.at!==lastShot){
       const shot=state.lastShot;
       lastShot=shot.at;
       if(shot.from&&shot.to){
         const a=toScreen(shot.from[0],shot.from[1]),b=toScreen(shot.to[0],shot.to[1]);
         FX?.shot({x:a.x,y:a.y},{x:b.x,y:b.y},shot.kind==="laser"?"bullet":"rocket","ally",0);
       }
     }
     updateInterface();
     if(msg.action)notice(msg.notice||"建設データを保存しました");
     return true;
   }
   if(msg.type==="industry:error"){
     loading=false;notice(msg.message||"処理に失敗しました");
     FX?.shake?.(2);
     return true;
   }
   return false;
 }
 function updateInterface(){
   if(!state)return;
   const w=state,store=w.warehouse||{};
   $("iwInventory").replaceChildren();
   const shown=["scrap","ironPlate","copperPlate","coal","stone","gear","circuit","ammoPack","sciencePack","tank"];
   for(const item of shown){
     const tile=document.createElement("div");
     tile.className="iw-stock"+((store[item]||0)<10?" warn":"");
     tile.innerHTML='<span class="iw-icon">'+(ITEM_ICONS[item]||"▪")+'</span>'+
       '<div class="iw-stock-info"><small>'+ITEM_LABELS[item]+'</small><b>'+num(store[item]||0)+'</b></div>';
     $("iwInventory").append(tile);
   }
   $("iwPower").textContent=num(w.power?.used||0)+" / "+num(w.power?.supply||0)+" MW";
   $("iwEntityCount").textContent=num(w.machineCount||0)+" MACHINES";
   $("iwPollution").textContent=num(w.pollution||0);
   $("iwWave").textContent=(w.enemies?.length||0)>0?(w.enemies.length+" 敵接近"):"次の襲撃 "+w.waveIn+"秒";
   $("iwCoords").textContent="X "+Math.round(camera.x)+" / Y "+Math.round(camera.y);
   $("iwRadius").textContent="開拓済み：中心から±"+w.radius+"タイル";
   $("iwSciencePoints").textContent="研究 "+num(w.research?.points||0)+"pt";
   $("iwHostiles").textContent=(w.enemies?.length||0)+" 敵機械";
   $("iwExpandCost").textContent="◆"+(30+w.expansions*30)+" / 鉄"+(12+w.expansions*8);
   const log=$("iwEventLog");log.replaceChildren();
   for(const ev of (w.log||[]).slice(0,6)){
     const p=document.createElement("p");
     p.textContent=new Date(ev.at).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})+"　"+ev.message;
     log.append(p);
   }
   renderPalette();paintPanel();
   $("iwSaveStatus").textContent="NEON AUTOSAVE / 保存済み";
 }
 function makeCategories(){
   const container=$("iwCategories");container.replaceChildren();
   for(const [id,label] of CATEGORIES){
     const b=document.createElement("button");b.type="button";b.textContent=label;b.dataset.cat=id;
     b.onclick=()=>{category=id;makeCategories();renderPalette();};
     b.classList.toggle("active",category===id);
     container.append(b);
   }
 }
 function selectedTool(type){
   tool=type;mode="build";
   $("iwSelectionLabel").textContent="建設選択: "+(defs[type]?.name||type)+"　方向 "+["↑","→","↓","←"][dir];
   updateTools();renderPalette();
 }
 function updateTools(){
   $("iwToolCursor").classList.toggle("active",mode==="select");
   $("iwToolRotate").classList.toggle("active",mode==="rotate");
   $("iwToolErase").classList.toggle("active",mode==="erase");
 }
 function renderPalette(){
   if(!ready)return;
   const root=$("iwBuildList");root.replaceChildren();
   for(const [id,d] of Object.entries(defs)){
     if(id==="core"||(category!=="all"&&d.category!==category))continue;
     const locked=d.tech && !state.research.unlocked.includes(d.tech);
     const cost=costs[id]||{};
     const label=Object.entries(cost).map(([item,n])=>(ITEM_LABELS[item]||item)+" "+n).join(" / ");
     const b=document.createElement("button");b.type="button";
     b.className="iw-build-item"+(tool===id&&mode==="build"?" active":"")+(locked?" locked":"");
     b.innerHTML='<span class="iw-build-icon">'+safe(d.icon)+'</span><span class="iw-bitem-data"><b>'+
       safe(d.name)+'</b><small>'+safe(locked?"🔒 要研究 "+d.tech:label)+'</small></span>';
     b.onclick=()=>{if(locked){tab="research";switchTab("research");notice("研究が必要："+d.tech);}else selectedTool(id);};
     root.append(b);
   }
 }
 function switchTab(next){
   tab=next;
   document.querySelectorAll("[data-iw-tab]").forEach(b=>b.classList.toggle("active",b.dataset.iwTab===next));
   paintPanel();
 }
 function makeEl(html){const template=document.createElement("template");template.innerHTML=html;return template.content;}
 function paintPanel(){
   if(!state){body.innerHTML='<div class="iw-panel-title">ワールド接続待機中</div>';return;}
   const w=state,warehouse=w.warehouse||{},power=w.power||{};
   if(tab==="overview"){
     body.innerHTML='<h3 class="iw-panel-title">工場の稼働状況</h3><div class="iw-panel-sub">PRODUCTION / NETWORK</div>'+
       '<div class="iw-panel-box"><div class="iw-row"><span>総設備数</span><strong>'+num(w.machineCount)+'</strong></div>'+
       '<div class="iw-row"><span>電力供給</span><strong>'+num(power.supply||0)+' MW</strong></div>'+
       '<div class="iw-row"><span>消費電力</span><strong>'+num(power.used||0)+' MW</strong></div>'+
       '<div class="iw-progress"><i style="width:'+Math.min(100,Math.round((power.used||0)/Math.max(1,power.supply||0)*100))+'%"></i></div>'+
       '<div class="iw-row"><span>供給ネットワーク</span><strong>'+num(power.networks||0)+'</strong></div>'+
       '<div class="iw-row"><span>蓄電量</span><strong>'+num(power.stored||0)+' MJ</strong></div></div>'+
       '<div class="iw-panel-box"><div class="iw-row"><span>採掘済み鉱石</span><strong>'+num(w.stats?.mined)+'</strong></div>'+
       '<div class="iw-row"><span>採掘効率</span><strong>'+num(w.rates?.mined)+' / 分</strong></div>'+
       '<div class="iw-row"><span>製造した製品</span><strong>'+num(w.stats?.crafted)+'</strong></div>'+
       '<div class="iw-row"><span>製造効率</span><strong>'+num(w.rates?.crafted)+' / 分</strong></div>'+
       '<div class="iw-row"><span>倉庫に搬送</span><strong>'+num(w.stats?.shipped)+'</strong></div>'+
       '<div class="iw-row"><span>出荷効率</span><strong>'+num(w.rates?.shipped)+' / 分</strong></div>'+
       '<div class="iw-row"><span>防衛成功（撃破）</span><strong>'+num(w.stats?.kills)+'</strong></div></div>'+
       '<div class="iw-panel-box"><div class="iw-row"><span>領土半径</span><strong>'+num(w.radius)+' TILE</strong></div>'+
       '<div class="iw-row"><span>研究ポイント</span><strong>'+num(w.research?.points)+'</strong></div>'+
       '<div class="iw-row"><span>汚染量</span><strong>'+num(w.pollution)+'</strong></div>'+
       '</div><p class="iw-panel-desc">生産ラインの出口を「資源バンカー」に接続すると完成品が倉庫に入り、新しい工場や研究所を建設できます。</p>';
     return;
   }
   if(tab==="inspect"){
     if(!selected){
       body.innerHTML='<h3 class="iw-panel-title">設備を選択</h3>'+
         '<p class="iw-panel-desc">マップ上の設備をクリックすると、レシピや搬送量、HP、電力状態を確認できます。</p>';
       return;
     }
     const {x,y}=selected,entity=w.entities[S.key(x,y)],terrain=S.tileAt(w.seed,x,y);
     if(!entity){
       body.innerHTML='<h3 class="iw-panel-title">座標 '+x+', '+y+'</h3>'+
         '<div class="iw-panel-sub">'+safe(terrain.terrain.toUpperCase())+'</div>'+
         (terrain.ore?'<div class="iw-panel-box"><div class="iw-row"><span>資源</span><strong>'+
            safe(ITEM_LABELS[terrain.ore]||terrain.ore)+'</strong></div><div class="iw-row"><span>推定埋蔵量</span><strong>'+
            num(terrain.richness)+'</strong></div></div>':
            '<p class="iw-panel-desc">このマスには資源がありません。</p>')+
         '<p class="iw-panel-desc">建設可能範囲内の空きマスに設備を配置してください。</p>';
       return;
     }
     const d=defs[entity.type]||{name:entity.type,icon:"◇",hp:100};
     const inv=Object.entries(entity.input||{}).filter(([,n])=>n>0).map(([k,n])=>safe(ITEM_LABELS[k]||k)+" ×"+num(n)).join(" / ")||"空";
     const output=(entity.output||[]).length?entity.output.map(x=>safe(ITEM_LABELS[x]||x)).slice(0,5).join(", "):"空";
     let recipeHtml="";
     if(entity.type==="assembler"||entity.type==="tankPlant"){
       recipeHtml='<div class="iw-panel-sub">RECIPE / 製造レシピ</div><div class="iw-recipe-list">'+
         Object.entries(recipes).filter(([id])=>entity.type==="tankPlant"?id==="tank":id!=="tank")
           .map(([id,r])=>'<button data-recipe="'+safe(id)+'" class="'+(entity.recipe===id?"active":"")+'">'+safe(r.name)+
            '<span>'+r.seconds+'s</span></button>').join("")+'</div>';
     }
     body.innerHTML='<h3 class="iw-panel-title">'+safe(d.name)+'</h3>'+
       '<div class="iw-panel-sub">X '+x+' / Y '+y+' / LV.'+num(entity.level||1)+'</div>'+
       '<div class="iw-inspector-icon">'+safe(d.icon)+'</div>'+
       '<div class="iw-panel-box"><div class="iw-row"><span>耐久力</span><strong>'+num(entity.hp)+' / '+num(d.hp)+'</strong></div>'+
       '<div class="iw-progress danger"><i style="width:'+Math.max(0,Math.min(100,entity.hp/d.hp*100))+'%"></i></div>'+
       '<div class="iw-row"><span>電力</span><strong>'+(entity.online?"ONLINE":"OFFLINE")+'</strong></div>'+
       '<div class="iw-row"><span>出口方向</span><strong>'+["↑","→","↓","←"][entity.dir]+'</strong></div>'+
       '<div class="iw-row"><span>入力</span><strong>'+inv+'</strong></div>'+
       '<div class="iw-row"><span>出力</span><strong>'+output+'</strong></div>'+
       (entity.item?'<div class="iw-row"><span>ベルト上</span><strong>'+safe(ITEM_LABELS[entity.item]||entity.item)+'</strong></div>':"")+
       (entity.fluid?'<div class="iw-row"><span>液体</span><strong>原油 '+num(entity.fluid)+'L</strong></div>':"")+
       '</div>'+recipeHtml+
       '<div class="iw-actions"><button class="iw-action" data-command="rotate">↻ 回転</button>'+
       '<button class="iw-action" data-command="upgrade">↑ 強化</button>'+
       '<button class="iw-action" data-command="repair">✚ 修理</button>'+
       '<button class="iw-action secondary" data-command="demolish">⌫ 撤去</button></div>';
     return;
   }
   if(tab==="research"){
     const unlocked=w.research?.unlocked||[];
     body.innerHTML='<h3 class="iw-panel-title">技術研究</h3><div class="iw-panel-sub">SCIENCE / AUTOMATION TREE</div>'+
       '<div class="iw-panel-box"><div class="iw-row"><span>研究ポイント</span><strong>'+num(w.research?.points||0)+' pt</strong></div>'+
       '<div class="iw-row"><span>解放済み</span><strong>'+unlocked.length+' / '+Object.keys(techs).length+'</strong></div></div>'+
       '<p class="iw-panel-desc">歯車と電子回路から研究パックを製造し、研究所に搬送して研究ポイントに変換します。</p>'+
       Object.entries(techs).map(([id,t])=>{
         const done=unlocked.includes(id),needs=(t.needs||[]).filter(k=>!unlocked.includes(k));
         return '<div class="iw-tech-card'+(done?" done":"")+'"><strong>'+
           safe(t.name)+'</strong><small>'+safe(t.details)+'</small>'+
           '<div class="iw-tech-meta"><span>必要 '+t.points+' pt</span><span>'+(done?"研究済み":needs.length?"前提不足":"研究可能")+'</span></div>'+
           '<button class="iw-action" data-tech="'+safe(id)+'"'+
           (done||needs.length||w.research.points<t.points?" disabled":"")+'>'+
           (done?"✓ 研究済み":needs.length?"前提: "+safe(needs.join(", ")):"⌬ 研究する")+'</button></div>';
       }).join("");
     return;
   }
   if(tab==="combat"){
     body.innerHTML='<h3 class="iw-panel-title">防衛・敵機械</h3><div class="iw-panel-sub">AUTOMATED BASE DEFENSE</div>'+
       '<div class="iw-panel-box"><div class="iw-row"><span>襲撃ウェーブ</span><strong>'+num(w.wave)+'</strong></div>'+
       '<div class="iw-row"><span>次の襲撃</span><strong>'+num(w.waveIn)+' 秒</strong></div>'+
       '<div class="iw-row"><span>現在の敵</span><strong>'+num(w.enemies.length)+'</strong></div>'+
       '<div class="iw-row"><span>総撃破数</span><strong>'+num(w.stats?.kills)+'</strong></div>'+
       '<div class="iw-row"><span>使用可能な戦車</span><strong>'+num(w.army?.tank||0)+'</strong></div>'+
       '<div class="iw-row"><span>出撃中の戦車</span><strong>'+num(w.friendly?.length||0)+'</strong></div>'+
       '<div class="iw-row"><span>汚染量</span><strong>'+num(w.pollution)+'</strong></div></div>'+
       '<p class="iw-panel-desc">工場の汚染が高いほど襲撃が頻繁になります。砲台に弾薬を供給し、必要なら修理ロボット基地を設置してください。</p>'+
       '<button class="iw-action" data-command="dispatch"'+((w.army?.tank||0)<1 || !(w.research?.unlocked||[]).includes("tanks")?' disabled':'')+
       '>▰ 自動戦車を1台防衛出撃させる</button>'+
       (w.enemies||[]).slice(0,8).map(e=>'<div class="iw-enemy-card"><span class="iw-enemy-icon">'+
         (e.type==="armored"?"▣":"✹")+'</span><div><strong>'+safe(e.type==="armored"?"重装機械獣":"機械虫")+'</strong>'+
         '<small>HP '+num(e.hp)+' / '+num(e.maxHp)+' — X '+Math.floor(e.x)+' / Y '+Math.floor(e.y)+'</small></div></div>').join("");
   }
 }
 function action(command,extra={}){
   if(!ready)return;
   const x=selected?.x,y=selected?.y;
   const payload={action:command,...extra};
   if(["rotate","upgrade","repair","demolish"].includes(command)){
     if(!selected)return notice("先に設備を選択してください");
     payload.x=x;payload.y=y;
   }
   send("industry:action",payload);
 }
 body.addEventListener("click",event=>{
   const el=event.target.closest("button");if(!el)return;
   if(el.dataset.command)action(el.dataset.command);
   if(el.dataset.recipe)action("recipe",{x:selected?.x,y:selected?.y,recipe:el.dataset.recipe});
   if(el.dataset.tech)action("research",{tech:el.dataset.tech});
 });
 function cellSize(){return Math.max(15,40*zoom);}
 function toScreen(x,y){
   const rect=canvas.getBoundingClientRect(),s=cellSize();
   return {x:rect.left+(x-camera.x)*s+CW/2,y:rect.top+(y-camera.y)*s+CH/2};
 }
 function localToTile(lx,ly){
   const s=cellSize();
   return {x:Math.round((lx-CW/2)/s+camera.x),y:Math.round((ly-CH/2)/s+camera.y)};
 }
 function resize(){
   const rect=canvas.getBoundingClientRect();
   CW=Math.max(1,rect.width);CH=Math.max(1,rect.height);
   dpr=Math.min(window.devicePixelRatio||1,2);
   const width=Math.ceil(CW*dpr),height=Math.ceil(CH*dpr);
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   ctx.setTransform(dpr,0,0,dpr,0,0);
 }
 function cachedTerrain(x,y){
   const id=S.key(x,y);let t=terrainCache.get(id);
   if(t)return t;
   t=S.tileAt(state.seed,x,y);
   if(terrainCache.size>16000)terrainCache.clear();
   terrainCache.set(id,t);
   return t;
 }
 const TERRAIN={grass:["#294c46","#294d46"],forest:["#1d4540","#234f44"],
   dirt:["#5b4c38","#5c513d"],rock:["#48545d","#515e63"],
   sand:["#695c40","#685c47"],water:["#164a5c","#154552"]};
 const ORE_COLOR={ironOre:"#d79d78",copperOre:"#d98250",coal:"#242e3e",stone:"#c4be9f",oil:"#7355ac"};
 function paintTerrain(){
   const s=cellSize(),x0=Math.floor(camera.x-CW/(2*s))-2,x1=Math.ceil(camera.x+CW/(2*s))+2;
   const y0=Math.floor(camera.y-CH/(2*s))-2,y1=Math.ceil(camera.y+CH/(2*s))+2;
   const count=(x1-x0+1)*(y1-y0+1);
   if(count>13000)return;
   ctx.fillStyle="#071723";ctx.fillRect(0,0,CW,CH);
   const ox=CW/2-camera.x*s,oy=CH/2-camera.y*s;
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
     const tile=cachedTerrain(x,y),sx=(x*s+ox-s/2),sy=(y*s+oy-s/2);
     const id=S.hash(state.seed,x,y,44)>.5?1:0;
     ctx.fillStyle=TERRAIN[tile.terrain]?.[id]||"#204d44";ctx.fillRect(sx,sy,s+.8,s+.8);
     if(tile.terrain==="forest"&&s>=19){
       ctx.fillStyle="#204337";ctx.beginPath();ctx.arc(sx+s*.52,sy+s*.4,s*.23,0,Math.PI*2);ctx.fill();
       ctx.fillStyle="#356b4f";ctx.beginPath();ctx.arc(sx+s*.43,sy+s*.33,s*.16,0,Math.PI*2);ctx.fill();
     }
     if(tile.terrain==="water"&&s>=15){
       ctx.fillStyle="#24788a44";ctx.fillRect(sx+s*.2,sy+s*.32,s*.6,2);
     }
     if(tile.ore&&s>=12){
       ctx.fillStyle=ORE_COLOR[tile.ore]||"#d6c1a0";
       for(let p=0;p<3;p++){
         const a=S.hash(state.seed,x,y,p+70);
         const b=S.hash(state.seed,x,y,p+80);
         ctx.beginPath();
         ctx.moveTo(sx+s*(.15+a*.6),sy+s*(.16+b*.6));
         ctx.lineTo(sx+s*(.1+a*.5),sy+s*(.34+b*.4));
         ctx.lineTo(sx+s*(.34+a*.4),sy+s*(.25+b*.5));
         ctx.closePath();ctx.fill();
       }
     }
     const outside=Math.abs(x)>state.radius||Math.abs(y)>state.radius;
     if(outside){ctx.fillStyle="#060c17cc";ctx.fillRect(sx,sy,s+.8,s+.8);}
     if(s>=22){ctx.strokeStyle="#789ba317";ctx.strokeRect(sx+.4,sy+.4,s,s);}
   }
   if(state.radius*2*s<CW*8){
     ctx.strokeStyle="#f1cb8a88";ctx.setLineDash([10,8]);ctx.lineWidth=2;
     ctx.strokeRect(ox-state.radius*s-s/2,oy-state.radius*s-s/2,
       (state.radius*2+1)*s,(state.radius*2+1)*s);
     ctx.setLineDash([]);
   }
 }
 function entityGlyph(entity){return defs[entity.type]?.icon||"□";}
 function paintMachines(timestamp){
   const s=cellSize(),t=timestamp*.001;
   const entities=entries(),byType={};
   // Draw electrical links behind machines.
   const poles=entities.filter(e=>["generator","pole","solar","accumulator"].includes(e.type));
   ctx.strokeStyle="#80b7b944";ctx.lineWidth=Math.max(1,s*.055);
   for(let i=0;i<poles.length;i++)for(let j=0;j<i;j++){
     const a=poles[i],b=poles[j];
     const dist=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
     if(dist>6)continue;
     const ax=(a.x-camera.x)*s+CW/2,ay=(a.y-camera.y)*s+CH/2;
     const bx=(b.x-camera.x)*s+CW/2,by=(b.y-camera.y)*s+CH/2;
     if(Math.abs(ax)>CW+100||Math.abs(bx)>CW+100||Math.abs(ay)>CH+100||Math.abs(by)>CH+100)continue;
     ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
   }
   const angle=["↑","→","↓","←"];
   for(const e of entities){
     const x=(e.x-camera.x)*s+CW/2,y=(e.y-camera.y)*s+CH/2;
     if(x<-s||x>CW+s||y<-s||y>CH+s)continue;
     const d=defs[e.type];if(!d)continue;
     const ratio=Math.max(.15,e.hp/d.hp);
     const bg=e.online?"#193f4a":e.type==="wall"?"#33454b":"#24333b";
     const glow=e.type==="generator"?"#74d6eb":e.type==="furnace"?"#f4a664":
       ["turret","laser"].includes(e.type)?"#f0a2a7":"#53dfbf";
     ctx.save();ctx.translate(x,y);
     ctx.globalAlpha=e.hp<=2?.5:1;
     ctx.fillStyle=bg;ctx.fillRect(-s*.43,-s*.43,s*.86,s*.86);
     ctx.strokeStyle=e.hp<=2?"#b85867":glow;ctx.lineWidth=Math.max(1,s*.035);
     ctx.strokeRect(-s*.43,-s*.43,s*.86,s*.86);
     if(e.online&&["generator","furnace","drill","assembler","laser"].includes(e.type) && s>22){
       ctx.shadowBlur=8+Math.sin(t*3)*4;ctx.shadowColor=glow;
     }
     ctx.font="bold "+Math.min(31,Math.max(12,s*.58))+"px 'Chakra Petch',sans-serif";
     ctx.fillStyle=e.hp<=2?"#b99798":glow;ctx.textAlign="center";ctx.textBaseline="middle";
     if(e.type==="drill"&&e.online)ctx.rotate(Math.sin(t*20)*.06);
     if(e.type==="assembler"&&e.online)ctx.rotate(t*.4);
     if(["belt","splitter","inserter","pipe"].includes(e.type))ctx.rotate(e.dir*Math.PI/2);
     ctx.fillText(entityGlyph(e),0,0);
     ctx.shadowBlur=0;
     if(e.type==="belt"){
       const phase=((timestamp/220)%1)*s*.55;
       ctx.fillStyle=e.item?"#ffd28a":"#75d1cc";
       ctx.fillRect(-s*.24+phase-s*.25,-s*.05,Math.max(2,s*.12),Math.max(1,s*.1));
     }
     if((e.type==="belt"||e.type==="splitter")&&e.item){
       ctx.fillStyle="#ffe0a2";ctx.beginPath();ctx.arc(0,0,Math.max(3,s*.12),0,Math.PI*2);ctx.fill();
     }
     if(e.type==="furnace"&&e.online&&s>22){
       ctx.fillStyle="#ffb35f";ctx.globalAlpha=.5+.4*Math.abs(Math.sin(t*5));
       ctx.fillRect(-s*.16,s*.2,s*.32,s*.08);ctx.globalAlpha=1;
     }
     if(e.type==="turret"||e.type==="laser"){
       ctx.rotate(e.dir*Math.PI/2);
       ctx.fillStyle=e.type==="laser"?"#7db7ff":"#dfb8a1";
       ctx.fillRect(-s*.06,-s*.32,s*.12,s*.17);
     }
     if(e.hp<d.hp&&s>20){
       ctx.fillStyle="#3e3038";ctx.fillRect(-s*.35,s*.33,s*.7,3);
       ctx.fillStyle="#ef8b84";ctx.fillRect(-s*.35,s*.33,s*.7*ratio,3);
     }
     ctx.restore();
     if(s>=32 && e.type!=="belt"&&e.type!=="pole"){
       ctx.textAlign="center";ctx.font=Math.max(9,s*.2)+"px 'Chakra Petch',sans-serif";
       ctx.fillStyle=e.online?"#b0eeec":"#87929a";
       ctx.fillText(d.name,x,y+s*.57);
     }
   }
 }
 function paintFriendlies(t){
   const s=cellSize();
   for(const tank of state.friendly||[]){
     const x=(tank.x-camera.x)*s+CW/2,y=(tank.y-camera.y)*s+CH/2;
     if(x<-30||x>CW+30||y<-30||y>CH+30)continue;
     ctx.save();ctx.translate(x,y);ctx.shadowBlur=12;ctx.shadowColor="#4fffe3";
     ctx.fillStyle="#175b60";ctx.strokeStyle="#aafff0";ctx.lineWidth=2;
     ctx.fillRect(-s*.27,-s*.22,s*.54,s*.44);ctx.strokeRect(-s*.27,-s*.22,s*.54,s*.44);
     ctx.shadowBlur=0;ctx.fillStyle="#e7fff7";ctx.textBaseline="middle";ctx.textAlign="center";
     ctx.font=Math.max(11,s*.32)+"px sans-serif";ctx.fillText("▰",0,0);
     ctx.fillStyle="#173c39";ctx.fillRect(-s*.28,s*.25,s*.56,3);
     ctx.fillStyle="#6ffbdd";ctx.fillRect(-s*.28,s*.25,s*.56*Math.max(0,tank.hp/tank.maxHp),3);
     ctx.restore();
   }
 }
 function paintEnemies(t){
   const s=cellSize();
   for(const e of state.enemies||[]){
     const x=(e.x-camera.x)*s+CW/2,y=(e.y-camera.y)*s+CH/2;
     if(x<-20||x>CW+20||y<-20||y>CH+20)continue;
     ctx.save();ctx.translate(x,y);
     ctx.shadowColor="#ff667e";ctx.shadowBlur=13;
     ctx.fillStyle=e.type==="armored"?"#a54762":"#bb5467";
     ctx.beginPath();ctx.arc(0,0,Math.min(20,s*.3)*(1+Math.sin(t*.006)*.04),0,Math.PI*2);ctx.fill();
     ctx.shadowBlur=0;ctx.strokeStyle="#ffb3c0";ctx.lineWidth=2;ctx.stroke();
     ctx.font=Math.max(11,s*.36)+"px sans-serif";ctx.textBaseline="middle";ctx.textAlign="center";ctx.fillStyle="#fff3ea";
     ctx.fillText(e.type==="armored"?"▣":"✹",0,0);
     ctx.fillStyle="#502a33";ctx.fillRect(-s*.32,s*.28,s*.64,4);
     ctx.fillStyle="#ff7b8d";ctx.fillRect(-s*.32,s*.28,s*.64*Math.max(0,e.hp/e.maxHp),4);
     ctx.restore();
   }
 }
 function paintCursor(timestamp){
   const point=hover||selected;if(!point)return;
   const s=cellSize(),x=(point.x-camera.x)*s+CW/2,y=(point.y-camera.y)*s+CH/2;
   const outside=Math.abs(point.x)>state.radius||Math.abs(point.y)>state.radius;
   ctx.save();ctx.strokeStyle=outside?"#fe7e79":"#ffdfa1";ctx.lineWidth=2;
   ctx.shadowColor=outside?"#fe6179":"#ffe89a";ctx.shadowBlur=8;
   ctx.strokeRect(x-s*.49,y-s*.49,s*.98,s*.98);
   if(mode==="build" && defs[tool] && !state.entities[S.key(point.x,point.y)]){
     ctx.globalAlpha=.6;ctx.font=Math.min(29,s*.6)+"px sans-serif";
     ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#f8ecc5";
     ctx.fillText(defs[tool].icon,x,y);
   }
   ctx.restore();
 }
 function renderFrame(time){
   requestAnimationFrame(renderFrame);
   if(!visible() || !state || time-lastFrame<29)return;
   lastFrame=time;frames++;
   const rect=canvas.getBoundingClientRect();
   if(rect.width!==CW||rect.height!==CH)resize();
   ctx.save();ctx.clearRect(0,0,CW,CH);
   paintTerrain();paintMachines(time);paintFriendlies(time);paintEnemies(time);paintCursor(time);
   ctx.restore();
   if(time-lastMini>2000){paintMini();lastMini=time;}
 }
 function paintMini(){
   if(!state)return;
   const w=mini.width,h=mini.height;
   mc.fillStyle="#0c2130";mc.fillRect(0,0,w,h);
   const radius=Math.max(14,state.radius),scale=(w-20)/(radius*2+4);
   for(let i=0;i<190;i++){
     const x=Math.floor((S.hash(state.seed,i,0,99)*2-1)*radius);
     const y=Math.floor((S.hash(state.seed,i,0,100)*2-1)*radius);
     const tile=S.tileAt(state.seed,x,y);
     mc.fillStyle=tile.ore?(ORE_COLOR[tile.ore]||"#aab"):"#29483e";
     mc.fillRect(w/2+x*scale,h/2+y*scale,2,2);
   }
   for(const e of entries()){
     mc.fillStyle=e.type==="core"?"#fff4b2":e.type==="turret"?"#f0a4aa":"#65e4d0";
     mc.fillRect(w/2+e.x*scale-1,h/2+e.y*scale-1,3,3);
   }
   for(const e of state.enemies||[]){
     mc.fillStyle="#ff657d";
     mc.fillRect(w/2+e.x*scale-1,h/2+e.y*scale-1,3,3);
   }
   mc.strokeStyle="#e2c480";mc.strokeRect(10,10,w-20,h-20);
   mc.fillStyle="#fff";mc.fillRect(w/2-1,h/2-1,3,3);
 }
 function locatePointer(e){
   const rect=canvas.getBoundingClientRect();
   return {x:e.clientX-rect.left,y:e.clientY-rect.top};
 }
 canvas.addEventListener("pointerdown",e=>{
   if(!visible()||!state)return;
   canvas.setPointerCapture(e.pointerId);
   const loc=locatePointer(e);activePointers.set(e.pointerId,loc);
   mouse={x:loc.x,y:loc.y,startX:loc.x,startY:loc.y,origCamera:{...camera},id:e.pointerId};
   moved=false;
   if(e.button===2)e.preventDefault();
 });
 canvas.addEventListener("pointermove",e=>{
   const loc=locatePointer(e);
   hover=localToTile(loc.x,loc.y);
   if(!mouse||e.pointerId!==mouse.id)return;
   if(Math.hypot(loc.x-mouse.startX,loc.y-mouse.startY)>6)moved=true;
   if(moved){
     camera.x=mouse.origCamera.x-(loc.x-mouse.startX)/cellSize();
     camera.y=mouse.origCamera.y-(loc.y-mouse.startY)/cellSize();
     canvas.classList.add("is-dragging");
   }
 });
 canvas.addEventListener("pointerup",e=>{
   const loc=locatePointer(e);
   if(mouse?.id===e.pointerId && !moved && state){
     const point=localToTile(loc.x,loc.y);
     selected=point;hover=point;
     if(e.button===2){
       action("rotate");
     }else if(mode==="erase"){
       action("demolish");
     }else if(mode==="rotate"){
       action("rotate");
     }else if(mode==="build"){
       if(state.entities[S.key(point.x,point.y)]){
         notice("すでに設備があります。詳細から編集してください");
         switchTab("inspect");
       }else{
         send("industry:action",{action:"build",machine:tool,x:point.x,y:point.y,dir});
       }
     }else switchTab("inspect");
     paintPanel();
   }
   activePointers.delete(e.pointerId);mouse=null;canvas.classList.remove("is-dragging");
 });
 canvas.addEventListener("pointercancel",e=>{activePointers.delete(e.pointerId);mouse=null;canvas.classList.remove("is-dragging");});
 canvas.addEventListener("contextmenu",e=>e.preventDefault());
 canvas.addEventListener("wheel",e=>{
   if(!visible())return;
   e.preventDefault();
   const {x,y}=locatePointer(e),before=localToTile(x,y);
   zoom=Math.max(.45,Math.min(2.2,zoom*(e.deltaY>0?.91:1.09)));
   camera.x=before.x-(x-CW/2)/cellSize();
   camera.y=before.y-(y-CH/2)/cellSize();
   $("iwZoomLabel").textContent=Math.round(zoom*100)+"%";
 },{passive:false});
 document.addEventListener("keydown",e=>{
   if(!visible()||["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName))return;
   if(e.key==="Escape")close();
   else if(e.key.toLowerCase()==="r"){
     dir=(dir+1)%4;$("iwSelectionLabel").textContent="建設方向 "+["↑","→","↓","←"][dir];
   }else if(e.key==="Delete"||e.key==="Backspace")action("demolish");
   else if(e.key===" "){e.preventDefault();mode="select";updateTools();}
   else if(e.key.toLowerCase()==="h"){camera.x=0;camera.y=0;}
 });
 function zoomTo(v){
   zoom=Math.max(.45,Math.min(2.2,v));
   $("iwZoomLabel").textContent=Math.round(zoom*100)+"%";
 }
 $("iwZoomIn").onclick=()=>zoomTo(zoom*1.2);
 $("iwZoomOut").onclick=()=>zoomTo(zoom/1.2);
 $("iwCenter").onclick=()=>{camera.x=0;camera.y=0;};
 $("iwExit").onclick=close;
 $("iwExpand").onclick=()=>send("industry:action",{action:"expand"});
 $("iwToResearch").onclick=()=>switchTab("research");
 $("iwToMilitary").onclick=()=>switchTab("combat");
 $("iwRaidMenu").onclick=()=>window.RogueHQ?.open();
 $("iwToolCursor").onclick=()=>{mode="select";updateTools();$("iwSelectionLabel").textContent="調査モード：設備を選択";};
 $("iwToolRotate").onclick=()=>{mode="rotate";updateTools();$("iwSelectionLabel").textContent="回転モード：設備をタップ";};
 $("iwToolErase").onclick=()=>{mode="erase";updateTools();$("iwSelectionLabel").textContent="撤去モード：設備をタップ";};
 document.querySelectorAll("[data-iw-tab]").forEach(b=>b.onclick=()=>switchTab(b.dataset.iwTab));
 function showHelp(){
   $("iwHelpOverlay").classList.add("is-visible");
 }
 $("iwHelpClose").onclick=()=>{
   $("iwHelpOverlay").classList.remove("is-visible");
   localStorage.setItem("rf-infinite-guide-v1","1");
 };
 $("hqStartBtn").onclick=open;
 $("hqOpenBtn").onclick=()=>{if(!document.body.classList.contains("playing"))open();};
 $("worldBtn").onclick=open;
 $("mapOpenBtn").onclick=()=>{if(!document.body.classList.contains("playing"))open();};
 $("tutorialBtn").onclick=showHelp;
 $("hqToWorld").onclick=open;
 $("hqToDefense").onclick=open;
 setInterval(()=>{
   if(visible()&&ready&&connected&&Date.now()-lastPoll>2300){
     lastPoll=Date.now();send("industry:poll");
   }
 },800);
 window.addEventListener("resize",resize,{passive:true});
 makeCategories();updateTools();resize();
 requestAnimationFrame(renderFrame);
 window.IndustrialWorld={onConnected,onDisconnected,onHomeReady,receive,open,close,showHelp};
})();
