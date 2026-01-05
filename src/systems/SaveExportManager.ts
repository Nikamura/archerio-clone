/**
 * SaveExportManager - Handles exporting and importing all game save data
 *
 * Uses JSON per line format (NDJSON) where each line contains:
 * {"key":"storage_key","value":{...data...}}
 */

// All localStorage keys used by the game
const ALL_STORAGE_KEYS = [
  'aura_archer_save_data',
  'aura_archer_currency_data',
  'aura_archer_equipment_data',
  'aura_archer_talent_data',
  'aura_archer_chest_data',
  'aura_archer_daily_rewards',
  'aura_archer_achievements',
  'aura_archer_theme_data',
  'aura_archer_hero_data',
  'aura_archer_chapter_data',
  'aura_archer_encyclopedia_data',
  'aura_archer_ability_priority_data',
  'aura_archer_coupon_data',
] as const

export interface SaveLine {
  key: string
  value: unknown
}

export interface ImportResult {
  success: boolean
  imported: number
  errors: string[]
}

class SaveExportManager {
  private static _instance: SaveExportManager

  static get instance(): SaveExportManager {
    if (!SaveExportManager._instance) {
      SaveExportManager._instance = new SaveExportManager()
    }
    return SaveExportManager._instance
  }

  private constructor() {}

  /**
   * Export all game data as NDJSON (newline-delimited JSON)
   * Each line is a JSON object with key and value
   */
  exportData(): string {
    const lines: string[] = []

    for (const key of ALL_STORAGE_KEYS) {
      const rawValue = localStorage.getItem(key)
      if (rawValue !== null) {
        try {
          const value = JSON.parse(rawValue)
          const line: SaveLine = { key, value }
          lines.push(JSON.stringify(line))
        } catch {
          // If value isn't valid JSON, store as raw string
          const line: SaveLine = { key, value: rawValue }
          lines.push(JSON.stringify(line))
        }
      }
    }

    return lines.join('\n')
  }

  /**
   * Import game data from NDJSON format
   * Returns result with success status and any errors
   */
  importData(data: string): ImportResult {
    const result: ImportResult = {
      success: false,
      imported: 0,
      errors: [],
    }

    if (!data || data.trim() === '') {
      result.errors.push('No data provided')
      return result
    }

    const lines = data.trim().split('\n')
    const validEntries: SaveLine[] = []

    // Parse and validate all lines first
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const parsed = JSON.parse(line)

        // Validate structure
        if (typeof parsed !== 'object' || parsed === null) {
          result.errors.push(`Line ${i + 1}: Invalid format - expected object`)
          continue
        }

        if (typeof parsed.key !== 'string') {
          result.errors.push(`Line ${i + 1}: Missing or invalid "key" field`)
          continue
        }

        if (!parsed.key.startsWith('aura_archer_')) {
          result.errors.push(`Line ${i + 1}: Invalid key "${parsed.key}" - must start with "aura_archer_"`)
          continue
        }

        if (!('value' in parsed)) {
          result.errors.push(`Line ${i + 1}: Missing "value" field`)
          continue
        }

        validEntries.push(parsed as SaveLine)
      } catch (e) {
        result.errors.push(`Line ${i + 1}: Invalid JSON - ${e instanceof Error ? e.message : 'parse error'}`)
      }
    }

    if (validEntries.length === 0) {
      result.errors.push('No valid save data found')
      return result
    }

    // Apply all valid entries to localStorage
    for (const entry of validEntries) {
      try {
        const valueString = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)
        localStorage.setItem(entry.key, valueString)
        result.imported++
      } catch (e) {
        result.errors.push(`Failed to save ${entry.key}: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }

    result.success = result.imported > 0
    return result
  }

  /**
   * Download save data as a file
   */
  downloadSave(): void {
    const data = this.exportData()
    const blob = new window.Blob([data], { type: 'application/x-ndjson' })
    const url = window.URL.createObjectURL(blob)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `aura-archer-save-${timestamp}.ndjson`

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    window.URL.revokeObjectURL(url)
  }

  /**
   * Trigger file picker for importing save data
   * Returns a promise that resolves with import result
   */
  pickAndImportFile(): Promise<ImportResult> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.ndjson,.json,.txt'

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) {
          resolve({ success: false, imported: 0, errors: ['No file selected'] })
          return
        }

        try {
          const text = await file.text()
          const result = this.importData(text)
          resolve(result)
        } catch (err) {
          resolve({
            success: false,
            imported: 0,
            errors: [`Failed to read file: ${err instanceof Error ? err.message : 'unknown error'}`],
          })
        }
      }

      input.oncancel = () => {
        resolve({ success: false, imported: 0, errors: ['File selection cancelled'] })
      }

      input.click()
    })
  }

  /**
   * Get list of storage keys that have data
   */
  getStoredKeys(): string[] {
    return ALL_STORAGE_KEYS.filter((key) => localStorage.getItem(key) !== null)
  }

  /**
   * Get total size of stored data in bytes (approximate)
   */
  getStorageSize(): number {
    let total = 0
    for (const key of ALL_STORAGE_KEYS) {
      const value = localStorage.getItem(key)
      if (value) {
        total += key.length + value.length
      }
    }
    return total
  }
}

export const saveExportManager = SaveExportManager.instance
