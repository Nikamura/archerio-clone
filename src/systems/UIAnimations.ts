/**
 * UIAnimations - Centralized UI animation utilities
 *
 * Provides consistent animation effects across all scenes:
 * - Scene transitions (fade, slide, scale)
 * - Button hover/press effects
 * - Modal animations
 * - Element entrance/exit animations
 */

import Phaser from 'phaser'

/**
 * Scene transition types
 */
export enum TransitionType {
  FADE = 'fade',
  SLIDE_LEFT = 'slide_left',
  SLIDE_RIGHT = 'slide_right',
  SLIDE_UP = 'slide_up',
  SLIDE_DOWN = 'slide_down',
  SCALE = 'scale',
  NONE = 'none',
}

/**
 * Animation duration presets
 */
export const DURATION = {
  INSTANT: 0,
  FAST: 150,
  NORMAL: 250,
  SLOW: 400,
  VERY_SLOW: 600,
} as const

/**
 * Easing presets for different animation types
 */
export const EASING = {
  // Standard movement
  EASE_OUT: 'Power2.easeOut',
  EASE_IN: 'Power2.easeIn',
  EASE_IN_OUT: 'Power2.easeInOut',
  // Bouncy/elastic
  BOUNCE_OUT: 'Back.easeOut',
  BOUNCE_IN: 'Back.easeIn',
  ELASTIC: 'Elastic.easeOut',
  // Smooth
  SINE_IN_OUT: 'Sine.easeInOut',
  // Linear
  LINEAR: 'Linear',
} as const

/**
 * Button animation configuration
 */
export interface ButtonConfig {
  scaleOnHover?: number
  scaleOnPress?: number
  hoverDuration?: number
  pressDuration?: number
  hoverTint?: number
  pressTint?: number
}

const DEFAULT_BUTTON_CONFIG: ButtonConfig = {
  scaleOnHover: 1.05,
  scaleOnPress: 0.95,
  hoverDuration: 100,
  pressDuration: 50,
}

/**
 * Apply hover and press animations to a button/interactive element
 */
export function applyButtonEffects(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject & {
    setScale?: (scale: number) => void
    setTint?: (tint: number) => void
    clearTint?: () => void
    scale?: number
  },
  config: ButtonConfig = {}
): void {
  const mergedConfig = { ...DEFAULT_BUTTON_CONFIG, ...config }
  const originalScale = target.scale || 1

  // Hover effect
  target.on('pointerover', () => {
    scene.tweens.add({
      targets: target,
      scale: originalScale * (mergedConfig.scaleOnHover || 1),
      duration: mergedConfig.hoverDuration,
      ease: EASING.EASE_OUT,
    })
    if (mergedConfig.hoverTint && target.setTint) {
      target.setTint(mergedConfig.hoverTint)
    }
  })

  // Hover out - return to normal
  target.on('pointerout', () => {
    scene.tweens.add({
      targets: target,
      scale: originalScale,
      duration: mergedConfig.hoverDuration,
      ease: EASING.EASE_OUT,
    })
    if (target.clearTint) {
      target.clearTint()
    }
  })

  // Press effect
  target.on('pointerdown', () => {
    scene.tweens.add({
      targets: target,
      scale: originalScale * (mergedConfig.scaleOnPress || 1),
      duration: mergedConfig.pressDuration,
      ease: EASING.EASE_OUT,
    })
    if (mergedConfig.pressTint && target.setTint) {
      target.setTint(mergedConfig.pressTint)
    }
  })

  // Release effect - return to hover state
  target.on('pointerup', () => {
    scene.tweens.add({
      targets: target,
      scale: originalScale * (mergedConfig.scaleOnHover || 1),
      duration: mergedConfig.hoverDuration,
      ease: EASING.BOUNCE_OUT,
    })
    if (target.clearTint) {
      target.clearTint()
    }
  })
}

/**
 * Create a scene fade in effect
 */
export function fadeInScene(
  scene: Phaser.Scene,
  duration: number = DURATION.NORMAL,
  callback?: () => void
): void {
  scene.cameras.main.fadeIn(duration, 0, 0, 0)
  if (callback) {
    scene.time.delayedCall(duration, callback)
  }
}

/**
 * Create a scene fade out effect
 */
export function fadeOutScene(
  scene: Phaser.Scene,
  duration: number = DURATION.NORMAL,
  callback?: () => void
): void {
  scene.cameras.main.fadeOut(duration, 0, 0, 0)
  if (callback) {
    scene.time.delayedCall(duration, callback)
  }
}

/**
 * Transition to a new scene with animation
 */
export function transitionToScene(
  currentScene: Phaser.Scene,
  targetScene: string,
  transitionType: TransitionType = TransitionType.FADE,
  duration: number = DURATION.NORMAL,
  data?: object
): void {
  switch (transitionType) {
    case TransitionType.FADE:
      fadeOutScene(currentScene, duration, () => {
        currentScene.scene.start(targetScene, data)
      })
      break

    case TransitionType.SLIDE_LEFT:
      slideOutScene(currentScene, 'left', duration, () => {
        currentScene.scene.start(targetScene, data)
      })
      break

    case TransitionType.SLIDE_RIGHT:
      slideOutScene(currentScene, 'right', duration, () => {
        currentScene.scene.start(targetScene, data)
      })
      break

    case TransitionType.SLIDE_UP:
      slideOutScene(currentScene, 'up', duration, () => {
        currentScene.scene.start(targetScene, data)
      })
      break

    case TransitionType.SLIDE_DOWN:
      slideOutScene(currentScene, 'down', duration, () => {
        currentScene.scene.start(targetScene, data)
      })
      break

    case TransitionType.SCALE:
      scaleOutScene(currentScene, duration, () => {
        currentScene.scene.start(targetScene, data)
      })
      break

    case TransitionType.NONE:
    default:
      currentScene.scene.start(targetScene, data)
      break
  }
}

/**
 * Slide out scene animation
 */
function slideOutScene(
  scene: Phaser.Scene,
  direction: 'left' | 'right' | 'up' | 'down',
  duration: number,
  callback?: () => void
): void {
  const { width, height } = scene.cameras.main
  let targetX = 0
  let targetY = 0

  switch (direction) {
    case 'left':
      targetX = -width
      break
    case 'right':
      targetX = width
      break
    case 'up':
      targetY = -height
      break
    case 'down':
      targetY = height
      break
  }

  scene.tweens.add({
    targets: scene.cameras.main,
    scrollX: -targetX,
    scrollY: -targetY,
    duration,
    ease: EASING.EASE_IN,
    onComplete: callback,
  })
}

/**
 * Scale out scene animation
 */
function scaleOutScene(
  scene: Phaser.Scene,
  duration: number,
  callback?: () => void
): void {
  scene.tweens.add({
    targets: scene.cameras.main,
    zoom: 0.8,
    duration,
    ease: EASING.EASE_IN,
  })
  fadeOutScene(scene, duration, callback)
}

/**
 * Animate element entrance from a direction
 */
export function animateIn(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  direction: 'left' | 'right' | 'up' | 'down' | 'scale' = 'scale',
  duration: number = DURATION.NORMAL,
  delay: number = 0
): Phaser.Tweens.Tween {
  const sprite = target as Phaser.GameObjects.Sprite
  const originalX = sprite.x
  const originalY = sprite.y

  switch (direction) {
    case 'left':
      sprite.x = -100
      sprite.setAlpha(0)
      return scene.tweens.add({
        targets: sprite,
        x: originalX,
        alpha: 1,
        duration,
        delay,
        ease: EASING.EASE_OUT,
      })

    case 'right':
      sprite.x = scene.cameras.main.width + 100
      sprite.setAlpha(0)
      return scene.tweens.add({
        targets: sprite,
        x: originalX,
        alpha: 1,
        duration,
        delay,
        ease: EASING.EASE_OUT,
      })

    case 'up':
      sprite.y = -100
      sprite.setAlpha(0)
      return scene.tweens.add({
        targets: sprite,
        y: originalY,
        alpha: 1,
        duration,
        delay,
        ease: EASING.EASE_OUT,
      })

    case 'down':
      sprite.y = scene.cameras.main.height + 100
      sprite.setAlpha(0)
      return scene.tweens.add({
        targets: sprite,
        y: originalY,
        alpha: 1,
        duration,
        delay,
        ease: EASING.EASE_OUT,
      })

    case 'scale':
    default:
      sprite.setScale(0)
      sprite.setAlpha(0)
      return scene.tweens.add({
        targets: sprite,
        scale: 1,
        alpha: 1,
        duration,
        delay,
        ease: EASING.BOUNCE_OUT,
      })
  }
}

/**
 * Animate element exit
 */
export function animateOut(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  direction: 'left' | 'right' | 'up' | 'down' | 'scale' = 'scale',
  duration: number = DURATION.NORMAL,
  callback?: () => void
): Phaser.Tweens.Tween {
  const sprite = target as Phaser.GameObjects.Sprite

  switch (direction) {
    case 'left':
      return scene.tweens.add({
        targets: sprite,
        x: -100,
        alpha: 0,
        duration,
        ease: EASING.EASE_IN,
        onComplete: callback,
      })

    case 'right':
      return scene.tweens.add({
        targets: sprite,
        x: scene.cameras.main.width + 100,
        alpha: 0,
        duration,
        ease: EASING.EASE_IN,
        onComplete: callback,
      })

    case 'up':
      return scene.tweens.add({
        targets: sprite,
        y: -100,
        alpha: 0,
        duration,
        ease: EASING.EASE_IN,
        onComplete: callback,
      })

    case 'down':
      return scene.tweens.add({
        targets: sprite,
        y: scene.cameras.main.height + 100,
        alpha: 0,
        duration,
        ease: EASING.EASE_IN,
        onComplete: callback,
      })

    case 'scale':
    default:
      return scene.tweens.add({
        targets: sprite,
        scale: 0,
        alpha: 0,
        duration,
        ease: EASING.EASE_IN,
        onComplete: callback,
      })
  }
}

/**
 * Show a modal with animation
 */
export function showModal(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  duration: number = DURATION.NORMAL
): Phaser.Tweens.Tween {
  container.setScale(0.5)
  container.setAlpha(0)

  return scene.tweens.add({
    targets: container,
    scale: 1,
    alpha: 1,
    duration,
    ease: EASING.BOUNCE_OUT,
  })
}

/**
 * Hide a modal with animation
 */
export function hideModal(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  duration: number = DURATION.FAST,
  callback?: () => void
): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: container,
    scale: 0.8,
    alpha: 0,
    duration,
    ease: EASING.EASE_IN,
    onComplete: callback,
  })
}

/**
 * Create a pulse animation (repeating scale)
 */
export function pulse(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  scale: number = 1.1,
  duration: number = 500
): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: target,
    scale: { from: 1, to: scale },
    duration,
    yoyo: true,
    repeat: -1,
    ease: EASING.SINE_IN_OUT,
  })
}

/**
 * Create a glow effect (pulsing alpha)
 */
export function glow(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  minAlpha: number = 0.5,
  maxAlpha: number = 1,
  duration: number = 600
): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: target,
    alpha: { from: minAlpha, to: maxAlpha },
    duration,
    yoyo: true,
    repeat: -1,
    ease: EASING.SINE_IN_OUT,
  })
}

/**
 * Create a shake animation
 */
export function shake(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  intensity: number = 5,
  duration: number = 300
): void {
  const sprite = target as Phaser.GameObjects.Sprite
  const originalX = sprite.x

  scene.tweens.add({
    targets: sprite,
    x: { from: originalX - intensity, to: originalX + intensity },
    duration: 50,
    yoyo: true,
    repeat: Math.floor(duration / 100),
    ease: EASING.SINE_IN_OUT,
    onComplete: () => {
      sprite.x = originalX
    },
  })
}

/**
 * Create a bounce animation
 */
export function bounce(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  height: number = 10,
  duration: number = 300
): Phaser.Tweens.Tween {
  const sprite = target as Phaser.GameObjects.Sprite
  const originalY = sprite.y

  return scene.tweens.add({
    targets: sprite,
    y: originalY - height,
    duration: duration / 2,
    ease: EASING.EASE_OUT,
    yoyo: true,
    onComplete: () => {
      sprite.y = originalY
    },
  })
}

/**
 * Stagger animation for multiple elements
 */
export function staggerIn(
  scene: Phaser.Scene,
  targets: Phaser.GameObjects.GameObject[],
  direction: 'left' | 'right' | 'up' | 'down' | 'scale' = 'up',
  duration: number = DURATION.NORMAL,
  staggerDelay: number = 50
): void {
  targets.forEach((target, index) => {
    animateIn(scene, target, direction, duration, index * staggerDelay)
  })
}

/**
 * Create a color flash effect
 */
export function flash(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  color: number = 0xffffff,
  duration: number = 100,
  repeat: number = 2
): void {
  const sprite = target as Phaser.GameObjects.Sprite
  let flashCount = 0

  const doFlash = () => {
    if (flashCount >= repeat * 2) {
      sprite.clearTint?.()
      return
    }

    if (flashCount % 2 === 0) {
      sprite.setTint?.(color)
    } else {
      sprite.clearTint?.()
    }

    flashCount++
    scene.time.delayedCall(duration, doFlash)
  }

  doFlash()
}

/**
 * Floating animation (gentle up/down bob)
 */
export function float(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  amplitude: number = 5,
  duration: number = 1500
): Phaser.Tweens.Tween {
  const sprite = target as Phaser.GameObjects.Sprite
  const originalY = sprite.y

  return scene.tweens.add({
    targets: sprite,
    y: originalY - amplitude,
    duration,
    yoyo: true,
    repeat: -1,
    ease: EASING.SINE_IN_OUT,
  })
}

/**
 * Typewriter text effect
 */
export function typewriter(
  scene: Phaser.Scene,
  textObject: Phaser.GameObjects.Text,
  fullText: string,
  charDelay: number = 50,
  callback?: () => void
): void {
  textObject.setText('')
  let charIndex = 0

  const addChar = () => {
    if (charIndex < fullText.length) {
      textObject.setText(fullText.substring(0, charIndex + 1))
      charIndex++
      scene.time.delayedCall(charDelay, addChar)
    } else if (callback) {
      callback()
    }
  }

  addChar()
}

/**
 * Number counting animation
 */
export function countUp(
  scene: Phaser.Scene,
  textObject: Phaser.GameObjects.Text,
  startValue: number,
  endValue: number,
  duration: number = 1000,
  prefix: string = '',
  suffix: string = ''
): void {
  const startTime = scene.time.now

  const updateValue = () => {
    const elapsed = scene.time.now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const currentValue = Math.floor(startValue + (endValue - startValue) * progress)

    textObject.setText(`${prefix}${currentValue}${suffix}`)

    if (progress < 1) {
      scene.time.delayedCall(16, updateValue) // ~60fps
    }
  }

  updateValue()
}

/**
 * Create a shine/glint effect across an element
 */
export function shine(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Rectangle,
  duration: number = 800
): void {
  const { x, y, width, height } = target

  // Create shine graphic
  const shineGraphics = scene.add.graphics()
  shineGraphics.fillStyle(0xffffff, 0.3)
  shineGraphics.fillRect(0, 0, 20, height)

  // Create a mask for the shine
  const mask = scene.make.graphics({})
  mask.fillRect(x - width / 2, y - height / 2, width, height)
  shineGraphics.setMask(mask.createGeometryMask())

  // Position shine to the left
  shineGraphics.setPosition(x - width / 2 - 20, y - height / 2)

  // Animate shine across
  scene.tweens.add({
    targets: shineGraphics,
    x: x + width / 2 + 20,
    duration,
    ease: EASING.LINEAR,
    onComplete: () => {
      shineGraphics.destroy()
      mask.destroy()
    },
  })
}
