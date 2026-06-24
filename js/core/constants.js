export const ROOM_STATES = Object.freeze({ CREATING:'CREATING', WAITING:'WAITING', COUNTDOWN:'COUNTDOWN', LIVE:'LIVE', OVERTIME:'OVERTIME', FINISHED:'FINISHED', CLOSING:'CLOSING' });
export const DEFAULT_ROOM_LIMITS = Object.freeze({ maxPlayers:10, minCasualPlayers:6, maxSpectators:4, maxBots:10, tickRate:20, maxEntities:320, interpolationMs:125 });
export const GAMEPLAY_EFFECTS = Object.freeze(['explosion','fire-zone','ice-zone','damage','pickup','ko','respawn','sudden-death']);
export const VISUAL_EFFECTS = Object.freeze(['particle','screen-shake','floating-text','decal','audio-cue']);
export const INPUT_FLAGS = Object.freeze({ sprint:1, dash:2, throwBomb:4 });
