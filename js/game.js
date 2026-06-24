(() => {
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
const mini = document.getElementById("minimap");
const mctx = mini.getContext("2d");

const UI = {
  start: document.getElementById("start"),
  pause: document.getElementById("pause"),
  over: document.getElementById("over"),
  overText: document.getElementById("overText"),
  play: document.getElementById("play"),
  again: document.getElementById("again"),
  score: document.getElementById("score"),
  timer: document.getElementById("timer"),
  hpText: document.getElementById("hpText"),
  hpBar: document.getElementById("hpBar"),
  stamBar: document.getElementById("stamBar"),
  fpsText: document.getElementById("fpsText"),
  inv: document.getElementById("inventory"),
  message: document.getElementById("message"),
  lab: document.getElementById("lab"),
  crosshair: document.getElementById("crosshair"),
  playerName: document.getElementById("playerName"),
  playerSkin: document.getElementById("playerSkin"),
  uiAccent: document.getElementById("uiAccent"),
  startMusicEnabled: document.getElementById("startMusicEnabled"),
  startSfxEnabled: document.getElementById("startSfxEnabled"),
  toggleMusic: document.getElementById("toggleMusic"),
  toggleSfx: document.getElementById("toggleSfx"),
};

const sliders = {
  startBots: document.getElementById("startBots"),
  startObs: document.getElementById("startObs"),
  startPacks: document.getElementById("startPacks"),
  startScale: document.getElementById("startScale"),
  bots: document.getElementById("bots"),
  obs: document.getElementById("obs"),
  packs: document.getElementById("packs"),
  parts: document.getElementById("parts"),
  scale: document.getElementById("scale"),
  fpsCap: document.getElementById("fpsCap"),
  floorDamage: document.getElementById("floorDamage"),
  musicEnabled: document.getElementById("musicEnabled"),
  sfxEnabled: document.getElementById("sfxEnabled"),
};

const labels = {};
["startBots","startObs","startPacks","startScale","bots","obs","packs","parts","scale","fpsCap"].forEach(id => {
  labels[id] = document.getElementById(id+"Val");
});

const TAU = Math.PI * 2;
const WORLD_W = 112;
const WORLD_D = 88;
const EYE = 1.62;
const FOV = 78 * Math.PI / 180;
const SIM_TICK_RATE = 20;
const SIM_DT = 1 / SIM_TICK_RATE;
let entitySeq = 0;
const nextEntityId = prefix => `${prefix}_${++entitySeq}`;

const rnd = (a,b)=>a+Math.random()*(b-a);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;
const dist = (x,z,x2,z2)=>Math.hypot(x-x2,z-z2);
const yawTo = (x,z,x2,z2)=>Math.atan2(x2-x,z2-z);
const fmt = t => {
  t = Math.max(0, Math.floor(t));
  return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0");
};

let W = innerWidth, H = innerHeight, renderScale = 0.75, pixelRatio = 1;
let playing=false, paused=false, gameOver=false, mouseLocked=false;
let last=performance.now(), fpsTime=0, fpsFrames=0, fps=0, accumulator=0;
let matchTime=420, hurtFlash=0;
const shakeState = { trauma:0, x:0, y:0, z:0, t:0 };
const keys = {};

const settings = {
  bots: 14,
  obstacles: 70,
  packs: 36,
  particles: 0.65,
  scale: 0.75,
  fpsCap: 60,
  floorDamage: true,
  musicEnabled: true,
  sfxEnabled: true,
  playerName: "Player",
  playerSkin: "#050505",
  uiAccent: "#ffd24d"
};

const bombTypes = [
  { id:"frag",   name:"FRAG",   color:"#191919", pack:10, fuse:1.05, rad:7.0, dmg:46, spd:31, desc:"normal" },
  { id:"sticky", name:"STICKY", color:"#e64d4d", pack:5,  fuse:1.55, rad:6.0, dmg:56, spd:28, desc:"pegajosa" },
  { id:"trap",   name:"TRAP",   color:"#ffd24d", pack:3,  fuse:999,  rad:6.4, dmg:66, spd:0,  desc:"trampa" },
  { id:"fire",   name:"FIRE",   color:"#ff6a20", pack:3,  fuse:1.05, rad:6.0, dmg:28, spd:27, desc:"incendiaria" },
  { id:"ice",    name:"ICE",    color:"#91e8ff", pack:1,  fuse:1.05, rad:7.3, dmg:18, spd:27, desc:"congelante" },
];

const player = {
  x:-45,z:-34,yaw:.55,pitch:0,vx:0,vz:0,r:.72,
  hp:100,maxHp:100,st:100,sel:0,cd:0,dash:0,kills:0,score:0,
  ammo:[0,0,0,0,0], frozen:0, burning:0, name:"Player", color:"#050505", dead:false
};

const cam = { x:0, y:EYE, z:0, yaw:0, pitch:0 };
let hand = { throw:0, bob:0 };

let obstacles=[], bots=[], packs=[], bombs=[], particles=[], craters=[], zones=[], texts=[], grass=[];
let renderTick = 0;


// ---------- Audio procedural ----------
const audio = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return { supported:false, resume(){}, startMusic(){}, stopMusic(){}, setMusicEnabled(){}, setSfxEnabled(){}, sfx(){}, update(){} };
  let ctx, master, musicGain, sfxGain, noiseBuffer, musicTimer=0, musicOn=false, step=0, lastPlayerHp=player.hp;
  const scale=[55,65.41,73.42,82.41,98,110,130.81,146.83];
  function init(){
    if(ctx) return;
    ctx=new AC();
    master=ctx.createGain(); musicGain=ctx.createGain(); sfxGain=ctx.createGain();
    master.gain.value=.74; musicGain.gain.value=.22; sfxGain.gain.value=.82;
    musicGain.connect(master); sfxGain.connect(master); master.connect(ctx.destination);
    noiseBuffer=ctx.createBuffer(1, ctx.sampleRate*1.2, ctx.sampleRate);
    const d=noiseBuffer.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  }
  function resume(){ init(); if(ctx.state!=='running') ctx.resume(); }
  function env(g, t, a=.005, d=.18, peak=.7, end=.0001){
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(end,t); g.gain.linearRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(end,t+a+d);
  }
  function tone(freq, dur, type='sine', gain=.35, dest=sfxGain, when=0, slide=0){
    resume(); const t=ctx.currentTime+when, o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),t+dur);
    env(g,t,.006,dur,gain); o.connect(g); g.connect(dest); o.start(t); o.stop(t+dur+.04);
  }
  function noise(dur, gain=.25, filter=900, type='lowpass', when=0){
    resume(); const t=ctx.currentTime+when, src=ctx.createBufferSource(), f=ctx.createBiquadFilter(), g=ctx.createGain();
    src.buffer=noiseBuffer; f.type=type; f.frequency.setValueAtTime(filter,t); env(g,t,.004,dur,gain); src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t); src.stop(t+dur+.04);
  }
  function distanceGain(x,z){ return clamp(1 - dist(player.x, player.z, x, z) / 62, .08, 1); }
  function sfx(name, opts={}){
    if(!settings.sfxEnabled) return;
    const vol=opts.vol ?? 1;
    if(name==='throw'){ tone(170,.12,'square',.16*vol,sfxGain,0,.55); noise(.08,.08*vol,1800,'bandpass'); }
    if(name==='select') tone(620,.06,'triangle',.12*vol,sfxGain,0,1.45);
    if(name==='empty'){ tone(120,.09,'sawtooth',.11*vol,sfxGain,0,.72); tone(90,.06,'square',.06*vol,sfxGain,.08,.7); }
    if(name==='pack'){ tone(520,.11,'triangle',.16*vol); tone(780,.13,'sine',.13*vol,sfxGain,.07); noise(.12,.05*vol,4200,'highpass'); }
    if(name==='dash') noise(.22,.18*vol,700,'highpass');
    if(name==='hurt'){ tone(86,.24,'sawtooth',.19*vol,sfxGain,0,.62); noise(.16,.10*vol,520,'lowpass'); }
    if(name==='ko'){ tone(330,.12,'square',.14*vol); tone(196,.22,'triangle',.13*vol,sfxGain,.1,.82); }
    if(name==='win'){ [523,659,784,1046].forEach((f,i)=>tone(f,.22,'triangle',.12*vol,sfxGain,i*.09)); }
    if(name==='lose'){ [196,146,98].forEach((f,i)=>tone(f,.22,'sawtooth',.11*vol,sfxGain,i*.11,.9)); }
    if(name==='explode'){
      const g=vol*(opts.x===undefined?1:distanceGain(opts.x,opts.z));
      tone(72,.42,'sine',.42*g,sfxGain,0,.38); tone(38,.55,'triangle',.32*g,sfxGain,0,.45); noise(.58,.38*g,260,'lowpass'); noise(.18,.20*g,2400,'bandpass');
    }
    if(name==='fire') noise(.48,.14*vol,1200,'bandpass');
    if(name==='ice'){ tone(880,.24,'sine',.12*vol,sfxGain,0,1.7); noise(.32,.08*vol,5000,'highpass'); }
  }
  function musicTick(){
    if(!settings.musicEnabled || !musicOn || !ctx) return;
    const beat=.34, root=scale[step%scale.length];
    tone(root,.30,step%4===0?'sawtooth':'triangle',.055,musicGain,0,.98);
    if(step%2===0) tone(root*2,.12,'square',.028,musicGain,.02,1.01);
    if(step%8===4) tone(root*3,.18,'sine',.035,musicGain,.04,1.25);
    if(step%4===0) noise(.06,.025,1400,'bandpass');
    step=(step+1)%32;
    musicTimer=setTimeout(musicTick, beat*1000);
  }
  function startMusic(){ if(!settings.musicEnabled) return; resume(); if(musicOn) return; musicOn=true; step=0; musicTick(); }
  function stopMusic(){ musicOn=false; clearTimeout(musicTimer); }
  function setMusicEnabled(enabled){ settings.musicEnabled = !!enabled; if(!settings.musicEnabled) stopMusic(); else if(playing && !paused && !gameOver) startMusic(); }
  function setSfxEnabled(enabled){ settings.sfxEnabled = !!enabled; }
  function update(){
    if(player.hp < lastPlayerHp - .8) sfx('hurt', {vol:clamp((lastPlayerHp-player.hp)/22,.25,1)});
    lastPlayerHp=player.hp;
  }
  return { supported:true, resume, startMusic, stopMusic, setMusicEnabled, setSfxEnabled, sfx, update };
})();

// ---------- Setup UI ----------
function bindSlider(id, suffix="") {
  const el = sliders[id], lab = labels[id];
  const sync = () => lab.textContent = el.value + suffix;
  el.addEventListener("input", sync); sync();
}
bindSlider("startBots"); bindSlider("startObs"); bindSlider("startPacks"); bindSlider("startScale","%");
bindSlider("bots"); bindSlider("obs"); bindSlider("packs"); bindSlider("parts","%"); bindSlider("scale","%"); bindSlider("fpsCap");

function copyStartToLab(){
  settings.bots = +sliders.startBots.value;
  settings.obstacles = +sliders.startObs.value;
  settings.packs = +sliders.startPacks.value;
  settings.scale = +sliders.startScale.value / 100;
  syncProfileSettings();
  settings.musicEnabled = !!UI.startMusicEnabled?.checked;
  settings.sfxEnabled = !!UI.startSfxEnabled?.checked;
  syncAudioControls();
  sliders.bots.value=settings.bots; labels.bots.textContent=settings.bots;
  sliders.obs.value=settings.obstacles; labels.obs.textContent=settings.obstacles;
  sliders.packs.value=settings.packs; labels.packs.textContent=settings.packs;
  sliders.scale.value=Math.round(settings.scale*100); labels.scale.textContent=Math.round(settings.scale*100)+"%";
}

function cleanPlayerName(name){
  return (name || "Player").trim().replace(/[^\p{L}\p{N}_ -]/gu, "").slice(0, 16) || "Player";
}
function syncProfileSettings(){
  settings.playerName = cleanPlayerName(UI.playerName?.value);
  settings.playerSkin = UI.playerSkin?.value || "#050505";
  settings.uiAccent = UI.uiAccent?.value || "#ffd24d";
  document.documentElement.style.setProperty("--accent", settings.uiAccent);
}
[UI.playerName, UI.playerSkin, UI.uiAccent].forEach(el => el?.addEventListener("input", syncProfileSettings));
function syncAudioControls(){
  if(UI.startMusicEnabled) UI.startMusicEnabled.checked = settings.musicEnabled;
  if(UI.startSfxEnabled) UI.startSfxEnabled.checked = settings.sfxEnabled;
  if(sliders.musicEnabled) sliders.musicEnabled.checked = settings.musicEnabled;
  if(sliders.sfxEnabled) sliders.sfxEnabled.checked = settings.sfxEnabled;
  if(UI.toggleMusic){
    UI.toggleMusic.textContent = settings.musicEnabled ? "♫ Música ON" : "♫ Música OFF";
    UI.toggleMusic.classList.toggle("off", !settings.musicEnabled);
    UI.toggleMusic.setAttribute("aria-pressed", String(settings.musicEnabled));
  }
  if(UI.toggleSfx){
    UI.toggleSfx.textContent = settings.sfxEnabled ? "✦ Efectos ON" : "✦ Efectos OFF";
    UI.toggleSfx.classList.toggle("off", !settings.sfxEnabled);
    UI.toggleSfx.setAttribute("aria-pressed", String(settings.sfxEnabled));
  }
}
function setMusicEnabled(enabled){ audio.setMusicEnabled(enabled); syncAudioControls(); }
function setSfxEnabled(enabled){ audio.setSfxEnabled(enabled); syncAudioControls(); }
[UI.startMusicEnabled, sliders.musicEnabled].forEach(el => el?.addEventListener("change", () => setMusicEnabled(el.checked)));
[UI.startSfxEnabled, sliders.sfxEnabled].forEach(el => el?.addEventListener("change", () => setSfxEnabled(el.checked)));
UI.toggleMusic?.addEventListener("click", () => setMusicEnabled(!settings.musicEnabled));
UI.toggleSfx?.addEventListener("click", () => setSfxEnabled(!settings.sfxEnabled));
syncProfileSettings();
syncAudioControls();

document.getElementById("applyLab").onclick = () => {
  settings.bots = +sliders.bots.value;
  settings.obstacles = +sliders.obs.value;
  settings.packs = +sliders.packs.value;
  settings.particles = +sliders.parts.value / 100;
  settings.scale = +sliders.scale.value / 100;
  settings.fpsCap = +sliders.fpsCap.value;
  settings.floorDamage = sliders.floorDamage.checked;
  audio.setMusicEnabled(sliders.musicEnabled.checked);
  audio.setSfxEnabled(sliders.sfxEnabled.checked);
  syncAudioControls();
  syncProfileSettings();
  resize();
  reset();
};
UI.play.onclick = () => { audio.resume(); copyStartToLab(); reset(); audio.startMusic(); };
UI.again.onclick = () => { audio.resume(); reset(); audio.startMusic(); };

function buildInventory(){
  UI.inv.innerHTML = "";
  bombTypes.forEach((t,i)=>{
    const div=document.createElement("div");
    div.className="slot";
    div.innerHTML = `<div class="top"><span class="dot" style="background:${t.color}"></span><b>${i+1} ${t.name}</b></div><small>${t.desc} · +${t.pack}</small><div class="qty" id="ammo${i}">x0</div>`;
    UI.inv.appendChild(div);
  });
}
buildInventory();

// ---------- Canvas / input ----------
function resize(){
  W = innerWidth; H = innerHeight;
  renderScale = settings.scale;
  pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(320, Math.floor(W * renderScale * pixelRatio));
  canvas.height = Math.max(200, Math.floor(H * renderScale * pixelRatio));
  canvas.style.width = W+"px";
  canvas.style.height = H+"px";
  ctx.setTransform(renderScale * pixelRatio,0,0,renderScale * pixelRatio,0,0);
}
addEventListener("resize", resize); resize();

canvas.addEventListener("click", () => {
  if(!playing || paused || gameOver) return;
  lockMouse();
  throwPlayerBomb();
});
function lockMouse(){ if(document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); }
document.addEventListener("pointerlockchange",()=> mouseLocked = document.pointerLockElement === canvas);
document.addEventListener("mousemove", e => {
  if(!playing || paused || gameOver || !mouseLocked) return;
  player.yaw += e.movementX * 0.00235;
  player.pitch = clamp(player.pitch - e.movementY * 0.00205, -0.72, 0.62);
});
addEventListener("keydown", e => {
  keys[e.code]=true;
  if(["KeyW","KeyA","KeyS","KeyD","Space","ShiftLeft","ShiftRight"].includes(e.code)) e.preventDefault();
  if(e.code==="Escape" && playing && !gameOver){
    paused = !paused;
    UI.pause.style.display = paused ? "block" : "none";
    if(paused) audio.stopMusic(); else audio.startMusic();
  }
  if(e.code==="KeyP") UI.lab.classList.toggle("hidden");
  if(e.code==="KeyR"){ reset(); audio.startMusic(); }
  if(e.code.startsWith("Digit")){
    const n=Number(e.code.slice(5))-1;
    if(n>=0 && n<bombTypes.length){
      player.sel=n;
      message(`${bombTypes[n].name} seleccionado`, .8);
      audio.sfx("select");
    }
  }
});
addEventListener("keyup", e => keys[e.code]=false);

// ---------- World generation ----------
function reset(){
  entitySeq=0;
  player.id="player_1";
  syncProfileSettings();
  playing=true; paused=false; gameOver=false; matchTime=420; resetShake();
  Object.assign(player,{x:-45,z:-34,yaw:.55,pitch:0,vx:0,vz:0,hp:100,st:100,sel:0,cd:0,dash:0,kills:0,score:0,ammo:[0,0,0,0,0],frozen:0,burning:0,name:settings.playerName,color:settings.playerSkin,dead:false});
  obstacles=[]; bots=[]; packs=[]; bombs=[]; particles=[]; craters=[]; zones=[]; texts=[];
  buildObstacles();
  buildBots();
  buildPacks();
  buildGrass();
  UI.start.style.display="none"; UI.pause.style.display="none"; UI.over.style.display="none";
  message(`${player.name}, sobrevives esta ronda. Los eliminados no reaparecen.`, 2.5);
  lockMouse();
}

function addObstacle(x,z,w,d,h,type,hp=100){
  obstacles.push({id:nextEntityId("obstacle"),x,z,w,d,h,type,hp,maxHp:hp,dead:false,cracked:false});
}
function obstacleOverlaps(x,z,w,d,pad=1.2){
  return obstacles.some(o => !o.dead && Math.abs(x-o.x) < (w+o.w)/2+pad && Math.abs(z-o.z) < (d+o.d)/2+pad);
}
function safePoint(radius=.7, avoidPlayer=0){
  for(let tries=0; tries<80; tries++){
    const x=rnd(-WORLD_W/2+3,WORLD_W/2-3), z=rnd(-WORLD_D/2+3,WORLD_D/2-3);
    if(avoidPlayer && dist(x,z,player.x,player.z)<avoidPlayer) continue;
    if(!blocked(x,z,radius)) return {x,z};
  }
  return {x:rnd(-12,12), z:rnd(-10,10)};
}

function addWallSegments(){
  const thickness=1.6, h=7.2, hp=999, seg=8;
  for(let x=-WORLD_W/2+seg/2; x<WORLD_W/2; x+=seg){
    addObstacle(x,-WORLD_D/2,seg+.06,thickness,h,"wall",hp);
    addObstacle(x, WORLD_D/2,seg+.06,thickness,h,"wall",hp);
  }
  for(let z=-WORLD_D/2+seg/2; z<WORLD_D/2; z+=seg){
    addObstacle(-WORLD_W/2,z,thickness,seg+.06,h,"wall",hp);
    addObstacle( WORLD_W/2,z,thickness,seg+.06,h,"wall",hp);
  }
}

function buildObstacles(){
  // outer walls are segmented so distant/background walls do not collapse into
  // huge polygons at low render scales or at grazing camera angles.
  addWallSegments();

  const presets = [
    [-42,-24,14,3,3.2,"container",180],[-30,-12,3,16,3.4,"concrete",220],[-15,-32,12,3,3.2,"container",180],
    [4,-25,5,13,5.2,"ruin",200],[23,-32,16,3,3.2,"container",180],[42,-25,5,12,8,"tower",240],
    [-44,0,12,2.5,1.8,"sand",90],[-30,8,6,6,2.4,"crate",70],[-15,5,10,2.5,2.2,"concrete",160],
    [2,10,8,2.7,1.8,"sand",90],[17,3,4,13,4.1,"ruin",190],[31,9,11,3,2.5,"crate",80],[45,1,9,2.8,2.2,"concrete",160],
    [-40,23,8,3,2.5,"crate",70],[-28,25,4,12,4.0,"ruin",190],[-13,29,10,3,1.8,"sand",90],
    [6,27,5,12,2.8,"concrete",170],[21,24,10,3,3.2,"container",180],[36,22,5,11,2.5,"crate",70],[45,29,10,3,1.8,"sand",90],
    [-34,37,13,3,3.2,"container",180],[-8,38,7,3,2.5,"crate",70],[13,37,11,3.5,2.6,"concrete",170],[34,37,13,3,3.2,"container",180]
  ];
  for(const p of presets) addObstacle(...p);

  let extra = Math.max(0, settings.obstacles - presets.length - 50);
  for(let i=0;i<extra;i++){
    const type = Math.random()<.45 ? "crate" : Math.random()<.65 ? "barrel" : "sand";
    const w=rnd(1.4,3.4), d=rnd(1.4,3.4);
    let x,z,ok=false;
    for(let tries=0; tries<35 && !ok; tries++){
      x=rnd(-49,49); z=rnd(-38,38);
      ok = dist(x,z,player.x,player.z)>=11 && !obstacleOverlaps(x,z,w,d,.55);
    }
    if(!ok) continue;
    addObstacle(x,z,w,d,rnd(1.0,2.5),type,type==="barrel"?42:65);
  }
}
function buildBots(){
  const names=["BLAST","FUSE","TRAP","IGNIS","FROST","BOOM","MINER","CHAOS","NOVA","SPARK","ASH","ZERO","KILO","BETA"];
  for(let i=0;i<settings.bots;i++){
    const {x,z}=safePoint(.9,18);
    const type=i%5;
    bots.push({
      id:nextEntityId("bot"),
      name:names[i%names.length]+(i>=names.length?i:""),
      x,z,vx:0,vz:0,r:.58,hp: i%7===0?130:80, maxHp:i%7===0?130:80,
      speed:i%7===0?3.4:rnd(4.2,6.5), color:["#ff5d4d","#70d6ff","#ffd24d","#ff6a20","#91e8ff"][type],
      ammo:[0,0,0,0,0], cd:rnd(1.2,2.8), path:rnd(0,TAU), dead:false, frozen:0, burning:0, stun:0, anim:rnd(0,TAU), throwAnim:0, yaw:0, lean:0
    });
  }
}
function buildPacks(){
  for(let i=0;i<settings.packs;i++){
    const {x,z}=safePoint(.7,7);
    packs.push({id:nextEntityId("pickup"),x,z,type:i%5,dead:false,respawn:0,spin:rnd(0,TAU)});
  }
}
function buildGrass(){
  grass=[];
  for(let i=0;i<230;i++) grass.push({x:rnd(-54,54),z:rnd(-42,42),h:rnd(.35,.9),c:Math.random()<.55?"#6f8b43":"#526f37"});
}


function easeOut(t){ return 1 - Math.pow(1 - t, 3); }
function angleLerp(a,b,t){
  let d=((b-a+Math.PI)%(TAU))-Math.PI;
  if(d<-Math.PI) d+=TAU;
  return a+d*t;
}
function resetShake(){
  shakeState.trauma=0; shakeState.x=0; shakeState.y=0; shakeState.z=0; shakeState.t=0;
}
function addCameraTrauma(amount,x,z){
  const nearPlayer = 1 - clamp(dist(x,z,player.x,player.z)/42,0,1);
  shakeState.trauma = clamp(shakeState.trauma + amount*(.35 + nearPlayer*.65), 0, .85);
}
function updateCameraShake(){
  shakeState.t += .37;
  shakeState.trauma *= .90;
  if(shakeState.trauma < .006){ resetShake(); return; }
  const amp = shakeState.trauma * shakeState.trauma;
  shakeState.x = Math.sin(shakeState.t*2.1) * amp * .34 + Math.sin(shakeState.t*5.7) * amp * .08;
  shakeState.y = Math.cos(shakeState.t*2.6) * amp * .16;
  shakeState.z = Math.cos(shakeState.t*1.7) * amp * .34 + Math.sin(shakeState.t*4.3) * amp * .08;
}

// ---------- Projection ----------
function setupCamera(){
  cam.x=player.x; cam.y=EYE; cam.z=player.z; cam.yaw=player.yaw; cam.pitch=player.pitch;
  updateCameraShake();
  cam.x += shakeState.x; cam.y += shakeState.y; cam.z += shakeState.z;
}
function cameraSpace(p){
  const dx=p.x-cam.x, dy=p.y-cam.y, dz=p.z-cam.z;
  const cy=Math.cos(cam.yaw), sy=Math.sin(cam.yaw);
  let lx=dx*cy-dz*sy;
  let lz=dx*sy+dz*cy;
  const cp=Math.cos(cam.pitch), sp=Math.sin(cam.pitch);
  let ly=dy*cp-lz*sp;
  let lz2=dy*sp+lz*cp;
  return {x:lx,y:ly,z:lz2};
}
function projectCamera(v){
  if(v.z<0.08) return null;
  const f=(H*.5)/Math.tan(FOV/2);
  return {x:W/2+v.x/v.z*f,y:H/2-v.y/v.z*f,z:v.z,scale:f/v.z};
}
function project(p){
  return projectCamera(cameraSpace(p));
}
function clipCameraPoly(poly, near=.08){
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i], b=poly[(i+1)%poly.length];
    const ain=a.z>=near, bin=b.z>=near;
    if(ain && bin) out.push(b);
    else if(ain && !bin){
      const t=(near-a.z)/(b.z-a.z);
      out.push({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),z:near});
    }else if(!ain && bin){
      const t=(near-a.z)/(b.z-a.z);
      out.push({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),z:near});
      out.push(b);
    }
  }
  return out;
}
function depthOf(pts){ let d=0; for(const p of pts)d+=cameraSpace(p).z; return d/pts.length; }
function drawPoly(pts,color,stroke=null){
  const clipped=clipCameraPoly(pts.map(cameraSpace));
  if(clipped.length<3) return;
  const ps=clipped.map(projectCamera).filter(Boolean);
  if(ps.length<3) return;
  ctx.beginPath(); ctx.moveTo(ps[0].x,ps[0].y);
  for(let i=1;i<ps.length;i++) ctx.lineTo(ps[i].x,ps[i].y);
  ctx.closePath(); ctx.fillStyle=color; ctx.fill();
  if(stroke){ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.stroke();}
}
function drawLine3D(a,b,color,w=1){
  const pa=project(a), pb=project(b); if(!pa||!pb)return;
  ctx.strokeStyle=color; ctx.lineWidth=w; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke();
}

// ---------- Game logic ----------
function forward(){ return {x:Math.sin(player.yaw), z:Math.cos(player.yaw)}; }
function right(){ return {x:Math.cos(player.yaw), z:-Math.sin(player.yaw)}; }

function update(dt){
  if(!playing || paused || gameOver) return;
  dt=Math.min(.05,dt);
  const hpBefore = player.hp;
  matchTime-=dt;
  if(matchTime<=0) endGame("Tiempo terminado. Puntos: "+player.score+" · KOs: "+player.kills);
  updatePlayer(dt);
  updateBots(dt);
  updateBombs(dt);
  updatePacks(dt);
  updateZones(dt);
  updateParticles(dt);
  updateTexts(dt);
  audio.update();
  hurtFlash=Math.max(0,hurtFlash-dt);
  if(player.hp < hpBefore - .6) hurtFlash=.16;
  if(player.hp<=0){ player.dead=true; endGame(`${player.name} fue eliminado. Puntos: ${player.score} · KOs: ${player.kills}`); }
  else if(bots.every(b => b.dead)) endGame(`${player.name} ganó la ronda. Puntos: ${player.score} · KOs: ${player.kills}`);
}
function endGame(txt){
  gameOver=true; playing=false; UI.overText.textContent=txt; UI.over.style.display="block";
  audio.stopMusic(); audio.sfx(txt.includes("ganó") ? "win" : "lose");
  document.exitPointerLock?.();
}
function updatePlayer(dt){
  player.cd=Math.max(0,player.cd-dt);
  player.dash=Math.max(0,player.dash-dt);
  player.frozen=Math.max(0,player.frozen-dt);
  player.burning=Math.max(0,player.burning-dt);
  if(player.burning>0) player.hp-=7*dt;
  let f=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  let s=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  const l=Math.hypot(f,s); if(l){f/=l;s/=l}
  let speed=7.2*(player.frozen>0?.42:1);
  if((keys.ShiftLeft||keys.ShiftRight)&&player.st>2&&l){speed=10.4*(player.frozen>0?.42:1);player.st-=33*dt}else player.st=Math.min(100,player.st+24*dt);
  const fw=forward(), rt=right();
  player.vx+=(fw.x*f+rt.x*s)*speed*9*dt;
  player.vz+=(fw.z*f+rt.z*s)*speed*9*dt;
  if(keys.Space&&player.dash<=0&&player.st>24){
    player.vx+=fw.x*19;player.vz+=fw.z*19;player.st-=24;player.dash=.85; spawnParticles(player.x,.3,player.z,16,"dust"); audio.sfx("dash");
  }
  player.vx*=Math.pow(.08,dt); player.vz*=Math.pow(.08,dt);
  player.x+=player.vx*dt; player.z+=player.vz*dt; collide(player);
  for(const p of packs) if(!p.dead&&dist(player.x,player.z,p.x,p.z)<1.45) collectPack(p,player);
}
function updateBots(dt){
  for(const b of bots){
    if(b.dead) continue;
    b.cd-=dt; b.throwAnim=Math.max(0,b.throwAnim-dt); b.stun=Math.max(0,b.stun-dt);
    b.frozen=Math.max(0,b.frozen-dt); b.burning=Math.max(0,b.burning-dt);
    const moveSpeed = Math.hypot(b.vx,b.vz);
    b.anim += dt * (0.9 + moveSpeed * 0.32);
    if(b.burning>0) b.hp-=8*dt;
    if(b.hp<=0){ killBot(b); continue; }

    const hasAmmo=b.ammo.some(v=>v>0);
    const d=dist(b.x,b.z,player.x,player.z);
    const sees=d<44 && clearLine(b.x,b.z,player.x,player.z);
    let targetPack=null;
    if(!hasAmmo){
      let best=1e9;
      for(const p of packs) if(!p.dead){ const dd=dist(b.x,b.z,p.x,p.z); if(dd<best){best=dd; targetPack=p;} }
    }
    let yaw=b.path;
    if(targetPack) yaw=yawTo(b.x,b.z,targetPack.x,targetPack.z);
    else if(sees&&d>10) yaw=yawTo(b.x,b.z,player.x,player.z);
    else if(sees&&d<6) yaw=yawTo(b.x,b.z,player.x,player.z)+Math.PI;
    if(Math.random()<.012) b.path=yawTo(b.x,b.z,player.x,player.z)+rnd(-1.5,1.5);
    for(const bomb of bombs) if(bomb.owner!==b.name&&dist(b.x,b.z,bomb.x,bomb.z)<7) yaw=yawTo(bomb.x,bomb.z,b.x,b.z);
    const slow=b.frozen>0?.35:1;
    const speed=b.speed*slow*(b.stun>0?.25:1);
    b.vx+=Math.sin(yaw)*speed*6*dt;
    b.vz+=Math.cos(yaw)*speed*6*dt;
    b.vx*=Math.pow(.12,dt); b.vz*=Math.pow(.12,dt);
    b.x+=b.vx*dt; b.z+=b.vz*dt; collide(b);
    const desiredYaw = Math.atan2(b.vx, b.vz);
    if(moveSpeed > .08) b.yaw = angleLerp(b.yaw || desiredYaw, desiredYaw, Math.min(1, dt * 9));
    b.lean = lerp(b.lean || 0, clamp(moveSpeed / Math.max(1, b.speed), 0, 1), Math.min(1, dt * 8));

    for(const p of packs) if(!p.dead&&dist(b.x,b.z,p.x,p.z)<1.35) collectPack(p,b);

    if(b.cd<=0 && sees && hasAmmo){
      botThrow(b,d);
      b.throwAnim=.35;
      b.cd=rnd(1.3,2.7);
    }
  }
}
function killBot(b){
  b.dead=true;
  player.kills++; player.score+=100;
  spawnText(b.x,2.5,b.z,"KO","#7dff75");
  spawnParticles(b.x,1.0,b.z,18,"debris",b.color);
  audio.sfx("ko");
}
function botThrow(b,d){
  let idx = preferredBomb(b);
  if(idx<0) return;
  b.ammo[idx]--;
  const t=bombTypes[idx];
  const yaw=yawTo(b.x,b.z,player.x+player.vx*.18,player.z+player.vz*.18)+rnd(-.13,.13);
  if(t.id==="trap" && d<16){ addBomb(b.x+Math.sin(yaw),.24,b.z+Math.cos(yaw),0,0,0,idx,b.name,true); return; }
  const pitch=clamp(Math.atan2(1.25,Math.max(5,d))+rnd(-.06,.08),.08,.32), cp=Math.cos(pitch);
  addBomb(b.x+Math.sin(yaw)*.9,1.25,b.z+Math.cos(yaw)*.9,Math.sin(yaw)*t.spd*.82*cp,Math.sin(pitch)*t.spd+3.2,Math.cos(yaw)*t.spd*.82*cp,idx,b.name,false);
}
function preferredBomb(b){ for(let i=0;i<b.ammo.length;i++) if(b.ammo[i]>0) return i; return -1; }

function collectPack(p,who){
  p.dead=true; p.respawn=11+rnd(0,9);
  const add=bombTypes[p.type].pack;
  if(who===player){
    player.ammo[p.type]+=add; player.sel=p.type;
    message(`Pack ${bombTypes[p.type].name} +${add}`,1.2);
    anime({targets:hand, bob:.18, duration:160, easing:"easeOutQuad", complete:()=>anime({targets:hand,bob:0,duration:250})});
    audio.sfx("pack");
  }else who.ammo[p.type]+=add;
  spawnParticles(p.x,.6,p.z,14,"spark",bombTypes[p.type].color);
}
function updatePacks(dt){
  for(const p of packs){ if(p.dead){p.respawn-=dt;if(p.respawn<=0)p.dead=false;} else p.spin+=dt; }
}
function throwPlayerBomb(){
  if(player.cd>0) return;
  const i=player.sel, t=bombTypes[i];
  if(player.ammo[i]<=0){message(`No tienes ${t.name}. Busca packs.`,1.3); audio.sfx("empty"); return;}
  const cp=Math.cos(player.pitch+.04), fx=Math.sin(player.yaw)*cp, fy=Math.sin(player.pitch+.04), fz=Math.cos(player.yaw)*cp;
  if(t.id==="trap") addBomb(player.x+Math.sin(player.yaw)*1.1,.22,player.z+Math.cos(player.yaw)*1.1,0,0,0,i,"player",true);
  else addBomb(player.x+fx*.8,EYE-.1+fy*.25,player.z+fz*.8,fx*t.spd,fy*t.spd+4.4,fz*t.spd,i,"player",false);
  player.ammo[i]--; player.cd=.33;
  anime({targets:hand, throw:1, duration:110, easing:"easeOutQuad", complete:()=>anime({targets:hand, throw:0, duration:160})});
  audio.sfx("throw");
}
function addBomb(x,y,z,vx,vy,vz,type,owner,placed=false){
  const t=bombTypes[type];
  bombs.push({id:nextEntityId("bomb"),x,y,z,vx,vy,vz,type,owner,r:.26,timer:placed&&t.id==="trap"?999:t.fuse,age:0,stuck:placed,armed:placed?.45:0,mini:false});
  spawnParticles(x,y,z,5,"spark",t.color);
}
function updateBombs(dt){
  for(const b of bombs){
    const t=bombTypes[b.type]; b.age+=dt; b.timer-=dt; if(b.armed>0)b.armed-=dt;
    if(t.id==="trap"&&b.armed<=0){
      const targets=b.owner==="player"?bots.filter(e=>!e.dead):[player];
      for(const q of targets) if(dist(b.x,b.z,q.x,q.z)<2.6){b.timer=0;break;}
    }
    if(!b.stuck){
      b.x+=b.vx*dt; b.y+=b.vy*dt; b.z+=b.vz*dt; b.vy-=15.5*dt;
      if(b.y<b.r){b.y=b.r;b.vy*=-.36;b.vx*=.78;b.vz*=.78;}
      b.vx*=Math.pow(.96,dt); b.vz*=Math.pow(.96,dt);
      for(const o of obstacles) if(!o.dead&&bombHitsObstacle(b,o)){
        if(t.id==="sticky"){b.stuck=true;b.vx=b.vy=b.vz=0;}
        else{
          const dx=b.x-o.x,dz=b.z-o.z;
          if(Math.abs(dx/o.w)>Math.abs(dz/o.d)){b.vx*=-.6;b.x+=Math.sign(dx)*.25}else{b.vz*=-.6;b.z+=Math.sign(dz)*.25}
          b.vy=Math.abs(b.vy)*.35;
        }
      }
    }
    if(t.id==="sticky"){
      if(b.owner==="player"){
        for(const e of bots) if(!e.dead&&dist(b.x,b.z,e.x,e.z)<e.r+.45){b.stuck=true;b.vx=b.vy=b.vz=0;b.x=e.x;b.y=1.35;b.z=e.z;}
      }else if(dist(b.x,b.z,player.x,player.z)<player.r+.45){b.stuck=true;b.vx=b.vy=b.vz=0;b.x=player.x;b.y=1.2;b.z=player.z;}
    }
    if(b.timer<=0){b.dead=true; explode(b); }
  }
  bombs=bombs.filter(b=>!b.dead);
}
function explode(b){
  const t=bombTypes[b.type];
  spawnExplosion(b.x,b.y,b.z,t);
  applyDamage(b.x,b.z,t.rad,t.dmg,b.owner,b.type);
  if(settings.floorDamage){ craters.push({x:b.x,z:b.z,r:t.rad*rnd(.55,.95),life:34,type:t.id}); }
  if(t.id==="fire") zones.push({kind:"fire",x:b.x,z:b.z,r:t.rad,life:5.2,max:5.2});
  if(t.id==="ice") zones.push({kind:"ice",x:b.x,z:b.z,r:t.rad,life:5.8,max:5.8});
  audio.sfx("explode", {x:b.x, z:b.z, vol:t.id==="trap"?.85:1});
  if(t.id==="fire") audio.sfx("fire");
  if(t.id==="ice") audio.sfx("ice");
}
function spawnExplosion(x,y,z,t){
  particles.push({x,y,z,vx:0,vy:0,vz:0,type:"blast",color:t.color,r:0,maxR:t.rad,life:.42,max:.42});
  particles.push({x,y:.04,z,vx:0,vy:0,vz:0,type:"shockwave",color:t.color,r:0,maxR:t.rad*1.35,life:.55,max:.55});
  spawnParticles(x,y,z,Math.floor(52*settings.particles),t.id==="fire"?"fire":t.id==="ice"?"ice":"boom",t.color);
  spawnParticles(x,.12,z,Math.floor(34*settings.particles),"smoke",t.color);
  addCameraTrauma(Math.min(.42, t.rad * .035), x, z);
}
function applyDamage(x,z,r,dmg,owner,type){
  const targets=[player,...bots.filter(b=>!b.dead)];
  for(const q of targets){
    const d=dist(x,z,q.x,q.z);
    if(d<r+(q.r||.7)){
      let f=1-d/(r+(q.r||.7));
      if(!clearLine(x,z,q.x,q.z)) f*=.55;
      const hurt=dmg*(.35+f*.9);
      const a=yawTo(x,z,q.x,q.z), imp=type===2?19:15;
      q.vx+=Math.sin(a)*imp*f; q.vz+=Math.cos(a)*imp*f;
      if(type===3) q.burning=3.4;
      if(type===4) q.frozen=4.2;
      q.hp-=hurt;
      spawnText(q.x,2.1,q.z,"-"+Math.round(hurt),q===player?"#ff5d4d":"#ffd24d");
      if(q!==player && q.hp<=0&&!q.dead){
        q.dead=true;
        if(owner==="player"){player.kills++;player.score+=100;}
        spawnText(q.x,2.8,q.z,"KO","#7dff75");
        spawnParticles(q.x,1,q.z,14,"debris",q.color);
      }
    }
  }
  for(const o of obstacles){
    if(o.dead) continue;
    const cx=clamp(x,o.x-o.w/2,o.x+o.w/2), cz=clamp(z,o.z-o.d/2,o.z+o.d/2);
    const d=dist(x,z,cx,cz);
    if(d<r){
      o.hp-=dmg*(1-d/r)+22;
      if(!o.cracked){o.cracked=true;}
      // Los obstáculos son cobertura fija estilo shooter: se agrietan, pero no desaparecen.
      o.hp=Math.max(1,o.hp);
    }
  }
}
function updateZones(dt){
  for(const z of zones){
    z.life-=dt;
    const targets=[player,...bots.filter(b=>!b.dead)];
    for(const q of targets) if(dist(q.x,q.z,z.x,z.z)<z.r){
      if(z.kind==="fire"){q.burning=Math.max(q.burning,.6);q.hp-=q===player?7*dt:10*dt;}
      if(z.kind==="ice"){q.frozen=Math.max(q.frozen,.6);}
    }
  }
  zones=zones.filter(z=>z.life>0);
}
function spawnParticles(x,y,z,n,type,color=null){
  n=Math.floor(n*settings.particles);
  for(let i=0;i<n;i++){
    const a=rnd(0,TAU);
    const sp= type==="spark"?rnd(3,9):type==="dust"?rnd(1,5):type==="smoke"?rnd(.45,3.8):rnd(2,17);
    const life=type==="dust"?rnd(.45,1.1):type==="smoke"?rnd(.9,2.2):rnd(.35,1.6);
    particles.push({x,y,z,vx:Math.sin(a)*sp,vy:type==="dust"?rnd(.5,2):type==="smoke"?rnd(.35,2.6):rnd(1,9),vz:Math.cos(a)*sp,type,color,life,max:life,size:type==="debris"?rnd(.08,.22):type==="smoke"?rnd(.22,.65):rnd(.05,.18),rot:rnd(0,TAU),grow:rnd(.7,1.45)});
  }
}
function updateParticles(dt){
  for(const p of particles){
    p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.rot+=dt*3;
    if(p.type==="blast" || p.type==="shockwave"){p.r=lerp(p.r,p.maxR,p.type==="shockwave"?.30:.22);}
    else {
      const gravity = p.type==="smoke" ? -1.1 : 10.5;
      p.vy-=gravity*dt;
      const drag = p.type==="smoke" ? .22 : .48;
      p.vx*=Math.pow(drag,dt); p.vz*=Math.pow(drag,dt);
    }
  }
  particles=particles.filter(p=>p.life>0);
  for(const c of craters)c.life-=dt;
  craters=craters.filter(c=>c.life>0);
}
function spawnText(x,y,z,text,color){ texts.push({x,y,z,text,color,life:1.15,max:1.15}); }
function updateTexts(dt){ for(const t of texts){t.life-=dt;t.y+=.75*dt;} texts=texts.filter(t=>t.life>0); }

// ---------- Collision helpers ----------
function blocked(x,z,r){ return obstacles.some(o=>!o.dead&&circleBox(x,z,r,o)); }
function circleBox(x,z,r,o){
  const nx=clamp(x,o.x-o.w/2,o.x+o.w/2), nz=clamp(z,o.z-o.d/2,o.z+o.d/2);
  return dist(x,z,nx,nz)<r;
}
function collide(a){
  a.x=clamp(a.x,-WORLD_W/2+1,WORLD_W/2-1); a.z=clamp(a.z,-WORLD_D/2+1,WORLD_D/2-1);
  for(const o of obstacles){
    if(o.dead) continue;
    const minX=o.x-o.w/2,maxX=o.x+o.w/2,minZ=o.z-o.d/2,maxZ=o.z+o.d/2;
    const nx=clamp(a.x,minX,maxX), nz=clamp(a.z,minZ,maxZ);
    const dx=a.x-nx,dz=a.z-nz,d=Math.hypot(dx,dz);
    if(d<a.r){
      const ux=d?dx/d:Math.random()-.5, uz=d?dz/d:Math.random()-.5, push=(a.r-d)||.01;
      a.x+=ux*push; a.z+=uz*push; a.vx+=ux*push*3; a.vz+=uz*push*3;
    }
  }
}
function clearLine(x,z,x2,z2){
  const steps=Math.max(2,Math.ceil(dist(x,z,x2,z2)/1.25));
  for(const o of obstacles){
    if(o.dead) continue;
    const minX=o.x-o.w/2,maxX=o.x+o.w/2,minZ=o.z-o.d/2,maxZ=o.z+o.d/2;
    for(let i=1;i<steps;i++){
      const t=i/steps, px=lerp(x,x2,t), pz=lerp(z,z2,t);
      if(px>minX&&px<maxX&&pz>minZ&&pz<maxZ) return false;
    }
  }
  return true;
}
function bombHitsObstacle(b,o){
  const minX=o.x-o.w/2-b.r,maxX=o.x+o.w/2+b.r,minZ=o.z-o.d/2-b.r,maxZ=o.z+o.d/2+b.r;
  return b.x>minX&&b.x<maxX&&b.z>minZ&&b.z<maxZ&&b.y<o.h+b.r;
}

// ---------- Render ----------
function render(){
  renderTick++;
  setupCamera();
  drawBackground();
  drawGround();
  const jobs=[];

  // ground decals/zones
  for(const c of craters){
    const pts=circleGround(c.x,c.z,c.r,20,.02);
    jobs.push({d:depthOf(pts), draw:()=>drawPoly(pts, c.type==="ice"?"rgba(20,80,95,.28)":"rgba(0,0,0,.35)")});
  }
  for(const z of zones){
    const pts=circleGround(z.x,z.z,z.r,28,.035);
    const alpha=(z.life/z.max)*(z.kind==="fire"?.36:.28);
    jobs.push({d:depthOf(pts), draw:()=>drawPoly(pts, z.kind==="fire"?`rgba(255,100,32,${alpha})`:`rgba(145,232,255,${alpha})`)});
  }

  // grass, cull far
  for(const g of grass){
    const d=cameraSpace({x:g.x,y:0,z:g.z}).z;
    if(d>1&&d<45) jobs.push({d, draw:()=>drawGrass(g)});
  }

  for(const o of obstacles) if(!o.dead) {
    const d=cameraSpace({x:o.x,y:o.h*.5,z:o.z}).z;
    if(d>-2 && d<90) jobs.push({d, draw:()=>drawBox(o)});
  }
  for(const p of packs) if(!p.dead) jobs.push({d:cameraSpace({x:p.x,y:.6,z:p.z}).z, draw:()=>drawPack(p)});
  for(const b of bombs) jobs.push({d:cameraSpace({x:b.x,y:b.y,z:b.z}).z, draw:()=>drawBomb(b)});
  for(const b of bots) if(!b.dead) jobs.push({d:cameraSpace({x:b.x,y:1,z:b.z}).z, draw:()=>drawBot(b)});
  for(const p of particles) jobs.push({d:cameraSpace({x:p.x,y:p.y,z:p.z}).z, draw:()=>drawParticle(p)});
  for(const t of texts) jobs.push({d:cameraSpace({x:t.x,y:t.y,z:t.z}).z, draw:()=>drawText3D(t)});

  jobs.sort((a,b)=>b.d-a.d);
  for(const j of jobs) if(j.d>.1) j.draw();

  drawHand();
  drawPostProcess();
}
function drawPostProcess(){
  const pulse = Math.min(1, shakeState.trauma * 1.8 + (player.burning > 0 ? .18 : 0) + (player.frozen > 0 ? .12 : 0));
  const vignette=ctx.createRadialGradient(W/2,H*.48,Math.min(W,H)*.18,W/2,H*.52,Math.max(W,H)*.72);
  vignette.addColorStop(0,"rgba(0,0,0,0)");
  vignette.addColorStop(.62,"rgba(0,0,0,.08)");
  vignette.addColorStop(1,`rgba(0,0,0,${.42 + pulse*.16})`);
  ctx.fillStyle=vignette; ctx.fillRect(0,0,W,H);
  if(player.frozen > 0){ ctx.fillStyle="rgba(145,232,255,.08)"; ctx.fillRect(0,0,W,H); }
  if(player.burning > 0){ ctx.fillStyle="rgba(255,96,28,.06)"; ctx.fillRect(0,0,W,H); }
}
function drawBackground(){
  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,"#6ea7d6"); sky.addColorStop(.48,"#c8dceb"); sky.addColorStop(.72,"#ead6ad"); sky.addColorStop(1,"#66706b");
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

  const horizon=H*(.52+cam.pitch*.28);
  const haze=ctx.createLinearGradient(0,horizon-80,0,horizon+120);
  haze.addColorStop(0,"rgba(255,255,255,0)"); haze.addColorStop(.55,"rgba(255,232,181,.28)"); haze.addColorStop(1,"rgba(18,24,28,.32)");
  ctx.fillStyle=haze; ctx.fillRect(0,horizon-90,W,230);

  // soft background silhouettes make the arena feel enclosed even when looking at the far wall.
  ctx.fillStyle="rgba(38,52,59,.22)";
  for(let i=0;i<9;i++){
    const x=(i*173 - (cam.yaw*70)%173)-110;
    const w=80+(i%3)*42, h=70+(i%4)*24;
    ctx.fillRect(x,horizon-h,w,h);
  }

  ctx.fillStyle="rgba(255,255,255,.20)";
  for(let i=0;i<8;i++){
    const x=(i*271 + performance.now()*0.006)% (W+260)-130;
    ctx.beginPath(); ctx.ellipse(x,70+i*23,150,20,0,0,TAU); ctx.fill();
  }
}
function drawGround(){
  const pts=[{x:-WORLD_W/2,y:0,z:-WORLD_D/2},{x:WORLD_W/2,y:0,z:-WORLD_D/2},{x:WORLD_W/2,y:0,z:WORLD_D/2},{x:-WORLD_W/2,y:0,z:WORLD_D/2}];
  drawPoly(pts,"#59615d");

  // Piso real de arena: loseta de concreto, sin franjas tipo fondo corrido.
  for(let gx=-56;gx<=56;gx+=4) drawLine3D({x:gx,y:.02,z:-44},{x:gx,y:.02,z:44},"rgba(255,255,255,.075)",1);
  for(let gz=-44;gz<=44;gz+=4) drawLine3D({x:-56,y:.02,z:gz},{x:56,y:.02,z:gz},"rgba(255,255,255,.085)",1);
  for(let gx=-56;gx<=56;gx+=16) drawLine3D({x:gx,y:.025,z:-44},{x:gx,y:.025,z:44},"rgba(0,0,0,.16)",2);
  for(let gz=-44;gz<=44;gz+=16) drawLine3D({x:-56,y:.025,z:gz},{x:56,y:.025,z:gz},"rgba(0,0,0,.16)",2);
}
function circleGround(cx,cz,r,n=20,y=.02){
  const pts=[]; for(let i=0;i<n;i++){const a=i/n*TAU;pts.push({x:cx+Math.sin(a)*r,y,z:cz+Math.cos(a)*r});} return pts;
}
function colorFor(o){
  const m={wall:"#56616c",container:"#526b84",concrete:"#96948c",sand:"#a48759",crate:"#8b613b",barrel:"#b96638",ruin:"#77756f",tower:"#6b5a42"};
  return m[o.type]||"#777";
}
function fogColor(alpha){ return `rgba(211,223,224,${alpha})`; }
function shade(hex,m){
  const c=hex.replace("#",""); let r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
  r=clamp(r*m|0,0,255); g=clamp(g*m|0,0,255); b=clamp(b*m|0,0,255);
  return `rgb(${r},${g},${b})`;
}
function drawBox(o){
  const x0=o.x-o.w/2,x1=o.x+o.w/2,z0=o.z-o.d/2,z1=o.z+o.d/2,y0=0,y1=o.h,p=(x,y,z)=>({x,y,z}),base=colorFor(o);
  const faces=[
    [[p(x0,y1,z0),p(x1,y1,z0),p(x1,y1,z1),p(x0,y1,z1)],shade(base,1.16)],
    [[p(x0,y0,z1),p(x1,y0,z1),p(x1,y1,z1),p(x0,y1,z1)],shade(base,.92)],
    [[p(x1,y0,z0),p(x0,y0,z0),p(x0,y1,z0),p(x1,y1,z0)],shade(base,.70)],
    [[p(x0,y0,z0),p(x0,y0,z1),p(x0,y1,z1),p(x0,y1,z0)],shade(base,.82)],
    [[p(x1,y0,z1),p(x1,y0,z0),p(x1,y1,z0),p(x1,y1,z1)],shade(base,.78)]
  ];
  faces.sort((a,b)=>depthOf(b[0])-depthOf(a[0]));
  for(const [pts,col] of faces) drawPoly(pts,col,"rgba(0,0,0,.35)");
  if(o.type==="wall"){
    const seam="rgba(255,255,255,.16)", rim="rgba(8,12,18,.52)";
    drawLine3D(p(x0,y1+.04,z0),p(x1,y1+.04,z0),rim,3);
    drawLine3D(p(x1,y1+.04,z0),p(x1,y1+.04,z1),rim,3);
    drawLine3D(p(x1,y1+.04,z1),p(x0,y1+.04,z1),rim,3);
    drawLine3D(p(x0,y1+.04,z1),p(x0,y1+.04,z0),rim,3);
    for(let y=1.8;y<y1-.2;y+=1.8){
      drawLine3D(p(x0,y,z0+.04),p(x1,y,z0+.04),seam,1);
      drawLine3D(p(x0,y,z1-.04),p(x1,y,z1-.04),seam,1);
      drawLine3D(p(x0+.04,y,z0),p(x0+.04,y,z1),seam,1);
      drawLine3D(p(x1-.04,y,z0),p(x1-.04,y,z1),seam,1);
    }
    for(let x=Math.ceil(x0/8)*8;x<x1;x+=8){
      drawLine3D(p(x,.05,z0+.05),p(x,y1-.1,z0+.05),seam,1);
      drawLine3D(p(x,.05,z1-.05),p(x,y1-.1,z1-.05),seam,1);
    }
    for(let z=Math.ceil(z0/8)*8;z<z1;z+=8){
      drawLine3D(p(x0+.05,.05,z),p(x0+.05,y1-.1,z),seam,1);
      drawLine3D(p(x1-.05,.05,z),p(x1-.05,y1-.1,z),seam,1);
    }
  }
  const centerDepth = cameraSpace({x:o.x,y:o.h*.5,z:o.z}).z;
  if(centerDepth > 18){
    const fog = clamp((centerDepth - 18) / 70, 0, .32);
    const face=[p(x0,y0,z1+.03),p(x1,y0,z1+.03),p(x1,y1,z1+.03),p(x0,y1,z1+.03)];
    drawPoly(face, fogColor(fog));
  }
  if(o.cracked){
    const p1=project({x:o.x-o.w*.25,y:o.h*.75,z:o.z+o.d/2+.02}), p2=project({x:o.x+o.w*.20,y:o.h*.35,z:o.z+o.d/2+.02});
    if(p1&&p2){ctx.strokeStyle="rgba(0,0,0,.72)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo((p1.x+p2.x)/2+8,(p1.y+p2.y)/2-12);ctx.lineTo(p2.x,p2.y);ctx.stroke();}
  }
}
function drawGrass(g){
  const a=project({x:g.x,y:0,z:g.z}), b=project({x:g.x,y:g.h,z:g.z});
  if(!a||!b)return;
  ctx.strokeStyle=g.c; ctx.lineWidth=Math.max(1,2*b.scale/120);
  ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
}
function drawPack(p){
  const center=project({x:p.x,y:.65+Math.sin(p.spin*3)*.1,z:p.z}); if(!center)return;
  const t=bombTypes[p.type], size=Math.max(8,.45*center.scale);
  ctx.save();
  ctx.shadowColor=t.color; ctx.shadowBlur=15;
  ctx.fillStyle="rgba(10,12,16,.8)";
  ctx.beginPath(); ctx.ellipse(center.x,center.y+size*.9,size*1.2,size*.42,0,0,TAU); ctx.fill();
  ctx.fillStyle=t.color; ctx.strokeStyle="#000"; ctx.lineWidth=2;
  for(let i=0;i<Math.min(t.pack,6);i++){
    const a=i/Math.min(t.pack,6)*TAU+p.spin;
    ctx.beginPath(); ctx.arc(center.x+Math.sin(a)*size*.55,center.y+Math.cos(a)*size*.25,size*.32,0,TAU); ctx.fill(); ctx.stroke();
  }
  ctx.shadowBlur=0; ctx.fillStyle="#fff"; ctx.font=`900 ${Math.max(10,size*.55)}px sans-serif`; ctx.textAlign="center";
  ctx.fillText("+"+t.pack+" "+t.name,center.x,center.y-size*.9);
  ctx.restore();
}
function drawBomb(b){
  const p=project({x:b.x,y:b.y,z:b.z}); if(!p)return;
  const t=bombTypes[b.type], s=Math.max(4,b.r*p.scale);
  const sh=project({x:b.x,y:.02,z:b.z});
  if(sh){ctx.fillStyle="rgba(0,0,0,.28)";ctx.beginPath();ctx.ellipse(sh.x,sh.y,s*1.5,s*.45,0,0,TAU);ctx.fill();}
  ctx.fillStyle=t.color;ctx.strokeStyle="#000";ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,s,0,TAU);ctx.fill();ctx.stroke();
  if(t.id==="trap"){ctx.strokeStyle="#ff3e38";ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,s*.6+Math.sin(b.age*12)*2,0,TAU);ctx.stroke();}
  else{ctx.strokeStyle="#4b3218";ctx.beginPath();ctx.moveTo(p.x+s*.35,p.y-s*.35);ctx.quadraticCurveTo(p.x+s*.9,p.y-s*1.2,p.x+s*1.2,p.y-s);ctx.stroke();ctx.fillStyle="#ffd24d";ctx.beginPath();ctx.arc(p.x+s*1.23,p.y-s,Math.max(2,s*.18),0,TAU);ctx.fill();}
}
function drawBot(b){
  const feet=project({x:b.x,y:0,z:b.z}), head=project({x:b.x,y:1.95,z:b.z});
  if(!feet||!head)return;
  const height=clamp(feet.y-head.y,18,230), scale=height/92, cx=head.x, top=head.y;
  const stride=Math.sin(b.anim*7.4)*(b.frozen>0?.22:1)*(b.lean||0);
  const bounce=Math.abs(Math.sin(b.anim*7.4))*5*scale*(b.lean||0);
  const bodyLean=Math.sin((b.yaw||0)-cam.yaw)*7*scale*(b.lean||0);
  const throwPose=b.throwAnim>0?easeOut(clamp(b.throwAnim/.35,0,1))*24*scale:0;
  ctx.save();
  const sh=project({x:b.x,y:.02,z:b.z});
  if(sh){ctx.fillStyle="rgba(0,0,0,.30)";ctx.beginPath();ctx.ellipse(sh.x,sh.y,22*scale,7*scale,0,0,TAU);ctx.fill();}
  const headR=13*scale, neckY=top+headR*2.1+bounce, chestY=top+height*.38+bounce, hipY=top+height*.64+bounce, footY=feet.y;
  const shoulderL={x:cx-13*scale+bodyLean,y:chestY}, shoulderR={x:cx+13*scale+bodyLean,y:chestY};
  const hipL={x:cx-8*scale-bodyLean*.25,y:hipY}, hipR={x:cx+8*scale-bodyLean*.25,y:hipY};
  ctx.lineCap="round"; ctx.lineJoin="round";
  ctx.strokeStyle="#050505"; ctx.lineWidth=Math.max(3,7*scale);
  ctx.beginPath();
  ctx.moveTo(cx+bodyLean*.45,neckY);ctx.quadraticCurveTo(cx+bodyLean,chestY,cx-bodyLean*.25,hipY);
  ctx.moveTo(shoulderL.x,shoulderL.y);ctx.quadraticCurveTo(cx-25*scale-stride*13,top+height*.48,cx-19*scale-stride*20,top+height*.58);
  ctx.moveTo(shoulderR.x,shoulderR.y);ctx.quadraticCurveTo(cx+26*scale+throwPose+stride*8,top+height*.46-throwPose*.55,cx+21*scale+throwPose,top+height*.58-throwPose*.35);
  ctx.moveTo(hipL.x,hipL.y);ctx.quadraticCurveTo(cx-18*scale+stride*18,top+height*.80,cx-17*scale-stride*11,footY);
  ctx.moveTo(hipR.x,hipR.y);ctx.quadraticCurveTo(cx+18*scale-stride*18,top+height*.80,cx+17*scale+stride*11,footY);
  ctx.stroke();
  ctx.fillStyle="#252b31";ctx.beginPath();ctx.roundRect(cx-11*scale+bodyLean*.5,chestY-4*scale,22*scale,25*scale,5*scale);ctx.fill();
  ctx.fillStyle="#050505";ctx.beginPath();ctx.arc(cx+bodyLean*.65,top+headR+bounce*.4,headR,0,TAU);ctx.fill();
  ctx.strokeStyle=b.frozen>0?"#91e8ff":b.burning>0?"#ff6a20":b.color;ctx.lineWidth=Math.max(2,3*scale);ctx.beginPath();ctx.arc(cx+bodyLean*.65,top+headR+bounce*.4,headR+2*scale,-.75,.75);ctx.stroke();
  if(b.ammo.some(v=>v>0)){ctx.fillStyle="#111";ctx.beginPath();ctx.arc(cx+29*scale+throwPose,top+height*.56-throwPose*.35,6*scale,0,TAU);ctx.fill();}
  ctx.fillStyle="rgba(0,0,0,.75)";ctx.fillRect(cx-26*scale,top-10*scale,52*scale,5*scale);
  ctx.fillStyle="#ff5d4d";ctx.fillRect(cx-26*scale,top-10*scale,52*scale*clamp(b.hp/b.maxHp,0,1),5*scale);
  ctx.fillStyle="rgba(255,255,255,.88)";ctx.font=`900 ${Math.max(9,11*scale)}px sans-serif`;ctx.textAlign="center";ctx.fillText(b.name,cx,top-15*scale);
  ctx.restore();
}
function drawParticle(p){
  const pr=project({x:p.x,y:p.y,z:p.z}); if(!pr)return;
  const alpha=clamp(p.life/(p.max||1),0,1);
  ctx.save();ctx.globalAlpha=alpha;
  if(p.type==="blast"){
    const s=p.r*pr.scale;
    const g=ctx.createRadialGradient(pr.x,pr.y,0,pr.x,pr.y,s);
    g.addColorStop(0,"#fff9c6"); g.addColorStop(.18,p.color||"#ffbd41"); g.addColorStop(.55,"rgba(255,120,26,.28)"); g.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(pr.x,pr.y,s,0,TAU);ctx.fill();
  }else if(p.type==="shockwave"){
    const s=p.r*pr.scale;
    ctx.globalAlpha=alpha*.55; ctx.strokeStyle=p.color||"#ffd24d"; ctx.lineWidth=Math.max(2,5*alpha);
    ctx.beginPath();ctx.ellipse(pr.x,pr.y,s,s*.22,0,0,TAU);ctx.stroke();
  }else if(p.type==="spark"){
    ctx.strokeStyle=p.color||"#ffd24d";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pr.x,pr.y);ctx.lineTo(pr.x-p.vx*pr.scale*.04,pr.y+p.vy*pr.scale*.04);ctx.stroke();
  }else{
    if(p.type==="smoke"){
      const s=Math.max(4,p.size*pr.scale*(p.grow||1)*(1.2-alpha*.35));
      const g=ctx.createRadialGradient(pr.x,pr.y,0,pr.x,pr.y,s);
      g.addColorStop(0,"rgba(58,55,52,.55)"); g.addColorStop(1,"rgba(35,35,35,0)");
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(pr.x,pr.y,s,0,TAU);ctx.fill();
    }else{
      ctx.fillStyle=p.color || (p.type==="ice"?"#91e8ff":p.type==="fire"?"#ff6a20":p.type==="debris"?"#654a35":"#b9b9b9");
      const s=Math.max(2,p.size*pr.scale);
      ctx.translate(pr.x,pr.y);ctx.rotate(p.rot);ctx.fillRect(-s/2,-s/2,s,s);
    }
  }
  ctx.restore();
}
function drawText3D(t){
  const p=project({x:t.x,y:t.y,z:t.z}); if(!p)return;
  ctx.save(); ctx.globalAlpha=clamp(t.life/t.max,0,1);
  ctx.font="900 20px sans-serif"; ctx.textAlign="center"; ctx.strokeStyle="#000"; ctx.lineWidth=4; ctx.fillStyle=t.color;
  ctx.strokeText(t.text,p.x,p.y);ctx.fillText(t.text,p.x,p.y);
  ctx.restore();
}
function drawHand(){
  const x=W/2+155+hand.throw*60, y=H*.78+Math.sin(performance.now()/150)*4-hand.bob*80;
  ctx.save();
  ctx.fillStyle=player.color; ctx.strokeStyle="#303641"; ctx.lineWidth=5;
  ctx.beginPath(); ctx.ellipse(x,y+55,58,92,.42,0,TAU); ctx.fill(); ctx.stroke();
  if(player.ammo[player.sel]>0){
    const t=bombTypes[player.sel];
    ctx.fillStyle=t.color; ctx.strokeStyle="#000"; ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(x-38,y-18,38,0,TAU);ctx.fill();ctx.stroke();
    if(t.id!=="trap"){
      ctx.strokeStyle="#51371d";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-12,y-40);ctx.quadraticCurveTo(x+24,y-72,x+55,y-55);ctx.stroke();
      ctx.fillStyle="#ffd24d";ctx.beginPath();ctx.arc(x+60,y-55,7+Math.sin(performance.now()/60)*2,0,TAU);ctx.fill();
    }else{
      ctx.strokeStyle="#ff3e38";ctx.lineWidth=4;ctx.beginPath();ctx.arc(x-38,y-18,18+Math.sin(performance.now()/90)*3,0,TAU);ctx.stroke();
    }
  }else{
    ctx.fillStyle="rgba(255,255,255,.22)";ctx.font="900 16px sans-serif";ctx.textAlign="center";ctx.fillText("SIN BOMBA",x-40,y-30);
  }
  ctx.restore();
}

// ---------- HUD ----------
function renderHUD(){
  document.body.classList.toggle("lowhp", playing && player.hp > 0 && player.hp < 32);
  document.body.classList.toggle("hurting", hurtFlash > 0);
  UI.crosshair.classList.toggle("cooldown", player.cd > 0 || player.ammo[player.sel] <= 0);
  UI.timer.textContent=fmt(matchTime);
  UI.hpText.textContent="♥ "+Math.max(0,Math.round(player.hp))+"/100";
  UI.hpBar.style.width=clamp(player.hp/player.maxHp*100,0,100)+"%";
  UI.stamBar.style.width=clamp(player.st,0,100)+"%";
  UI.fpsText.textContent=`FPS ${fps} · Bots ${bots.filter(b=>!b.dead).length} · Obst. ${obstacles.filter(o=>!o.dead).length}`;
  [...UI.inv.children].forEach((el,i)=>{
    el.classList.toggle("active",i===player.sel);
    el.classList.toggle("empty",player.ammo[i] <= 0);
    const q=el.querySelector(".qty"); if(q) q.textContent="x"+player.ammo[i];
  });
  const aliveBots=bots.filter(b=>!b.dead).length;
  const board=[[player.name,player.hp>0?Math.max(1,Math.ceil(player.hp/28)):0],...bots.map(b=>[b.name,b.dead?0:Math.max(1,Math.ceil(b.hp/28))])].sort((a,b)=>b[1]-a[1]).slice(0,4);
  UI.score.innerHTML=`<h3>BOMB ROYALE FPS</h3><div class="line"><span>Ronda</span><b>${aliveBots}/${bots.length} bots</b></div>`+board.map((b,i)=>`<div class="line" style="color:${i===0?settings.uiAccent:"#dce2ea"}"><span>${i+1} ${b[0]}</span><b>${b[1]}</b></div>`).join("");
  drawMinimap();
}
function drawMinimap(){
  const r=mini.width/2; mctx.clearRect(0,0,mini.width,mini.height);
  mctx.save();mctx.translate(r,r);
  mctx.fillStyle="rgba(8,11,16,.9)";mctx.beginPath();mctx.arc(0,0,r,0,TAU);mctx.fill();
  mctx.save();mctx.beginPath();mctx.arc(0,0,r-5,0,TAU);mctx.clip();
  mctx.fillStyle="#35422e";mctx.fillRect(-r,-r,2*r,2*r);
  for(const o of obstacles)if(!o.dead){mctx.fillStyle="rgba(255,255,255,.2)";const x=o.x/WORLD_W*2*r,z=o.z/WORLD_D*2*r;mctx.fillRect(x-o.w/WORLD_W*r,z-o.d/WORLD_D*r,Math.max(2,o.w/WORLD_W*2*r),Math.max(2,o.d/WORLD_D*2*r));}
  for(const p of packs)if(!p.dead){mctx.fillStyle=bombTypes[p.type].color;mctx.beginPath();mctx.arc(p.x/WORLD_W*2*r,p.z/WORLD_D*2*r,3,0,TAU);mctx.fill();}
  for(const b of bots)if(!b.dead){mctx.fillStyle="#ff5d4d";mctx.beginPath();mctx.arc(b.x/WORLD_W*2*r,b.z/WORLD_D*2*r,4,0,TAU);mctx.fill();}
  const px=player.x/WORLD_W*2*r,pz=player.z/WORLD_D*2*r;
  mctx.fillStyle=player.color;mctx.beginPath();mctx.moveTo(px+Math.sin(player.yaw)*10,pz+Math.cos(player.yaw)*10);mctx.lineTo(px+Math.sin(player.yaw+2.35)*7,pz+Math.cos(player.yaw+2.35)*7);mctx.lineTo(px+Math.sin(player.yaw-2.35)*7,pz+Math.cos(player.yaw-2.35)*7);mctx.fill();
  mctx.restore();mctx.strokeStyle="rgba(255,255,255,.3)";mctx.lineWidth=2;mctx.beginPath();mctx.arc(0,0,r-2,0,TAU);mctx.stroke();mctx.restore();
}
function message(txt, seconds=1.4){
  UI.message.textContent=txt;
  clearTimeout(message.t);
  message.t=setTimeout(()=>{if(UI.message.textContent===txt)UI.message.textContent=""},seconds*1000);
}

// ---------- Main loop ----------
function loop(now){
  const rawDt=(now-last)/1000; last=now;
  fpsTime+=rawDt; fpsFrames++;
  if(fpsTime>=.5){fps=Math.round(fpsFrames/fpsTime);fpsFrames=0;fpsTime=0;}
  accumulator += Math.min(.25, rawDt);
  let steps = 0;
  while(accumulator >= SIM_DT && steps < 5){
    update(SIM_DT);
    accumulator -= SIM_DT;
    steps++;
  }
  const renderInterval = 1/settings.fpsCap;
  if(!loop.lastRender || now - loop.lastRender >= renderInterval * 1000){
    render();
    renderHUD();
    loop.lastRender = now;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
