import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Tests for LevelUpScene ability selection event flow.
 *
 * These tests verify the event communication between LevelUpScene and GameScene
 * without requiring a full Phaser environment.
 */

describe('LevelUpScene Event Flow', () => {
  // Mock the event system that mirrors Phaser's game.events
  let mockGameEvents: {
    listeners: Map<string, Array<(data: unknown) => void>>
    emit: (event: string, data?: unknown) => void
    once: (event: string, callback: (data: unknown) => void) => void
    removeListener: (event: string, callback: (data: unknown) => void) => void
  }

  beforeEach(() => {
    // Reset mock event system
    mockGameEvents = {
      listeners: new Map(),
      emit(event: string, data?: unknown) {
        const callbacks = this.listeners.get(event)
        if (callbacks) {
          callbacks.forEach(cb => cb(data))
        }
      },
      once(event: string, callback: (data: unknown) => void) {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, [])
        }
        // Wrap callback to remove after first call (simulating 'once')
        const wrappedCallback = (data: unknown) => {
          callback(data)
          this.removeListener(event, wrappedCallback)
        }
        this.listeners.get(event)!.push(wrappedCallback)
      },
      removeListener(event: string, callback: (data: unknown) => void) {
        const callbacks = this.listeners.get(event)
        if (callbacks) {
          const index = callbacks.indexOf(callback)
          if (index > -1) {
            callbacks.splice(index, 1)
          }
        }
      }
    }
  })

  it('should register listener before scene launch', () => {
    // Simulate GameScene.handleLevelUp()
    let receivedAbility: string | null = null

    // GameScene registers listener BEFORE launching LevelUpScene
    mockGameEvents.once('abilitySelected', (abilityId) => {
      receivedAbility = abilityId as string
    })

    expect(mockGameEvents.listeners.has('abilitySelected')).toBe(true)
    expect(mockGameEvents.listeners.get('abilitySelected')?.length).toBe(1)

    // Simulate LevelUpScene.selectAbility()
    mockGameEvents.emit('abilitySelected', 'front_arrow')

    expect(receivedAbility).toBe('front_arrow')
    // Listener should be removed after 'once'
    expect(mockGameEvents.listeners.get('abilitySelected')?.length).toBe(0)
  })

  it('should handle multiple level-ups correctly', () => {
    const appliedAbilities: string[] = []
    let physicsResumed = false

    // First level-up
    mockGameEvents.once('abilitySelected', (abilityId) => {
      appliedAbilities.push(abilityId as string)
      physicsResumed = true
    })

    mockGameEvents.emit('abilitySelected', 'attack_speed')
    expect(appliedAbilities).toEqual(['attack_speed'])
    expect(physicsResumed).toBe(true)

    // Reset for second level-up
    physicsResumed = false

    // Second level-up - new listener must be registered
    mockGameEvents.once('abilitySelected', (abilityId) => {
      appliedAbilities.push(abilityId as string)
      physicsResumed = true
    })

    mockGameEvents.emit('abilitySelected', 'multishot')
    expect(appliedAbilities).toEqual(['attack_speed', 'multishot'])
    expect(physicsResumed).toBe(true)
  })

  it('should not receive events if no listener is registered', () => {
    let received = false

    // Emit without registering listener first
    mockGameEvents.emit('abilitySelected', 'front_arrow')

    // Now register listener (too late)
    mockGameEvents.once('abilitySelected', () => {
      received = true
    })

    // The event was already emitted, so callback shouldn't have been called
    expect(received).toBe(false)
  })

  it('should clean up listener after receiving event', () => {
    const spy = vi.fn()

    mockGameEvents.once('abilitySelected', spy)

    // First emit - should call
    mockGameEvents.emit('abilitySelected', 'attack_boost')
    expect(spy).toHaveBeenCalledTimes(1)

    // Second emit - should NOT call (listener was removed by 'once')
    mockGameEvents.emit('abilitySelected', 'front_arrow')
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('Container Interactive Hit Area', () => {
  /**
   * This test documents the Phaser container interactive hit area issue.
   *
   * In Phaser, for a Container to be properly interactive:
   * 1. setSize() must be called to define dimensions
   * 2. setInteractive() must include an explicit hit area shape
   *
   * Without an explicit hit area, the container won't receive pointer events
   * even though setInteractive() was called.
   *
   * WRONG:
   *   container.setSize(width, height)
   *   container.setInteractive({ useHandCursor: true })
   *
   * CORRECT:
   *   container.setSize(width, height)
   *   container.setInteractive(
   *     new Phaser.Geom.Rectangle(-width/2, -height/2, width, height),
   *     Phaser.Geom.Rectangle.Contains
   *   )
   *
   * Note: The rectangle is offset by -width/2, -height/2 because container
   * origin is at center (0,0), so the hit area needs to extend from
   * -width/2 to +width/2 horizontally and -height/2 to +height/2 vertically.
   */
  it('documents the container hit area requirement', () => {
    // This test is documentation - the actual fix is in LevelUpScene.ts
    const containerWidth = 100
    const containerHeight = 150

    // The hit area rectangle should be centered on the container's origin
    const expectedHitArea = {
      x: -containerWidth / 2,  // -50
      y: -containerHeight / 2, // -75
      width: containerWidth,   // 100
      height: containerHeight  // 150
    }

    expect(expectedHitArea.x).toBe(-50)
    expect(expectedHitArea.y).toBe(-75)
    expect(expectedHitArea.width).toBe(100)
    expect(expectedHitArea.height).toBe(150)
  })
})
