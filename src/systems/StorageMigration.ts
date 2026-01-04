/**
 * Storage Migration Utility
 *
 * Migrates localStorage data from old "arrow_game_*" keys to new "aura_archer_*" keys.
 * This must be called BEFORE any managers are initialized to ensure they load from the correct keys.
 */

const KEY_MIGRATIONS: Array<{ oldKey: string; newKey: string }> = [
  { oldKey: 'arrow_game_save_data', newKey: 'aura_archer_save_data' },
  { oldKey: 'arrow_game_currency_data', newKey: 'aura_archer_currency_data' },
  { oldKey: 'arrow_game_equipment_data', newKey: 'aura_archer_equipment_data' },
  { oldKey: 'arrow_game_talent_data', newKey: 'aura_archer_talent_data' },
  { oldKey: 'arrow_game_chest_data', newKey: 'aura_archer_chest_data' },
  { oldKey: 'arrow_game_daily_rewards', newKey: 'aura_archer_daily_rewards' },
  { oldKey: 'arrow_game_achievements', newKey: 'aura_archer_achievements' },
  { oldKey: 'arrow_game_theme_data', newKey: 'aura_archer_theme_data' },
  { oldKey: 'arrow_game_hero_data', newKey: 'aura_archer_hero_data' },
  { oldKey: 'arrow_game_chapter_data', newKey: 'aura_archer_chapter_data' },
  { oldKey: 'arrow_game_encyclopedia_data', newKey: 'aura_archer_encyclopedia_data' },
]

/**
 * Migrates all localStorage keys from old format to new format.
 * This is idempotent - safe to run multiple times.
 *
 * For each key pair:
 * - If old key exists AND new key does NOT exist: copy data to new key
 * - Old keys are NOT deleted to allow rollback if needed
 */
export function migrateStorage(): void {
  let migrated = 0

  for (const { oldKey, newKey } of KEY_MIGRATIONS) {
    const oldData = localStorage.getItem(oldKey)
    const newData = localStorage.getItem(newKey)

    // Only migrate if old data exists and new data doesn't
    if (oldData !== null && newData === null) {
      localStorage.setItem(newKey, oldData)
      migrated++
      console.log(`StorageMigration: Migrated ${oldKey} → ${newKey}`)
    }
  }

  if (migrated > 0) {
    console.log(`StorageMigration: Completed migration of ${migrated} keys`)
  }
}
