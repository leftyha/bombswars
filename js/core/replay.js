import { cloneState, compactSnapshot, diffSnapshots, resetIds } from './state.js';
import { stepSimulation } from './simulation.js';
export function createReplay(initialState){ return { initialState:cloneState(initialState), frames:[] }; }
export function recordFrame(replay,tick,inputs,snapshot){ replay.frames.push({tick,inputs:cloneState(inputs),snapshot:compactSnapshot(snapshot)}); }
export function replay(replayFile){ const state=cloneState(replayFile.initialState); for(const frame of replayFile.frames) stepSimulation(state, frame.inputs); return state; }
export function assertDeterministic(initialState, inputFrames){ resetIds(); const a=cloneState(initialState); for(const inputs of inputFrames) stepSimulation(a, inputs); resetIds(); const b=cloneState(initialState); for(const inputs of inputFrames) stepSimulation(b, inputs); return JSON.stringify(compactSnapshot(a))===JSON.stringify(compactSnapshot(b)); }
export { compactSnapshot, diffSnapshots };
