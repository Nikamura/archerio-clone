/**
 * SaveExportManager - Handles exporting and importing all game save data
 *
 * Uses JSON per line format (NDJSON) where each line contains:
 * Line 1 (metadata): {"_meta":true,"version":1,"exportedAt":timestamp,"keys":["key1",...]}
 * Line 2+: {"key":"storage_key","value":{...data...}}
 *
 * Old saves compatibility:
 * - Missing keys: Managers use default values for missing fields
 * - Extra keys: Ignored (forwards compatible)
 * - Version migrations: Handled by individual managers on reload
 */

// Current export format version (increment when format changes)
const EXPORT_VERSION = 1

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

export interface SaveMetadata {
  _meta: true
  version: number
  exportedAt: number
  keys: string[]
}

export interface SaveLine {
  key: string
  value: unknown
}

export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  warnings: string[]
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
   * First line is metadata, followed by key-value pairs
   */
  exportData(): string {
    const lines: string[] = []
    const exportedKeys: string[] = []

    // Collect all data
    for (const key of ALL_STORAGE_KEYS) {
      const rawValue = localStorage.getItem(key)
      if (rawValue !== null) {
        try {
          const value = JSON.parse(rawValue)
          const line: SaveLine = { key, value }
          lines.push(JSON.stringify(line))
          exportedKeys.push(key)
        } catch {
          // If value isn't valid JSON, store as raw string
          const line: SaveLine = { key, value: rawValue }
          lines.push(JSON.stringify(line))
          exportedKeys.push(key)
        }
      }
    }

    // Prepend metadata line
    const metadata: SaveMetadata = {
      _meta: true,
      version: EXPORT_VERSION,
      exportedAt: Date.now(),
      keys: exportedKeys,
    }

    return [JSON.stringify(metadata), ...lines].join('\n')
  }

  /**
   * Import game data from NDJSON format
   * Handles both old format (no metadata) and new format (with metadata)
   * Returns result with success status, warnings, and errors
   */
  importData(data: string): ImportResult {
    const result: ImportResult = {
      success: false,
      imported: 0,
      skipped: 0,
      warnings: [],
      errors: [],
    }

    if (!data || data.trim() === '') {
      result.errors.push('No data provided')
      return result
    }

    const lines = data.trim().split('\n')
    const validEntries: SaveLine[] = []
    let metadata: SaveMetadata | null = null

    // Parse and validate all lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const parsed = JSON.parse(line)

        // Check if this is a metadata line
        if (parsed._meta === true) {
          metadata = parsed as SaveMetadata

          // Check export format version
          if (metadata.version > EXPORT_VERSION) {
            result.warnings.push(
              `Save from newer version (v${metadata.version}). Some data may not load correctly.`
            )
          }

          // Show export date info
          if (metadata.exportedAt) {
            const exportDate = new Date(metadata.exportedAt).toLocaleDateString()
            result.warnings.push(`Save exported on ${exportDate}`)
          }

          continue
        }

        // Validate data line structure
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

        // Check if this is a known key (warn but still import unknown keys)
        if (!ALL_STORAGE_KEYS.includes(parsed.key as typeof ALL_STORAGE_KEYS[number])) {
          result.warnings.push(`Unknown save key "${parsed.key}" - may be from older/newer version`)
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

    // Check for missing expected keys (compare with metadata or known keys)
    const importedKeys = new Set(validEntries.map((e) => e.key))
    const expectedKeys = metadata?.keys ?? ALL_STORAGE_KEYS
    const missingKeys = expectedKeys.filter((k) => !importedKeys.has(k))

    if (missingKeys.length > 0 && missingKeys.length < expectedKeys.length) {
      // Only warn if some keys are missing (not all - that could be a fresh save)
      result.warnings.push(
        `Missing ${missingKeys.length} save entries - defaults will be used for: ${missingKeys.slice(0, 3).join(', ')}${missingKeys.length > 3 ? '...' : ''}`
      )
    }

    // Apply all valid entries to localStorage
    for (const entry of validEntries) {
      try {
        const valueString = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)
        localStorage.setItem(entry.key, valueString)
        result.imported++
      } catch (e) {
        result.errors.push(`Failed to save ${entry.key}: ${e instanceof Error ? e.message : 'unknown error'}`)
        result.skipped++
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
          resolve({ success: false, imported: 0, skipped: 0, warnings: [], errors: ['No file selected'] })
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
            skipped: 0,
            warnings: [],
            errors: [`Failed to read file: ${err instanceof Error ? err.message : 'unknown error'}`],
          })
        }
      }

      input.oncancel = () => {
        resolve({ success: false, imported: 0, skipped: 0, warnings: [], errors: ['File selection cancelled'] })
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
