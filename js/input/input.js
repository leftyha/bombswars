export function createInputState() { return { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, sprint: false, dash: false, throwBomb: false }; }
export function serializeInput(input, seq, dt) { return { ...input, seq, dt }; }
