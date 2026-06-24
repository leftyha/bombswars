import assert from 'node:assert/strict'; import { createGameState, createActor, compactSnapshot, diffSnapshots } from '../js/core/state.js'; import { stepSimulation } from '../js/core/simulation.js'; import { assertDeterministic } from '../js/core/replay.js';
const s=createGameState(123); const p=createActor('player',{id:'p1'}); s.players.push(p); s.pickups.push({id:'pack1',x:1,z:0,type:0,amount:3});
const frames=[[{playerId:'p1',seq:1,moveX:1,moveZ:0,yaw:0,dt:.05}], [{playerId:'p1',seq:2,throwBomb:true,yaw:0,dt:.05}]];
assert.equal(assertDeterministic(s,frames),true); const before=compactSnapshot(s); stepSimulation(s,frames[0]); const after=compactSnapshot(s); assert.equal(diffSnapshots(before,after).players.length,1); console.log('simulation deterministic and snapshot diff ok');
