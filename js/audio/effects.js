import { GAMEPLAY_EFFECTS, VISUAL_EFFECTS } from '../core/constants.js';
export function classifyEffect(type) { if (GAMEPLAY_EFFECTS.includes(type)) return 'gameplay'; if (VISUAL_EFFECTS.includes(type)) return 'visual'; return 'unknown'; }
