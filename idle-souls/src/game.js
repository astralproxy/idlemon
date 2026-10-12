export const MAX_OFFLINE_SECONDS = 10; // don't let player log off instantly to avoid death
export const SAVE_KEY = "idlemon-save-v1";
export const SAVE_VERSION = 12;
export const PLAYER_STARTING_MAX_HP = 400;
export const PLAYER_MAX_HP_PER_LEVEL = 15;
export const PLAYER_MAX_HP_CAP = 1900;
export const SHOP_REFRESH_COST = 5;

export function getPlayerMaxHp(level) {
  return Math.min(
    PLAYER_MAX_HP_CAP,
    PLAYER_STARTING_MAX_HP + Math.max(0, level - 1) * PLAYER_MAX_HP_PER_LEVEL,
  );
}

export function resetSavedGame(storage = globalThis.localStorage) {
  storage.removeItem(SAVE_KEY);
}

export function createRestoreKey(state, now = Date.now()) {
  const snapshot = { ...state, updatedAt: now };
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
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
    const state = parseSavedState(serialized, content);
    state.updatedAt = now;
    return state;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The local save")) {
      throw new Error(`Restore key contains invalid progress: ${error.message}`);
    }
    throw new Error("The restore key is malformed or contains invalid progress.");
  }
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
  return content.loot.filter((item) => item.slot === "");
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

  if (getTotalItemCount(state, item.id) >= 9) {
    throw new Error("You already hold the maximum of 9 of this item.");
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

export function addLootToBag(state, content, lootId) {
  const item = content.loot.find((loot) => loot.id === lootId);
  if (!item) {
    throw new Error("That loot item is not available.");
  }
  if (getTotalItemCount(state, item.id) >= 9) {
    throw new Error("You already hold the maximum of 9 of this item.");
  }
  state.lootInventory[item.id] = (state.lootInventory[item.id] ?? 0) + 1;
  markLootNew(state, item.id);
}

function getTotalItemCount(state, lootId) {
  const bagCount = state.lootInventory[lootId] ?? 0;
  const equippedCount = Object.values(state.gear ?? {}).filter((id) => id === lootId).length;
  return bagCount + equippedCount;
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
  return content.monsters.filter((monster) => monster.unlock_level <= state.level);
}

export function createInitialState(content, now = Date.now()) {
  const firstMonster = unlockedMonsters({ level: 1 }, content)[0];
  if (!firstMonster) {
    throw new Error("No monster is available at level 1.");
  }
  return {
    version: SAVE_VERSION,
    level: 1,
    xp: 0,
    hp: getPlayerMaxHp(1),
    gameOver: false,
    targetMonsterId: firstMonster.id,
    pendingTargetMonsterId: null,
    monsterHp: firstMonster.health,
    attackRemainder: 0,
    nextHitDefense: 0,
    nextHitDefensePercent: 0,
    activeTab: "fight",
    awaitingMonsterSelection: false,
    shopUnlocked: false,
    shopVisited: false,
    bossShopHintDismissed: false,
    prepareViewed: false,
    lastLootCheck: null,
    shopOffers: createShopOffers(content),
    newLootIds: [],
    lootInventory: {},
    gear: {},
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

  if (!state || typeof state !== "object" || Array.isArray(state) || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, SAVE_VERSION].includes(state.version)) {
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
  if (targetMonsterId !== null && (!target || state.level < target.unlock_level)) {
    target = unlockedMonsters(state, content)[0];
    if (!target) {
      throw new Error("No monster is available for the saved player level.");
    }
    targetMonsterId = target.id;
    monsterHp = target.health;
    awaitingMonsterSelection = false;
  }
  let pendingTargetMonsterId = state.pendingTargetMonsterId ?? null;
  const pendingTarget = pendingTargetMonsterId === null
    ? null
    : content.monsters.find((monster) => monster.id === pendingTargetMonsterId);
  if (pendingTargetMonsterId !== null
      && (!pendingTarget || pendingTarget.id === target?.id || pendingTarget.unlock_level > state.level)) {
    pendingTargetMonsterId = null;
  }
  if (!isNonNegativeNumber(state.xp)) {
    throw new Error("The saved experience value is invalid.");
  }
  const maxHp = getPlayerMaxHp(state.level);
  const hp = state.hp ?? maxHp;
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
  if (!target) {
    if (monsterHp !== 0 || !awaitingMonsterSelection || pendingTargetMonsterId !== null) {
      recoveryWarnings.push("Repaired saved monster selection.");
    }
    monsterHp = 0;
    awaitingMonsterSelection = true;
    pendingTargetMonsterId = null;
  } else if (target.type.toLowerCase() === "boss" && shopUnlocked && monsterHp === 0) {
    if (!awaitingMonsterSelection || pendingTargetMonsterId !== null) {
      recoveryWarnings.push("Repaired saved Boss defeat state.");
    }
    awaitingMonsterSelection = true;
    pendingTargetMonsterId = null;
  } else if (awaitingMonsterSelection && target.type.toLowerCase() === "boss" && shopUnlocked) {
    if (monsterHp !== 0 || pendingTargetMonsterId !== null) {
      recoveryWarnings.push("Repaired saved Boss defeat state.");
    }
    monsterHp = 0;
    pendingTargetMonsterId = null;
  } else if (awaitingMonsterSelection) {
    recoveryWarnings.push("Repaired saved monster selection.");
    awaitingMonsterSelection = false;
    monsterHp = target.health;
    pendingTargetMonsterId = null;
  } else if (!isNonNegativeNumber(monsterHp) || monsterHp === 0) {
    recoveryWarnings.push("Repaired saved monster health.");
    monsterHp = target.health;
  } else if (monsterHp > target.health) {
    recoveryWarnings.push("Adjusted saved monster health to match the current sheet.");
    monsterHp = target.health;
  }
  if (!isNonNegativeNumber(monsterHp)
      || (noSelectedMonster
        ? monsterHp !== 0 || !awaitingMonsterSelection || pendingTargetMonsterId !== null
          : monsterHp > target.health
          || (monsterHp === 0) !== awaitingMonsterSelection
          || (awaitingMonsterSelection && target.type.toLowerCase() !== "boss")
          || (awaitingMonsterSelection && (!shopUnlocked || pendingTargetMonsterId !== null)))) {
    throw new Error("The saved monster health does not match the current sheet.");
  }
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
    const slot = savedSlot === "Two-Hand" ? "Hand" : savedSlot;
    const itemGearSlot = item.slot === "Two-Hand" ? "Hand" : item.slot;
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
  const handItem = content.loot.find((loot) => loot.id === gear.Hand);
  if (handItem?.slot === "Two-Hand" && gear.Offhand) {
    lootInventory[gear.Offhand] = (lootInventory[gear.Offhand] ?? 0) + 1;
    delete gear.Offhand;
    recoveryWarnings.push("Returned saved Offhand equipment to the Bag because a Two-Hand item occupies the Hand slot.");
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

  return {
    version: SAVE_VERSION,
    level: state.level,
    xp: state.xp,
    hp,
    gameOver,
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
    currencyInventory,
    currencyBalance,
    kills,
    updatedAt: state.updatedAt,
  };
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

export function getPlayerStats(state, content) {
  let gearDamage = 0;
  const bonuses = {
    xp_multiplier: 0,
    defense_flat: 0,
    defense_percent: 0,
  };

  for (const lootId of Object.values(state.gear ?? {})) {
    const item = content.loot.find((loot) => loot.id === lootId);
    const skill = item && content.skills.find((candidate) => candidate.name === item.skill);
    if (item && ["damage_flat"].includes(skill?.effect)) {
      gearDamage += item.effectValue;
    }
    if (skill?.effect === "defense_flat") {
      if (item.effectIsPercentage) {
        bonuses.defense_percent += item.effectValue;
      } else {
        bonuses.defense_flat += item.effectValue;
      }
    }
  }

  return {
    damage: 1 + gearDamage,
    defense: state.godMode ? 999 : bonuses.defense_flat,
    defensePercent: Math.min(100, bonuses.defense_percent),
    xpMultiplier: Math.max(0, 1 + bonuses.xp_multiplier),
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
  const handItem = content.loot.find((loot) => loot.id === state.gear?.Hand);
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
  if (item.slot === "Offhand" && isTwoHandEquipped(state, content)) {
    throw new Error("Offhand equipment cannot be used while a Two-Hand item is equipped.");
  }

  const slot = item.slot === "Two-Hand" ? "Hand" : item.slot;
  const previousId = state.gear[slot];
  if (previousId === item.id) {
    return false;
  }
  if (previousId) {
    state.lootInventory[previousId] = (state.lootInventory[previousId] ?? 0) + 1;
  }
  if (item.slot === "Two-Hand" && state.gear.Offhand) {
    const offhandId = state.gear.Offhand;
    state.lootInventory[offhandId] = (state.lootInventory[offhandId] ?? 0) + 1;
    delete state.gear.Offhand;
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
    && (item.slot === "Two-Hand" ? "Hand" : item.slot) === slot
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
    const maxHp = getPlayerMaxHp(state.level);
    if (state.gameOver || state.hp >= maxHp) {
      return false;
    }
    const healing = item.effectIsPercentage
      ? maxHp * item.effectValue / 100
      : item.effectValue;
    state.hp = Math.min(maxHp, state.hp + healing);
  }
  else if (skill.effect === "damage_flat")
  {
    // OLD WAY DIDN'T CHECK BOSSES
    // const target = content.monsters.find((monster) => monster.id === state.targetMonsterId);
    // if (!target || target.unlock_level > state.level) {
    //   throw new Error("The selected monster is unavailable.");
    // }
    // state.monsterHp -= item.effectValue;
    // if (state.monsterHp <= 0) {
    //   grantKillRewards(state, content, target, random);
    //   state.monsterHp = target.health;
    // }

    const target = content.monsters.find((monster) => monster.id === state.targetMonsterId);
    if (!target || target.unlock_level > state.level) {
      throw new Error("The selected monster is unavailable.");
    }
    state.monsterHp -= item.effectValue;
    if (state.monsterHp <= 0) {
      state.monsterHp = 0; // Lock at 0 so it renders empty
      grantKillRewards(state, content, target, random);
      
      if (target.type.toLowerCase() === "boss") {
        state.shopUnlocked = true;
        state.shopVisited = false;
        state.bossShopHintDismissed = false;
        state.awaitingMonsterSelection = true;
        state.pendingTargetMonsterId = null;
        state.prepareViewed = false;
        state.attackRemainder = 0;
      }
      // For regular monsters, if you want it to reset after an item kill, 
      // you can let the next tick handle it or handle the pending switch:
      else if (state.pendingTargetMonsterId) {
        const nextTarget = content.monsters.find((monster) => monster.id === state.pendingTargetMonsterId);
        state.targetMonsterId = nextTarget.id;
        state.pendingTargetMonsterId = null;
        state.monsterHp = nextTarget.health;
      } else {
        state.monsterHp = target.health;
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
    return !state.gameOver && state.hp < getPlayerMaxHp(state.level);
  }
  if (skill.effect === "damage_flat") {
    const target = content.monsters.find((monster) => monster.id === state.targetMonsterId);
    return Boolean(target && target.unlock_level <= state.level);
  }
  return skill.effect === "defense_flat";
}

function consumeLoot(state, lootId) {
  state.lootInventory[lootId] -= 1;
  if (state.lootInventory[lootId] === 0) {
    delete state.lootInventory[lootId];
  }
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
  state.hp = getPlayerMaxHp(state.level) / 2; // half
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
  if (!monster || monster.unlock_level > state.level) {
    throw new Error("That monster is not unlocked.");
  }
  if (monster.type.toLowerCase() === "boss" && (state.kills[monster.id] ?? 0) > 0) {
    throw new Error("That Boss has already been defeated.");
  }
  if (state.awaitingMonsterSelection && state.targetMonsterId && monster.id === state.targetMonsterId) {
    throw new Error("Choose a different monster after defeating a Boss.");
  }
  if (state.awaitingMonsterSelection) {
    state.targetMonsterId = monster.id;
    state.monsterHp = monster.health;
    state.awaitingMonsterSelection = false;
    state.pendingTargetMonsterId = null;
    state.activeTab = "fight";
    state.attackRemainder = 0;
    return;
  }
  if (monster.id === state.targetMonsterId) {
    state.pendingTargetMonsterId = null;
    return;
  }
  state.pendingTargetMonsterId = monster.id;
}

function grantExperience(state, amount) {
  state.xp += amount;
  while (state.xp >= experienceForNextLevel(state.level)) {
    state.xp -= experienceForNextLevel(state.level);
    state.level += 1;
  }
}

function grantKillRewards(state, content, monster, random = Math.random) {
  const stats = getPlayerStats(state, content);
  state.kills[monster.id] = (state.kills[monster.id] ?? 0) + 1;
  grantExperience(state, Math.max(1, Math.floor(monster.xp * stats.xpMultiplier)));

  const lootChance = monster.lootChance ?? 100;
  if (monster.lootNames.length > 0) {
    const roll = Math.floor(random() * 101);
    const dropped = lootChance >= 100 || roll < lootChance;
    state.lastLootCheck = {
      monsterName: monster.name,
      roll,
      chance: lootChance,
      dropped,
    };
    if (dropped) {
      for (const name of monster.lootNames) {
        const item = content.loot.find((loot) => loot.name === name);
        if (item && getTotalItemCount(state, item.id) < 9) {
          state.lootInventory[item.id] = (state.lootInventory[item.id] ?? 0) + 1;
          markLootNew(state, item.id);
        }
      }
    }
  } else {
    state.lastLootCheck = {
      monsterName: monster.name,
      roll: null,
      chance: lootChance,
      dropped: false,
    };
  }
  const materialCount = monster.materialCount ?? 1;
  const materialChance = monster.materialChance ?? 100;
  const materialNames = monster.materialNames ?? monster.currencyNames ?? [];
  const hasMaterialDrop = materialChance >= 100
    || (materialCount > 0 && materialNames.length > 0 && Math.floor(random() * 101) < materialChance);
  if (materialCount > 0 && hasMaterialDrop) {
    for (const name of materialNames) {
      const item = content.materials.find((material) => material.name === name);
      state.currencyInventory[item.id] = (state.currencyInventory[item.id] ?? 0) + materialCount;
    }
  }
}

export function advanceGame(state, content, elapsedSeconds, random = Math.random) {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new Error("Elapsed game time must be a non-negative number.");
  }
  if (state.gameOver || state.awaitingMonsterSelection) {
    return state;
  }
  const elapsed = Math.min(elapsedSeconds, MAX_OFFLINE_SECONDS);
  const attacks = Math.floor(state.attackRemainder + elapsed + Number.EPSILON);
  state.attackRemainder = state.attackRemainder + elapsed - attacks;
  if (state.attackRemainder < 0) {
    state.attackRemainder = 0;
  }

  let target = content.monsters.find((monster) => monster.id === state.targetMonsterId);
  if (!target || target.unlock_level > state.level) {
    throw new Error("The selected monster is unavailable in the current sheet.");
  }

  for (let index = 0; index < attacks; index += 1)
  {
    // Reload the monster and skip attacking on this tick so it starts at full health
    if (state.monsterHp === -1) {
      state.monsterHp = target.health;
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
    
    const stats = getPlayerStats(state, content);
    state.monsterHp -= stats.damage;

    // Fatal hit
    if (state.monsterHp <= 0) {
      state.monsterHp = 0; // Lock health at 0 so it renders empty for the death tick
      grantKillRewards(state, content, target, random);
      
      if (target.type.toLowerCase() === "boss") {
        state.shopUnlocked = true;
        state.shopVisited = false;
        state.bossShopHintDismissed = false;
        state.awaitingMonsterSelection = true;
        state.pendingTargetMonsterId = null;
        state.prepareViewed = false;
        state.attackRemainder = 0;
      }
      
      break; // Stop further attacks so the 0 HP state is displayed
    }
/*    state.monsterHp -= stats.damage;
    if (state.monsterHp <= 0) {
      state.monsterHp = 0; // explicitly set to 0 to avoid over-kill

      grantKillRewards(state, content, target, random);
      
      if (target.type.toLowerCase() === "boss") {
        state.shopUnlocked = true;
        state.shopVisited = false;
        state.bossShopHintDismissed = false;
        state.awaitingMonsterSelection = true;
        state.pendingTargetMonsterId = null;
        state.prepareViewed = false;
        state.attackRemainder = 0;
        break;
      }
      else if (state.pendingTargetMonsterId) {
        target = content.monsters.find((monster) => monster.id === state.pendingTargetMonsterId);
        state.targetMonsterId = target.id;
        state.pendingTargetMonsterId = null;
        //state.monsterHp = target.health; // or keep at 0 to tick before spawning next monster
      }
      else {
        state.monsterHp = target.health;
      }

      break;
      //continue;
    }*/

    const incomingDamage = state.godMode
      ? 0
      : Math.max(0, target.damage - stats.defense - state.nextHitDefense);
    
    const defensePercent = Math.min(100, stats.defensePercent + (state.nextHitDefensePercent ?? 0));
    const reducedDamage = Math.max(0, incomingDamage * (1 - defensePercent / 100));
    state.nextHitDefense = 0;
    state.nextHitDefensePercent = 0;
    state.hp = Math.max(0, state.hp - reducedDamage);
    if (state.hp === 0) {
      state.gameOver = true;
      state.attackRemainder = 0;
      break;
    }
  }

  return state;
}
