/**
 * Game math utilities
 */

/**
 * Calculate angle between two points in radians
 */
export function angleBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.atan2(y2 - y1, x2 - x1)
}

/**
 * Calculate distance between two points
 */
export function distanceBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1)
}

/**
 * Calculate velocity components from angle and speed
 */
export function velocityFromAngle(
  angle: number,
  speed: number
): { x: number; y: number } {
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed,
  }
}

/**
 * Normalize an angle to be between -PI and PI
 */
export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI
  while (angle < -Math.PI) angle += 2 * Math.PI
  return angle
}
