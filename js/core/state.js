let counters = new Map();
export function nextId(prefix){ const n=(counters.get(prefix)||0)+1; counters.set(prefix,n); return `${prefix}_${n}`; }
export function resetIds(){ counters = new Map(); }
export function createGameState(seed=1){ return { version:1, seed, tick:0, mode:'Bomb Royale', phase:'WAITING', matchTime:420, players:[], bots:[], bombs:[], pickups:[], obstacles:[], zones:[], score:{}, events:[], stats:{ startedAt:0, duration:0 } }; }
export function createActor(kind, data={}){ const id=data.id||nextId(kind); return { id, kind, name:data.name||id, x:data.x||0, z:data.z||0, vx:0, vz:0, yaw:data.yaw||0, pitch:0, hp:data.hp??100, maxHp:data.maxHp??100, ammo:data.ammo||[2,0,0,0,0], cooldowns:{ bomb:0, dash:0, pickup:0 }, flags:{ sprint:false, shield:false, dead:false }, stats:{ kos:0, deaths:0, bombsUsed:0 }, inputSeq:0, ...data }; }
export function serializeState(state){ return JSON.stringify(state); }
export function deserializeState(json){ return JSON.parse(json); }
export function cloneState(state){ return structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state)); }
export function compactSnapshot(state){ return { tick:state.tick, phase:state.phase, players:state.players.map(compactActor), bots:state.bots.map(compactActor), bombs:state.bombs.map(b=>({id:b.id,x:+b.x.toFixed(2),z:+b.z.toFixed(2),type:b.type,t:+b.timer.toFixed(2)})), events:state.events.slice(-16) }; }
function compactActor(a){ return { id:a.id, x:+a.x.toFixed(2), z:+a.z.toFixed(2), yaw:+a.yaw.toFixed(3), hp:Math.round(a.hp), dead:!!a.flags?.dead, score:a.score||0, seq:a.inputSeq||0 }; }
export function diffSnapshots(a,b){ const diff={ from:a.tick, tick:b.tick, players:[], bots:[], bombs:[], events:b.events||[] }; for (const group of ['players','bots','bombs']) { const old=new Map((a[group]||[]).map(e=>[e.id,e])); diff[group]=(b[group]||[]).filter(e=>JSON.stringify(old.get(e.id))!==JSON.stringify(e)); } return diff; }
