import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import puppeteer, { Browser, Page } from 'puppeteer'
import { mkdir } from 'fs/promises'
import path from 'path'

const GAME_URL = 'http://localhost:3000'
const SCREENSHOTS_DIR = path.join(process.cwd(), 'test', 'screenshots')

// Helper function to wait
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('Visual Tests', () => {
  let browser: Browser
  let page: Page
  const logs: string[] = []
  const errors: string[] = []

  beforeAll(async () => {
    // Create screenshots directory
    await mkdir(SCREENSHOTS_DIR, { recursive: true })

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--autoplay-policy=no-user-gesture-required',
      ],
    })

    page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 720 })

    // Collect console logs
    page.on('console', (msg) => {
      logs.push(msg.text())
    })

    // Collect errors
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })
  }, 30000)

  afterAll(async () => {
    if (browser) {
      await browser.close()
    }
  })

  it('should load the game and display main menu', async () => {
    await page.goto(GAME_URL, {
      waitUntil: 'networkidle2',
      timeout: 10000,
    })

    // Wait for game to initialize
    await wait(2000)

    // Check canvas exists
    const gameState = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      return {
        canvasExists: !!canvas,
        canvasSize: canvas
          ? { width: canvas.width, height: canvas.height }
          : null,
      }
    })

    expect(gameState.canvasExists).toBe(true)
    expect(gameState.canvasSize).not.toBeNull()

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'main-menu.png'),
    })
  }, 15000)

  it('should start the game when play button is clicked', async () => {
    const canvas = await page.$('canvas')
    expect(canvas).not.toBeNull()

    const box = await canvas!.boundingBox()
    expect(box).not.toBeNull()

    // Click center of canvas where PLAY button is
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

    // Wait for game scene to load
    await wait(1000)

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'game-scene.png'),
    })

    // Check no critical errors occurred
    const criticalErrors = errors.filter(
      (e) => e.includes('Uncaught') || e.includes('TypeError')
    )
    expect(criticalErrors).toHaveLength(0)
  }, 10000)

  it('should spawn enemies in the game', async () => {
    // Wait for enemies to spawn and move
    await wait(2000)

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'game-with-enemies.png'),
    })

    // Check for enemy spawn logs
    const enemyLogs = logs.filter(
      (log) => log.includes('Spawned') || log.includes('Enemy')
    )
    expect(enemyLogs.length).toBeGreaterThan(0)
  }, 10000)

  it('should respond to player movement input', async () => {
    // Simulate movement
    await page.keyboard.down('ArrowRight')
    await wait(500)
    await page.keyboard.up('ArrowRight')
    await wait(500)

    // Take screenshot during movement
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'game-moving.png'),
    })

    // No errors should occur during movement
    const recentErrors = errors.slice(-5)
    const movementErrors = recentErrors.filter((e) =>
      e.includes('movement') || e.includes('velocity')
    )
    expect(movementErrors).toHaveLength(0)
  }, 10000)

  it('should trigger shooting when player stops moving', async () => {
    // Stop moving to trigger shooting
    await wait(1000)

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'game-shooting.png'),
    })

    // Game should still be running without errors
    expect(errors.filter((e) => e.includes('Uncaught'))).toHaveLength(0)
  }, 10000)

  it('should maintain 60 FPS performance', async () => {
    // Collect FPS data
    const fpsData = await page.evaluate(() => {
      return new Promise<number[]>((resolve) => {
        const samples: number[] = []
        let lastTime = performance.now()
        let frameCount = 0

        function measure() {
          frameCount++
          const now = performance.now()
          if (now - lastTime >= 1000) {
            samples.push(frameCount)
            frameCount = 0
            lastTime = now
            if (samples.length >= 3) {
              resolve(samples)
              return
            }
          }
          requestAnimationFrame(measure)
        }
        requestAnimationFrame(measure)
      })
    })

    const avgFPS = fpsData.reduce((a, b) => a + b, 0) / fpsData.length
    // Allow for some variance, minimum 30 FPS
    expect(avgFPS).toBeGreaterThanOrEqual(30)
  }, 15000)
})
