import puppeteer from 'puppeteer'
import { mkdir } from 'fs/promises'
import path from 'path'

// Helper function to wait
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function runVisualTest() {
  console.log('🚀 Starting visual test...')

  // Create screenshots directory
  const screenshotsDir = path.join(process.cwd(), 'test', 'screenshots')
  await mkdir(screenshotsDir, { recursive: true })

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 720 })

    // Collect console logs
    const logs: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      logs.push(text)
      console.log('📝', text)
    })

    // Collect errors
    page.on('pageerror', (error) => {
      console.error('❌ Page error:', error.message)
    })

    // Navigate to game
    console.log('🌐 Navigating to http://localhost:3000')
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2',
      timeout: 10000,
    })

    // Wait for game to initialize
    console.log('⏳ Waiting for game to load...')
    await wait(2000)

    // Take screenshot of main menu
    console.log('📸 Taking screenshot: main-menu.png')
    await page.screenshot({
      path: path.join(screenshotsDir, 'main-menu.png'),
    })

    // Click play button
    console.log('🎮 Clicking PLAY button...')
    const canvas = await page.$('canvas')
    if (canvas) {
      const box = await canvas.boundingBox()
      if (box) {
        // Click center of canvas where PLAY button is
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      }
    }

    // Wait for game scene to load
    await wait(1000)

    // Take screenshot of game scene
    console.log('📸 Taking screenshot: game-scene.png')
    await page.screenshot({
      path: path.join(screenshotsDir, 'game-scene.png'),
    })

    // Check for enemies
    console.log('🔍 Checking game state...')
    const gameState = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      return {
        canvasExists: !!canvas,
        canvasSize: canvas
          ? { width: canvas.width, height: canvas.height }
          : null,
      }
    })

    console.log('📊 Game state:', gameState)

    // Wait a bit to let enemies spawn and move
    await wait(2000)

    // Take screenshot after enemies have moved
    console.log('📸 Taking screenshot: game-with-enemies.png')
    await page.screenshot({
      path: path.join(screenshotsDir, 'game-with-enemies.png'),
    })

    // Simulate some movement (press arrow key)
    console.log('⌨️  Simulating player movement...')
    await page.keyboard.down('ArrowRight')
    await wait(500)
    await page.keyboard.up('ArrowRight')
    await wait(500)

    // Take screenshot during movement
    console.log('📸 Taking screenshot: game-moving.png')
    await page.screenshot({
      path: path.join(screenshotsDir, 'game-moving.png'),
    })

    // Stop moving to trigger shooting
    await wait(1000)

    console.log('📸 Taking screenshot: game-shooting.png')
    await page.screenshot({
      path: path.join(screenshotsDir, 'game-shooting.png'),
    })

    // Check console logs for key messages
    console.log('\n📋 Summary of console logs:')
    const importantLogs = logs.filter(
      (log) =>
        log.includes('Spawned') ||
        log.includes('Enemy') ||
        log.includes('created') ||
        log.includes('Scene')
    )
    importantLogs.forEach((log) => console.log('  -', log))

    console.log('\n✅ Visual test complete!')
    console.log(`📁 Screenshots saved to: ${screenshotsDir}`)
  } catch (error) {
    console.error('❌ Test failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

runVisualTest().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
