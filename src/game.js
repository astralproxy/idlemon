export const MAX_OFFLINE_SECONDS = 10; // don't let player log off instantly to avoid death
export const SAVE_KEY = "idlemon-save-v1";
export const SAVE_VERSION = 13;
export const PLAYER_STARTING_MAX_HP = 400;
export const PLAYER_MAX_HP_CAP = 1525;
export const PLAYER_STARTING_MAX_STAMINA = 91;
export const PLAYER_MAX_STAMINA_CAP = 140; // not 160, but +1 every 2 levels

const PLAYER_STAMINA_REGEN_RATE = 25;
const STAMINA_1H = 15; // weapon, offhand, or shield
const STAMINA_2H = 45;

export const ESTUS_BASE_COUNT = 5;
export const ITEM_MAX_COUNT = 9;
export const MAX_MATERIALS = 99;
export const SHOP_REFRESH_COST = 50;

export const WEAPON_SLOTS = new Set(["r-hand", "two-hand", "l-hand"]);

export function isWeaponItem(item) {
  return WEAPON_SLOTS.has((item.slot ?? "").toLowerCase());
}
export function isArmorItem(item) {
  return (item.slot ?? "") !== "" && !isWeaponItem(item);
}
export function isBossItem(item) {
  return (item.notes ?? "").toLowerCase().includes("boss");
}
export function isDragonItem(item) {
  return /dragon/i.test(item.name);
}
export function isDragonMaterial(material) {
  return material.name.trim().toLowerCase() === "dragon scale";
}
export function getMaxUpgradeLevel(item) {
  if (!item.slot) return 0;
  return isBossItem(item) ? 5 : 10;
}
export function getUpgradeCost(item, nextLevel) {
  if (isBossItem(item)) {
    if (nextLevel <= 2) return 1;
    if (nextLevel <= 4) return 2;
    return 4;
  }
  if (nextLevel <= 3) return 1;
  if (nextLevel <= 7) return 2;
  return 3;
}
export function getUpgradeSoulCost(material) {
  return isDragonMaterial(material) ? 10000 : 1000;
}

// Does this skill effect scale with upgrades?
function isUpgradedEffect(item, skillName, eff) {
  const isDefend = skillName.toLowerCase() === "defend";
  if (isArmorItem(item)) return isDefend;                    // armor: Defend only
  return !(isDefend && eff.effectIsPercentage);              // weapons: all except Defend %
}

function baseItemEffects(item) {
  return item.skillEffects?.length
    ? item.skillEffects
    : [{ effectValue: item.effectValue, effectIsPercentage: item.effectIsPercentage }];
}

export function isUpgradable(item) {
  if (!item.slot) return false;
  const skills = item.skills?.length ? item.skills : (item.skill ? [item.skill] : []);
  const base = baseItemEffects(item);
  return skills.some((sk, i) => isUpgradedEffect(item, sk, base[i] ?? base[0]));
}

// Effects after applying the item's upgrade level (+10% of base per level)
export function getItemEffects(state, item) {
  const skills = item.skills?.length ? item.skills : (item.skill ? [item.skill] : []);
  const base = baseItemEffects(item);
  const level = state.upgrades?.[item.id] ?? 0;
  return skills.map((skName, i) => {
    const eff = base[i] ?? base[0];
    if (level === 0 || !isUpgradedEffect(item, skName, eff)) return eff;
    return { ...eff, effectValue: eff.effectValue * (10 + level) / 10 };
  });
}

export function upgradeLoot(state, content, lootId, materialId) {
  const item = content.loot.find((loot) => loot.id === lootId);
  if (!item) throw new Error("That loot item is not available.");
  const owned = (state.lootInventory[lootId] ?? 0) > 0
    || Object.values(state.gear ?? {}).includes(lootId);
  if (!owned) throw new Error(`You no longer have ${item.name}.`);

  const current = state.upgrades?.[lootId] ?? 0;
  if (current >= getMaxUpgradeLevel(item)) {
    throw new Error(`${item.name} is already at its maximum upgrade level.`);
  }
  const cost = getUpgradeCost(item, current + 1);
  if ((state.currencyInventory[materialId] ?? 0) < cost) {
    throw new Error("Not enough upgrade materials.");
  }

  const material = content.materials.find((m) => m.id === materialId);
  if (!material) throw new Error("That material is not available.");

  if (isDragonItem(item) !== isDragonMaterial(material)) {
    throw new Error(isDragonItem(item)
      ? `${item.name} can only be upgraded with Dragon Scale.`
      : `${material.name} cannot upgrade ${item.name}.`);
  }

  // Determine soul cost based on material type
  const soulCost = getUpgradeSoulCost(material);
  const currentSouls = state.currencyBalance ?? 0;
  if (currentSouls < soulCost) {
    throw new Error("Not enough souls.");
  }

  // Deduct souls and materials
  state.currencyBalance = currentSouls - soulCost;
  state.currencyInventory[materialId] -= cost;
  if (state.currencyInventory[materialId] === 0) {
    delete state.currencyInventory[materialId];
  }
  state.upgrades = state.upgrades ?? {};
  state.upgrades[lootId] = current + 1;
  return current + 1;
}

export function getPlayerMaxHp(level, state = null, content = null) {
  const l = Math.max(1, level);
  const standardLevels = Math.min(l - 1, 29);
  const extraLevels = Math.max(0, l - 30);
  let hp = PLAYER_STARTING_MAX_HP + (standardLevels * 15) + (extraLevels * 10);
  
  // Apply special item multipliers if state and content are provided
  if (state && content) {
    const special = getSpecialItemBonuses(state, content);
    if (special.hpMultiplier) {
      hp *= special.hpMultiplier;
      return Math.round(hp); // Bypasses PLAYER_MAX_HP_CAP when multiplied
    }
  }

  return Math.min(PLAYER_MAX_HP_CAP, Math.round(hp));
}

export function getPlayerMaxStamina(level, state = null, content = null) {
  const l = Math.max(1, level);
  const increases = Math.floor((l - 1) / 2);
  let stamina = PLAYER_STARTING_MAX_STAMINA + increases;
  
  if (state && content) {
    const special = getSpecialItemBonuses(state, content);
    if (special.staminaMultiplier) {
      stamina *= special.staminaMultiplier;
      return Math.round(stamina); // Bypasses PLAYER_MAX_STAMINA_CAP when multiplied
    }
  }

  return Math.min(PLAYER_MAX_STAMINA_CAP, Math.round(stamina));
}

export function resetSavedGame(storage = globalThis.localStorage) {
  storage.removeItem(SAVE_KEY);
}

export function createRestoreKey(state, content, now = Date.now()) {
  const gearIndices = {};
  for (const [slot, lootId] of Object.entries(state.gear ?? {})) {
    const idx = content.loot.findIndex((l) => l.id === lootId);
    if (idx !== -1) gearIndices[slot] = idx;
  }

  const lootIndices = {};
  for (const [lootId, count] of Object.entries(state.lootInventory ?? {})) {
    const idx = content.loot.findIndex((l) => l.id === lootId);
    if (idx !== -1) lootIndices[idx] = count;
  }

  const currencyIndices = {};
  for (const [matId, count] of Object.entries(state.currencyInventory ?? {})) {
    const idx = content.materials.findIndex((m) => m.id === matId);
    if (idx !== -1) currencyIndices[idx] = count;
  }

  const killIndices = {};
  for (const [monsterId, count] of Object.entries(state.kills ?? {})) {
    const idx = content.monsters.findIndex((m) => m.id === monsterId);
    if (idx !== -1) killIndices[idx] = count;
  }

  const compactState = [
    state.level,
    Math.round(state.xp),
    Math.round(state.hp),
    state.currencyBalance ?? 0,
    gearIndices,
    lootIndices,
    currencyIndices,
    killIndices,
    state.ngPlus ?? 0,
    state.canLinkFire,
    now
  ];

  const bytes = new TextEncoder().encode(JSON.stringify(compactState));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `#save=${encoded}`;
}

export function restoreStateFromKey(key, content, now = Date.now()) {
  const match = /^#save=([A-Za-z0-9_-]+)$/.exec(key);
  if (!match || match[1].length > 100_000) {
    throw new Error("The restore key is invalid or too large.");
  }

  try {
    const base64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const serialized = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed = JSON.parse(serialized);

    // If it's an array, unpack it into the standard state format
    if (Array.isArray(parsed)) {
      const [level, xp, hp, currencyBalance, gearIndices, lootIndices, currencyIndices, killIndices, ngPlus, canLinkFire] = parsed;
      const baseState = createInitialState(content, now);

      const gear = {};
      for (const [slot, idx] of Object.entries(gearIndices ?? {})) {
        if (content.loot[idx]) gear[slot] = content.loot[idx].id;
      }

      const lootInventory = {};
      for (const [idxStr, count] of Object.entries(lootIndices ?? {})) {
        const item = content.loot[Number(idxStr)];
        if (item) lootInventory[item.id] = count;
      }

      const currencyInventory = {};
      for (const [idxStr, count] of Object.entries(currencyIndices ?? {})) {
        const mat = content.materials[Number(idxStr)];
        if (mat) currencyInventory[mat.id] = count;
      }

      const kills = {};
      for (const [idxStr, count] of Object.entries(killIndices ?? {})) {
        const monster = content.monsters[Number(idxStr)];
        if (monster) kills[monster.id] = count;
      }

      baseState.level = level;
      baseState.xp = xp;
      baseState.hp = hp;
      baseState.currencyBalance = currencyBalance;
      baseState.gear = gear;
      baseState.lootInventory = lootInventory;
      baseState.currencyInventory = currencyInventory;
      baseState.kills = kills;
      baseState.targetMonsterId = null;
      baseState.monsterHp = 0;
      baseState.awaitingMonsterSelection = true;
      baseState.pendingTargetMonsterId = null;
      baseState.ngPlus = Number.isInteger(ngPlus) && ngPlus >= 0 ? ngPlus : 0;
      baseState.canLinkFire = Boolean(canLinkFire);
      baseState.updatedAt = now;

      return parseSavedState(JSON.stringify(baseState), content);
    }

    // Fallback for older full-object keys
    const state = parseSavedState(serialized, content);
    state.updatedAt = now;
    return state;
  } catch (error) {
    throw new Error("The restore key is malformed or contains invalid progress.");
  }
}

export function getMonsterHealth(monster, ngPlus = 0) {
  const baseHealth = monster.health ?? 0;
  if (ngPlus <= 0) return baseHealth;

  // Non-stacking flat bonus added to the base 2x multiplier per NG+ level
  const additionalBonuses = [
    0,     // ngPlus 0 (unused)
    0.00,  // ngPlus 1
    0.07,  // ngPlus 2
    0.10,  // ngPlus 3
    0.14,  // ngPlus 4
    0.19,  // ngPlus 5
    0.25   // ngPlus 6+
  ];

  const bonus = ngPlus < additionalBonuses.length ? additionalBonuses[ngPlus] : 0.25;
  const multiplier = 2 + bonus;

  return Math.round(baseHealth * multiplier);
}

export function getMonsterDamage(monster, ngPlus = 0) {
  const baseDamage = monster.damage ?? 0;
  if (ngPlus <= 0) return baseDamage;

  // Multiplier per NG+ level (6+ stays at the last value)
  const multipliers = [
    1.00,  // ngPlus 0 (unused)
    1.37,  // ngPlus 1
    1.66,  // ngPlus 2  (+0.29)
    1.78,  // ngPlus 3  (+0.12)
    1.95,  // ngPlus 4  (+0.16)
    2.15,  // ngPlus 5  (+0.21)
    2.40   // ngPlus 6+ (+0.25)
  ];

  const multiplier = ngPlus < multipliers.length ? multipliers[ngPlus] : multipliers[multipliers.length - 1];

  return Math.round(baseDamage * multiplier);
}

export function experienceForNextLevel(level) {
  const nextLevel = level + 1;
  return Math.round(
    0.02 * nextLevel ** 3
      + 3.06 * nextLevel ** 2
      - 13.68 * nextLevel
      + 81.96,
  );
}

export function createShopOffers(content, random = Math.random) {
  const available = shopLoot(content).map((item) => item.id);
  if (available.length < 2) {
    throw new Error("The Shop requires at least two loot items without a Slot.");
  }
  for (let index = 0; index < 2; index += 1) {
    const selected = index + Math.floor(random() * (available.length - index));
    [available[index], available[selected]] = [available[selected], available[index]];
  }
  return available.slice(0, 2);
}

function shopLoot(content) {
  return content.loot.filter((item) => {
    if (item.slot !== "") return false;

    // exclude things with the Notes 'noshop' in data
    const notes = (item.notes ?? item.Notes ?? "").trim().toLowerCase();
    return !notes.includes("noshop");
  });
}

export function refreshShop(state, content, random = Math.random) {
  if (!state.shopUnlocked || getCurrencyBalance(state, content) < SHOP_REFRESH_COST) {
    return false;
  }
  const offers = createShopOffers(content, random);
  state.currencyBalance = getCurrencyBalance(state, content) - SHOP_REFRESH_COST;
  state.shopOffers = offers;
  return true;
}

function getCurrencyBalance(state, content) {
  return state.currencyBalance ?? content.materials.reduce((total, material) => (
    total + material.value * (state.currencyInventory?.[material.id] ?? 0)
  ), 0);
}

function replacementOffer(content, excludedIds, random) {
  let candidates = shopLoot(content).filter((item) => !excludedIds.has(item.id));
  if (candidates.length === 0) {
    const otherOfferId = excludedIds.values().next().value;
    candidates = shopLoot(content).filter((item) => item.id !== otherOfferId);
  }
  if (candidates.length === 0) {
    throw new Error("The Shop requires at least two loot items without a Slot.");
  }
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index].id;
}

export function buyShopItem(state, content, offerIndex, random = Math.random) {
  if (!state.shopUnlocked) {
    return false;
  }
  if (!Array.isArray(state.shopOffers)
      || !Number.isInteger(offerIndex)
      || offerIndex < 0
      || offerIndex >= state.shopOffers.length) {
    throw new Error("That Shop offer is unavailable.");
  }
  const item = content.loot.find((loot) => loot.id === state.shopOffers[offerIndex]);
  if (!item || item.slot !== "") {
    throw new Error("That Shop item is no longer available.");
  }
  if (getCurrencyBalance(state, content) < item.value) {
    return false;
  }

  const maxCount = getMaxItemCount(state, item);
  if (getTotalItemCount(state, item.id) >= maxCount) {
    throw new Error(`Maximum of ${maxCount} ${item.name} already held.`);
  }

  state.currencyBalance = getCurrencyBalance(state, content) - item.value;
  state.lootInventory[item.id] = (state.lootInventory[item.id] ?? 0) + 1;
  markLootNew(state, item.id);

  const otherOffer = state.shopOffers[1 - offerIndex];
  state.shopOffers[offerIndex] = replacementOffer(
    content,
    new Set([otherOffer, item.id]),
    random,
  );
  return true;
}

export function getMaxItemCount(state, item) {
  if ((item?.name ?? "").toLowerCase().includes("estus")) {
    return ESTUS_BASE_COUNT + (state.ngPlus ?? 0);
  }
  return ITEM_MAX_COUNT;
}

function getTotalItemCount(state, lootId) {
  const bagCount = state.lootInventory[lootId] ?? 0;
  const equippedCount = Object.values(state.gear ?? {}).filter((id) => id === lootId).length;
  return bagCount + equippedCount;
}

export function isItemCountMaxed(state, item) {
  return getTotalItemCount(state, item.id) >= getMaxItemCount(state, item);
}

export function addLootToBag(state, content, lootId) {
  const item = content.loot.find((loot) => loot.id === lootId);
  if (!item) {
    throw new Error("That loot item is not available.");
  }

  // Cannot obtain another unique item if already carried or equipped.
  // This also applies to NG+, but if you sold it you can get the loot again.
  const isUnique = (item.notes ?? "").toLowerCase().includes("unique");
  if (isUnique) {
    const totalOwned = (state.lootInventory[lootId] ?? 0) + (Object.values(state.gear).includes(lootId) ? 1 : 0);
    if (totalOwned > 0) {
      return false;
    }
  }
  const maxCount = getMaxItemCount(state, item);
  if (getTotalItemCount(state, item.id) >= maxCount) {
    throw new Error(`Maximum of ${maxCount} ${item.name} already held.`);
  }

  state.lootInventory[item.id] = (state.lootInventory[item.id] ?? 0) + 1;
  markLootNew(state, item.id);
}

export function sellLoot(state, content, lootId, count = 1) {
  const item = content.loot.find((loot) => loot.id === lootId);
  if (!item) {
    throw new Error("That loot item is not available.");
  }
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("The number of loot items to sell must be a positive whole number.");
  }
  if ((state.lootInventory[item.id] ?? 0) < count) {
    return false;
  }

  state.lootInventory[item.id] -= count;
  if (state.lootInventory[item.id] === 0) {
    if (!Object.values(state.gear ?? {}).includes(item.id)) {
      delete state.upgrades?.[item.id];
    }
    delete state.lootInventory[item.id];
    state.newLootIds = state.newLootIds.filter((id) => id !== item.id);
  }
  state.currencyBalance = getCurrencyBalance(state, content) + item.value * count;
  return true;
}

export function sellMaterial(state, content, materialId, count = 1) {
  const item = content.materials.find((material) => material.id === materialId);
  if (!item) {
    throw new Error("That Material is not available.");
  }
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("The number of Materials to sell must be a positive whole number.");
  }
  if ((state.currencyInventory[item.id] ?? 0) < count) {
    return false;
  }

  state.currencyInventory[item.id] -= count;
  if (state.currencyInventory[item.id] === 0) {
    delete state.currencyInventory[item.id];
  }
  state.currencyBalance = getCurrencyBalance(state, content) + item.value * count;
  return true;
}

function markLootNew(state, lootId) {
  if (!state.newLootIds.includes(lootId)) {
    state.newLootIds.push(lootId);
  }
  state.prepareViewed = state.activeTab === "prepare";
}

function unlockedMonsters(state, content) {
  return content.monsters; // no filter
  //return content.monsters.filter((monster) => monster.unlock_level <= state.level);
}

export function createInitialState(content, now = Date.now()) {
  //const firstMonster = unlockedMonsters({ level: 1 }, content)[0];
  return {
    version: SAVE_VERSION,
    level: 1,
    xp: 0,
    hp: getPlayerMaxHp(1),
    stamina: PLAYER_STARTING_MAX_STAMINA,
    maxStamina: getPlayerMaxStamina(1),
    playtime: 0, // Track total play time in seconds
    ngPlus: 0,
    autoHealEnabled: false,
    autoHealThreshold: 100,
    gameOver: false,
    canLinkFire: false,
    targetMonsterId: null,//firstMonster.id,
    pendingTargetMonsterId: null,
    monsterHp: 0,//firstMonster.health,
    awaitingMonsterSelection: true,//false,
    attackRemainder: 0,
    nextHitDefense: 0,
    nextHitDefensePercent: 0,
    activeTab: "fight",
    shopUnlocked: false,
    shopVisited: false,
    bossShopHintDismissed: false,
    prepareViewed: false,
    lastLootCheck: null,
    shopOffers: createShopOffers(content),
    newLootIds: [],
    lootInventory: {},
    gear: {},
    upgrades: {},
    currencyInventory: {},
    currencyBalance: 0,
    kills: {},
    updatedAt: now,
  };
}

export function parseSavedState(serialized, content) {
  let state;
  try {
    state = JSON.parse(serialized);
  } catch {
    throw new Error("The local save is not valid JSON.");
  }

  if (!state || typeof state !== "object" || Array.isArray(state) || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, SAVE_VERSION].includes(state.version)) {
    throw new Error("The local save has an unsupported format.");
  }
  
  if (!Number.isInteger(state.level) || state.level < 1) {
    throw new Error("The saved player level is invalid.");
  }
  let target = content.monsters.find((monster) => monster.id === state.targetMonsterId);
  let targetMonsterId = state.targetMonsterId;
  let monsterHp = state.monsterHp;
  let awaitingMonsterSelection = state.awaitingMonsterSelection ?? false;
  const recoveryWarnings = [];
  if (targetMonsterId !== null && !target) {
    target = unlockedMonsters(state, content)[0];
    targetMonsterId = target.id;
    monsterHp = getMonsterHealth(target, state.ngPlus);
    awaitingMonsterSelection = false;
  }
  let pendingTargetMonsterId = state.pendingTargetMonsterId ?? null;
  const pendingTarget = pendingTargetMonsterId === null
    ? null
    : content.monsters.find((monster) => monster.id === pendingTargetMonsterId);
  if (pendingTargetMonsterId !== null
      && (!pendingTarget || pendingTarget.id === target?.id)) {
    pendingTargetMonsterId = null;
  }
  if (!isNonNegativeNumber(state.xp)) {
    throw new Error("The saved experience value is invalid.");
  }
  const maxHp = getPlayerMaxHp(state.level, state, content);
  const maxStamina = getPlayerMaxStamina(state.level, state, content);
  const hp = state.hp ?? maxHp;
  const playtime = isNonNegativeNumber(state.playtime) ? state.playtime : 0;
  const ngPlus = Number.isInteger(state.ngPlus) ? state.ngPlus : 0;
  const targetHealth = target ? getMonsterHealth(target, ngPlus) : 0;
  const gameOver = state.gameOver ?? false;
  if (!Number.isFinite(hp) || hp < 0 || hp > maxHp || typeof gameOver !== "boolean") {
    throw new Error("The saved player health or game-over state is invalid.");
  }
  if ((hp === 0) !== gameOver) {
    throw new Error("The saved player health does not match the game-over state.");
  }
  const activeTab = state.activeTab ?? (state.isPreparing ? "prepare" : "fight");
  const shopUnlocked = state.shopUnlocked
    ?? (activeTab === "shop"
      || content.monsters.some((monster) => monster.type.toLowerCase() === "boss" && (state.kills?.[monster.id] ?? 0) > 0));
  const shopVisited = state.shopVisited ?? activeTab === "shop";
  const bossShopHintDismissed = state.bossShopHintDismissed ?? false;
  if (typeof awaitingMonsterSelection !== "boolean"
      || typeof shopUnlocked !== "boolean"
      || typeof shopVisited !== "boolean"
      || typeof bossShopHintDismissed !== "boolean") {
    throw new Error("The saved Boss progression is invalid.");
  }
  const prepareViewed = state.prepareViewed ?? false;
  if (typeof prepareViewed !== "boolean") {
    throw new Error("The saved Prepare state is invalid.");
  }
  if (!["fight", "prepare", "shop"].includes(activeTab)
      || (activeTab === "shop" && !shopUnlocked)) {
    throw new Error("The saved game mode is invalid.");
  }
  const noSelectedMonster = targetMonsterId === null;
  const isSpecialEnemyType = target ? ["boss", "miniboss", "phantom"].includes(target.type.toLowerCase()) : false;
  if (!target) {
    if (monsterHp !== 0 || !awaitingMonsterSelection || pendingTargetMonsterId !== null) {
      recoveryWarnings.push("Repaired saved monster selection.");
    }
    monsterHp = 0;
    awaitingMonsterSelection = true;
    pendingTargetMonsterId = null;
  } else if (isSpecialEnemyType && (target.type.toLowerCase() !== "boss" || shopUnlocked) && monsterHp === 0) {
    if (!awaitingMonsterSelection || pendingTargetMonsterId !== null) {
      recoveryWarnings.push("Repaired saved Boss defeat state.");
    }
    awaitingMonsterSelection = true;
    pendingTargetMonsterId = null;
  } else if (awaitingMonsterSelection && isSpecialEnemyType && (target.type.toLowerCase() !== "boss" || shopUnlocked)) {
    if (monsterHp !== 0 || pendingTargetMonsterId !== null) {
      recoveryWarnings.push("Repaired saved Boss defeat state.");
    }
    monsterHp = 0;
    pendingTargetMonsterId = null;
  } else if (awaitingMonsterSelection) {
    recoveryWarnings.push("Repaired saved monster selection.");
    awaitingMonsterSelection = false;
    monsterHp = targetHealth;
    pendingTargetMonsterId = null;
  } else if (!isNonNegativeNumber(monsterHp) || monsterHp === 0) {
    recoveryWarnings.push("Repaired saved monster health.");
    monsterHp = targetHealth;
  } else if (monsterHp > targetHealth) {
    recoveryWarnings.push("Adjusted saved monster health to match the current sheet.");
    monsterHp = targetHealth;
  }
  // if (!isNonNegativeNumber(monsterHp)
  //     || (noSelectedMonster
  //       ? monsterHp !== 0 || !awaitingMonsterSelection || pendingTargetMonsterId !== null
  //         : monsterHp > targetHealth
  //         || (monsterHp === 0) !== awaitingMonsterSelection
  //         || (awaitingMonsterSelection && target.type.toLowerCase() !== "boss")
  //         || (awaitingMonsterSelection && (!shopUnlocked || pendingTargetMonsterId !== null)))) {
  //   throw new Error("The saved monster health does not match the current sheet.");
  // }
  if (!isNonNegativeNumber(state.attackRemainder) || state.attackRemainder >= 1) {
    throw new Error("The saved attack timer is invalid.");
  }
  const nextHitDefense = state.nextHitDefense ?? 0;
  if (!isNonNegativeNumber(nextHitDefense)) {
    throw new Error("The saved temporary defense value is invalid.");
  }
  const nextHitDefensePercent = state.nextHitDefensePercent ?? 0;
  if (!isNonNegativeNumber(nextHitDefensePercent) || nextHitDefensePercent > 100) {
    throw new Error("The saved temporary defense percentage is invalid.");
  }
  if (!isNonNegativeNumber(state.updatedAt)) {
    throw new Error("The saved timestamp is invalid.");
  }
  const { inventory: lootInventory, warnings: lootRecoveryWarnings } = pruneLootInventory(
    state.lootInventory,
    content.loot,
  );
  if (state.gear !== undefined && (!state.gear || typeof state.gear !== "object" || Array.isArray(state.gear))) {
    throw new Error("The saved gear data is invalid.");
  }
  const gear = {};
  for (const [savedSlot, lootId] of Object.entries(state.gear ?? {})) {
    const item = content.loot.find((loot) => loot.id === lootId);
    if (!item) {
      continue;
    }
    const slot = savedSlot === "Two-Hand" ? "R-Hand" : savedSlot;
    const itemGearSlot = item.slot === "Two-Hand" ? "R-Hand" : item.slot;
    if (itemGearSlot !== slot) {
      lootInventory[item.id] = (lootInventory[item.id] ?? 0) + 1;
      continue;
    }
    const existingItem = content.loot.find((loot) => loot.id === gear[slot]);
    if (existingItem) {
      if (item.slot === "Two-Hand" && existingItem.slot !== "Two-Hand") {
        lootInventory[existingItem.id] = (lootInventory[existingItem.id] ?? 0) + 1;
        gear[slot] = item.id;
      } else {
        lootInventory[item.id] = (lootInventory[item.id] ?? 0) + 1;
      }
    } else {
      gear[slot] = item.id;
    }
  }
  const handItem = content.loot.find((loot) => loot.id === gear["R-Hand"]);
  if (handItem?.slot === "Two-Hand" && gear["L-Hand"]) {
    lootInventory[gear["L-Hand"]] = (lootInventory[gear["L-Hand"]] ?? 0) + 1;
    delete gear["L-Hand"];
    recoveryWarnings.push("Returned saved L-Hand equipment to the Bag because a Two-Hand item occupies the R-Hand slot.");
  }
  const currencyInventory = pruneCountMap(state.currencyInventory, new Set(content.materials.map((item) => item.id)), "materials");
  const currencyBalance = state.currencyBalance ?? content.materials.reduce((total, material) => (
    total + material.value * (currencyInventory[material.id] ?? 0)
  ), 0);
  if (!isNonNegativeNumber(currencyBalance) || currencyBalance > 1_000_000_000_000) {
    throw new Error("The saved Souls balance is invalid.");
  }
  let shopOffers = state.shopOffers;
  if (!Array.isArray(shopOffers)
      || shopOffers.length !== 2
      || shopOffers[0] === shopOffers[1]
      || shopOffers.some((id) => !shopLoot(content).some((item) => item.id === id))) {
    shopOffers = createShopOffers(content);
  }
  const newLootIds = state.newLootIds ?? [];
  if (!Array.isArray(newLootIds)) {
    throw new Error("The saved new-loot data is invalid.");
  }
  const currentLootIds = new Set(content.loot.map((item) => item.id));
  const repairedNewLootIds = [...new Set(newLootIds.filter((id) => currentLootIds.has(id)))];
  const kills = pruneCountMap(state.kills, new Set(content.monsters.map((monster) => monster.id)), "kill");

  const autoHealEnabled = typeof state.autoHealEnabled === "boolean" ? state.autoHealEnabled : false;
  const autoHealThreshold = Number.isInteger(state.autoHealThreshold) && state.autoHealThreshold > 0
    ? state.autoHealThreshold
    : 100;
  
  const seenMaterials = state.seenMaterials && typeof state.seenMaterials === "object" && !Array.isArray(state.seenMaterials)
    ? state.seenMaterials
    : {}; // Add this block

  const upgrades = {};
  for (const [id, level] of Object.entries(state.upgrades ?? {})) {
    const lootItem = content.loot.find((loot) => loot.id === id);
    if (lootItem && Number.isInteger(level) && level > 0) {
      upgrades[id] = Math.min(level, getMaxUpgradeLevel(lootItem));
    }
  }

  return {
    version: SAVE_VERSION,
    level: state.level,
    xp: state.xp,
    hp,
    maxStamina,
    stamina: Math.min(state.stamina ?? maxStamina, maxStamina),
    playtime,
    ngPlus,
    autoHealEnabled,
    autoHealThreshold,
    gameOver,
    canLinkFire: Boolean(state.canLinkFire),
    targetMonsterId,
    pendingTargetMonsterId,
    monsterHp,
    attackRemainder: state.attackRemainder,
    nextHitDefense,
    nextHitDefensePercent,
    activeTab,
    awaitingMonsterSelection,
    shopUnlocked,
    shopVisited,
    bossShopHintDismissed,
    prepareViewed,
    shopOffers,
    newLootIds: repairedNewLootIds,
    lootInventory,
    recoveryWarnings: [...recoveryWarnings, ...lootRecoveryWarnings],
    gear,
    upgrades,
    currencyInventory,
    seenMaterials,
    currencyBalance,
    kills,
    updatedAt: state.updatedAt,
  };
}

export function getItemDamageBreakdown(state, item, content) {
  let physical = 0;
  let magic = 0;
  let fire = 0;
  let lightning = 0;
  let poison = 0;

  const skills = item.skills?.length ? item.skills : (item.skill ? [item.skill] : []);
  
  // Only treat as a weapon breakdown if at least one skill is explicitly offensive
  const hasOffensiveSkill = skills.some(sk => {
    const lower = sk.toLowerCase();
    return lower === "attack" || lower.includes("magic") || lower.includes("fire") || lower.includes("lightning") || lower.includes("poison");
  });

  if (!hasOffensiveSkill) {
    return { physical: 0, magic: 0, fire: 0, lightning: 0, poison: 0 };
  }

  const effects = getItemEffects(state, item);

  // Flatten all effect values, splitting any comma-separated strings
  // percent based damage is always a special item counted separately (for now)
  const allValues = [];
  const allIsPercentage = [];
  for (const eff of effects) {
    if (typeof eff.effectValue === "string" && eff.effectValue.includes(",")) {
      const splitVals = eff.effectValue.split(",").map((v) => Number(v.trim()) || 0);
      allValues.push(...splitVals);
      for (let i = 0; i < splitVals.length; i++) allIsPercentage.push(eff.effectIsPercentage);
    } else {
      allValues.push(Number(eff.effectValue) || 0);
      allIsPercentage.push(Boolean(eff.effectIsPercentage));
    }
  }

  // Map values index-by-index to skills in order (ignoring defensive/utility skills)
  for (let i = 0; i < skills.length; i++) {
    const skName = (skills[i] || "").toLowerCase();
    const val = allValues[i] !== undefined ? allValues[i] : (allValues[0] || 0);
    const isPct = allIsPercentage[i] !== undefined ? allIsPercentage[i] : (allIsPercentage[0] || false);
    
    // Skip percent-based values from flat baseline breakdown (handled via getSpecialItemBonuses)
    if (isPct) continue;

    const skillObj = content?.skills?.find((candidate) => candidate.name.toLowerCase() === skName);
    const effectType = skillObj?.effect;

    if (skName.includes("magic") || effectType === "magic") {
      magic += val;
    } else if (skName.includes("fire") || effectType === "fire") {
      fire += val;
    } else if (skName.includes("lightning") || effectType === "lightning") {
      lightning += val;
    } else if (skName.includes("poison") || effectType === "poison") {
      poison += val;
    } else if (skName.includes("attack") || skName.includes("physical") || effectType === "damage_flat" || (!skillObj && skName)) {
      physical += val;
    }
  }

  return { physical, magic, fire, lightning, poison };
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function pruneLootInventory(value, loot) {
  const validLootIds = new Set(loot.map((item) => item.id));
  const entries = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const inventory = {};
  const warnings = [];
  for (const [id, count] of Object.entries(entries)) {
    if (!validLootIds.has(id) || !Number.isSafeInteger(count) || count < 0) {
      const itemName = loot.find((item) => item.id === id)?.name ?? id;
      warnings.push(`Removed invalid saved loot entry "${itemName}".`);
      continue;
    }
    inventory[id] = count;
  }
  if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) {
    warnings.push("Cleared invalid saved loot inventory data.");
  }
  return { inventory, warnings };
}

function pruneCountMap(value, allowedIds, label) {
  const entries = value ?? {};
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    throw new Error(`The saved ${label} data is invalid.`);
  }
  const repaired = {};
  for (const [id, count] of Object.entries(entries)) {
    if (!allowedIds.has(id)) {
      continue;
    }
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`The saved ${label} data contains an invalid entry.`);
    }
    repaired[id] = count;
  }
  return repaired;
}

export function getHumanity(state, content) {
  let humanityCount = 0;

  const humanityItem = content.materials.find((m) => m.name.toLowerCase() === "humanity")
        || content.loot.find((l) => l.name.toLowerCase() === "humanity");
    
  if (humanityItem) {
    humanityCount = state.currencyInventory?.[humanityItem.id] 
      ?? state.lootInventory?.[humanityItem.id] 
      ?? 0;
  }

  return humanityCount;
}

export function getSpecialItemBonuses(state, content, item = null) {
  let extraDamage = 0;
  let selfDamage = 0; // should be NEGATIVE
  let physDamageMultiplier = 1;
  let magicDamageMultiplier = 1;
  let fireDamageMultiplier = 1;
  let lightningDamageMultiplier = 1;
  let poisonDamageMultiplier = 1;
  let hpMultiplier = 1;
  let staminaMultiplier = 1;
  let extraReason = "";

  // Helper to check for certain items by name
  const isChaosBlade = (i) => i && (i.id === "chaos-blade" || i.name.toLowerCase().includes("chaos blade"));
  const isFurysword = (i) => i && (i.id === "quelaags-furysword" || i.name.toLowerCase().includes("quelaag's furysword"));
  const isDuskCrownRing = (i) => i && (i.id === "dusk-crown-ring" || i.name.toLowerCase().includes("dusk crown ring"));
  const isRingOfFavor = (i) => i && (i.id === "ring-of-favor-and-protection" || i.name.toLowerCase().includes("ring of favor and protection"));
  const isTinyBeingRing = (i) => i && (i.id === "tiny-beings-ring" || i.name.toLowerCase().includes("tiny being's ring"));
  const isMaskOfMother = (i) => i && (i.id === "mask-of-the-mother" || i.name.toLowerCase().includes("mask of the mother"));

  // If a specific item was passed, check it; otherwise check all equipped gear
  const itemsToCheck = item ? [item] : Object.values(state.gear ?? {}).map(id => content.loot.find(l => l.id === id));

  // Check given or equipped gear for special item rules
  for (const gearItem of itemsToCheck) {
    // WEAPONS
    if (isChaosBlade(gearItem)) {
      extraReason = "Chaos";
      selfDamage = -20;

      const humanityCount = getHumanity(state, content);
      if (humanityCount > 0) {
        const bonuses = [0, 2, 1, 1, .6, .7, .6, .6, .6, .7, .6];
        extraDamage += bonuses[Math.min(10, humanityCount)];
      }
    }
    if (isFurysword(gearItem)) {
      extraReason = "Humanity";

      const humanityCount = getHumanity(state, content);
      if (humanityCount > 0) {
        // Example scaling: 1 humanity = +2 dmg, 2 = +5 dmg, etc. 
        // Or a formula: e.g., +2 damage per humanity:
        const pairs = Math.floor(humanityCount / 2);
        extraDamage += (pairs * 0.5) + ((humanityCount % 2 !== 0) ? 0.2 : 0);

        // TODO: add fire damage
      }
    }

    // ARMOR
    if (isMaskOfMother(gearItem)) {
      extraReason = "Mother";
      hpMultiplier *= 1.1;
    }

    // RINGS
    // remove else checks if more than 1 can be equipped
    if (isDuskCrownRing(gearItem)) {
      extraReason = "Dusk";
      magicDamageMultiplier *= 1.5;
      hpMultiplier *= 0.5;
    }
    else if (isRingOfFavor(gearItem)) {
      extraReason = "Favor";
      hpMultiplier *= 1.2;
      staminaMultiplier *= 1.2;
    }
    else if (isTinyBeingRing(gearItem)) {
      extraReason = "Being";
      hpMultiplier *= 1.05;
    }
  }

  return {  damage: extraDamage,
            selfDamage,
            physDamageMultiplier,
            magicDamageMultiplier,
            fireDamageMultiplier,
            lightningDamageMultiplier,
            poisonDamageMultiplier,
            hpMultiplier,
            staminaMultiplier,
            reason : extraReason
   };
}

export function getPlayerStats(state, content) {
  let physicalDamage = 0;
  let magicDamage = 0;
  let fireDamage = 0;
  let lightningDamage = 0;
  let poisonDamage = 0;
  let gearHealing = 0;
  let weaponHealing = 0;
  const bonuses = {
    xp_multiplier: 0,
    defense_flat: 0,
    defense_percent: 0,
  };

  // Get special item multipliers first
  const specialBonuses = getSpecialItemBonuses(state, content);

  // Calculate base max HP and apply multiplier (ignoring cap if modified)
  // bonuses were already gotten here for other reasons, so avoid calling again in getplayermaxhp
  const baseMaxHp = getPlayerMaxHp(state.level);
  const hpMultiplier = specialBonuses.hpMultiplier ?? 1;
  const maxHp = Math.round(baseMaxHp * hpMultiplier)
  const hpModified = hpMultiplier !== 1;

  // Calculate stamina and apply multipliers
  const baseMaxStamina = getPlayerMaxStamina(state.level, state, content);
  const staminaMultiplier = specialBonuses.staminaMultiplier ?? 1;
  const maxStamina = Math.round(baseMaxStamina * staminaMultiplier);
  const staminaModified = staminaMultiplier !== 1;

  for (const lootId of Object.values(state.gear ?? {})) {
    const item = content.loot.find((loot) => loot.id === lootId);
    if (!item) continue;

    const itemSkills = item.skills?.length ? item.skills : (item.skill ? [item.skill] : []);
    const itemEffects = getItemEffects(state, item);

    let hasDamage = false;
    for (let i = 0; i < itemSkills.length; i++) {
      const skName = itemSkills[i];
      const eff = itemEffects[i] ?? itemEffects[0];
      const skill = content.skills.find((candidate) => candidate.name.toLowerCase() === skName.toLowerCase());

      if (skill?.effect === "damage_flat" || (!skill && skName)) {
        hasDamage = true;
      }
      if (skill?.effect === "defense_flat") {
        if (eff.effectIsPercentage) {
          bonuses.defense_percent += eff.effectValue;
        } else {
          bonuses.defense_flat += eff.effectValue;
        }
      }
      if (skill?.effect === "heal") {
        const maxHp = getPlayerMaxHp(state.level, state, content);
        if (item.slot === "R-Hand" || item.slot === "Two-Hand") {
          weaponHealing += eff.effectIsPercentage ? (maxHp * eff.effectValue / 100) : eff.effectValue;
        } else {
          gearHealing += eff.effectIsPercentage ? (maxHp * eff.effectValue / 100) : eff.effectValue;
        }
      }
    }

    if (hasDamage) {
      const breakdown = getItemDamageBreakdown(state, item, content);
      physicalDamage += breakdown.physical;
      fireDamage += breakdown.fire;
      magicDamage += breakdown.magic;
    }
  }

  const basePhysical = 1 + physicalDamage + specialBonuses.damage;
  const totalPhysical = basePhysical * (specialBonuses.physDamageMultiplier || 1);
  const totalMagic = magicDamage * (specialBonuses.magicDamageMultiplier || 1);
  const totalFire = fireDamage * (specialBonuses.fireDamageMultiplier || 1);
  const totalLightning = lightningDamage * (specialBonuses.lightningDamageMultiplier || 1);
  const totalPoison = poisonDamage * (specialBonuses.poisonDamageMultiplier || 1);

  const totalDamage = totalPhysical + totalMagic + totalFire + totalLightning + totalPoison;

  return {
    damage: totalDamage,
    physicalDamage: totalPhysical,
    magicDamage: totalMagic,
    fireDamage: totalFire,
    lightningDamage: totalLightning,
    poisonDamage: totalPoison,
    maxHp, hpModified,
    maxStamina, staminaModified,
    defense: state.godMode ? 999 : bonuses.defense_flat,
    defensePercent: Math.min(100, bonuses.defense_percent),
    xpMultiplier: Math.max(0, 1 + bonuses.xp_multiplier),
    gearHealing, weaponHealing,
    selfDamage: specialBonuses.selfDamage
  };
}

function addLootToInventory(state, lootId, count = 1) {
  const current = state.lootInventory[lootId] ?? 0;
  if (current >= 9) {
    return false; // Bag is already at maximum capacity (9) for this item
  }
  state.lootInventory[lootId] = Math.min(9, current + count);
  markLootNew(state, lootId);
  return true;
}

export function isTwoHandEquipped(state, content) {
  const handItem = content.loot.find((loot) => loot.id === state.gear?.["R-Hand"]);
  return handItem?.slot === "Two-Hand";
}

export function equipLoot(state, content, lootId) {
  const item = content.loot.find((loot) => loot.id === lootId);
  if (!item) {
    throw new Error("That loot item is not available.");
  }
  const owned = state.lootInventory[item.id] ?? 0;
  if (owned < 1) {
    throw new Error("That item is not in your bag.");
  }
  if (item.slot === "L-Hand" && isTwoHandEquipped(state, content)) {
    throw new Error("L-Hand equipment cannot be used while a Two-Hand item is equipped.");
  }

  const slot = item.slot === "Two-Hand" ? "R-Hand" : item.slot;
  const previousId = state.gear[slot];
  if (previousId === item.id) {
    return false;
  }
  if (previousId) {
    state.lootInventory[previousId] = (state.lootInventory[previousId] ?? 0) + 1;
  }
  if (item.slot === "Two-Hand" && state.gear["L-Hand"]) {
    const offhandId = state.gear["L-Hand"];
    state.lootInventory[offhandId] = (state.lootInventory[offhandId] ?? 0) + 1;
    delete state.gear["L-Hand"];
  }
  state.lootInventory[item.id] = owned - 1;
  if (state.lootInventory[item.id] === 0) {
    delete state.lootInventory[item.id];
  }
  state.gear[slot] = item.id;
  return true;
}

export function unequipLoot(state, content, slot) {
  const lootId = state.gear[slot];
  if (!lootId) {
    return false;
  }
  if (!content.loot.some((item) => (
    item.id === lootId
    && (item.slot === "Two-Hand" ? "R-Hand" : item.slot) === slot
  ))) {
    throw new Error("The equipped item no longer matches this gear slot.");
  }
  delete state.gear[slot];
  state.lootInventory[lootId] = (state.lootInventory[lootId] ?? 0) + 1;
  return true;
}

export function useLoot(state, content, lootId, random = Math.random) {
  const item = content.loot.find((loot) => loot.id === lootId);
  if (!item || item.slot !== "") {
    throw new Error("Only a slotless loot item can be used.");
  }
  if ((state.lootInventory[item.id] ?? 0) < 1) {
    throw new Error("That item is not in your bag.");
  }

  const skill = content.skills.find((candidate) => candidate.name === item.skill);
  if (!skill && item.skill.toLowerCase() === "revive") {
    return revivePlayer(state, content, item.id);
  }
  if (!skill) {
    throw new Error("This item has no usable associated skill.");
  }
  if (skill.effect === "revive") {
    return revivePlayer(state, content, item.id);
  }
  if (skill.effect === "flee") {
    if (!state.targetMonsterId || state.awaitingMonsterSelection || state.gameOver) {
      return false;
    }
    state.targetMonsterId = null;
    state.pendingTargetMonsterId = null;
    state.monsterHp = 0;
    state.attackRemainder = 0;
    state.awaitingMonsterSelection = true;
    state.activeTab = "prepare";
    state.prepareViewed = true;
  } else if (skill.effect === "heal") {
    const maxHp = getPlayerMaxHp(state.level, state, content);
    if (state.gameOver || state.hp >= maxHp) {
      return false;
    }
    const healing = item.effectIsPercentage
      ? maxHp * item.effectValue / 100
      : item.effectValue;
    state.hp = Math.min(maxHp, state.hp + healing);
  } else if (skill.effect === "stamina") {
    const maxStamina = stats.maxStamina ?? getPlayerMaxStamina(state.level, state, content);
    if ((state.stamina ?? maxStamina) >= maxStamina) {
      return false;
    }
    const staminaRestore = item.effectIsPercentage
      ? maxStamina * item.effectValue / 100
      : item.effectValue;
    state.stamina = Math.min(maxStamina, (state.stamina ?? maxStamina) + staminaRestore);
  } else if (skill.effect === "damage_flat") {
    const target = content.monsters.find((monster) => monster.id === state.targetMonsterId);
    if (!target) {
      throw new Error("The selected monster is unavailable.");
    }

    // Get damage breakdown for the item using the same index-mapping logic
    const dummyItemState = { upgrades: { [item.id]: state.upgrades?.[item.id] ?? 0 } };
    const dmgBreakdown = getItemDamageBreakdown(dummyItemState, item, content);
    let physDmg = dmgBreakdown.physical;
    let magicDmg = dmgBreakdown.magic;
    let fireDmg = dmgBreakdown.fire;
    let lightningDmg = dmgBreakdown.lightning;
    let poisonDmg = dmgBreakdown.poison;

    const monsterNotes = (target.notes ?? target.Notes ?? "").toLowerCase();
    if (monsterNotes.includes("magic resist")) {
      magicDmg = 0;
    }
    if (monsterNotes.includes("fire resist")) {
      fireDmg = 0;
    }
    if (monsterNotes.includes("lightning resist")) {
      lightningDmg = 0;
    }
    if (monsterNotes.includes("poison resist")) {
      poisonDmg = 0;
    }

    const netDamage = physDmg + magicDmg + fireDmg + lightningDmg + poisonDmg;
    state.monsterHp -= netDamage;

    // Check if enemy is dead
    if (state.monsterHp <= 0) {
      state.monsterHp = 0; // Lock at 0 so it renders empty
      grantKillRewards(state, content, target, random);
      
      const enemytype = target.type.toLowerCase();
      if (enemytype === "boss" || enemytype === "miniboss" || enemytype === "phantom") {
        // Halt game advance for all special enemy Types
        state.awaitingMonsterSelection = true;
        state.pendingTargetMonsterId = null;
        state.prepareViewed = false;
        state.attackRemainder = 0;

        // Real bosses also open the shop
        if (enemytype === "boss") {
          state.shopUnlocked = true;
          state.shopVisited = false;
          state.bossShopHintDismissed = false;
        }
      }
      // For regular monsters, if you want it to reset after an item kill, 
      // you can let the next tick handle it or handle the pending switch:
      else if (state.pendingTargetMonsterId) {
        const nextTarget = content.monsters.find((monster) => monster.id === state.pendingTargetMonsterId);
        state.targetMonsterId = nextTarget.id;
        state.pendingTargetMonsterId = null;
        state.monsterHp = getMonsterHealth(nextTarget, state.ngPlus);
      } else {
        state.monsterHp = getMonsterHealth(target, state.ngPlus);
      }
    }
  }
  else if (skill.effect === "defense_flat")
  {
    if (item.effectIsPercentage) {
      state.nextHitDefensePercent = Math.min(100, (state.nextHitDefensePercent ?? 0) + item.effectValue);
    } else {
      state.nextHitDefense += item.effectValue;
    }
  }
  else
  {
    throw new Error(`The "${skill.name}" skill cannot be used from an item.`);
  }

  consumeLoot(state, item.id);
  return true;
}

export function canUseLoot(state, content, lootId) {
  const item = content.loot.find((loot) => loot.id === lootId);
  if (!item || item.slot !== "" || (state.lootInventory[item.id] ?? 0) < 1) {
    return false;
  }

  const skill = content.skills.find((candidate) => candidate.name === item.skill);
  if (!skill) {
    return item.skill.toLowerCase() === "revive" && state.gameOver && state.hp === 0;
  }
  if (skill.effect === "revive") {
    return state.gameOver && state.hp === 0;
  }
  if (skill.effect === "flee") {
    return Boolean(state.targetMonsterId) && !state.awaitingMonsterSelection && !state.gameOver;
  }
  if (skill.effect === "heal") {
    return !state.gameOver && state.hp < getPlayerMaxHp(state.level, state, content);
  }
  if (skill.effect === "stamina") {
    const maxStamina = state.maxStamina ?? getPlayerMaxStamina(state.level, state, content);
    return (state.stamina ?? maxStamina) < maxStamina;
  }
  if (skill.effect === "damage_flat") {
    const isMonsterActive = Boolean(state.targetMonsterId) && !state.awaitingMonsterSelection && !state.gameOver;
    if (isMonsterActive)
    {
      const target = content.monsters.find((monster) => monster.id === state.targetMonsterId);
      return Boolean(target);
    }
  }
  
  return skill.effect === "defense_flat";
}

function consumeLoot(state, lootId) {
  state.lootInventory[lootId] -= 1;
  if (state.lootInventory[lootId] === 0) {
    delete state.lootInventory[lootId];
  }
}

export function processAutoHeal(state, content) {
  if (!state.autoHealEnabled || state.gameOver || state.hp > state.autoHealThreshold) {
    return false;
  }

  const healItems = content.loot.filter((item) => {
    if (item.slot !== "" || (state.lootInventory[item.id] ?? 0) < 1) return false;
    const skill = content.skills.find((s) => s.name === item.skill);
    return skill && skill.effect === "heal";
  });

  if (healItems.length === 0) {
    return false;
  }

  healItems.sort((a, b) => b.effectValue - a.effectValue);
  const bestHealItem = healItems[0];

  return useLoot(state, content, bestHealItem.id);
}

export function revivePlayer(state, content, lootId) {
  if (!state.gameOver || state.hp !== 0) {
    return false;
  }
  const item = content.loot.find((loot) => (!lootId || loot.id === lootId)
    && isReviveLoot(loot, content)
    && (state.lootInventory[loot.id] ?? 0) > 0);
  if (!item) {
    return false;
  }
  consumeLoot(state, item.id);
  state.hp = getPlayerMaxHp(state.level, state, content) / 2; // half
  state.gameOver = false;

  // Reset selected monster so the player must choose a new target
  state.targetMonsterId = null;
  state.pendingTargetMonsterId = null;
  state.monsterHp = 0;
  state.awaitingMonsterSelection = true;
  state.activeTab = "fight";

  return true;
}

function isReviveLoot(item, content) {
  const skill = findReviveSkill(item, content);
  return skill ? skill.effect === "revive" : item.skill.toLowerCase() === "revive";
}

function findReviveSkill(item, content) {
  return content.skills.find((skill) => skill.name === item.skill);
}

export function selectMonster(state, content, monsterId) {
  const monster = content.monsters.find((candidate) => candidate.id === monsterId);

  // Handle some edge cases
  if (!monster) {
    throw new Error("That monster is not unlocked.");
  }
  if (monster.type.toLowerCase() === "boss" && (state.kills[monster.id] ?? 0) > 0) {
    throw new Error("That Boss has already been defeated.");
  }
  if (state.awaitingMonsterSelection && state.targetMonsterId && monster.id === state.targetMonsterId) {
    throw new Error("Choose a different monster after defeating a Boss.");
  }

  // Check requirements
  if (monster.requirements) {
    const requiredMaterial = content.materials.find(
      (m) => m.name.toLowerCase() === monster.requirements.toLowerCase()
    );
    if (requiredMaterial && (state.currencyInventory[requiredMaterial.id] ?? 0) < 1) {
      throw new Error(`Requires ${monster.requirements} in your bag to select.`);
    }
  }

  if (state.awaitingMonsterSelection) {
    state.targetMonsterId = monster.id;
    state.monsterHp = getMonsterHealth(monster, state.ngPlus);
    state.awaitingMonsterSelection = false;
    state.pendingTargetMonsterId = null;
    state.activeTab = "fight";
    state.attackRemainder = 0;

    // Lock the shop again when leaving the victory/awaiting selection screen
    state.shopUnlocked = false;
    state.shopVisited = false;
  
    return;
  }
  if (monster.id === state.targetMonsterId) {
    state.pendingTargetMonsterId = null;
    return;
  }
  state.pendingTargetMonsterId = monster.id;
}

function grantExperience(state, content, amount) {
  state.xp += amount;
  while (state.xp >= experienceForNextLevel(state.level)) {
    state.xp -= experienceForNextLevel(state.level);
    state.level += 1;

    state.maxStamina = getPlayerMaxStamina(state.level, state, content);
    state.stamina = state.maxStamina; // Refill stamina on level up (optional, or let it scale)
  }
}

function grantKillRewards(state, content, monster, random = Math.random) {
  const stats = getPlayerStats(state, content);
  state.kills[monster.id] = (state.kills[monster.id] ?? 0) + 1;
  grantExperience(state, content, Math.max(1, Math.floor(monster.xp * stats.xpMultiplier)));

  // Fully regenerate stamina upon defeating a monster or boss
  const maxStamina = state.maxStamina ?? getPlayerMaxStamina(state.level, state, content);
  state.stamina = maxStamina;

  // Grant souls from the monster's Souls column with multiplier
  // Souls multiplier scales with NG+ level (NG+0 = 1x, NG+4 = 4x, etc.)
  const soulMultiplier = Math.max(1, 1 + (state.ngPlus ?? 0));
  const baseSoulAmount = Number(monster.souls) || 0;
  if (baseSoulAmount > 0) {
    state.currencyBalance = (state.currencyBalance ?? 0) + (baseSoulAmount * soulMultiplier);
  }
  
  const lootChance = monster.lootChance ?? 100;
  
  const rawLootNames = monster.lootNames ?? monster.lootName ?? [];
  const lootNames = typeof rawLootNames === "string"
    ? rawLootNames.replace(/^["']|["']$/g, "").split(/,\s*/).map((name) => name.trim()).filter(Boolean)
    : Array.isArray(rawLootNames)
      ? rawLootNames
      : [rawLootNames].filter(Boolean);

  const droppedLootNames = [];
  let lastRoll = null;
  if (lootNames.length > 0) {
    const rawLootChances = monster.lootChances ?? monster.lootChance ?? 100;
    const lootChances = typeof rawLootChances === "string"
      ? rawLootChances.split(/,\s*/).map((val) => Number(val.trim()))
      : Array.isArray(rawLootChances)
        ? rawLootChances
        : [rawLootChances];

    const enemyType = (monster.type ?? "").toLowerCase();
    const isBossOrMutuallyExclusive = enemyType === "boss" || enemyType === "miniboss" || enemyType === "phantom";

    const isAlreadyOwned = (itemId) => {
      const inBag = (state.lootInventory[itemId] ?? 0) > 0;
      const equipped = Object.values(state.gear ?? {}).includes(itemId);
      return inBag || equipped;
    };

    if (isBossOrMutuallyExclusive) {
      // Separate items into Guaranteed (>= 100) and Mutually Exclusive (< 100)
      const guaranteedIndices = [];
      const exclusiveIndices = [];

      for (let i = 0; i < lootNames.length; i++) {
        const chance = lootChances[i] ?? lootChances[0] ?? 100;
        if (chance >= 100) {
          guaranteedIndices.push(i);
        } else {
          exclusiveIndices.push(i);
        }
      }

      // 1. Process Guaranteed Drops (Chance >= 100) independently
      for (const idx of guaranteedIndices) {
        const name = lootNames[idx];
        const item = content.loot.find((loot) => loot.name.toLowerCase() === name.toLowerCase());
        if (item) {
          const isUnique = (item.notes ?? "").toLowerCase().includes("unique") || isBossItem(item);
          if (isUnique && isAlreadyOwned(item.id)) {
            continue;
          }

          const maxCount = getMaxItemCount(state, item);
          if (getTotalItemCount(state, item.id) < maxCount) {
            state.lootInventory[item.id] = (state.lootInventory[item.id] ?? 0) + 1;
            markLootNew(state, item.id);
            droppedLootNames.push(item.name);
          }
        }
      }

      // 2. Process Mutually Exclusive Drops (Chance < 100)
      if (exclusiveIndices.length > 0) {
        let validIndices = [];
        let validChances = [];

        for (const idx of exclusiveIndices) {
          const name = lootNames[idx];
          const item = content.loot.find((loot) => loot.name.toLowerCase() === name.toLowerCase());
          if (item) {
            const isUnique = (item.notes ?? "").toLowerCase().includes("unique") || isBossItem(item);
            if (isUnique && isAlreadyOwned(item.id)) {
              continue;
            }
          }
          validIndices.push(idx);
          validChances.push(Math.max(0, lootChances[idx] ?? 100));
        }

        // Fallback: If player owns all exclusive items, allow duplicates from them
        if (validIndices.length === 0 && exclusiveIndices.length > 0) {
          for (const idx of exclusiveIndices) {
            validIndices.push(idx);
            validChances.push(Math.max(0, lootChances[idx] ?? 100));
          }
        }

        if (validIndices.length > 0) {
          const totalWeight = validChances.reduce((sum, chance) => sum + chance, 0);
          let roll = Math.floor(Math.random() * (totalWeight > 0 ? totalWeight : 100));
          lastRoll = roll;

          let cumulative = 0;
          let selectedValidIndex = -1;
          for (let i = 0; i < validChances.length; i++) {
            cumulative += validChances[i];
            if (roll < cumulative) {
              selectedValidIndex = i;
              break;
            }
          }

          if (selectedValidIndex !== -1) {
            const originalIndex = validIndices[selectedValidIndex];
            const name = lootNames[originalIndex];
            const item = content.loot.find((loot) => loot.name.toLowerCase() === name.toLowerCase());
            if (item) {
              const maxCount = getMaxItemCount(state, item);
              if (getTotalItemCount(state, item.id) < maxCount) {
                state.lootInventory[item.id] = (state.lootInventory[item.id] ?? 0) + 1;
                markLootNew(state, item.id);
                droppedLootNames.push(item.name);
              }
            }
          }
        }
      }
    } else {
      // Standard independent drop roll for normal monsters
      for (let i = 0; i < lootNames.length; i++) {
        const name = lootNames[i];
        const chance = Number.isFinite(lootChances[i]) ? lootChances[i] : (lootChances[0] ?? 100);
        const roll = Math.floor(Math.random() * 100);
        const dropped = chance >= 100 || roll < chance;
        lastRoll = roll;

        if (dropped) {
          const item = content.loot.find((loot) => loot.name.toLowerCase() === name.toLowerCase());
          if (item) {
            const isUnique = (item.notes ?? "").toLowerCase().includes("unique");
            if (isUnique && isAlreadyOwned(item.id)) {
              continue;
            }

            const maxCount = getMaxItemCount(state, item);
            if (getTotalItemCount(state, item.id) < maxCount) {
              state.lootInventory[item.id] = (state.lootInventory[item.id] ?? 0) + 1;
              markLootNew(state, item.id);
              droppedLootNames.push(item.name);
            }
          }
        }
      }
    }

    state.lastLootCheck = {
      monsterName: monster.name,
      roll: lastRoll,
      chance: lootChance,
      dropped: droppedLootNames.length > 0,
    };
  }
  state.lastDroppedLootNames = droppedLootNames;

  const materialCount = monster.materialCount ?? 1;
  const materialChance = monster.materialChance ?? 100;
  
  // Support multiple material/currency names safely
  const materialNames = monster.materialNames 
    ?? monster.currencyNames 
    ?? (monster.materialName ? [monster.materialName] : []);

  const hasMaterialDrop = materialChance >= 100
    || (materialCount > 0 && materialNames.length > 0 && Math.floor(Math.random() * 100) < materialChance);
  
  if (materialCount > 0 && hasMaterialDrop) {
    const bossMaterials = [];

    for (const name of materialNames) {
      const item = content.materials.find((material) => material.name === name);
      if (!item) continue;

      const notes = (item.notes ?? item.Notes ?? "").trim().toLowerCase();
      const isBoss = notes === "boss";
      const isUnique = notes.includes("unique");
      const isUpgrade = notes.includes("upgrade");

      if (isBoss) {
        bossMaterials.push(item);
      } else {
      const currentCount = state.currencyInventory[item.id] ?? 0;
        if (currentCount < MAX_MATERIALS) {
          // If it's an upgrade item, limit the drop amount to 1 max per drop event
          const effectiveCount = isUpgrade ? 1 : materialCount;
          const countToAdd = isUnique ? Math.min(1, Math.max(0, 1 - currentCount)) : effectiveCount;
          
          if (countToAdd > 0) {
            state.currencyInventory[item.id] = currentCount + countToAdd;
          }
        }
      }
    }

    // If there are boss materials, randomly select exactly one to drop
    if (bossMaterials.length > 0) {
      const selectedBossItem = bossMaterials[Math.floor(Math.random() * bossMaterials.length)];
      state.currencyInventory[selectedBossItem.id] = (state.currencyInventory[selectedBossItem.id] ?? 0) + 1;
      
      // Save the specific chosen item name for UI display
      state.lastBossDrop = selectedBossItem.name;
    } else {
      state.lastBossDrop = null;
    }
  }
}

export function advanceGame(state, content, elapsedSeconds, random = Math.random) {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new Error("Elapsed game time must be a non-negative number.");
  }
  if (state.gameOver)
  {
    return state;
  }

  const stats = getPlayerStats(state, content);

  // Apply passive healing from equipped gear (but not weapons)
  if (stats.gearHealing > 0 && state.hp > 0 && !state.gameOver) {
    const maxHp = getPlayerMaxHp(state.level, state, content);
    state.hp = Math.min(maxHp, state.hp + stats.gearHealing);
  }

  // Check if we aren't actively fighting and return early
  if (state.awaitingMonsterSelection) {
    return state;
  }

  const elapsed = Math.min(elapsedSeconds, MAX_OFFLINE_SECONDS);
  const attacks = Math.floor(state.attackRemainder + elapsed + Number.EPSILON);
  state.attackRemainder = state.attackRemainder + elapsed - attacks;
  if (state.attackRemainder < 0) {
    state.attackRemainder = 0;
  }

  let target = content.monsters.find((monster) => monster.id === state.targetMonsterId);
  if (!target) {
    throw new Error("The selected monster is unavailable in the current sheet.");
  }

  for (let index = 0; index < attacks; index += 1)
  {
    // Stamina Regen on tick between attack sequences
    if (state.monsterHp !== -1) {
      const maxStamina = stats.maxStamina ?? getPlayerMaxStamina(state.level, state, content);
      const regenAmount = state.doubleStaminaNextTick ? PLAYER_STAMINA_REGEN_RATE * 2 : PLAYER_STAMINA_REGEN_RATE;
      state.doubleStaminaNextTick = false;

      state.stamina = Math.min(maxStamina, (state.stamina ?? 0) + regenAmount);

      // If regen brings stamina back above or equal to 0, vulnerability is cleared
      if (state.stamina >= 0) {
        state.isVulnerable = false;
      }
    }

    // Reload the monster and skip attacking on this tick so it starts at full health
    if (state.monsterHp === -1) {
      state.monsterHp = getMonsterHealth(target, state.ngPlus);

      // Fully replenish stamina right when the new monster spawns fresh
      state.stamina = state.maxStamina ?? PLAYER_STARTING_MAX_STAMINA;
      
      continue; 
    }

    // Wait a tick (monster stays at 0 HP for this entire tick)
    if (state.monsterHp === 0) {
      if (state.awaitingMonsterSelection) {
        break;
      }
      if (state.pendingTargetMonsterId) {
        target = content.monsters.find((monster) => monster.id === state.pendingTargetMonsterId);
        state.targetMonsterId = target.id;
        state.pendingTargetMonsterId = null;
        
      }
      state.monsterHp = -1; // Move to reload state for the following tick
      break; // Pause combat for this tick while showing 0 HP
    }

    // Apply healing from equipped weapons
    if (stats.weaponHealing > 0 && state.hp > 0 && !state.gameOver) {
      const maxHp = getPlayerMaxHp(state.level, state, content);
      state.hp = Math.min(maxHp, state.hp + stats.weaponHealing);
    }
    
    // Damage enemy
    //state.monsterHp -= stats.damage;
    // Damage enemy with type breakdown & resistance check
    let physDmg = stats.physicalDamage;
    let magicDmg = stats.magicDamage;
    let fireDmg = stats.fireDamage;
    let lightningDmg = stats.lightningDamage;
    let poisonDmg = stats.poisonDamage;

    const monsterNotes = (target.notes ?? target.Notes ?? "").toLowerCase();
    if (monsterNotes.includes("magic resist")) {
      magicDmg = 0;
    }
    if (monsterNotes.includes("fire resist")) {
      fireDmg = 0;
    }
    if (monsterNotes.includes("lightning resist")) {
      lightningDmg = 0;
    }
    if (monsterNotes.includes("poison resist")) {
      poisonDmg = 0;
    }

    const netDamage = physDmg + magicDmg + fireDmg + lightningDmg + poisonDmg;
    state.monsterHp -= netDamage;

    // Damage self (negatively)
    if (stats.selfDamage > 0 && !state.godMode) {
      state.hp = Math.max(0, state.hp + stats.selfDamage);
      if (state.hp === 0) {
        state.gameOver = true;
        state.attackRemainder = 0;
        state.soulsLost = state.currencyBalance ?? 0;
        state.currencyBalance = 0;
        break;
      }
    }

    // Consume player stamina every hit
    const maxStamina = state.maxStamina ?? PLAYER_STARTING_MAX_STAMINA;
    // Check if both R-Hand and L-Hand are equipped with items (dual wielding / sword + shield)
    const hasRHand = Boolean(state.gear?.["R-Hand"]);
    const hasLHand = Boolean(state.gear?.["L-Hand"]);
    const isDualWielding = hasRHand && hasLHand && !isTwoHandEquipped(state, content);

    // Two-hand costs STAMINA_2H, dual-wielding (R-Hand + L-Hand) costs double STAMINA_1H, otherwise single 1H
    const staminaCost = isTwoHandEquipped(state, content) 
      ? STAMINA_2H 
      : (isDualWielding ? STAMINA_1H * 2 : STAMINA_1H);

    state.stamina = (state.stamina ?? maxStamina) - staminaCost;

    // If stamina drops below 0 from attack, enter negative stamina state
    if (state.stamina < 0) {
      state.isVulnerable = true;
    }

    // Fatal hit
    if (state.monsterHp <= 0) {
      state.monsterHp = 0; // Lock health at 0 so it renders empty for the death tick
      grantKillRewards(state, content, target, random);
      
      const enemytype = target.type.toLowerCase();
      if (enemytype === "boss" || enemytype === "miniboss" || enemytype === "phantom") {
        // Halt game advance for all special enemy Types
        state.awaitingMonsterSelection = true;
        state.pendingTargetMonsterId = null;
        state.prepareViewed = false;
        state.attackRemainder = 0;

        // Real bosses also open the shop
        if (enemytype === "boss") {
          state.shopUnlocked = true;
          state.shopVisited = false;
          state.bossShopHintDismissed = false;
        }
      }
      
      break; // Stop further attacks so the 0 HP state is displayed
    }

    let incomingDamage = 0;
    if (!state.godMode) {
      const rawMonsterDmg = getMonsterDamage(target, state.ngPlus);
      
      // If stamina remained < 0 after regen, take unmitigated health damage (ignore %, keep flat armor defense)
      if (state.isVulnerable && state.stamina < 0) {
        incomingDamage = Math.max(0, rawMonsterDmg - stats.defense);
        state.doubleStaminaNextTick = true; // Guarantee double regen on the next tick
        state.isVulnerable = false;
      } else {
        const mitigatedByFlat = Math.max(0, rawMonsterDmg - stats.defense - state.nextHitDefense);
        const defensePercent = Math.min(100, stats.defensePercent + (state.nextHitDefensePercent ?? 0));
        incomingDamage = Math.max(0, mitigatedByFlat * (1 - defensePercent / 100));
      }
    }
    
    const defensePercent = Math.min(100, stats.defensePercent + (state.nextHitDefensePercent ?? 0));
    const reducedDamage = Math.max(0, incomingDamage * (1 - defensePercent / 100));
    state.nextHitDefense = 0;
    state.nextHitDefensePercent = 0;
    state.hp = Math.max(0, state.hp - reducedDamage);

    if (state.hp === 0) {
      state.gameOver = true;
      state.attackRemainder = 0;
      state.soulsLost = state.currencyBalance ?? 0;
      state.currencyBalance = 0;
      break;
    }

    // Trigger auto-heal check immediately after taking damage (if not dead)
    processAutoHeal(state, content);
  }

  return state;
}
