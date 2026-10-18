Technical & Feature Specification

1. File Structure Overview

config.js: Contains environment configurations such as DEBUG_ENABLED and the Google Sheets published CSV export endpoints (SHEET_CSV_URLS).

csv.js: Pure utility file for parsing CSV strings into structured JavaScript objects. Handles quoted fields, escaped characters, and newline normalization.

content.js: Loads spreadsheet data from the URLs in config.js, validates rows against predefined schemas, establishes cross-references (monsters-to-loot/materials, loot-to-skills), and logs warnings for bad data.

game.js: Pure game-logic engine. Contains data calculations, state mutations, combat calculations, inventory modifications, shop logic, auto-heal checks, and save/restore encoding. Contains no DOM code.

main.js: Primary driver script. Handles UI DOM bindings, event listeners, view tab switching, the main game loop timer, rendering logic, and local storage persistence.

2. Spreadsheet Data Integration & Schema (content.js / csv.js)

The game content is entirely driven by four Google Sheets/CSV exports validated upon page load in content.js:

Skills Sheet (SCHEMAS.skills)

Required Fields: Name

Mapped Abilities: attack, magic, defend, heal, revive, flee.

Monsters Sheet (SCHEMAS.monsters)

Required Fields: Name, Level, HP, Damage, Loot

Optional / Extension Fields: Souls, Loot Chance, Materials, Mat Count, Mat Chance, Location, Type, Requirements, Notes

Behavior:

Calculates default XP as Level * 10.

Type: Values like "Boss", "Miniboss", or "Phantom" mark special enemies. Defeating special enemies pauses automatic target advancing and unlocks specific progression thresholds.

Notes: Parsing looks for terms such as "optional" to mark optional bosses.

Loot Sheet (SCHEMAS.loot)

Required Fields: Name, Slot, Value, Skill, Skill Effect, Rarity

Rarities: trash, common, uncommon, rare, epic, legendary, mythic.

Slots:

Equipment slots: R-Hand, L-Hand, Two-Hand, Ring, Head, Chest, Arms, Legs.

Slotless (""): Consumables / Usable items (e.g., healing potions, revive items, flee scrolls).

Multi-Skill Support: Separated by ; or |. Can map multiple skills and skill effects per loot item.

Percentage Effects: Percentages (e.g., 20%) are validated specifically for defend and heal skills.

Materials Sheet (SCHEMAS.materials)

Required Fields: Name, Value, Uses

Special Notes / Crafting: Supports Crafted and Notes ("boss", "unique", "upgrade").

3. Core Mechanics & State Management (game.js)

Player & Stats

HP Formula is a piecewise progression formula: Base PLAYER_STARTING_MAX_HP 400 HP, +15 HP per level up to level 30, then +10 HP per level up to level 99, reaching a PLAYER_MAX_HP_CAP of 1525 HP.

Stats (getPlayerStats):

Damage: 1 + total weapon/gear flat damage.

Defense: Flat defense bonuses + percentage defense reduction bonuses.

Gear Healing: Passive HP regen calculated per tick from equipped items with the heal skill effect.

XP Multiplier: Applied to XP gains upon monster kills.

Combat & Tick Loop (advanceGame)

Time Step: Runs on tick intervals scaled by game speed settings. Maximum offline progress capped by MAX_OFFLINE_SECONDS (10s).

Combat Sequence:

If monsterHp === -1, monster reloads HP for the next turn.

If monsterHp === 0, execution pauses for 1 tick to display the defeated state, then proceeds to switch targets or set reload state.

Player hits target for stats.damage.

Active gear passive healing applies.

If monster HP reaches zero, rewards are calculated and granted.

If monster survives, target attacks player for target.damage - stats.defense, reduced by active defense percentages.

processAutoHeal checks if player HP falls below configured thresholds and uses healing items automatically.

If player HP reaches 0, gameOver = true, souls are lost, and combat halts until revival/reset.

Boss Progression & Special Enemy Types

Defeating special enemy types ("boss", "miniboss", "phantom") sets awaitingMonsterSelection = true, forcing the player to manually select their next target.

Defeating a "boss" unlocks the Shop tab.

Bag, Equipment & Inventory Limits

Max Stacks: Standard consumables capped at 9 (Estus items capped at 5). Materials cap at 99. Unique items capped at 1 total across bag + gear.

Two-Hand Rule: Equipping a Two-Hand item automatically unequips the L-Hand item and returns it to the bag. L-Hand items cannot be equipped while a Two-Hand weapon is active.

Shop Mechanics

Offers two slotless loot items at a time (shopLoot).

Refreshing offers costs SHOP_REFRESH_COST (5 Souls).

Save / Restore / Persistence

Save Key: Encoded as a Base64 URL-safe string containing a compact JSON array of player state indices to keep URLs short and restore keys shareable (createRestoreKey and restoreStateFromKey).

Save Versioning: Tracked via SAVE_VERSION = 12. State parsing safely migrates or repairs malformed/outdated saves.

New Game Plus (NG+) Feature:
  - Triggered upon defeating the final boss and choosing to "Link the Fire" from the endgame dialog.
  - Retains player progression: Level, unlocked/held loot, equipment, and Soul balance.
  - World & Loop Reset: Resets monster kill counts (state.kills), clears active/pending targets, resets active monster HP, closes shop access, and clears transient timers, active buffs, and status history logs.

Difficulty Scaling (Monster Health):
  - Scaled per NG+ level using getMonsterHealth(monster, state.ngPlus).
  - Base multiplier for NG+ 1 is 1.54x.
  - Subsequent NG+ levels add non-stacking flat bonuses: NG+2 (+7%), NG+3 (+10%), NG+4 (+14%), NG+5 (+19%), and NG+6+ (+25%).

4. UI Layer & Views (main.js)

Tabs:

fight: Combat screen displaying active target, health meter, and quick-use items.

prepare: Enemy selection overview and stat preparation.

shop: Shop interface for purchasing slotless items or selling items for Souls.

Sub-Pages:

profile: Player stats log, saved state string generator/restorer.

settings: Configurable auto-heal toggles, HP thresholds, sorting rules, and game speed controls.

help: Instructional guidance.

cheat (Debug only): Visible when DEBUG_ENABLED = true for testing loot and state manipulation.

Background Art: Dynamically assigned based on the target monster's location field (./art/<location-slug>.webp).

5. Navigation Quick Reference for AI Agents

Adding a new skill capability? Update SKILL_ABILITIES in content.js and add parsing logic in game.js (useLoot / getPlayerStats).

Modifying combat logic or death handling? Inspect advanceGame in game.js.

Updating inventory limits or equipment rules? Inspect equipLoot, addLootToBag, or getMaxItemCount in game.js.

Changing UI dialogs or tab switching? Inspect main.js event listeners and render() family functions.

Modifying Sheet column names or validations? Update SCHEMAS in content.js.