# Cloud Sync & Multiplayer Architecture Plan

## Overview

This document outlines the architecture for adding cloud synchronization, cross-device play, concurrent gameplay handling, offline support, and global leaderboards to Aura Archer.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Recommended Tech Stack](#2-recommended-tech-stack)
3. [Data Model Design](#3-data-model-design)
4. [Sync Architecture](#4-sync-architecture)
5. [Conflict Resolution Strategy](#5-conflict-resolution-strategy)
6. [Offline Support](#6-offline-support)
7. [Authentication](#7-authentication)
8. [Global Leaderboards](#8-global-leaderboards)
9. [Implementation Phases](#9-implementation-phases)
10. [Security Considerations](#10-security-considerations)
11. [Migration Strategy](#11-migration-strategy)

---

## 1. Current State Analysis

### Existing Data Stores (localStorage)

| Manager | Storage Key | Data Description |
|---------|-------------|------------------|
| SaveManager | `aura_archer_save_data` | Player stats, settings, timestamps |
| CurrencyManager | `aura_archer_currency_data` | Gold, gems, scrolls, energy |
| EquipmentManager | `aura_archer_equipment_data` | Inventory items, equipped slots |
| ChapterManager | `aura_archer_chapter_data` | Chapter progress, unlocks, stars |
| AchievementManager | `aura_archer_achievements` | Claimed tiers, earned totals |
| TalentManager | `aura_archer_talent_data` | Unlocked talents, lottery state |
| HeroManager | `aura_archer_hero_data` | Hero unlocks, levels, XP, perks |
| ChestManager | `aura_archer_chest_data` | Chest inventory counts |
| DailyRewardManager | `aura_archer_daily_rewards` | Claim timestamps, streak day |
| ThemeManager | `aura_archer_theme_data` | Unlocked themes, selection |
| EncyclopediaManager | `aura_archer_encyclopedia_data` | Discovered entries |

### Data Categories by Sync Strategy

**Category A: Progression (Merge with MAX)**
- Chapter progress (highestRoom, completed, bestStars)
- Statistics (totalKills, highestScore, bossesDefeated)
- Hero levels and XP
- Unlocks (heroes, themes, chapters, encyclopedia)
- Achievement completion tiers

**Category B: Consumables (Server-Authoritative)**
- Gems (premium currency - fraud prevention)
- Purchased items/IAPs

**Category C: Inventory (Timestamp + Manual Resolution)**
- Equipment inventory
- Equipped items
- Chest inventory

**Category D: Ephemeral (Latest-Write-Wins)**
- Settings (audio, graphics, controls)
- Selected hero/theme
- Tutorial completion state

**Category E: Time-Gated (Server Time)**
- Daily rewards (prevent timezone manipulation)
- Daily challenge completion
- Energy regeneration
- Talent lottery daily spins

---

## 2. Recommended Tech Stack

### Primary Recommendation: Supabase

**Why Supabase:**
- PostgreSQL backend (flexible queries for leaderboards)
- Built-in Row Level Security (RLS)
- Real-time subscriptions for live sync
- Edge Functions for server-side validation
- Auth with multiple providers (Google, Apple, anonymous)
- Generous free tier (500MB database, 2GB storage)
- Self-hostable if needed later

### Alternative: Firebase

**Firebase Pros:**
- Better real-time performance
- Simpler client SDK
- Offline persistence built-in

**Firebase Cons:**
- NoSQL limits complex leaderboard queries
- Vendor lock-in
- Costs scale faster

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Phaser)                         │
├─────────────────────────────────────────────────────────────────┤
│  SyncManager (new)                                              │
│  ├── LocalStorageAdapter (existing managers)                    │
│  ├── SyncQueue (pending operations)                             │
│  └── ConflictResolver                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (BaaS)                              │
├─────────────────────────────────────────────────────────────────┤
│  Auth        │ Database (PostgreSQL)  │ Edge Functions          │
│  ├─ Google   │ ├─ users               │ ├─ validate-score       │
│  ├─ Apple    │ ├─ player_data         │ ├─ resolve-conflicts    │
│  └─ Anon     │ ├─ equipment           │ ├─ daily-rewards        │
│              │ ├─ leaderboards        │ └─ anti-cheat           │
│              │ └─ sync_log            │                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model Design

### Database Schema (PostgreSQL)

```sql
-- Users table (auto-created by Supabase Auth)
-- Uses auth.users

-- Main player data (one row per user)
CREATE TABLE player_data (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Version for optimistic locking
  version INTEGER NOT NULL DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Save data version (for migrations)
  save_version INTEGER NOT NULL DEFAULT 1,

  -- Hero data
  selected_hero_id TEXT NOT NULL DEFAULT 'atreus',
  unlocked_heroes TEXT[] NOT NULL DEFAULT ARRAY['atreus'],
  hero_progress JSONB NOT NULL DEFAULT '{}',

  -- Currency (gems server-authoritative)
  gold INTEGER NOT NULL DEFAULT 1000,
  gems INTEGER NOT NULL DEFAULT 50,
  scrolls INTEGER NOT NULL DEFAULT 0,

  -- Energy (server-managed)
  energy INTEGER NOT NULL DEFAULT 5,
  last_energy_update TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Statistics (merge with max)
  statistics JSONB NOT NULL DEFAULT '{
    "totalRuns": 0,
    "totalKills": 0,
    "totalDeaths": 0,
    "highestRoom": 0,
    "highestChapter": 1,
    "totalPlayTimeMs": 0,
    "bossesDefeated": 0,
    "abilitiesAcquired": 0,
    "longestRun": 0,
    "fastestBossKill": 0,
    "highestScore": 0,
    "endlessHighWave": 0,
    "monsterKills": {"enemies": {}, "bosses": {}}
  }',

  -- Chapter progress (merge with max)
  chapter_progress JSONB NOT NULL DEFAULT '{}',
  unlocked_chapters INTEGER[] NOT NULL DEFAULT ARRAY[1],

  -- Talents
  unlocked_talents JSONB NOT NULL DEFAULT '{}',
  lottery_spins_today INTEGER NOT NULL DEFAULT 0,
  lottery_last_spin_date DATE,

  -- Daily rewards (server time)
  daily_reward_day INTEGER NOT NULL DEFAULT 1,
  daily_reward_last_claim TIMESTAMPTZ,

  -- Daily challenge
  daily_challenge_last_date DATE,
  daily_challenge_best_wave INTEGER NOT NULL DEFAULT 0,
  daily_challenge_completions INTEGER NOT NULL DEFAULT 0,

  -- Achievements
  achievement_claimed_tiers JSONB NOT NULL DEFAULT '{}',

  -- Chests
  chest_inventory JSONB NOT NULL DEFAULT '{"wooden": 0, "silver": 0, "golden": 0}',

  -- Themes
  unlocked_themes TEXT[] NOT NULL DEFAULT ARRAY['medieval'],
  selected_theme_id TEXT NOT NULL DEFAULT 'medieval',

  -- Encyclopedia
  discovered_entries TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Settings (client-side, sync for convenience)
  settings JSONB NOT NULL DEFAULT '{
    "difficulty": "normal",
    "audioEnabled": true,
    "audioVolume": 0.3,
    "showDamageNumbers": true,
    "vibrationEnabled": true,
    "language": "en",
    "autoLevelUp": false,
    "autoRoomAdvance": false,
    "graphicsQuality": "high",
    "screenShakeEnabled": true,
    "colorblindMode": "none"
  }',

  -- Tutorial
  tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Equipment inventory (separate table for easier queries)
CREATE TABLE equipment (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES player_data(id) ON DELETE CASCADE,

  type TEXT NOT NULL,
  slot TEXT NOT NULL,
  rarity TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  perks TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  is_equipped BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_equipment_user_id ON equipment(user_id);
CREATE INDEX idx_equipment_slot ON equipment(user_id, slot);

-- Leaderboards (materialized for performance)
CREATE TABLE leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  leaderboard_type TEXT NOT NULL, -- 'highscore', 'endless', 'daily', 'speedrun'
  score BIGINT NOT NULL,
  metadata JSONB, -- chapter, difficulty, etc.

  -- Anti-cheat
  client_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,

  -- Period (for daily/weekly leaderboards)
  period_start DATE,
  period_end DATE,

  -- User display info (denormalized)
  display_name TEXT,
  hero_id TEXT,

  UNIQUE(user_id, leaderboard_type, period_start)
);

CREATE INDEX idx_leaderboards_type_score ON leaderboards(leaderboard_type, score DESC);
CREATE INDEX idx_leaderboards_period ON leaderboards(leaderboard_type, period_start, score DESC);

-- Sync log for conflict resolution
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  operation TEXT NOT NULL, -- 'update', 'merge', 'conflict'
  data_category TEXT NOT NULL,

  local_data JSONB,
  remote_data JSONB,
  resolved_data JSONB,

  client_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  device_id TEXT,
  app_version TEXT
);

CREATE INDEX idx_sync_log_user ON sync_log(user_id, server_timestamp DESC);

-- Row Level Security
ALTER TABLE player_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can view own data" ON player_data
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON player_data
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON player_data
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Equipment policies
CREATE POLICY "Users can manage own equipment" ON equipment
  FOR ALL USING (auth.uid() = user_id);

-- Leaderboard policies (everyone can view, only own can insert)
CREATE POLICY "Anyone can view leaderboards" ON leaderboards
  FOR SELECT USING (true);

CREATE POLICY "Users can submit own scores" ON leaderboards
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## 4. Sync Architecture

### New Manager: SyncManager

```typescript
// src/systems/SyncManager.ts

interface SyncConfig {
  autoSyncInterval: number  // ms, default 30000
  maxRetries: number        // default 3
  conflictStrategy: 'ask' | 'local' | 'remote' | 'merge'
}

interface SyncOperation {
  id: string
  timestamp: number
  category: DataCategory
  operation: 'create' | 'update' | 'delete'
  data: unknown
  retries: number
}

type DataCategory =
  | 'progression'   // Category A: merge with MAX
  | 'consumable'    // Category B: server-authoritative
  | 'inventory'     // Category C: timestamp + manual
  | 'ephemeral'     // Category D: latest-write-wins
  | 'time_gated'    // Category E: server time

interface ConflictResolution {
  category: DataCategory
  localData: unknown
  remoteData: unknown
  suggestedResolution: unknown
  requiresUserInput: boolean
}

class SyncManager extends Phaser.Events.EventEmitter {
  private static _instance: SyncManager
  private supabase: SupabaseClient
  private syncQueue: SyncOperation[] = []
  private isSyncing: boolean = false
  private isOnline: boolean = navigator.onLine
  private lastSyncTimestamp: number = 0

  // Events
  static EVENTS = {
    SYNC_STARTED: 'syncStarted',
    SYNC_COMPLETED: 'syncCompleted',
    SYNC_FAILED: 'syncFailed',
    CONFLICT_DETECTED: 'conflictDetected',
    CONFLICT_RESOLVED: 'conflictResolved',
    ONLINE_STATUS_CHANGED: 'onlineStatusChanged',
  }

  constructor(config: SyncConfig) {
    // Initialize Supabase client
    // Set up network listeners
    // Load sync queue from localStorage
  }

  // Queue a local change for sync
  queueChange(category: DataCategory, data: unknown): void

  // Force immediate sync
  async syncNow(): Promise<SyncResult>

  // Pull latest from server
  async pullRemote(): Promise<RemoteData>

  // Push local changes
  async pushLocal(): Promise<PushResult>

  // Resolve a conflict
  async resolveConflict(
    conflict: ConflictResolution,
    resolution: 'local' | 'remote' | 'merge'
  ): Promise<void>

  // Handle conflict based on category
  private mergeData(
    category: DataCategory,
    local: unknown,
    remote: unknown
  ): unknown
}
```

### Sync Flow Diagram

```
┌─────────────────┐
│  User Action    │
│  (e.g., level   │
│   up hero)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Local Manager   │
│ (HeroManager)   │
│ Updates local   │
│ state + storage │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SyncManager    │
│  Queues change  │
│  with category  │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Online? │
    └────┬────┘
         │
    ┌────┼────┐
    │    │    │
   Yes   No   │
    │    │    │
    │    ▼    │
    │  Queue  │
    │  saved  │
    │  locally│
    │         │
    ▼         │
┌─────────────┴───┐
│ Sync to Server  │
│ (with conflict  │
│  detection)     │
└────────┬────────┘
         │
    ┌────┴────────┐
    │  Conflict?  │
    └────┬────────┘
         │
    ┌────┼────┐
    │    │    │
   Yes   No   │
    │    │    │
    ▼    ▼    │
  Resolve  Apply│
  based on     │
  category     │
         │     │
         └──┬──┘
            │
            ▼
┌─────────────────┐
│ Update local    │
│ managers with   │
│ merged data     │
└─────────────────┘
```

---

## 5. Conflict Resolution Strategy

### Per-Category Resolution

```typescript
// src/systems/ConflictResolver.ts

interface MergeResult<T> {
  merged: T
  conflicts: string[]  // Fields that couldn't auto-resolve
}

class ConflictResolver {
  /**
   * Category A: Progression - Always take MAX value
   */
  mergeProgression(local: ProgressionData, remote: ProgressionData): MergeResult<ProgressionData> {
    return {
      merged: {
        totalKills: Math.max(local.totalKills, remote.totalKills),
        totalRuns: Math.max(local.totalRuns, remote.totalRuns),
        highestRoom: Math.max(local.highestRoom, remote.highestRoom),
        highestScore: Math.max(local.highestScore, remote.highestScore),
        bossesDefeated: Math.max(local.bossesDefeated, remote.bossesDefeated),
        // Unlocks are set unions
        unlockedHeroes: [...new Set([...local.unlockedHeroes, ...remote.unlockedHeroes])],
        unlockedChapters: [...new Set([...local.unlockedChapters, ...remote.unlockedChapters])],
        // Chapter progress: take best stars per chapter
        chapterProgress: this.mergeChapterProgress(local.chapterProgress, remote.chapterProgress),
        // Hero progress: take highest level per hero
        heroProgress: this.mergeHeroProgress(local.heroProgress, remote.heroProgress),
      },
      conflicts: [],
    }
  }

  /**
   * Category B: Consumables - Server is authoritative
   */
  mergeConsumables(local: ConsumableData, remote: ConsumableData): MergeResult<ConsumableData> {
    // For gems (premium currency), always use server value
    // For gold, take max to prevent loss but server validates
    return {
      merged: {
        gems: remote.gems,  // Server authoritative
        gold: Math.max(local.gold, remote.gold),  // Merge with max
        scrolls: Math.max(local.scrolls, remote.scrolls),
      },
      conflicts: [],
    }
  }

  /**
   * Category C: Inventory - Needs careful handling
   */
  mergeInventory(local: Equipment[], remote: Equipment[]): MergeResult<Equipment[]> {
    const localMap = new Map(local.map(e => [e.id, e]))
    const remoteMap = new Map(remote.map(e => [e.id, e]))
    const merged: Equipment[] = []
    const conflicts: string[] = []

    // Items in both: take higher level, warn on mismatch
    // Items only in local: keep (new item created offline)
    // Items only in remote: keep (created on other device)

    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

    for (const id of allIds) {
      const localItem = localMap.get(id)
      const remoteItem = remoteMap.get(id)

      if (localItem && remoteItem) {
        // Both exist - merge by level
        if (localItem.level !== remoteItem.level) {
          merged.push(localItem.level > remoteItem.level ? localItem : remoteItem)
        } else {
          merged.push(remoteItem) // Same level, prefer remote
        }
      } else if (localItem) {
        merged.push(localItem)
      } else if (remoteItem) {
        merged.push(remoteItem)
      }
    }

    return { merged, conflicts }
  }

  /**
   * Category D: Ephemeral - Latest timestamp wins
   */
  mergeEphemeral(
    local: { data: unknown; timestamp: number },
    remote: { data: unknown; timestamp: number }
  ): MergeResult<unknown> {
    return {
      merged: local.timestamp > remote.timestamp ? local.data : remote.data,
      conflicts: [],
    }
  }

  /**
   * Category E: Time-gated - Server time is authoritative
   */
  mergeTimeGated(local: TimeGatedData, remote: TimeGatedData): MergeResult<TimeGatedData> {
    // Server manages:
    // - Daily reward state (use server time for day calculation)
    // - Talent lottery spins today (use server count)
    // - Energy regeneration (server calculates based on last_energy_update)
    return {
      merged: {
        dailyRewardDay: remote.dailyRewardDay,
        dailyRewardLastClaim: remote.dailyRewardLastClaim,
        lotterySpinsToday: remote.lotterySpinsToday,
        energy: remote.energy,
        lastEnergyUpdate: remote.lastEnergyUpdate,
      },
      conflicts: [],
    }
  }
}
```

### User-Facing Conflict Resolution UI

When automatic merge isn't possible (rare), show a dialog:

```
┌──────────────────────────────────────────┐
│         Sync Conflict Detected           │
├──────────────────────────────────────────┤
│                                          │
│  Your progress differs between devices.  │
│                                          │
│  ┌─────────────┐   ┌─────────────┐       │
│  │ This Device │   │Other Device │       │
│  ├─────────────┤   ├─────────────┤       │
│  │ Gold: 5,000 │   │ Gold: 3,000 │       │
│  │ Level: 15   │   │ Level: 18   │       │
│  │ Items: 12   │   │ Items: 8    │       │
│  └─────────────┘   └─────────────┘       │
│                                          │
│  [Keep This Device] [Keep Other Device]  │
│               [Merge Best]               │
│                                          │
└──────────────────────────────────────────┘
```

---

## 6. Offline Support

### Architecture: Local-First

```typescript
// src/systems/OfflineManager.ts

interface OfflineConfig {
  maxQueueSize: number      // Max operations to queue (default: 1000)
  maxQueueAgeMs: number     // Max age before warning (default: 7 days)
  persistQueueKey: string   // localStorage key for queue
}

class OfflineManager {
  private queue: SyncOperation[] = []

  /**
   * All writes go to local first (instant)
   * Queue operations for server sync
   */
  queueOperation(op: SyncOperation): void {
    this.queue.push(op)
    this.persistQueue()

    // If online, trigger sync
    if (navigator.onLine) {
      syncManager.syncNow()
    }
  }

  /**
   * On reconnect, process queue in order
   */
  async processQueue(): Promise<ProcessResult> {
    const results: OperationResult[] = []

    while (this.queue.length > 0) {
      const op = this.queue[0]

      try {
        await this.executeOperation(op)
        this.queue.shift()  // Remove successful operation
        this.persistQueue()
      } catch (error) {
        if (this.isRetryable(error)) {
          op.retries++
          if (op.retries >= config.maxRetries) {
            // Move to dead letter queue
            this.handleFailedOperation(op)
          }
          break  // Stop processing, will retry
        } else {
          // Non-retryable error (conflict, validation)
          this.handleConflict(op, error)
        }
      }
    }

    return { processed: results.length, remaining: this.queue.length }
  }

  /**
   * Persist queue to localStorage for app restart
   */
  private persistQueue(): void {
    localStorage.setItem(
      'aura_archer_sync_queue',
      JSON.stringify(this.queue)
    )
  }
}
```

### Network Status Handling

```typescript
// In SyncManager constructor

window.addEventListener('online', () => {
  this.isOnline = true
  this.emit(SyncManager.EVENTS.ONLINE_STATUS_CHANGED, { online: true })
  this.syncNow()  // Process queued operations
})

window.addEventListener('offline', () => {
  this.isOnline = false
  this.emit(SyncManager.EVENTS.ONLINE_STATUS_CHANGED, { online: false })
})

// Capacitor app lifecycle
if (Capacitor.isNativePlatform()) {
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && this.isOnline) {
      this.syncNow()  // Sync when app returns to foreground
    }
  })
}
```

---

## 7. Authentication

### Supported Auth Methods

1. **Anonymous Auth** (default for new players)
   - Auto-created on first launch
   - Can be upgraded to permanent account later
   - Data preserved on upgrade

2. **Sign in with Apple** (iOS requirement)
   - Required for App Store

3. **Sign in with Google**
   - Most popular, cross-platform

4. **Email/Password** (optional)
   - For players who don't use social login

### Auth Flow

```
┌─────────────────────────────────────────────┐
│              First Launch                    │
├─────────────────────────────────────────────┤
│                                             │
│  1. Create anonymous Supabase session       │
│  2. Create player_data row                  │
│  3. Generate device_id for sync tracking    │
│  4. Start playing immediately               │
│                                             │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│         Later: Link Account                  │
├─────────────────────────────────────────────┤
│                                             │
│  Settings → Account → "Save Progress"       │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Sign in to save your progress      │    │
│  │  across devices                     │    │
│  │                                     │    │
│  │  [  Sign in with Apple]             │    │
│  │  [  Sign in with Google]            │    │
│  │  [  Use Email]                      │    │
│  │                                     │    │
│  │  Your progress will be preserved.   │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

### Account Linking (Anonymous → Permanent)

```typescript
// src/systems/AuthManager.ts

class AuthManager {
  /**
   * Link anonymous account to permanent identity
   * Preserves all existing data
   */
  async linkAccount(provider: 'apple' | 'google' | 'email'): Promise<LinkResult> {
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: window.location.origin }
    })

    if (error) {
      // Check if account exists with this identity
      if (error.code === 'identity_already_exists') {
        // Offer to merge or replace
        return {
          success: false,
          requiresMerge: true,
          existingAccount: await this.getExistingAccountInfo(provider)
        }
      }
      throw error
    }

    return { success: true }
  }

  /**
   * Merge two accounts (keeping best progress)
   */
  async mergeAccounts(
    keepAccountId: string,
    mergeFromAccountId: string
  ): Promise<MergeResult> {
    // Call Edge Function to merge server-side
    const { data, error } = await supabase.functions.invoke('merge-accounts', {
      body: { keepAccountId, mergeFromAccountId }
    })

    return data
  }
}
```

---

## 8. Global Leaderboards

### Leaderboard Types

| Type | Period | Ranking Field | Reset |
|------|--------|---------------|-------|
| All-Time High Score | Permanent | `highestScore` | Never |
| Endless Mode | Permanent | `endlessHighWave` | Never |
| Daily Challenge | Daily | Daily score | Midnight UTC |
| Weekly | Weekly | Week total | Monday UTC |

### Leaderboard Queries

```sql
-- Get top 100 all-time scores
SELECT
  l.user_id,
  l.display_name,
  l.hero_id,
  l.score,
  l.server_timestamp,
  ROW_NUMBER() OVER (ORDER BY l.score DESC) as rank
FROM leaderboards l
WHERE l.leaderboard_type = 'highscore'
  AND l.verified = true
ORDER BY l.score DESC
LIMIT 100;

-- Get player's rank
WITH ranked AS (
  SELECT
    user_id,
    score,
    ROW_NUMBER() OVER (ORDER BY score DESC) as rank
  FROM leaderboards
  WHERE leaderboard_type = 'highscore' AND verified = true
)
SELECT rank, score FROM ranked WHERE user_id = $1;

-- Get nearby players (around player's rank)
WITH ranked AS (
  SELECT
    user_id,
    display_name,
    score,
    ROW_NUMBER() OVER (ORDER BY score DESC) as rank
  FROM leaderboards
  WHERE leaderboard_type = 'highscore' AND verified = true
)
SELECT * FROM ranked
WHERE rank BETWEEN (SELECT rank FROM ranked WHERE user_id = $1) - 5
              AND (SELECT rank FROM ranked WHERE user_id = $1) + 5;

-- Daily leaderboard
SELECT
  l.display_name,
  l.score,
  l.hero_id
FROM leaderboards l
WHERE l.leaderboard_type = 'daily'
  AND l.period_start = CURRENT_DATE
  AND l.verified = true
ORDER BY l.score DESC
LIMIT 100;
```

### Anti-Cheat Measures

```typescript
// Client-side score submission
interface ScoreSubmission {
  score: number
  metadata: {
    chapter: number
    difficulty: string
    roomsCleared: number
    killCount: number
    playTimeMs: number
    abilitiesUsed: string[]
    heroId: string
    heroLevel: number
    equipmentPower: number
  }
  clientTimestamp: number
  sessionId: string
  checksum: string  // HMAC of score + metadata + secret
}

// Edge Function validation
// supabase/functions/validate-score/index.ts

Deno.serve(async (req) => {
  const { score, metadata, checksum, sessionId } = await req.json()

  // 1. Verify checksum
  const expectedChecksum = hmac(score, metadata, SECRET)
  if (checksum !== expectedChecksum) {
    return new Response('Invalid checksum', { status: 400 })
  }

  // 2. Validate score is plausible
  const maxPossibleScore = calculateMaxScore(metadata)
  if (score > maxPossibleScore * 1.1) {  // 10% tolerance
    return flagForReview(score, metadata)
  }

  // 3. Check for statistical anomalies
  const recentScores = await getRecentScores(userId)
  if (isStatisticalAnomaly(score, recentScores)) {
    return flagForReview(score, metadata)
  }

  // 4. Rate limiting
  if (await isRateLimited(userId)) {
    return new Response('Too many submissions', { status: 429 })
  }

  // 5. Insert verified score
  await supabase.from('leaderboards').insert({
    user_id: userId,
    leaderboard_type: determineType(metadata),
    score,
    metadata,
    verified: true,
    ...
  })

  return new Response('OK')
})
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal: Basic sync infrastructure without breaking existing game**

- [ ] Set up Supabase project
- [ ] Create database schema
- [ ] Implement `SyncManager` skeleton
- [ ] Add anonymous auth
- [ ] Create `CloudDataAdapter` that wraps existing managers
- [ ] Implement basic push/pull sync
- [ ] Add sync indicator to UI (optional)

**Files to create:**
```
src/systems/
├── SyncManager.ts
├── AuthManager.ts
├── CloudDataAdapter.ts
└── supabase.ts  (client init)
```

### Phase 2: Offline Support (Week 3)

**Goal: Robust offline-first architecture**

- [ ] Implement sync queue with localStorage persistence
- [ ] Add network status detection
- [ ] Implement queue processing on reconnect
- [ ] Add conflict detection
- [ ] Implement per-category merge strategies
- [ ] Add sync status events for UI

### Phase 3: Conflict Resolution (Week 4)

**Goal: Handle concurrent gameplay gracefully**

- [ ] Implement `ConflictResolver` class
- [ ] Add conflict resolution UI (modal)
- [ ] Test concurrent gameplay scenarios
- [ ] Add device tracking to sync_log
- [ ] Implement version-based optimistic locking

### Phase 4: Authentication (Week 5)

**Goal: Permanent accounts and cross-device play**

- [ ] Add Sign in with Apple
- [ ] Add Sign in with Google
- [ ] Implement account linking flow
- [ ] Add account merge functionality
- [ ] Update settings UI with account section
- [ ] Handle auth state changes in app lifecycle

### Phase 5: Leaderboards (Week 6)

**Goal: Global competition**

- [ ] Create leaderboard UI scene
- [ ] Implement score submission with validation
- [ ] Add Edge Function for anti-cheat
- [ ] Create leaderboard queries
- [ ] Add daily/weekly reset jobs (Supabase cron)
- [ ] Display player rank in UI

### Phase 6: Polish & Testing (Week 7-8)

**Goal: Production readiness**

- [ ] Extensive testing on multiple devices
- [ ] Test poor network conditions
- [ ] Test long offline periods
- [ ] Performance optimization
- [ ] Error handling and recovery
- [ ] Analytics and monitoring
- [ ] Documentation

---

## 10. Security Considerations

### Client-Side Security

```typescript
// Never trust client data for:
// - Gem amounts (premium currency)
// - Time-gated resources (daily rewards, energy)
// - Leaderboard scores (validate server-side)

// Always validate on server:
// - Score submissions
// - Currency transactions
// - Time-based rewards
```

### Row Level Security (RLS)

All tables have RLS enabled. Users can only:
- Read/write their own player_data
- Read/write their own equipment
- Read all leaderboard entries
- Write only their own leaderboard entries

### Rate Limiting

```sql
-- Supabase rate limiting (pg_net extension)
-- Limit score submissions to 10 per hour
CREATE OR REPLACE FUNCTION check_score_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM leaderboards
    WHERE user_id = NEW.user_id
    AND server_timestamp > NOW() - INTERVAL '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER score_rate_limit
  BEFORE INSERT ON leaderboards
  FOR EACH ROW EXECUTE FUNCTION check_score_rate_limit();
```

### Data Validation

```typescript
// Edge Function: Validate all incoming data
function validatePlayerData(data: Partial<PlayerData>): ValidationResult {
  const errors: string[] = []

  // Currency bounds
  if (data.gold !== undefined && (data.gold < 0 || data.gold > 999999999)) {
    errors.push('Invalid gold amount')
  }

  // Level bounds
  if (data.heroProgress) {
    for (const [heroId, progress] of Object.entries(data.heroProgress)) {
      if (progress.level < 1 || progress.level > 100) {
        errors.push(`Invalid level for hero ${heroId}`)
      }
    }
  }

  // Equipment validation
  if (data.equipment) {
    for (const item of data.equipment) {
      if (!VALID_EQUIPMENT_TYPES.includes(item.type)) {
        errors.push(`Invalid equipment type: ${item.type}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
```

---

## 11. Migration Strategy

### For Existing Players

```typescript
// On app update with new sync system:

class MigrationManager {
  async migrateLocalData(): Promise<void> {
    // 1. Check if migration needed
    const migrationVersion = localStorage.getItem('aura_archer_migration_version')
    if (migrationVersion === CURRENT_MIGRATION_VERSION) return

    // 2. Create anonymous auth session
    const { user } = await supabase.auth.signInAnonymously()

    // 3. Gather all local data
    const localData = this.gatherAllLocalData()

    // 4. Upload to cloud
    await supabase.from('player_data').upsert({
      id: user.id,
      ...localData,
    })

    // 5. Mark migration complete
    localStorage.setItem('aura_archer_migration_version', CURRENT_MIGRATION_VERSION)

    // 6. Show success message
    this.showMigrationComplete()
  }

  private gatherAllLocalData(): CloudPlayerData {
    return {
      // Gather from all existing managers
      ...saveManager.getData(),
      ...currencyManager.toSaveData(),
      equipment: equipmentManager.toSaveData(),
      chapters: chapterManager.toSaveData(),
      achievements: achievementManager.toSaveData(),
      talents: talentManager.toSaveData(),
      heroes: heroManager.toSaveData(),
      chests: chestManager.toSaveData(),
      dailyRewards: dailyRewardManager.toSaveData(),
      themes: themeManager.getAllThemeStates(),
    }
  }
}
```

### Data Format Versioning

```typescript
// In player_data table
save_version: 1  // Increment when schema changes

// Migration functions (similar to SaveManager pattern)
const migrations: Record<number, MigrationFn> = {
  2: (data) => {
    // Add new field introduced in v2
    return { ...data, newField: defaultValue }
  },
  3: (data) => {
    // Transform data structure in v3
    return { ...data, transformed: transform(data.old) }
  },
}
```

---

## Appendix A: Cost Estimation

### Supabase Free Tier (sufficient for launch)
- 500 MB database
- 2 GB storage
- 50,000 monthly active users
- 500 MB bandwidth
- Edge Functions included

### Growth Tier ($25/month)
- 8 GB database
- 100 GB storage
- Unlimited users
- 50 GB bandwidth

### Estimated costs at scale:
- 10,000 DAU: Free tier
- 100,000 DAU: ~$50/month
- 1,000,000 DAU: ~$200-500/month

---

## Appendix B: Alternative Approaches Considered

### Option: Export/Import Codes

**Pros:** Zero backend cost, simple implementation
**Cons:** Poor UX, no automatic sync, no leaderboards
**Decision:** Good for Phase 0 interim solution

### Option: Firebase

**Pros:** Better offline SDK, simpler setup
**Cons:** NoSQL limits leaderboard queries, higher costs at scale
**Decision:** Supabase preferred for SQL flexibility

### Option: Custom Backend

**Pros:** Full control, no vendor lock-in
**Cons:** Significant dev time, infrastructure management
**Decision:** Not worth the overhead for current team size

---

## Appendix C: Testing Checklist

### Sync Scenarios
- [ ] Fresh install, no account
- [ ] Fresh install, existing account
- [ ] Play offline, sync when online
- [ ] Concurrent play on two devices
- [ ] Long offline period (7+ days)
- [ ] Account upgrade (anonymous → Google)
- [ ] Account merge (two accounts with progress)

### Conflict Scenarios
- [ ] Level up hero on both devices
- [ ] Spend currency on both devices
- [ ] Equip items on both devices
- [ ] Complete chapter on both devices

### Edge Cases
- [ ] Network drops mid-sync
- [ ] App killed during sync
- [ ] Clock manipulation attempts
- [ ] Invalid data injection attempts

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Decide on timeline** priorities
3. **Create Supabase project** and test basic integration
4. **Implement Phase 1** foundation
5. **Iterate** based on testing feedback
