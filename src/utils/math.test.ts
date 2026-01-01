import { describe, it, expect } from 'vitest'
import {
  angleBetween,
  distanceBetween,
  clamp,
  lerp,
  velocityFromAngle,
  normalizeAngle,
} from './math'

describe('angleBetween', () => {
  it('should return 0 for points on the same horizontal line (right)', () => {
    expect(angleBetween(0, 0, 10, 0)).toBe(0)
  })

  it('should return PI/2 for points directly below', () => {
    expect(angleBetween(0, 0, 0, 10)).toBeCloseTo(Math.PI / 2)
  })

  it('should return PI for points to the left', () => {
    expect(angleBetween(0, 0, -10, 0)).toBeCloseTo(Math.PI)
  })

  it('should return -PI/2 for points directly above', () => {
    expect(angleBetween(0, 0, 0, -10)).toBeCloseTo(-Math.PI / 2)
  })
})

describe('distanceBetween', () => {
  it('should return 0 for the same point', () => {
    expect(distanceBetween(5, 5, 5, 5)).toBe(0)
  })

  it('should calculate horizontal distance', () => {
    expect(distanceBetween(0, 0, 10, 0)).toBe(10)
  })

  it('should calculate vertical distance', () => {
    expect(distanceBetween(0, 0, 0, 10)).toBe(10)
  })

  it('should calculate diagonal distance (3-4-5 triangle)', () => {
    expect(distanceBetween(0, 0, 3, 4)).toBe(5)
  })
})

describe('clamp', () => {
  it('should return value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('should return min when value is below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('should return max when value is above range', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('should handle negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5)
    expect(clamp(-15, -10, -1)).toBe(-10)
    expect(clamp(0, -10, -1)).toBe(-1)
  })
})

describe('lerp', () => {
  it('should return start when t is 0', () => {
    expect(lerp(0, 100, 0)).toBe(0)
  })

  it('should return end when t is 1', () => {
    expect(lerp(0, 100, 1)).toBe(100)
  })

  it('should return midpoint when t is 0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50)
  })

  it('should clamp t to 0-1 range', () => {
    expect(lerp(0, 100, -0.5)).toBe(0)
    expect(lerp(0, 100, 1.5)).toBe(100)
  })

  it('should work with negative values', () => {
    expect(lerp(-100, 100, 0.5)).toBe(0)
  })
})

describe('velocityFromAngle', () => {
  it('should return positive x for angle 0', () => {
    const vel = velocityFromAngle(0, 100)
    expect(vel.x).toBeCloseTo(100)
    expect(vel.y).toBeCloseTo(0)
  })

  it('should return positive y for angle PI/2', () => {
    const vel = velocityFromAngle(Math.PI / 2, 100)
    expect(vel.x).toBeCloseTo(0)
    expect(vel.y).toBeCloseTo(100)
  })

  it('should return negative x for angle PI', () => {
    const vel = velocityFromAngle(Math.PI, 100)
    expect(vel.x).toBeCloseTo(-100)
    expect(vel.y).toBeCloseTo(0)
  })

  it('should scale with speed', () => {
    const vel1 = velocityFromAngle(0, 50)
    const vel2 = velocityFromAngle(0, 100)
    expect(vel2.x).toBeCloseTo(vel1.x * 2)
  })
})

describe('normalizeAngle', () => {
  it('should leave angles within -PI to PI unchanged', () => {
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(1)).toBe(1)
    expect(normalizeAngle(-1)).toBe(-1)
  })

  it('should wrap angles greater than PI', () => {
    expect(normalizeAngle(Math.PI + 0.5)).toBeCloseTo(-Math.PI + 0.5)
  })

  it('should wrap angles less than -PI', () => {
    expect(normalizeAngle(-Math.PI - 0.5)).toBeCloseTo(Math.PI - 0.5)
  })

  it('should handle multiple rotations', () => {
    expect(normalizeAngle(4 * Math.PI)).toBeCloseTo(0)
    expect(normalizeAngle(-4 * Math.PI)).toBeCloseTo(0)
  })
})
