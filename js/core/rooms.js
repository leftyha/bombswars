import { ROOM_STATES, DEFAULT_ROOM_LIMITS } from './constants.js'; import { createGameState, createActor, nextId } from './state.js'; import { addBot } from './simulation.js';
export class Room { constructor({id=nextId('room'),region='local',limits={}}={}){ this.id=id; this.region=region; this.state=ROOM_STATES.CREATING; this.limits={...DEFAULT_ROOM_LIMITS,...limits}; this.game=createGameState(); this.spectators=new Set(); this.createdAt=Date.now(); this.state=ROOM_STATES.WAITING; }
 canJoin(){ return this.state===ROOM_STATES.WAITING && this.game.players.length < Math.floor(this.limits.maxPlayers*.9); }
 addPlayer(session){ if(!this.canJoin()) return null; const p=createActor('player',{id:session.id,name:session.name||session.id}); this.game.players.push(p); this.game.score[p.id]=0; return p; }
 fillWithBots(){ while(this.game.players.length+this.game.bots.length < this.limits.minCasualPlayers && this.game.bots.length < this.limits.maxBots) addBot(this.game,{name:`BOT ${this.game.bots.length+1}`}); }
 startCountdown(){ this.state=ROOM_STATES.COUNTDOWN; this.countdownUntil=Date.now()+3000; }
 setLive(){ this.state=ROOM_STATES.LIVE; this.game.phase='LIVE'; }
 }
export class Matchmaker { constructor(){ this.rooms=[]; } findRoom(region='local'){ let room=this.rooms.filter(r=>r.region===region&&r.canJoin()).sort((a,b)=>b.game.players.length-a.game.players.length)[0]; if(!room){ room=new Room({region}); this.rooms.push(room); } return room; } enqueue(session,region='local'){ const room=this.findRoom(region); const player=room.addPlayer(session); if(room.game.players.length>=room.limits.minCasualPlayers) room.startCountdown(); else room.fillWithBots(); return {room,player}; } }
