import Phaser from 'phaser'
import { currencyManager } from '../../systems/CurrencyManager'

export interface CurrencyBarConfig {
  scene: Phaser.Scene
  y?: number
  showGold?: boolean
  showGems?: boolean
  showEnergy?: boolean
  depth?: number
}

export interface CurrencyBarResult {
  container: Phaser.GameObjects.Container
  updateEnergy: () => void
  updateAll: () => void
  destroy: () => void
}

/**
 * CurrencyBar - Reusable currency display component
 * Shows gold, gems, and energy in a compact horizontal layout
 */
export function createCurrencyBar(config: CurrencyBarConfig): CurrencyBarResult {
  const {
    scene,
    y = 10,
    showGold = true,
    showGems = true,
    showEnergy = true,
    depth = 10,
  } = config

  const width = scene.cameras.main.width
  const container = scene.add.container(0, y)
  container.setDepth(depth)

  let goldText: Phaser.GameObjects.Text | null = null
  let gemsText: Phaser.GameObjects.Text | null = null
  let energyText: Phaser.GameObjects.Text | null = null
  let energyTimerText: Phaser.GameObjects.Text | null = null

  // Gold display (left)
  if (showGold) {
    goldText = scene.add.text(10, 0, `💰${currencyManager.get('gold')}`, {
      fontSize: '14px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 2,
    })
    container.add(goldText)
  }

  // Gems display (center)
  if (showGems) {
    gemsText = scene.add.text(width / 2, 0, `💎${currencyManager.get('gems')}`, {
      fontSize: '14px',
      color: '#00FFFF',
      stroke: '#000000',
      strokeThickness: 2,
    })
    gemsText.setOrigin(0.5, 0)
    container.add(gemsText)
  }

  // Energy display (right)
  if (showEnergy) {
    const currentEnergy = currencyManager.get('energy')
    const maxEnergy = currencyManager.getMaxEnergy()

    energyText = scene.add.text(width - 10, 0, `⚡${currentEnergy}/${maxEnergy}`, {
      fontSize: '14px',
      color: '#FFFF00',
      stroke: '#000000',
      strokeThickness: 2,
    })
    energyText.setOrigin(1, 0)
    container.add(energyText)

    // Energy timer (below energy)
    energyTimerText = scene.add.text(width - 10, 18, '', {
      fontSize: '11px',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 2,
    })
    energyTimerText.setOrigin(1, 0)
    container.add(energyTimerText)
  }

  const updateEnergy = () => {
    if (!energyText || !energyTimerText) return

    const currentEnergy = currencyManager.get('energy')
    const maxEnergy = currencyManager.getMaxEnergy()
    energyText.setText(`⚡${currentEnergy}/${maxEnergy}`)

    if (currentEnergy >= maxEnergy) {
      energyTimerText.setText('')
    } else {
      const timeString = currencyManager.getFormattedTimeUntilNextEnergy()
      energyTimerText.setText(`Next: ${timeString}`)
    }
  }

  const updateAll = () => {
    if (goldText) {
      goldText.setText(`💰${currencyManager.get('gold')}`)
    }
    if (gemsText) {
      gemsText.setText(`💎${currencyManager.get('gems')}`)
    }
    updateEnergy()
  }

  const destroy = () => {
    container.destroy()
  }

  return {
    container,
    updateEnergy,
    updateAll,
    destroy,
  }
}
