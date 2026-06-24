export class RateLimiter {
  constructor() { this.buckets = new Map(); }
  allow(key, max, windowMs, now = Date.now()) { const b = this.buckets.get(key) || []; while (b.length && b[0] < now - windowMs) b.shift(); if (b.length >= max) return false; b.push(now); this.buckets.set(key, b); return true; }
}
export function detectImpossibleInput(actor, input, dt = 1 / 20) {
  const problems = [];
  if (Math.abs(input.moveX || 0) > 1 || Math.abs(input.moveZ || 0) > 1) problems.push('excessive-move-axis');
  if ((input.dt || 0) > 0.2) problems.push('excessive-dt');
  if (input.dash && actor.cooldowns?.dash > 0) problems.push('dash-too-frequent');
  if (input.throwBomb && actor.cooldowns?.bomb > 0) problems.push('throw-too-frequent');
  const speed = Math.hypot(actor.vx || 0, actor.vz || 0);
  if (speed * dt > 12) problems.push('teleport-or-excessive-speed');
  return problems;
}
