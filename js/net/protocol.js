export const MSG={ HELLO:'HELLO', WELCOME:'WELCOME', INPUT:'INPUT', SNAPSHOT:'SNAPSHOT', DIFF:'DIFF', PING:'PING', PONG:'PONG', RESULT:'RESULT', ERROR:'ERROR' };
export const makeInput=(playerId,seq,data)=>({ t:MSG.INPUT, playerId, seq, dt:data.dt??0.05, moveX:data.moveX||0, moveZ:data.moveZ||0, yaw:data.yaw||0, pitch:data.pitch||0, sprint:!!data.sprint, dash:!!data.dash, throwBomb:!!data.throwBomb });
export const encode=m=>JSON.stringify(m); export const decode=s=>JSON.parse(s);
