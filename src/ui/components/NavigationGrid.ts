import Phaser from 'phaser'
import { audioManager } from '../../systems/AudioManager'
import { transitionToScene, TransitionType, DURATION } from '../../systems/UIAnimations'

export interface NavGridItem {
  id: string
  icon: string
  label: string
  scene?: string
  badge?: number
  onClick?: () => void
}

export interface NavigationGridConfig {
  scene: Phaser.Scene
  x: number
  y: number
  width: number
  items: NavGridItem[]
  columns?: number
  depth?: number
}

export interface NavigationGridResult {
  container: Phaser.GameObjects.Container
  updateBadge: (id: string, count: number) => void
  destroy: () => void
}

const ITEM_SIZE = 60
const ITEM_GAP = 8
const LABEL_OFFSET = 8
const BADGE_COLOR = 0xff4444

/**
 * NavigationGrid - Grid of icon buttons with labels for main menu navigation
 */
export function createNavigationGrid(config: NavigationGridConfig): NavigationGridResult {
  const { scene, x, y, items, columns = 5, depth = 10 } = config

  const container = scene.add.container(x, y)
  container.setDepth(depth)

  const gridItems: Map<
    string,
    {
      container: Phaser.GameObjects.Container
      badge?: Phaser.GameObjects.Container
      badgeText?: Phaser.GameObjects.Text
    }
  > = new Map()

  // Calculate grid layout
  const itemWidth = ITEM_SIZE + ITEM_GAP
  const totalGridWidth = columns * itemWidth - ITEM_GAP
  const startX = -totalGridWidth / 2 + ITEM_SIZE / 2

  items.forEach((item, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const itemX = startX + col * itemWidth
    const itemY = row * (ITEM_SIZE + LABEL_OFFSET + 16 + ITEM_GAP)

    const itemContainer = scene.add.container(itemX, itemY)
    container.add(itemContainer)

    // Background circle
    const bg = scene.add.circle(0, 0, ITEM_SIZE / 2, 0x2a2a4e, 0.8)
    bg.setStrokeStyle(2, 0x444466, 0.5)
    bg.setInteractive({ useHandCursor: true })
    itemContainer.add(bg)

    // Icon (centered in the circle)
    const icon = scene.add.text(0, 0, item.icon, {
      fontSize: '22px',
    })
    icon.setOrigin(0.5)
    itemContainer.add(icon)

    // Label below icon
    const label = scene.add.text(0, ITEM_SIZE / 2 + LABEL_OFFSET, item.label, {
      fontSize: '9px',
      color: '#aaaaaa',
    })
    label.setOrigin(0.5, 0)
    itemContainer.add(label)

    // Badge (if count > 0)
    let badgeContainer: Phaser.GameObjects.Container | undefined
    let badgeText: Phaser.GameObjects.Text | undefined

    if (item.badge && item.badge > 0) {
      badgeContainer = scene.add.container(ITEM_SIZE / 2 - 8, -ITEM_SIZE / 2 + 8)
      itemContainer.add(badgeContainer)

      const badgeCircle = scene.add.circle(0, 0, 10, BADGE_COLOR)
      badgeContainer.add(badgeCircle)

      badgeText = scene.add.text(0, 0, item.badge > 9 ? '9+' : `${item.badge}`, {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      badgeText.setOrigin(0.5)
      badgeContainer.add(badgeText)

      // Pulse animation
      scene.tweens.add({
        targets: badgeCircle,
        scale: { from: 1, to: 1.15 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    gridItems.set(item.id, {
      container: itemContainer,
      badge: badgeContainer,
      badgeText,
    })

    // Hover effect
    bg.on('pointerover', () => {
      bg.setFillStyle(0x3a3a5e, 1)
      bg.setStrokeStyle(2, 0x6a6a8e, 0.8)
      label.setColor('#ffffff')
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(0x2a2a4e, 0.8)
      bg.setStrokeStyle(2, 0x444466, 0.5)
      label.setColor('#aaaaaa')
    })

    // Click handler
    bg.on('pointerdown', () => {
      audioManager.playMenuSelect()

      if (item.onClick) {
        item.onClick()
      } else if (item.scene) {
        transitionToScene(scene, item.scene, TransitionType.FADE, DURATION.FAST)
      }
    })
  })

  const updateBadge = (id: string, count: number) => {
    const gridItem = gridItems.get(id)
    if (!gridItem) return

    if (count > 0) {
      if (!gridItem.badge) {
        const itemContainer = gridItem.container
        const badgeContainer = scene.add.container(ITEM_SIZE / 2 - 8, -ITEM_SIZE / 2 + 8)
        itemContainer.add(badgeContainer)

        const badgeCircle = scene.add.circle(0, 0, 10, BADGE_COLOR)
        badgeContainer.add(badgeCircle)

        const badgeText = scene.add.text(0, 0, count > 9 ? '9+' : `${count}`, {
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        badgeText.setOrigin(0.5)
        badgeContainer.add(badgeText)

        gridItem.badge = badgeContainer
        gridItem.badgeText = badgeText

        scene.tweens.add({
          targets: badgeCircle,
          scale: { from: 1, to: 1.15 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      } else if (gridItem.badgeText) {
        gridItem.badgeText.setText(count > 9 ? '9+' : `${count}`)
      }
    } else if (gridItem.badge) {
      gridItem.badge.destroy()
      gridItem.badge = undefined
      gridItem.badgeText = undefined
    }
  }

  const destroy = () => {
    container.destroy()
  }

  return {
    container,
    updateBadge,
    destroy,
  }
}
