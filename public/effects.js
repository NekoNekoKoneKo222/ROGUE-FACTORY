"use strict";

/*
 * ROGUE FACTORY procedural visual-effects layer.
 * No spritesheet, GPU shaders, or external assets required.
 * All graphics are client-side only; game simulation remains authoritative.
 */
window.FactoryFX=(()=>{
  const canvas=document.getElementById("fx");
  const ctx=canvas.getContext("2d",{alpha:true});
  const flash=document.getElementById("flash");
  let W=window.innerWidth,H=window.innerHeight,dpr=1,quality="high",audio=false,ac=null;
  let last=0,elapsed=0,particles=[],shots=[],rings=[],floaters=[],sparks=0;
  let shakeT=0,shakePower=0;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const palette={ally:"#3de5e2",enemy:"#ff6777",energy:"#8bd8fc",ore:"#f6ad5e",fire:"#ffae57",metal:"#c5eaff"};
  const rand=(a,b)=>a+Math.random()*(b-a);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function resize(){
    W=window.innerWidth;H=window.innerHeight;
    dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    canvas.style.width=W+"px";canvas.style.height=H+"px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener("resize",resize,{passive:true});
  resize();
  function setQuality(v){
    quality=["high","low","off"].includes(v)?v:"high";
    if(reduced && quality==="high")quality="low";
    document.body.dataset.fx=quality;
    if(quality==="off"){particles=[];shots=[];rings=[];floaters=[];}
  }
  function setAudio(enabled){
    audio=!!enabled;
    if(audio){
      try{
        const AudioCtor=window.AudioContext||window.webkitAudioContext;
        if(!AudioCtor){audio=false;return false;}
        ac=ac||new AudioCtor();
        if(ac.state==="suspended")ac.resume();
      }catch{audio=false;}
    }
    return audio;
  }
  let lastSound=0;
  function tone(freq=280,duration=0.09,wave="triangle",volume=0.026,drop=0){
    if(!audio || !ac)return;
    const now=ac.currentTime;
    if(now-lastSound<0.034)return;
    lastSound=now;
    try{
      const osc=ac.createOscillator(),gain=ac.createGain();
      osc.type=wave;osc.frequency.setValueAtTime(freq,now);
      if(drop)osc.frequency.exponentialRampToValueAtTime(Math.max(50,freq+drop),now+duration);
      gain.gain.setValueAtTime(Math.max(0.001,volume),now);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);
      osc.connect(gain);gain.connect(ac.destination);
      osc.start(now);osc.stop(now+duration+0.02);
    }catch{}
  }
  function position(source){
    if(source?.nodeType===1){
      const r=source.getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+r.height/2};
    }
    return source&&typeof source.x==="number"?source:{x:W/2,y:H/2};
  }
  function addParticle(x,y,vx,vy,color,life,size=2,mode="spark"){
    if(particles.length>(quality==="high"?800:180))return;
    particles.push({x,y,vx,vy,life,age:0,color,size,mode,rot:rand(0,Math.PI*2),spin:rand(-6,6)});
  }
  function burst(where,kind="build",power=1){
    if(quality==="off")return;
    const {x,y}=position(where);
    const color=kind==="destroy"?palette.enemy:kind==="energy"?palette.energy:kind==="impact"?palette.fire:palette.ally;
    const count=Math.round((quality==="high"?27:9)*power);
    for(let i=0;i<count;i++){
      const a=rand(0,Math.PI*2),speed=rand(35,210)*(kind==="destroy"?1.3:1)*power;
      addParticle(x+rand(-5,5),y+rand(-5,5),Math.cos(a)*speed,Math.sin(a)*speed-(kind==="impact"?35:0),
        Math.random()<0.28?"#ffffff":color,rand(0.3,0.95),rand(1.5,5),kind==="destroy"?"shard":"spark");
    }
    rings.push({x,y,age:0,life:kind==="destroy"?0.6:0.42,max:kind==="destroy"?60:38,color});
    if(kind==="destroy")shake(9);
    else if(kind==="impact")shake(2.5);
    if(kind==="destroy")tone(130,0.23,"sawtooth",0.045,-90);
    if(kind==="build")tone(630,0.07,"triangle",0.02,250);
  }
  function shot(from,to,kind="bullet",side="ally",damage=0){
    if(quality==="off")return;
    const a=position(from),b=position(to);
    shots.push({ax:a.x,ay:a.y,bx:b.x,by:b.y,kind,side,damage,age:0,life:kind==="rocket"?0.65:0.19,trail:[]});
    if(kind==="rocket")tone(110,0.18,"sawtooth",0.025,190);
    else tone(510,0.035,"square",0.01,-240);
    burstSmall(a.x,a.y,side==="ally"?palette.ally:palette.enemy,kind==="rocket"?7:3);
  }
  function burstSmall(x,y,color,count=5){
    const n=quality==="high"?count:Math.ceil(count/2);
    for(let i=0;i<n;i++){
      const a=rand(0,Math.PI*2);
      addParticle(x,y,Math.cos(a)*rand(14,65),Math.sin(a)*rand(14,65),color,rand(0.2,0.5),rand(1,2.5));
    }
  }
  function impact(where,damage=0,team="enemy"){
    if(quality==="off")return;
    const p=position(where);
    burst(p,"impact",Math.min(1.2,0.7+damage/55));
    if(damage>0)floaters.push({x:p.x+rand(-15,15),y:p.y-10,text:"-"+Math.ceil(damage),age:0,life:0.95,color:team==="ally"?palette.enemy:palette.ally});
    if(quality==="high" && damage>=20){
      flash.style.background=team==="ally"?"#ff354b":"#ffffff";
      flash.classList.remove("flash-active");
      void flash.offsetWidth;
      flash.classList.add("flash-active");
    }
  }
  function shake(power=4){
    if(quality==="off" || reduced)return;
    shakeT=0.2;shakePower=Math.max(shakePower,power);
  }
  function float(where,label,color="#62f2e2"){
    if(quality==="off")return;
    const p=position(where);
    floaters.push({x:p.x,y:p.y,text:String(label),color,age:0,life:1.05});
  }
  function ambient(grid){
    if(quality!=="high" || !grid || !document.body.classList.contains("playing"))return;
    const cells=[...grid.querySelectorAll(".tile.machine-online")];
    for(let i=0;i<Math.min(2,cells.length);i++){
      const cell=cells[Math.floor(Math.random()*cells.length)];
      if(!cell)return;
      const r=cell.getBoundingClientRect(),type=cell.dataset.type;
      if(["generator","drill","furnace","ammo"].includes(type)){
        const x=rand(r.left+5,r.right-5),y=rand(r.top+5,r.bottom-5);
        const color=type==="furnace"?palette.fire:type==="drill"?palette.ore:palette.ally;
        addParticle(x,y,rand(-20,20),rand(-35,-4),color,rand(0.3,0.75),rand(1,3));
      }
    }
  }
  function victory(){
    if(quality==="off")return;
    for(let i=0;i<(quality==="high"?140:40);i++){
      addParticle(rand(0,W),rand(-H*0.25,0),rand(-65,65),rand(80,220),[palette.ally,"#ffffff","#f7c963",palette.energy][i%4],rand(2,5),rand(3,7),"confetti");
    }
    tone(630,0.3,"sine",0.035,350);
  }
  function render(timestamp){
    const dt=Math.min(0.05,Math.max(0.001,(timestamp-last)/1000||0.016));last=timestamp;
    elapsed+=dt;
    ctx.clearRect(0,0,W,H);
    if(shakeT>0){
      shakeT=Math.max(0,shakeT-dt);
      canvas.style.transform="translate("+rand(-shakePower,shakePower).toFixed(1)+"px,"+rand(-shakePower,shakePower).toFixed(1)+"px)";
      shakePower*=0.89;
    }else{canvas.style.transform="none";shakePower=0;}
    if(quality!=="off"){
      ctx.save();
      for(let i=shots.length-1;i>=0;i--){
        const p=shots[i];p.age+=dt;
        const t=clamp(p.age/p.life,0,1);
        const curve=p.kind==="rocket"?Math.sin(Math.PI*t)*Math.min(120,Math.abs(p.bx-p.ax)*0.15):0;
        const x=p.ax+(p.bx-p.ax)*t,y=p.ay+(p.by-p.ay)*t-curve;
        p.trail.push({x,y,age:0});
        if(p.trail.length>18)p.trail.shift();
        const color=p.side==="ally"?palette.ally:palette.enemy;
        if(p.kind==="rocket"){
          for(let j=1;j<p.trail.length;j++){
            const a=p.trail[j-1],b=p.trail[j];
            ctx.strokeStyle=j%3===0?"rgba(255,180,92,.52)":color;
            ctx.globalAlpha=j/p.trail.length;
            ctx.lineWidth=1+4*j/p.trail.length;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
          }
          ctx.globalAlpha=1;
          ctx.fillStyle="#fff5ce";ctx.shadowBlur=16;ctx.shadowColor=color;
          ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(p.by-p.ay,p.bx-p.ax));ctx.fillRect(-10,-3,20,6);ctx.restore();
          ctx.shadowBlur=0;
          if(Math.random()<0.5)burstSmall(x,y,"#ffb969",2);
        }else{
          ctx.strokeStyle=color;ctx.lineWidth=3;ctx.shadowBlur=12;ctx.shadowColor=color;
          ctx.beginPath();ctx.moveTo(x-(p.bx-p.ax)*0.035,y-(p.by-p.ay)*0.035);ctx.lineTo(x,y);ctx.stroke();ctx.shadowBlur=0;
        }
        if(t>=1){
          impact({x:p.bx,y:p.by},p.damage,p.side==="ally"?"enemy":"ally");
          shots.splice(i,1);
        }
      }
      for(let i=rings.length-1;i>=0;i--){
        const p=rings[i];p.age+=dt;
        const t=p.age/p.life;
        ctx.globalAlpha=1-t;ctx.strokeStyle=p.color;ctx.lineWidth=(1-t)*3;
        ctx.beginPath();ctx.arc(p.x,p.y,8+t*p.max,0,Math.PI*2);ctx.stroke();
        if(t>=1)rings.splice(i,1);
      }
      ctx.globalAlpha=1;
      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
        p.vx*=0.989;p.vy+=p.mode==="confetti"?30*dt:98*dt;
        p.rot+=p.spin*dt;
        const alpha=clamp(1-p.age/p.life,0,1);
        ctx.globalAlpha=alpha;ctx.fillStyle=p.color;
        if(p.mode==="shard" || p.mode==="confetti"){
          ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*1.3);ctx.restore();
        }else{
          ctx.shadowColor=p.color;ctx.shadowBlur=quality==="high"?8:0;
          ctx.beginPath();ctx.arc(p.x,p.y,p.size*alpha,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
        }
        if(p.age>=p.life)particles.splice(i,1);
      }
      ctx.globalAlpha=1;
      for(let i=floaters.length-1;i>=0;i--){
        const f=floaters[i];f.age+=dt;
        const t=f.age/f.life;
        ctx.globalAlpha=clamp(1-t,0,1);ctx.font="bold 15px system-ui,sans-serif";
        ctx.textAlign="center";ctx.shadowColor=f.color;ctx.shadowBlur=10;ctx.fillStyle=f.color;
        ctx.fillText(f.text,f.x,f.y-t*45);ctx.shadowBlur=0;
        if(t>=1)floaters.splice(i,1);
      }
      ctx.restore();ctx.globalAlpha=1;
      if(elapsed>0.33 && Math.floor((elapsed-dt)/0.33)!==Math.floor(elapsed/0.33)){
        ambient(document.getElementById("myGrid"));ambient(document.getElementById("enemyGrid"));
      }
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
  setQuality(reduced?"low":"high");
  return {burst,shot,impact,float,shake,victory,setQuality,setAudio,get quality(){return quality;}};
})();
