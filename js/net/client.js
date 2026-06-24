import { MSG, encode, decode, makeInput } from './protocol.js'; import { stepSimulation } from '../core/simulation.js';
export class NetClient { constructor(url){ this.url=url; this.seq=0; this.pending=[]; this.snapshots=[]; this.metrics={ping:0,loss:0,connection:'closed'}; }
 connect(name='Player'){ this.ws=new WebSocket(this.url); this.metrics.connection='connecting'; this.ws.onopen=()=>{this.metrics.connection='open'; this.ws.send(encode({t:MSG.HELLO,name}));}; this.ws.onclose=()=>{this.metrics.connection='closed'; setTimeout(()=>this.connect(name),1000);}; this.ws.onmessage=e=>this.handle(decode(e.data)); }
 sendInput(playerId,data){ const input=makeInput(playerId,++this.seq,data); this.pending.push(input); this.ws?.readyState===1&&this.ws.send(encode(input)); return input; }
 predict(state,input){ stepSimulation(state,[input]); }
 handle(msg){ if(msg.t===MSG.SNAPSHOT){ this.snapshots.push({at:performance.now(),msg}); this.snapshots=this.snapshots.slice(-32); this.pending=this.pending.filter(i=>i.seq>(msg.ackSeq||0)); } if(msg.t===MSG.PONG) this.metrics.ping=performance.now()-msg.clientTime; }
 interpolationPair(delayMs=125){ const target=performance.now()-delayMs; let a,b; for(const s of this.snapshots){ if(s.at<=target) a=s; if(s.at>target){ b=s; break; } } return {a,b}; }
 }
