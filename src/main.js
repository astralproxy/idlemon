import { DEBUG_ENABLED, SHEET_CSV_URLS } from "../config.js";
import { loadGameContent, RARITY_ORDER } from "./content.js";

import {
  advanceGame,
  addLootToBag,
  buyShopItem,
  canUseLoot,
  createRestoreKey,
  createInitialState,
  equipLoot,
  experienceForNextLevel,
  getPlayerMaxHp,
  getPlayerStats,
  isTwoHandEquipped,
  MAX_OFFLINE_SECONDS,
  parseSavedState,
  refreshShop,
  resetSavedGame,
  revivePlayer,
  restoreStateFromKey,
  SAVE_KEY,
  SHOP_REFRESH_COST,
  selectMonster,
  sellMaterial,
  sellLoot,
  unequipLoot,
  useLoot,
} from "./game.js";

const elements = {
  splashScreen: document.querySelector("#splash-screen"),
  splashText: document.querySelector("#splash-text"),
  //splashProgressFill: document.querySelector("#splash-progress-fill"),
  splashStartBtn: document.querySelector("#splash-start-btn"),
  game: document.querySelector("#game"),
  
  // Generic confirmation popup
  confirmDialog: document.querySelector("#confirm-dialog"),
  confirmDialogTitle: document.querySelector("#confirm-dialog-title"),
  confirmDialogMessage: document.querySelector("#confirm-dialog-message"),
  confirmDialogYes: document.querySelector("#confirm-dialog-yes"),
  confirmDialogNo: document.querySelector("#confirm-dialog-no"),

  status: document.querySelector("#game-status"),
  resetGame: document.querySelector("#reset-game"),
  menuToggle: document.querySelector("#menu-toggle"),
  siteMenu: document.querySelector("#site-menu"),
  cheatMenuItem: document.querySelector("#cheat-menu-item"),
  profilePage: document.querySelector("#profile-page"),
  helpPage: document.querySelector("#help-page"),
  settingsPage: document.querySelector("#settings-page"),
  settingsAutoHealEnabled: document.querySelector("#settings-auto-heal-enabled"),
  settingsAutoHealThreshold: document.querySelector("#settings-auto-heal-threshold"),
  swapInventoryOrder: document.querySelector("#swap-inventory-order"),

  hideStatusText: document.querySelector("#hide-status-text"),
  statusPanel: document.querySelector(".status-panel"),
  statusLogList: document.querySelector("#status-log-list"),

  gameSpeed: document.querySelector("#game-speed"),
  gameSpeedValue: document.querySelector("#game-speed-value"),
  
  inventoryGrid: document.querySelector(".inventory-grid"),
  
  cheatPage: document.querySelector("#cheat-page"),
  cheatLootList: document.querySelector("#cheat-loot-list"),
  cheatOptionsList: document.querySelector("#cheat-options-list"), // Add this line
  
  restoreKey: document.querySelector("#restore-key"),
  copyRestoreKey: document.querySelector("#copy-restore-key"),
  copyStatus: document.querySelector("#copy-status"),
  errorPanel: document.querySelector("#error-panel"),
  errorMessage: document.querySelector("#error-message"),
  
  fightTab: document.querySelector("#fight-tab"),
  prepareTab: document.querySelector("#prepare-tab"),
  
  craftDialog: document.querySelector("#craft-dialog"),
  craftDialogTitle: document.querySelector("#craft-dialog-title"),
  craftDialogMessage: document.querySelector("#craft-dialog-message"),
  craftSourceName: document.querySelector("#craft-source-name"),
  craftOptionsList: document.querySelector("#craft-options-list"),
  craftConfirmBtn: document.querySelector("#craft-confirm-btn"),

  shopTab: document.querySelector("#shop-tab"),
  shopLockedTooltip: document.querySelector("#shop-locked-tooltip"),
  shopSection: document.querySelector("#shop-section"),
  shopList: document.querySelector("#shop-list"),
  shopCurrencyCount: document.querySelector("#shop-currency-count"),
  refreshShop: document.querySelector("#refresh-shop"),

  sellConfirmDialog: document.querySelector("#sell-confirm-dialog"),
  sellConfirmItemName: document.querySelector("#sell-confirm-item-name"),
  sellConfirmRarity: document.querySelector("#sell-confirm-rarity"),
  sellConfirmPrice: document.querySelector("#sell-confirm-price"),
  sellConfirmDialog: document.querySelector("#sell-confirm-dialog"),
  sellConfirmItemName: document.querySelector("#sell-confirm-item-name"),
  sellConfirmRarity: document.querySelector("#sell-confirm-rarity"),
  sellConfirmPrice: document.querySelector("#sell-confirm-price"),
  // SELL quantity dialog
  sellQuantityDialog: document.querySelector("#sell-quantity-dialog"),
  sellQtyItemName: document.querySelector("#sell-qty-item-name"),
  sellQtyMax: document.querySelector("#sell-qty-max"),
  sellQtyInput: document.querySelector("#sell-qty-input"),
  sellQtyMinus: document.querySelector("#sell-qty-minus"),
  sellQtyPlus: document.querySelector("#sell-qty-plus"),
  sellQtyAll: document.querySelector("#sell-qty-all"),
  sellQtyTotalSouls: document.querySelector("#sell-qty-total-souls"),
  sellQuantityForm: document.querySelector("#sell-quantity-form"),
  // end SELL quanity dialog

  playerStatsPanel: document.querySelector(".player-stats-panel"),
  monsterSection: document.querySelector("#monster-section"),
  activeMonsterCard: document.querySelector("#active-monster-card"),
  bossKilledCard: document.querySelector("#boss-killed-card"),
  bossKilledHeading: document.querySelector(".boss-killed-heading h3"),
  bossShopHint: document.querySelector(".boss-shop-hint"),
  bossKilledName: document.querySelector("#boss-killed-name"),
  bossKilledReward: document.querySelector("#boss-killed-reward"),
  prepareMonster: document.querySelector("#prepare-monster"),
  prepareMonsterName: document.querySelector("#prepare-monster-name"),
  prepareMonsterHealth: document.querySelector("#prepare-monster-health"),
  prepareMonsterHealthMeter: document.querySelector("#prepare-monster-health-meter"),
  gameOver: document.querySelector("#game-over"),
  gameOverStats: document.querySelector("#game-over-stats"),
  startOver: document.querySelector("#start-over"),
  revivePrompt: document.querySelector("#revive-prompt"),
  reviveMessage: document.querySelector("#revive-message"),
  revivePlayer: document.querySelector("#revive-player"),
  level: document.querySelector("#player-level"),
  xp: document.querySelector("#player-xp"),
  xpMeter: document.querySelector("#xp-meter"),
  currencyCount: document.querySelector("#currency-count"),
  hp: document.querySelector("#player-hp"),
  hpMax: document.querySelector("#player-max-hp"),
  armor: document.querySelector("#player-armor"),
  damage: document.querySelector("#player-damage"),
  playerStatsToggle: document.querySelector("#player-stats-toggle"),
  playerStatsDetails: document.querySelector("#player-stats-details"),
  playerStatsCompact: document.querySelector("#player-stats-compact"),
  compactPlayerLevel: document.querySelector("#compact-player-level"),
  compactPlayerHp: document.querySelector("#compact-player-hp"),
  compactPlayerHpMax: document.querySelector("#compact-player-max-hp"),
  compactPlayerArmor: document.querySelector("#compact-player-armor"),
  compactPlayerDamage: document.querySelector("#compact-player-damage"),
  monsterDropdown: document.querySelector("#monster-dropdown"),
  monsterToggleBtn: document.querySelector("#monster-dropdown .dropdown-toggle"),
  monsterMenu: document.querySelector("#monster-dropdown .dropdown-menu"),
  monsterSelectedLabel: document.querySelector("#monster-dropdown .dropdown-selected-label"),
  monsterLevel: document.querySelector("#monster-level"),
  monsterName: document.querySelector("#monster-name"),
  monsterHealth: document.querySelector("#monster-health"),
  monsterHealthMeter: document.querySelector("#monster-health-meter"),
  monsterReward: document.querySelector("#monster-reward"),
  lootCheckDebug: document.querySelector("#loot-check-debug"),
  quickItemsSection: document.querySelector("#quick-items-section"),
  quickItemsList: document.querySelector("#quick-items-list"),
  killCount: document.querySelector("#kill-count"),
  defeatedCount: document.querySelector("#defeated-count"),
  unlockedCount: document.querySelector("#unlocked-count"),
  gearList: document.querySelector("#gear-list"),
  bagToggle: document.querySelector("#bag-toggle"),
  bagContent: document.querySelector("#bag-content"),
  bagShopNote: document.querySelector("#bag-shop-note"),
  bagItemsTab: document.querySelector("#bag-items-tab"),
  bagItemsPanel: document.querySelector("#bag-items-panel"),
  bagItemsList: document.querySelector("#bag-items-list"),
  bagWeaponsTab: document.querySelector("#bag-weapons-tab"),
  bagWeaponsPanel: document.querySelector("#bag-weapons-panel"),
  bagWeaponsList: document.querySelector("#bag-weapons-list"),
  bagArmorTab: document.querySelector("#bag-armor-tab"),
  bagArmorPanel: document.querySelector("#bag-armor-panel"),
  bagArmorList: document.querySelector("#bag-armor-list"),
  bagMaterialsTab: document.querySelector("#bag-materials-tab"),
  bagMaterialsPanel: document.querySelector("#bag-materials-panel"),
  bagMaterialsList: document.querySelector("#bag-materials-list"),
  gearToggle: document.querySelector("#gear-toggle"),
  gearContent: document.querySelector("#gear-content"),
};

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const GEAR_SLOTS = ["Hand", "Offhand", "Ring", "Head", "Chest", "Arms", "Legs"];
const QUICK_ITEM_IGNORED_SKILLS = new Set(["revive"]);
const INVENTORY_ORDER_KEY = "idlemon-inventory-order-swapped";
const HIDE_STATUS_TEXT_KEY = "idlemon-hide-status-text";
const GAME_SPEED_KEY = "idlemon-game-speed";
const GAME_SPEEDS = [1, 2, 5];
let content;
let state;
let lastTickAt;
let currentPage = "game";
let playerStatsCollapsed = true;
let gearCollapsed = false;
let bagCollapsed = false;
let gameSpeed = 1;
let statusMessage = "Combat and rewards happen automatically.";
let statusTimeout;
let statusVersion = 0;
let saveErrorShown = false;
let resetting = false;
let shopTooltipTimeout;
let isMonsterSelectOpen = false;
let lastKnownActiveMonsterId = null;

function showError(message) {
  elements.game.hidden = true;
  elements.errorPanel.hidden = false;
  elements.errorMessage.textContent = message;
  elements.status.textContent = "Game unavailable.";
}

// Generic confirmation popup dialog
function showConfirmDialog(title, message, yesText = "Yes", noText = "Cancel", isDangerous = false) {
  if (!elements.confirmDialog) {
    return Promise.resolve(window.confirm(message));
  }

  elements.confirmDialogTitle.textContent = title;
  elements.confirmDialogMessage.textContent = message;
  elements.confirmDialogYes.textContent = yesText;
  elements.confirmDialogNo.textContent = noText;

  if (isDangerous) {
    elements.confirmDialogYes.className = "button reset-button";
  } else {
    elements.confirmDialogYes.className = "button";
  }

  elements.confirmDialog.showModal();

  return new Promise((resolve) => {
    elements.confirmDialog.addEventListener(
      "close",
      () => {
        resolve(elements.confirmDialog.returnValue === "confirm");
      },
      { once: true }
    );
  });
}

// Log status to the main page as well as the Profile history
function setStatus(message) {
  window.clearTimeout(statusTimeout);
  const version = ++statusVersion;
  statusMessage = message;
  elements.status.textContent = message;
  
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dd = pad(now.getDate());
  const mm = pad(now.getMonth() + 1);
  const yy = String(now.getFullYear()).slice(-2);
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  const timestamp = `$${mm}/{dd}/${yy} ${hh}:${min}:${ss}`;

  state.statusLog.unshift({ text: message, time: timestamp });
  if (state.statusLog.length > 100) {
    state.statusLog.pop();
  }

  statusTimeout = window.setTimeout(() => {
    if (version !== statusVersion) {
      return;
    }
    statusMessage = "";
    elements.status.textContent = "";
  }, 5000);
}

function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function lootEffectText(item) {
  if (!item.skill) {
    return "No associated skill";
  }
  const skill = content.skills.find((candidate) => candidate.name === item.skill);
  const effectValue = item.effectIsPercentage
    ? `${numberFormat.format(item.effectValue)}%`
    : numberFormat.format(item.effectValue);
  return skill ? `${item.skill} (${effectValue})` : item.skill;
}

function monsterDisplayName(monster) {
  return monster.type.toLowerCase() === "boss" ? `[BOSS] ${monster.name}` : monster.name;
}

function renderList(container, rows, emptyText, renderRow) {
  container.replaceChildren();
  if (rows.length === 0) {
    container.append(createTextElement("p", "muted empty-state", emptyText));
    return;
  }
  for (const row of rows) {
    container.append(renderRow(row));
  }
}

function updateBackground(monster) {
  if (!monster) return;
  const loc = monster.location || monster.Location;
  if (!loc) return;

  const filename = loc
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + ".webp";

  document.body.style.setProperty("--bg-image", `url("./art/${filename}")`);
}

function checkAndUpdateBackground() {
  if (!state || !content) return;
  if (state.targetMonsterId !== lastKnownActiveMonsterId) {
    lastKnownActiveMonsterId = state.targetMonsterId;
    const target = content.monsters.find((m) => m.id === state.targetMonsterId);
    if (target) {
      updateBackground(target);
    }
  }
}

function confirmLootSale(item, count = 1) {
  elements.sellConfirmItemName.textContent = count > 1 ? `${item.name} ×${count}` : item.name;
  elements.sellConfirmRarity.textContent = item.rarity;
  elements.sellConfirmRarity.className = `loot-rarity rarity-${item.rarity.toLowerCase()}`;
  elements.sellConfirmPrice.textContent = numberFormat.format(item.value * count);
  elements.sellConfirmDialog.showModal();
  return new Promise((resolve) => {
    elements.sellConfirmDialog.addEventListener(
      "close",
      () => resolve(elements.sellConfirmDialog.returnValue === "sell"),
      { once: true },
    );
  });
}

function promptSellQuantity(item, maxCount) {
  elements.sellQtyItemName.textContent = item.name;
  elements.sellQtyMax.textContent = maxCount;
  elements.sellQtyInput.value = 1;
  elements.sellQtyInput.max = maxCount;
  
  const updateTotalPrice = () => {
    const qty = Math.max(1, Math.min(maxCount, Number(elements.sellQtyInput.value) || 1));
    elements.sellQtyTotalSouls.textContent = numberFormat.format(item.value * qty);
  };
  updateTotalPrice();

  // Clean up previous listeners or handle via single-use events
  const onInput = () => updateTotalPrice();
  const onMinus = () => {
    elements.sellQtyInput.value = Math.max(1, Number(elements.sellQtyInput.value) - 1);
    updateTotalPrice();
  };
  const onPlus = () => {
    elements.sellQtyInput.value = Math.min(maxCount, Number(elements.sellQtyInput.value) + 1);
    updateTotalPrice();
  };
  const onAll = () => {
    elements.sellQtyInput.value = maxCount;
    updateTotalPrice();
  };

  elements.sellQtyInput.addEventListener("input", onInput);
  elements.sellQtyMinus.onclick = onMinus;
  elements.sellQtyPlus.onclick = onPlus;
  elements.sellQtyAll.onclick = onAll;

  elements.sellQuantityDialog.showModal();

  return new Promise((resolve) => {
    elements.sellQuantityDialog.addEventListener(
      "close",
      () => {
        elements.sellQtyInput.removeEventListener("input", onInput);
        if (elements.sellQuantityDialog.returnValue === "confirm") {
          const finalQty = Math.max(1, Math.min(maxCount, Number(elements.sellQtyInput.value) || 1));
          resolve(finalQty);
        } else {
          resolve(null);
        }
      },
      { once: true },
    );
  });
}

function populateMonsterSelect() {
  elements.monsterMenu.replaceChildren();
  let currentSelectedText = "Choose an enemy...";

  if (state.awaitingMonsterSelection) {
    currentSelectedText = "Choose an enemy...";
  }

  // Find first undefeated boss to block progress
  // const undefeatedBossIndex = content.monsters.findIndex(
  //   (monster) => monster.type.toLowerCase() === "boss" && (state.kills[monster.id] ?? 0) === 0
  // );

  // Find the first required (non-optional) boss that hasn't been defeated yet
  const undefeatedBossIndex = content.monsters.findIndex(
    (monster) => monster.type.toLowerCase() === "boss" &&
      !monster.isOptional &&
      (state.kills[monster.id] ?? 0) === 0
  );

  for (let index = 0; index < content.monsters.length; index += 1) {
    const monster = content.monsters[index];
    const item = document.createElement("div");
    item.className = "dropdown-item";
    item.dataset.value = monster.id;

    // Check requirement satisfaction
    let missingRequirement = false;
    if (monster.requirements) {
      const reqMaterial = content.materials.find(
        (m) => m.name.toLowerCase() === monster.requirements.toLowerCase()
      );
      if (reqMaterial && (state.currencyInventory[reqMaterial.id] ?? 0) < 1) {
        missingRequirement = true;
      }
    }

    const isObscured = undefeatedBossIndex !== -1 && index > undefeatedBossIndex;
    const isSelected = !state.awaitingMonsterSelection && monster.id === (state.pendingTargetMonsterId ?? state.targetMonsterId);

    if (isObscured) {
      item.textContent = "??? (Beat boss to reveal)";
      item.classList.add("is-disabled");
    } else if (missingRequirement) {
      item.textContent = `${monsterDisplayName(monster)} (req: ${monster.requirements})`;
      item.classList.add("is-italic", "is-disabled");
    }else {
      item.classList.remove("is-italic"); // just in case
      const isPendingTarget = monster.id === state.pendingTargetMonsterId;
      const isSpecialEnemy = monster.type.toLowerCase() === "boss" ||
                             monster.type.toLowerCase() === "miniboss" ||
                             monster.type.toLowerCase() === "phantom";
      if (isSpecialEnemy) {
        item.classList.add("boss-item");
      }
      const isDefeatedSpecial = isSpecialEnemy && (state.kills[monster.id] ?? 0) > 0;
      const isDisabled = isDefeatedSpecial || (state.awaitingMonsterSelection && monster.id === state.targetMonsterId);
      
      const displayName = monsterDisplayName(monster);
      item.textContent = isPendingTarget ? `${displayName} (after current)` : `${displayName}`;

      if (isDefeatedSpecial) {
        item.classList.add("boss-defeated");
      }
      if (isDisabled) {
        item.classList.add("is-disabled");
      }
    }

    if (isSelected) {
      item.classList.add("is-selected");
      currentSelectedText = item.textContent;
    }

    elements.monsterMenu.append(item);
  }

  elements.monsterSelectedLabel.textContent = currentSelectedText;
}

function renderStatusLog() {
  if (!elements.statusLogList || !state) return;
  renderList(
    elements.statusLogList,
    state.statusLog ?? [],
    "No status history yet.",
    (entry) => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.style.display = "flex";
      item.style.justifyContent = "flex-start";
      item.style.alignItems = "flex-start";
      item.style.gap = "10px";
      item.style.fontSize = "0.82rem";
      item.style.textAlign = "left";
      
      const timeSpan = document.createElement("span");
      timeSpan.style.color = "var(--muted)";
      timeSpan.style.whiteSpace = "nowrap";
      timeSpan.textContent = `[${entry.time}]`;

      const textSpan = document.createElement("span");
      textSpan.style.textAlign = "left";
      textSpan.textContent = entry.text;

      item.appendChild(timeSpan);
      item.appendChild(textSpan);
      return item;
    }
  );
}

function render() {
  const stats = getPlayerStats(state, content);
  const xpNeeded = experienceForNextLevel(state.level);
  renderCombatTab();

  elements.game.hidden = currentPage !== "game" || state.gameOver;
  elements.gameOver.hidden = currentPage !== "game" || !state.gameOver;
  elements.profilePage.hidden = currentPage !== "profile";
  elements.helpPage.hidden = currentPage !== "help";
  elements.settingsPage.hidden = currentPage !== "settings";
  elements.settingsAutoHealEnabled.checked = Boolean(state.autoHealEnabled);
  if (document.activeElement !== elements.settingsAutoHealThreshold) {
    elements.settingsAutoHealThreshold.value = state.autoHealThreshold ?? 100;
  }
  elements.cheatPage.hidden = !DEBUG_ENABLED || currentPage !== "cheat";
  elements.inventoryGrid.classList.toggle("is-shop", state.activeTab === "shop");
  elements.playerStatsPanel.hidden = state.activeTab === "shop";
  elements.level.textContent = String(state.level);
  elements.xp.textContent = `${numberFormat.format(state.xp)} / ${numberFormat.format(xpNeeded)} XP to next level`;
  elements.xpMeter.style.width = `${Math.min(100, (state.xp / xpNeeded) * 100)}%`;
  elements.xpMeter.parentElement.setAttribute("aria-valuemax", String(xpNeeded));
  elements.xpMeter.parentElement.setAttribute("aria-valuenow", String(Math.floor(state.xp)));
  elements.currencyCount.textContent = numberFormat.format(state.currencyBalance);
  elements.shopCurrencyCount.textContent = numberFormat.format(state.currencyBalance);
  const playerHp = Math.floor(state.hp);
  const playerHpMax = getPlayerMaxHp(state.level);
  elements.hp.textContent = numberFormat.format(playerHp);
  elements.hpMax.textContent = numberFormat.format(playerHpMax);
  elements.armor.textContent = numberFormat.format(stats.defense);
  elements.damage.textContent = numberFormat.format(stats.damage);
  elements.compactPlayerLevel.textContent = numberFormat.format(state.level);
  elements.compactPlayerHp.textContent = numberFormat.format(playerHp);
  elements.compactPlayerHpMax.textContent = numberFormat.format(playerHpMax);
  const hpPercent = (playerHp / playerHpMax) * 100;
  elements.compactPlayerHp.classList.toggle("is-low-hp", hpPercent < 20);
  //elements.compactPlayerArmor.textContent = numberFormat.format(stats.defense);
  elements.compactPlayerArmor.textContent = `${numberFormat.format(stats.defense)} + ${stats.defensePercent}%`;
  elements.compactPlayerDamage.textContent = numberFormat.format(stats.damage);
  elements.playerStatsDetails.hidden = playerStatsCollapsed;
  elements.playerStatsCompact.hidden = !playerStatsCollapsed;
  elements.playerStatsToggle.setAttribute("aria-expanded", String(!playerStatsCollapsed));
  elements.playerStatsToggle.textContent = playerStatsCollapsed ? "+" : "−";
  elements.playerStatsToggle.setAttribute("aria-label", `${playerStatsCollapsed ? "Expand" : "Collapse"} Player Stats`);
  elements.gearContent.hidden = gearCollapsed;
  elements.gearToggle.setAttribute("aria-expanded", String(!gearCollapsed));
  elements.gearToggle.textContent = gearCollapsed ? "+" : "−";
  elements.gearToggle.setAttribute("aria-label", `${gearCollapsed ? "Expand" : "Collapse"} Equipment`);
  elements.bagContent.hidden = bagCollapsed;
  elements.bagShopNote.hidden = state.activeTab !== "shop";
  elements.bagToggle.setAttribute("aria-expanded", String(!bagCollapsed));
  elements.bagToggle.textContent = bagCollapsed ? "+" : "−";
  elements.bagToggle.setAttribute("aria-label", `${bagCollapsed ? "Expand" : "Collapse"} Bag`);
  elements.status.textContent = statusMessage;

  if (!elements.profilePage.hidden) {
    renderStatusLog();
    if (document.activeElement !== elements.restoreKey) {
      elements.restoreKey.value = createRestoreKey(state);
    }
  }

  // Update the selected label text based on current state target
  const currentMonster = content.monsters.find((m) => m.id === (state.pendingTargetMonsterId ?? state.targetMonsterId));
  if (currentMonster) {
    elements.monsterSelectedLabel.textContent = monsterDisplayName(currentMonster);
  } else if (state.awaitingMonsterSelection) {
    elements.monsterSelectedLabel.textContent = "Choose an enemy...";
  }
  const target = content.monsters.find((monster) => monster.id === state.targetMonsterId);
  const availableMonsters = content.monsters;//.filter((monster) => monster.unlock_level <= state.level);

  elements.activeMonsterCard.hidden = !target || state.awaitingMonsterSelection;
  elements.bossKilledCard.hidden = !target || !state.awaitingMonsterSelection;
  elements.lootCheckDebug.hidden = true;//!DEBUG_ENABLED || !state.lastLootCheck;
  if (state.lastLootCheck) {
    const { monsterName, roll, chance, dropped } = state.lastLootCheck;
    const checkedMonster = content.monsters.find((monster) => monster.name === monsterName);
    const displayName = checkedMonster ? monsterDisplayName(checkedMonster) : monsterName;
    elements.lootCheckDebug.textContent = roll === null
      ? `Debug loot check: ${displayName} has no loot listed.`
      : `Debug loot check: ${displayName} rolled ${numberFormat.format(roll)}% vs ${numberFormat.format(chance)}% — ${dropped ? "dropped" : "no drop"}.`;
  }
  elements.prepareMonster.hidden = !target || state.activeTab !== "prepare" || state.awaitingMonsterSelection;
  elements.killCount.hidden = !target || state.awaitingMonsterSelection;
  if (target) {
    // Normal enemies show all loot as rewards because we don't take time to see what actually dropped
    // Special enemy kills (e.g. boss) pause the game, so we only want to see what actually dropped
    const isSpecialEnemyType = ["boss", "miniboss", "phantom"].includes(target.type.toLowerCase());
    const lootChance = target.lootChance ?? 100;
    const lootRewards = isSpecialEnemyType
      ? (state.lastDroppedLootNames ?? [])
      : (target.lootNames ?? []).map((name) => 
          lootChance < 100 ? `${name} (${lootChance}%)` : name
        );

    const rawMaterials = target.materialNames ?? target.currencyNames ?? [];
    const bossNames = rawMaterials.filter((name) => {
      const item = content.materials.find((m) => m.name === name);
      return (item?.notes ?? "").trim().toLowerCase() === "boss";
    });
    
    // Pick which boss item to display: the chosen drop, or the first one as default
    const activeBossName = state.lastBossDrop && bossNames.includes(state.lastBossDrop)
      ? state.lastBossDrop
      : bossNames[0];

    const materialRewards = rawMaterials
      .filter((name) => name.trim().toLowerCase() !== "soul")
      .filter((name) => {
        const item = content.materials.find((m) => m.name === name);
        const isBoss = (item?.notes ?? "").trim().toLowerCase() === "boss";
        // Hide non-chosen boss materials when multiple exist
        return !isBoss || name === activeBossName;
      })
      .map((name) => {
        const item = content.materials.find((m) => m.name === name);
        const notes = (item?.notes ?? "").toLowerCase();
        
        let rewardString = "";
        if (notes.includes("boss")) {
          rewardString = name;
        } else if (notes.includes("unique")) {
          rewardString = name; // Excludes the mat count number
        } else if (notes.includes("upgrade")) {
          rewardString = name;
        } else {
          rewardString = `${numberFormat.format(target.materialCount ?? 1)} ${name}`;
        }

        // Append material chance if it's less than 100% and not a boss item
        if (!notes.includes("boss") && target.materialChance < 100) {
          rewardString += ` (${target.materialChance}%)`;
        }

        return rewardString;
      });
    
    const itemRewards = [...lootRewards, ...materialRewards];

    const isBoss = target.type.toLowerCase() === "boss";
    elements.bossKilledHeading.textContent = isBoss ? "VICTORY ACHIEVED" : "You Defeated";
    elements.bossShopHint.hidden = !isBoss; // Hide for minibosses, phantoms
    elements.monsterLevel.textContent = `Level ${target.level}`;
    elements.bossKilledName.textContent = target.name;
    elements.bossKilledReward.replaceChildren(
      document.createTextNode(`Rewards: ${numberFormat.format(target.xp)} XP`),
    );
    for (const rewardName of lootRewards) {
      const item = content.loot.find((lootItem) => lootItem.name === rewardName);
      elements.bossKilledReward.append(document.createElement("br"));
      if (item) {
        elements.bossKilledReward.append(createTextElement(
          "span",
          `loot-rarity rarity-${item.rarity.toLowerCase()}`,
          rewardName,
        ));
      } else {
        elements.bossKilledReward.append(document.createTextNode(rewardName));
      }
    }
    for (const reward of materialRewards) {
      elements.bossKilledReward.append(
        document.createElement("br"),
        document.createTextNode(reward),
      );
    }
    elements.monsterName.textContent = monsterDisplayName(target);
    elements.monsterHealth.textContent = `${numberFormat.format(Math.max(0, state.monsterHp))} / ${numberFormat.format(target.health)}`;
    const healthPercent = Math.max(0, Math.min(100, (state.monsterHp / target.health) * 100));
    elements.monsterHealthMeter.style.width = `${healthPercent}%`;
    elements.monsterHealthMeter.style.backgroundColor = `hsl(${Math.round(healthPercent * 1.2)} 75% 45%)`;
    elements.monsterHealthMeter.parentElement.setAttribute("aria-valuenow", String(Math.floor(healthPercent)));
    elements.prepareMonsterName.textContent = monsterDisplayName(target);
    elements.prepareMonsterHealth.textContent = elements.monsterHealth.textContent;
    elements.prepareMonsterHealthMeter.style.width = `${healthPercent}%`;
    elements.prepareMonsterHealthMeter.style.backgroundColor = `hsl(${Math.round(healthPercent * 1.2)} 75% 45%)`;
    elements.prepareMonsterHealthMeter.parentElement.setAttribute("aria-valuenow", String(Math.floor(healthPercent)));
    const rewardsText = itemRewards.length > 0 ? `, ${itemRewards.join(", ")}` : "";
    elements.monsterReward.textContent = `Deals ${numberFormat.format(target.damage)} damage\nRewards: ${numberFormat.format(target.xp)} XP${rewardsText}`;
    elements.defeatedCount.textContent = `Defeated: ${numberFormat.format(state.kills[target.id] ?? 0)} monsters`;
    elements.unlockedCount.textContent = `${numberFormat.format(availableMonsters.length)} of ${numberFormat.format(content.monsters.length)} unlocked`;
  } else {
    elements.monsterSelectedLabel.textContent = "Choose an enemy...";
    elements.defeatedCount.textContent = `Defeated: ${numberFormat.format(Object.values(state.kills).reduce((total, count) => total + count, 0))} monsters`;
    elements.unlockedCount.textContent = `${numberFormat.format(availableMonsters.length)} of ${numberFormat.format(content.monsters.length)} unlocked`;
  }

  const soulsLost = state.soulsLost ?? 0;
  const totalKills = Object.values(state.kills).reduce((total, count) => total + count, 0);
  // Calculate total bosses defeated (monsters with type "boss")
  const totalBossesDefeated = content.monsters
    .filter((monster) => monster.type.toLowerCase() === "boss")
    .reduce((total, boss) => total + (state.kills[boss.id] ?? 0), 0);

  elements.gameOverStats.textContent = `Player level: ${numberFormat.format(state.level)}
    Souls lost: ${numberFormat.format(soulsLost)}
    \nEnemies defeated: ${numberFormat.format(totalKills)}
    Bosses defeated: ${numberFormat.format(totalBossesDefeated)}`;
  renderShop();
  const reviveItem = content.loot.find((item) => {
    const skill = content.skills.find((candidate) => candidate.name === item.skill);
    const isAvailableRevive = skill
      ? skill.effect === "revive"
      : item.skill.toLowerCase() === "revive";
    return isAvailableRevive && (state.lootInventory[item.id] ?? 0) > 0;
  });
  elements.revivePrompt.hidden = !reviveItem;
  elements.startOver.hidden = Boolean(reviveItem);
  if (reviveItem) {
    elements.reviveMessage.textContent = `Have you lost your nerve? ... No? Then go along. No one's stopping you.`;
    elements.revivePlayer.textContent = `Use [${reviveItem.name}] to Revive`;
    elements.revivePlayer.dataset.lootId = reviveItem.id;
  }

  renderList(elements.gearList, GEAR_SLOTS, "", (slot) => {
    const item = content.loot.find((loot) => loot.id === state.gear[slot]);
    const row = document.createElement("article");
    const offhandDisabled = slot === "Offhand" && isTwoHandEquipped(state, content);
    row.className = `list-item gear-item${offhandDisabled ? " is-disabled" : ""}`;
    if (offhandDisabled) {
      row.setAttribute("aria-disabled", "true");
    }
    row.append(
      createTextElement("strong", "gear-slot", slot),
    );
    const itemColumn = createTextElement("div", "gear-equipped-item", "");
    if (item) {
      itemColumn.append(
        createTextElement("span", `item-title loot-rarity rarity-${item.rarity.toLowerCase()}`, item.name),
        createTextElement("span", "muted item-description", `${lootEffectText(item)}`),
      );
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button secondary";
      button.textContent = "Unequip";
      button.addEventListener("click", () => {
        unequipLoot(state, content, slot);
        setStatus(`${item.name} moved to your bag.`);
        render();
        saveState();
      });
      row.append(itemColumn, button);
    } else if (offhandDisabled) {
      itemColumn.append(createTextElement("span", "muted", "Disabled by Two-Hand item"));
      row.append(itemColumn);
    } else {
      itemColumn.append(createTextElement("span", "muted", "Empty"));
      row.append(itemColumn);
    }
    return row;
  });

  elements.gameSpeed.addEventListener("input", () => {
    gameSpeed = GAME_SPEEDS[Number(elements.gameSpeed.value)];
    elements.gameSpeedValue.value = `${gameSpeed}×`;
    lastTickAt = Date.now();
    try {
      localStorage.setItem(GAME_SPEED_KEY, String(gameSpeed));
    } catch (error) {
      setStatus(`Could not save this setting: ${error.message}`);
    }
  });

  const bagLoot = content.loot.filter((item) => (state.lootInventory[item.id] ?? 0) > 0);
  const quickUseItems = bagLoot.filter((item) => (
    item.slot === "" && !QUICK_ITEM_IGNORED_SKILLS.has(item.skill.toLowerCase())
  ));
  elements.quickItemsSection.hidden = quickUseItems.length === 0;
  elements.quickItemsList.replaceChildren();
  for (const item of quickUseItems) {
    const count = state.lootInventory[item.id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button secondary quick-item-button";
    button.textContent = `${item.name} ×${count}`;
    button.title = `${item.name}: ${lootEffectText(item)}`;
    button.setAttribute("aria-label", `Use ${item.name}, ${count} in bag. ${lootEffectText(item)}.`);
    button.disabled = !canUseLoot(state, content, item.id);
    button.addEventListener("click", () => {
      try {
        if (!useLoot(state, content, item.id)) {
          setStatus(`Cannot use ${item.name} right now.`);
          return;
        }
        setStatus(`${item.name} used.`);
        render();
        saveState();
      } catch (error) {
        setStatus(`Could not use ${item.name}: ${error.message}`);
        render();
      }
    });
    elements.quickItemsList.append(button);
  }

  const renderBagItem = (item) => {
    const row = document.createElement("article");
    
    // highlight non-Items that are new
    const isValidTab = state.activeTab === "fight" || state.activeTab === "prepare";
    const isNewLootVisible = isValidTab && item.slot !== "" && state.newLootIds.includes(item.id);
    row.className = `list-item loot-item${isNewLootVisible ? " is-new-loot" : ""}`;
    
    // Text description container (Column 1)
    const textContainer = createTextElement("div", "skill-copy", "");

    // Badge element (Column 2)
    const badge = createTextElement("span", "badge", `×${state.lootInventory[item.id]}`);

    const isShop = state.activeTab === "shop";
    
    const slotLabel = item.slot ? item.slot : "Consumable";
    const titleSpan = createTextElement("span", `item-title loot-rarity rarity-${item.rarity.toLowerCase()}`, item.name);
    
    // Combine slot and effect into one descriptive string
    const detailsText = `(${slotLabel}) - ${lootEffectText(item)}`;

    const heading = createTextElement("h3", "", "");
    heading.append(titleSpan, document.createElement("br"), createTextElement("span", "muted item-description", detailsText));

    textContainer.append(heading);
    
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";
    button.textContent = isShop ? "Sell" : item.slot ? "Equip" : "Use";
    button.disabled = isShop
      ? item.value === 0
      : (item.slot === "" && !canUseLoot(state, content, item.id))
        || (item.slot === "Offhand" && isTwoHandEquipped(state, content));
    if (item.slot === "Offhand" && isTwoHandEquipped(state, content)) {
      button.title = "Unequip the Two-Hand item before equipping Offhand gear.";
    }
    
    const sellLootCount = async (count) => {
      try {
        const rarityLevels = {
          trash: 0,
          common: 1,
          uncommon: 2,
          rare: 3,
          epic: 4,
          legendary: 5,
          mythic: 6,
        };
        if ((rarityLevels[item.rarity.toLowerCase()] ?? 0) >= rarityLevels.rare
            && !await confirmLootSale(item, count)) {
          return;
        }
        if (!sellLoot(state, content, item.id, count)) {
          setStatus(`${item.name} is no longer in your Bag.`);
          render();
          return;
        }
        const totalValue = item.value * count;
        setStatus(count > 1
          ? `Sold ${count} ${item.name} for ${numberFormat.format(totalValue)} Souls.`
          : `${item.name} sold for ${numberFormat.format(totalValue)} Souls.`);
        render();
        saveState();
      } catch (error) {
        setStatus(`Could not sell ${item.name}: ${error.message}`);
        render();
      }
    };
    button.addEventListener("click", async () => {
      try {
        if (isShop) {
          const count = state.lootInventory[item.id];
          if (count > 3) {
            const quantityToSell = await promptSellQuantity(item, count);
            if (quantityToSell !== null) {
              await sellLootCount(quantityToSell);
            }
          } else {
            await sellLootCount(1);
          }
          return;
        } else if (item.slot) {
          equipLoot(state, content, item.id);
          setStatus(`${item.name} equipped.`);
        } else if (useLoot(state, content, item.id)) {
          setStatus(`${item.name} used.`);
        } else {
          setStatus(`Cannot use ${item.name} right now.`);
          return;
        }
      } catch (error) {
        setStatus(`Could not use ${item.name}: ${error.message}`);
        render();
        return;
      }
      render();
      saveState();
    });

    // Append to row in exact grid column order: [Text, Badge, Button/Actions]
    if (isShop) {
      const actions = createTextElement("div", "bag-sale-actions", "");
      
      // Create a stacked wrapper for Value + Sell button
      const stackedContainer = createTextElement("div", "bag-sale-stacked", "");
      stackedContainer.append(
        createTextElement("span", "bag-sale-value", `Value: ${numberFormat.format(item.value)}`),
        button
      );
      actions.append(stackedContainer);

      row.append(textContainer, badge, actions);
    } else {
      row.append(textContainer, badge, button);
    }

    return row;
  };

  // indicate new items
  updateBagTabIndicators();

  const sortByRarityDesc = (a, b) => {
    const rankA = RARITY_ORDER.indexOf(a.rarity.toLowerCase());
    const rankB = RARITY_ORDER.indexOf(b.rarity.toLowerCase());
    return rankB - rankA;
  };

  // Items, sorted alphabetically
  renderList(
    elements.bagItemsList,
    bagLoot.filter((item) => item.slot === "").sort((a, b) => a.name.localeCompare(b.name)),
    "No consumable items in your bag.",
    renderBagItem,
  );
  
  // Weapons
  const weaponSlots = new Set(["hand", "two-hand", "offhand"]);
  renderList(
    elements.bagWeaponsList,
    bagLoot.filter((item) => weaponSlots.has(item.slot.toLowerCase())).sort(sortByRarityDesc),
    "No weapons in your bag.",
    renderBagItem,
  );
  // Armor
  renderList(
    elements.bagArmorList,
    bagLoot.filter((item) => item.slot !== "" && !weaponSlots.has(item.slot.toLowerCase())).sort(sortByRarityDesc),
    "No armor in your bag.",
    renderBagItem,
  );

  renderList(
    elements.bagMaterialsList,
    content.materials.filter((item) => (state.currencyInventory[item.id] ?? 0) > 0),
    "No materials in your bag.",
    (item) => {
      const row = document.createElement("article");
      
      // Highlight new materials when not seen yet and count > 0
      const isNewMaterial = !state.seenMaterials?.[item.id] && (state.currencyInventory[item.id] ?? 0) > 0;
      row.className = `list-item loot-item${isNewMaterial ? " is-new-loot" : ""}`;
      
      const materialUses = (item.uses ?? item.use ?? "").toLowerCase().split(/[\s,]+/);
      const isCraftMaterial = materialUses.includes("craft");
      const isBossMaterial = (item.notes ?? "").trim().toLowerCase() === "boss";

      const textContainer = createTextElement("div", "skill-copy", "");

      // Apply text highlight if notes === "Boss"
      const titleClasses = `item-title${isBossMaterial ? " boss-material-title" : ""}`;
      const titleSpan = createTextElement("strong", titleClasses, item.name);
      textContainer.append(titleSpan);
      
      if (isCraftMaterial && (state.activeTab === "shop")) {
        const craftNoteSpan = createTextElement("span", "muted", "(Also used in Crafting)");
        craftNoteSpan.style.display = "block";
        craftNoteSpan.style.fontWeight = "normal";
        textContainer.append(craftNoteSpan);
      }
      
      const badge = createTextElement("span", "badge", `×${state.currencyInventory[item.id]}`);
      row.append(textContainer, badge);

      const actions = createTextElement("div", "bag-sale-actions", "");

      // Check if this material's use type is Craft AND we're in the Prepare tab
      if (state.activeTab === "prepare" && isCraftMaterial) {
        const craftButton = document.createElement("button");
        craftButton.type = "button";
        craftButton.className = "button secondary";
        craftButton.textContent = "Craft";
        
        craftButton.addEventListener("click", () => {
          if (!elements.craftDialog) {
            console.error("craftDialog element not found in DOM!");
            return;
          }

          activeCraftItem = item;
          selectedCraftLootId = null;

          elements.craftDialogTitle.textContent = "Crafting";
          elements.craftOptionsList.replaceChildren();
          elements.craftConfirmBtn.disabled = true;

          const craftedNames = (item.crafted ?? "")
            .split(/[,;\n]+/)
            .map((name) => name.trim())
            .filter(Boolean);

          if (craftedNames.length === 0) {
            elements.craftOptionsList.append(createTextElement("p", "muted", "No recipes available."));
          } else {
            for (const lootName of craftedNames) {
              const lootItem = content.loot.find((l) => l.name.toLowerCase() === lootName.toLowerCase());
              const optionCard = document.createElement("button");
              optionCard.type = "button";
              optionCard.className = "list-item loot-item crafted-loot-item";
              
              if (lootItem) {
                const slotLabel = lootItem.slot ? lootItem.slot : "Consumable";
                
                // Title and slot together on the first line
                const titleSpan = createTextElement("span", `item-title loot-rarity rarity-${lootItem.rarity.toLowerCase()}`, lootItem.name);
                
                const detailsText = `(${slotLabel}) - ${lootEffectText(lootItem)}`;
                const detailsSpan = createTextElement("span", "muted item-description", detailsText);
                detailsSpan.style.fontWeight = "normal";

                const heading = createTextElement("strong", "", "");
                heading.append(titleSpan, document.createElement("br"), detailsSpan);

                const valueLabel = createTextElement("span", "muted", "Value:");
                const valueNum = createTextElement("span", "muted", numberFormat.format(lootItem.value));
                valueNum.style.color = "var(--accent)";

                const valueContainer = createTextElement("div", "", "");
                valueContainer.style.display = "flex";
                valueContainer.style.flexDirection = "column";
                valueContainer.style.alignItems = "flex-end";
                valueContainer.style.textAlign = "right";
                valueContainer.append(valueLabel, valueNum);

                optionCard.style.display = "grid";
                optionCard.style.gridTemplateColumns = "1fr 50px";
                optionCard.style.alignItems = "center";
                optionCard.style.gap = "12px";

                optionCard.append(heading, valueContainer);
              } else {
                optionCard.append(createTextElement("strong", "", lootName));
              }

              optionCard.addEventListener("click", () => {
                elements.craftOptionsList.querySelectorAll(".list-item").forEach((el) => el.classList.remove("is-new-loot"));
                optionCard.classList.add("is-new-loot");
                selectedCraftLootId = lootItem ? lootItem.id : null;
                elements.craftConfirmBtn.disabled = !selectedCraftLootId;
              });

              elements.craftOptionsList.append(optionCard);
            }
          }

          elements.craftDialog.showModal();
        });
        actions.append(craftButton);
      }

      if (state.activeTab === "shop") {
        const actions = createTextElement("div", "bag-sale-actions", "");
        const stackedContainer = createTextElement("div", "bag-sale-stacked", "");

        const sellMaterialCount = (count) => {
          try {
            if (!sellMaterial(state, content, item.id, count)) {
              setStatus(`${item.name} is no longer in your Bag.`);
              render();
              return;
            }
            const totalValue = item.value * count;
            setStatus(count > 1
              ? `Sold ${count} ${item.name} for ${numberFormat.format(totalValue)} Souls.`
              : `${item.name} sold for ${numberFormat.format(totalValue)} Souls.`);
            render();
            saveState();
          } catch (error) {
            setStatus(`Could not sell ${item.name}: ${error.message}`);
          }
        };

        const button = document.createElement("button");
        button.type = "button";
        button.className = "button";
        button.textContent = "Sell";
        button.disabled = item.value === 0;
        button.addEventListener("click", async () => {
          if (item.value === 0) return;
          const count = state.currencyInventory[item.id];
          if (count > 3) {
            const quantityToSell = await promptSellQuantity(item, count);
            if (quantityToSell !== null) {
              sellMaterialCount(quantityToSell);
            }
          } else {
            sellMaterialCount(1);
          }
        });

        stackedContainer.append(
          createTextElement("span", "bag-sale-value", `Value: ${numberFormat.format(item.value)}`),
          button
        );
        actions.append(stackedContainer);
        row.append(actions);
      }

      if (actions.children.length > 0) {
        row.append(actions);
      }

      return row;
    },
  );

}

function renderShop() {
  elements.refreshShop.disabled = state.currencyBalance < SHOP_REFRESH_COST;
  elements.shopList.replaceChildren();
  state.shopOffers.forEach((lootId, offerIndex) => {
    const item = content.loot.find((loot) => loot.id === lootId);
    const card = document.createElement("article");
    card.className = "panel shop-item";
    const details = createTextElement("div", "shop-item-details", "");
    const title = createTextElement("h3", `loot-rarity rarity-${item.rarity.toLowerCase()}`, item.name);
    title.append(createTextElement("span", "shop-owned-count", ` (Owned: ${numberFormat.format(state.lootInventory[item.id] ?? 0)})`));
    details.append(
      title,
      createTextElement("p", "muted", `${item.slot ? `${item.slot}` : "Consumable"} · ${lootEffectText(item)}`),
    );
    const actions = createTextElement("div", "shop-item-actions", "");
    actions.append(createTextElement("span", "shop-price", `Price: ${numberFormat.format(item.value)}`));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";
    button.textContent = "Buy";
    button.disabled = state.currencyBalance < item.value;
    button.addEventListener("click", () => {
      try {
        if (!buyShopItem(state, content, offerIndex)) {
          setStatus(`Not enough Souls to buy ${item.name}.`);
          return;
        }
        setStatus(`${item.name} added to your Bag.`);
        render();
        saveState();
      } catch (error) {
        setStatus(`Could not buy ${item.name}: ${error.message}`);
      }
    });
    actions.append(button);
    card.append(details, actions);
    elements.shopList.append(card);
  });
}

let activeCraftItem = null;
let selectedCraftLootId = null;

elements.craftDialog.addEventListener("close", () => {
  if (elements.craftDialog.returnValue === "craft" && selectedCraftLootId && activeCraftItem) {
    try {
      if ((state.currencyInventory[activeCraftItem.id] ?? 0) < 1) {
        setStatus(`You no longer have ${activeCraftItem.name}.`);
        return;
      }
      state.currencyInventory[activeCraftItem.id] -= 1;
      if (state.currencyInventory[activeCraftItem.id] === 0) {
        delete state.currencyInventory[activeCraftItem.id];
      }

      addLootToBag(state, content, selectedCraftLootId);
      const craftedItem = content.loot.find((l) => l.id === selectedCraftLootId);
      setStatus(`Successfully crafted ${craftedItem ? craftedItem.name : "item"}!`);
      render();
      saveState();
    } catch (error) {
      setStatus(`Could not craft item: ${error.message}`);
    }
  }
  activeCraftItem = null;
  selectedCraftLootId = null;
});

elements.refreshShop.addEventListener("click", () => {
  try {
    if (!refreshShop(state, content)) {
      setStatus(`Refreshing the Shop costs ${SHOP_REFRESH_COST} Souls.`);
      return;
    }
    setStatus(`Shop offers refreshed for ${SHOP_REFRESH_COST} Souls.`);
    render();
    saveState();
  } catch (error) {
    setStatus(`Could not refresh the Shop: ${error.message}`);
  }
});

function renderCheatLoot() {
  elements.cheatLootList.replaceChildren();

  // -- GOD MODE TOGGLE BUTTON ---
  const godModeButton = document.createElement("button");
  godModeButton.type = "button";
  godModeButton.className = "button secondary";
  godModeButton.textContent = `God Mode: ${state.godMode ? "ON" : "OFF"}`;
  godModeButton.addEventListener("click", () => {
    state.godMode = !state.godMode;
    godModeButton.textContent = `God Mode: ${state.godMode ? "ON" : "OFF"}`;
    setStatus(`God Mode is now ${state.godMode ? "ON" : "OFF"}.`);
    render();
    saveState();
  });
  elements.cheatLootList.append(godModeButton);

  // --- REMOVE ITEM CHEAT DROPDOWN ---
  const removeContainer = document.createElement("div");
  removeContainer.className = "cheat-remove-section";
  removeContainer.style.cssText = "margin-top: 16px; display: flex; flex-direction: column; gap: 8px;";
  
  const removeLabel = document.createElement("label");
  removeLabel.textContent = "Remove Item / Material from Inventory:";
  
  const removeSelect = document.createElement("select");
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select an item to remove...";
  defaultOption.disabled = true;
  defaultOption.selected = true;
  removeSelect.appendChild(defaultOption);

  // Gather all items and materials currently in inventory
  const inventoryItems = [];

  for (const [lootId, count] of Object.entries(state.lootInventory ?? {})) {
    if (count > 0) {
      const item = content.loot.find((l) => l.id === lootId);
      if (item) inventoryItems.push({ id: item.id, name: item.name, type: "loot", count });
    }
  }

  for (const [matId, count] of Object.entries(state.currencyInventory ?? {})) {
    if (count > 0) {
      const material = content.materials.find((m) => m.id === matId);
      if (material) inventoryItems.push({ id: material.id, name: material.name, type: "material", count });
    }
  }

  // Sort alphabetically by name
  inventoryItems.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of inventoryItems) {
    const option = document.createElement("option");
    option.value = `${entry.type}:${entry.id}`;
    option.textContent = `${entry.name} (×${entry.count})`;
    removeSelect.appendChild(option);
  }

  removeSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    if (!val) return;
    const [type, id] = val.split(":");
    
    if (type === "loot") {
      delete state.lootInventory[id];
      state.newLootIds = state.newLootIds.filter((itemKey) => itemKey !== id);
      setStatus(`Removed loot item from inventory.`);
    } else if (type === "material") {
      delete state.currencyInventory[id];
      setStatus(`Removed material from inventory.`);
    }

    renderCheatLoot();
    render();
    saveState();
  });

  removeContainer.append(removeLabel, removeSelect);
  elements.cheatLootList.append(removeContainer);

  // --- GRANT ITEM DROPDOWNS (Items, Weapons, Armor, Materials) ---
  const weaponSlots = new Set(["hand", "two-hand", "offhand"]);
  
  const consumableItems = content.loot
    .filter((item) => item.slot === "")
    .sort((a, b) => a.name.localeCompare(b.name));
    
  const weaponItems = content.loot
    .filter((item) => weaponSlots.has(item.slot.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
    
  const armorItems = content.loot
    .filter((item) => item.slot !== "" && !weaponSlots.has(item.slot.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
    
  const materialItems = [...content.materials]
    .sort((a, b) => a.name.localeCompare(b.name));

  const categories = [
    { label: "Grant Consumable Item:", items: consumableItems, isMaterial: false },
    { label: "Grant Weapon:", items: weaponItems, isMaterial: false },
    { label: "Grant Armor:", items: armorItems, isMaterial: false },
    { label: "Grant Material:", items: materialItems, isMaterial: true },
  ];

  for (const cat of categories) {
    const container = document.createElement("div");
    container.style.cssText = "margin-top: 14px; display: flex; flex-direction: column; gap: 6px;";

    const label = document.createElement("label");
    label.textContent = cat.label;

    const select = document.createElement("select");
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "Select an item to add...";
    defaultOpt.disabled = true;
    defaultOpt.selected = true;
    select.appendChild(defaultOpt);

    for (const item of cat.items) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      select.appendChild(option);
    }

    select.addEventListener("change", (e) => {
      const id = e.target.value;
      if (!id) return;

      try {
        if (cat.isMaterial) {
          const material = content.materials.find((m) => m.id === id);
          if (material) {
            state.currencyInventory[material.id] = (state.currencyInventory[material.id] ?? 0) + 1;
            setStatus(`${material.name} added to your Bag for free.`);
          }
        } else {
          addLootToBag(state, content, id);
          const item = content.loot.find((l) => l.id === id);
          setStatus(`${item ? item.name : "Item"} added to your Bag for free.`);
        }
        renderCheatLoot();
        render();
        saveState();
      } catch (error) {
        setStatus(`Could not add item: ${error.message}`);
      }
    });

    container.append(label, select);
    elements.cheatLootList.append(container);
  }
}

function saveState() {
  if (resetting) {
    return false;
  }
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    saveErrorShown = false;
    return true;
  } catch (error) {
    if (!saveErrorShown) {
      setStatus(`Could not save progress in this browser: ${error.message}`);
      saveErrorShown = true;
    }
    return false;
  }
}

function closeMenu() {
  elements.siteMenu.hidden = true;
  elements.menuToggle.setAttribute("aria-expanded", "false");
  elements.menuToggle.setAttribute("aria-label", "Open menu");
  lastTickAt = Date.now();
}

function selectBagTab(tab) {
  const previousTab = state.activeBagTab || "items";

  // Clear new loot tags when switching to another tab
  if (previousTab !== tab) {
    const weaponSlots = new Set(["hand", "two-hand", "offhand"]);

    if (previousTab === "weapons" && state && content) {
      state.newLootIds = (state.newLootIds ?? []).filter((id) => {
        const item = content.loot.find((l) => l.id === id);
        return !item || !weaponSlots.has(item.slot.toLowerCase());
      });
    } else if (previousTab === "armor" && state && content) {
      state.newLootIds = (state.newLootIds ?? []).filter((id) => {
        const item = content.loot.find((l) => l.id === id);
        return !item || item.slot === "" || weaponSlots.has(item.slot.toLowerCase());
      });
    } else if (previousTab === "materials" && state && content) {
      state.seenMaterials = state.seenMaterials || {};
      for (const item of content.materials) {
        if ((state.currencyInventory[item.id] ?? 0) > 0) {
          state.seenMaterials[item.id] = true;
        }
      }
    }
    state.activeBagTab = tab;
  }

  const tabs = [
    ["items", elements.bagItemsTab, elements.bagItemsPanel],
    ["weapons", elements.bagWeaponsTab, elements.bagWeaponsPanel],
    ["armor", elements.bagArmorTab, elements.bagArmorPanel],
    ["materials", elements.bagMaterialsTab, elements.bagMaterialsPanel],
  ];
  for (const [name, button, panel] of tabs) {
    const selected = name === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    panel.hidden = !selected;
  }

  render();
  saveState();
}

// Add inside updateBagTabIndicators function or render flow
function updateBagTabIndicators() {
  if (!content || !state) return;

  const weaponSlots = new Set(["hand", "two-hand", "offhand"]);
  const hasNewWeapon = (state.newLootIds ?? []).some((id) => {
    const item = content.loot.find((l) => l.id === id);
    return item && weaponSlots.has(item.slot.toLowerCase());
  });

  const hasNewArmor = (state.newLootIds ?? []).some((id) => {
    const item = content.loot.find((l) => l.id === id);
    return item && item.slot !== "" && !weaponSlots.has(item.slot.toLowerCase());
  });

  state.seenMaterials = state.seenMaterials || {};
  const hasNewMaterial = content.materials.some((item) => {
    const count = state.currencyInventory[item.id] ?? 0;
    return count > 0 && !state.seenMaterials[item.id];
  });

  const setIndicator = (button, show) => {
    let indicator = button.querySelector(".tab-indicator");
    if (show) {
      if (!indicator) {
        indicator = document.createElement("span");
        indicator.className = "tab-indicator";
        indicator.textContent = "*";
        button.appendChild(indicator);
      }
    } else {
      if (indicator) {
        indicator.remove();
      }
    }
  };

  setIndicator(elements.bagWeaponsTab, hasNewWeapon);
  setIndicator(elements.bagArmorTab, hasNewArmor);
  setIndicator(elements.bagMaterialsTab, hasNewMaterial);
}

function renderCombatTab() {
  for (const [tab, name] of [
    [elements.fightTab, "fight"],
    [elements.prepareTab, "prepare"],
    [elements.shopTab, "shop"],
  ]) {
    const selected = state.activeTab === name;
    if (name === "shop") {
      const shopLocked = !state.shopUnlocked;
      tab.setAttribute("aria-disabled", String(shopLocked));
      tab.title = "";
      elements.shopLockedTooltip.hidden = true;
    }
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  elements.monsterSection.hidden = state.activeTab !== "fight";
  elements.bossShopHint.hidden = state.bossShopHintDismissed;
  elements.prepareMonster.hidden = state.activeTab !== "prepare" || state.awaitingMonsterSelection;
  elements.shopSection.hidden = state.activeTab !== "shop";
}

async function selectCombatTab(tabName) {
  if (tabName === "shop" && !state.shopUnlocked) {
    elements.shopLockedTooltip.hidden = false;
    window.clearTimeout(shopTooltipTimeout);
    shopTooltipTimeout = window.setTimeout(() => {
      elements.shopLockedTooltip.hidden = true;
    }, 3000);
    return;
  }
  const previousTab = state.activeTab;
  if (tabName === previousTab) {
    return;
  }
  if (previousTab === "shop") {
    state.shopVisited = true;
  }

  if (tabName === "fight" && state.shopVisited) {
    // Confirm you want to leave the shop
    const confirmed = await showConfirmDialog(
      "Leave Shop?",
      "It will be locked until the next Boss is defeated.",
      "Yes",
      "Cancel",
      true // marks confirm button as danger/red style
    );

    if (!confirmed) {
      return;
    }

    state.shopUnlocked = false;
    state.shopVisited = false;
    state.bossShopHintDismissed = true;
  }
  if (tabName === "shop") {
    state.shopVisited = true;
  }
  if (tabName === "prepare") {
    state.prepareViewed = true;
  } else if (tabName === "fight" && previousTab === "prepare" && state.prepareViewed) {
    state.newLootIds = [];
    state.prepareViewed = false;
  }
  
  state.activeTab = tabName;
  lastTickAt = Date.now();
  renderCombatTab();
  setStatus(tabName === "fight"
    ? state.targetMonsterId === null
      ? "Choose an enemy to begin fighting."
      : state.awaitingMonsterSelection
        ? "Boss defeated! Choose a new enemy to continue."
        : "Fight mode. Combat continues automatically."
    : state.awaitingMonsterSelection
      ? `${tabName === "shop" ? "Shop" : "Prepare"} mode. Combat paused.`
      : `${tabName === "shop" ? "Shop" : "Prepare"} mode. Combat continues automatically.`);
  render();
  saveState();
}

function showPage(page) {
  if (page === "cheat" && !DEBUG_ENABLED) {
    return;
  }
  currentPage = page;
  lastTickAt = Date.now();
  closeMenu();
  if (page === "profile") {
    elements.restoreKey.value = createRestoreKey(state);
    elements.copyStatus.textContent = "";
    elements.profilePage.querySelector("h2").focus();
  } else if (page === "help") {
    elements.helpPage.querySelector("h2").focus();
  } else if (page === "settings") {
    elements.settingsPage.querySelector("h2").focus();
  } else if (page === "cheat") {
    elements.cheatPage.querySelector("h2").focus();
  }
  render();
  saveState();
}

elements.fightTab.addEventListener("click", () => selectCombatTab("fight"));
elements.playerStatsToggle.addEventListener("click", () => {
  playerStatsCollapsed = !playerStatsCollapsed;
  render();
});
for (const [toggle, isCollapsed, setCollapsed] of [
  [elements.gearToggle, () => gearCollapsed, (value) => { gearCollapsed = value; }],
  [elements.bagToggle, () => bagCollapsed, (value) => { bagCollapsed = value; }],
]) {
  toggle.addEventListener("click", () => {
    setCollapsed(!isCollapsed());
    render();
  });
}
elements.prepareTab.addEventListener("click", () => selectCombatTab("prepare"));
elements.shopTab.addEventListener("click", () => selectCombatTab("shop"));
const combatTabs = [
  [elements.fightTab, "fight"],
  [elements.prepareTab, "prepare"],
  [elements.shopTab, "shop"],
];
for (const [tab, tabName] of combatTabs) {
  tab.addEventListener("keydown", (event) => {
    const currentIndex = combatTabs.findIndex(([candidate]) => candidate === tab);
    let nextIndex;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex + combatTabs.length - 1) % combatTabs.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % combatTabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = combatTabs.length - 1;
    }
    if (nextIndex !== undefined) {
      event.preventDefault();
      const [nextTab, nextTabName] = combatTabs[nextIndex];
      selectCombatTab(nextTabName);
      nextTab.focus();
    }
  });
}

elements.bagItemsTab.addEventListener("click", () => selectBagTab("items"));
elements.bagWeaponsTab.addEventListener("click", () => selectBagTab("weapons"));
elements.bagArmorTab.addEventListener("click", () => selectBagTab("armor"));
elements.bagMaterialsTab.addEventListener("click", () => selectBagTab("materials"));
const bagTabs = [
  [elements.bagItemsTab, "items"],  
  [elements.bagWeaponsTab, "weapons"],
  [elements.bagArmorTab, "armor"],
  [elements.bagMaterialsTab, "materials"],
];

function tick() {
  const now = Date.now();
  const elapsed = Math.max(0, (now - lastTickAt) / 1000);
  lastTickAt = now;
  const wasAwaitingMonsterSelection = state.awaitingMonsterSelection;
  const previousTargetId = state.targetMonsterId;
  const previousTargetKills = state.kills[previousTargetId] ?? 0;
  const gameIsActive = currentPage === "game" && elements.siteMenu.hidden;
  if (gameIsActive) {
    advanceGame(state, content, elapsed * gameSpeed);

    // if new monster activated, we will update the bg image
    checkAndUpdateBackground();
  }

  // Triggered when a Boss is defeated (entering awaiting selection state)
  if (!wasAwaitingMonsterSelection && state.awaitingMonsterSelection) {
    setStatus(state.targetMonsterId === null
      ? "Fled from combat. Choose a enemy when you're ready to fight again."
      : "Boss defeated! Choose a new enemy to continue.");
    populateMonsterSelect();
    render();
    saveState();
    return; // early out for special case: boss kill
  }

  // Triggered when switching targets after an enemy kill
  if (previousTargetId !== state.targetMonsterId) {
    const previousTarget = content.monsters.find((monster) => monster.id === previousTargetId);
    const nextTarget = content.monsters.find((monster) => monster.id === state.targetMonsterId);
    setStatus(`${monsterDisplayName(previousTarget)} defeated. Now fighting ${monsterDisplayName(nextTarget)}.`);
    populateMonsterSelect(); // IMPORTANT!
  }
  // Triggered when a normal monster is defeated and loops
  else if (previousTargetId && state.kills[previousTargetId] > previousTargetKills) {
    const defeatedMonster = content.monsters.find((monster) => monster.id === previousTargetId);
    setStatus(`${monsterDisplayName(defeatedMonster)} defeated.`);
    populateMonsterSelect();
  }

  render();
  if (now - state.updatedAt >= 15_000) {
    saveState();
  }
}

elements.monsterToggleBtn.addEventListener("click", () => {
  const isExpanded = elements.monsterToggleBtn.getAttribute("aria-expanded") === "true";
  elements.monsterToggleBtn.setAttribute("aria-expanded", !isExpanded);
  elements.monsterMenu.hidden = isExpanded;
});

elements.monsterMenu.addEventListener("click", (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item || item.classList.contains("is-disabled")) return;

  elements.monsterMenu.hidden = true;
  elements.monsterToggleBtn.setAttribute("aria-expanded", "false");

  const selectedValue = item.dataset.value;
  if (!selectedValue) return;

  const wasPaused = state.awaitingMonsterSelection;
  const wasAwaitingMonsterSelection = state.awaitingMonsterSelection;
  const hadPendingTarget = state.pendingTargetMonsterId !== null;
  const selectedMonster = content.monsters.find((monster) => monster.id === selectedValue);
  
  selectMonster(state, content, selectedValue);
  lastTickAt = Date.now();
  setStatus(wasAwaitingMonsterSelection
    ? `Now fighting ${monsterDisplayName(selectedMonster)}.`
    : state.pendingTargetMonsterId
      ? `Finish ${monsterDisplayName(content.monsters.find((monster) => monster.id === state.targetMonsterId))} first. Switching to ${monsterDisplayName(selectedMonster)} next.`
      : wasPaused
        ? "Target changed. Combat remains paused."
        : hadPendingTarget && state.targetMonsterId === selectedMonster.id
          ? "Target change canceled."
          : "Target changed. Combat continues automatically.");
  render();
  saveState();
});

// Close dropdown if clicking outside
document.addEventListener("click", (e) => {
  if (!elements.monsterDropdown.contains(e.target)) {
    elements.monsterMenu.hidden = true;
    elements.monsterToggleBtn.setAttribute("aria-expanded", "false");
  }
});

elements.revivePlayer.addEventListener("click", () => {
  const lootId = elements.revivePlayer.dataset.lootId;
  if (!lootId || !revivePlayer(state, content)) {
    setStatus("The Revive item is no longer available in your Bag.");
    render();
    return;
  }
  lastTickAt = Date.now();
  setStatus("Revived. Automatic combat continues.");
  render();
  saveState();
});

elements.menuToggle.addEventListener("click", () => {
  const opening = elements.siteMenu.hidden;
  elements.siteMenu.hidden = !opening;
  elements.menuToggle.setAttribute("aria-expanded", String(opening));
  elements.menuToggle.setAttribute("aria-label", opening ? "Close menu" : "Open menu");
  lastTickAt = Date.now();
});

elements.siteMenu.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (button) {
    showPage(button.dataset.page);
  }
});

elements.swapInventoryOrder.addEventListener("change", () => {
  const isSwapped = elements.swapInventoryOrder.checked;
  elements.inventoryGrid.classList.toggle("is-swapped", isSwapped);
  try {
    localStorage.setItem(INVENTORY_ORDER_KEY, String(isSwapped));
  } catch (error) {
    setStatus(`Could not save this setting: ${error.message}`);
  }
});

elements.hideStatusText.addEventListener("change", () => {
  const shouldHideStatus = elements.hideStatusText.checked;
  elements.statusPanel.hidden = shouldHideStatus;
  try {
    localStorage.setItem(HIDE_STATUS_TEXT_KEY, String(shouldHideStatus));
  } catch (error) {
    setStatus(`Could not save this setting: ${error.message}`);
  }
});

elements.settingsAutoHealEnabled.addEventListener("change", () => {
  state.autoHealEnabled = elements.settingsAutoHealEnabled.checked;
  localStorage.setItem("idlemon-auto-heal-enabled", String(state.autoHealEnabled));
  saveState();
});

elements.settingsAutoHealThreshold.addEventListener("change", () => {
  const val = parseInt(elements.settingsAutoHealThreshold.value, 10);
  state.autoHealThreshold = Number.isNaN(val) || val < 1 ? 1 : val;
  elements.settingsAutoHealThreshold.value = state.autoHealThreshold;
  localStorage.setItem("idlemon-auto-heal-threshold", String(state.autoHealThreshold));
  saveState();
});

document.querySelectorAll(".return-to-game").forEach((button) => {
  button.addEventListener("click", () => showPage("game"));
});

document.addEventListener("click", (event) => {
  if (!elements.siteMenu.hidden
      && !elements.siteMenu.contains(event.target)
      && !elements.menuToggle.contains(event.target)) {
    closeMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.siteMenu.hidden) {
    closeMenu();
    elements.menuToggle.focus();
  }
});

elements.copyRestoreKey.addEventListener("click", async () => {
  const key = createRestoreKey(state);
  elements.restoreKey.value = key;
  try {
    await navigator.clipboard.writeText(key);
    elements.copyStatus.textContent = "Restore key copied.";
  } catch (error) {
    elements.restoreKey.focus();
    elements.restoreKey.select();
    elements.copyStatus.textContent = `Could not access the clipboard: ${error.message}. Select and copy the key above.`;
  }
});

elements.resetGame.hidden = false;//!DEBUG_ENABLED;
elements.cheatMenuItem.hidden = !DEBUG_ENABLED;
async function restartGame() {
  // Confirm with user first
  const confirmed = await showConfirmDialog(
    "Confirm Reset",
    "Are you sure you want to reset? All progress will be lost.",
    "Yes",
    "Cancel",
    true // marks confirm button as danger/red style
  );

  if (confirmed) {
    resetAndReload();
  }
}

function resetAndReload() {
  try {
    resetSavedGame();
    resetting = true;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    location.reload();
  } catch (error) {
    if (!elements.errorPanel.hidden) {
      elements.errorMessage.textContent = `Could not reset the saved game: ${error.message}`;
    } else {
      setStatus(`Could not start over: ${error.message}`);
    }
  }
}

elements.resetGame.addEventListener("click", restartGame);
elements.startOver.addEventListener("click", restartGame);

async function startGame() {
  try {
    // Keep main game hidden initially while loading assets
    elements.game.hidden = true;
    elements.errorPanel.hidden = true;
    elements.menuToggle.hidden = true;

    // Check if a save file already exists in localStorage
    const hasExistingSave = localStorage.getItem(SAVE_KEY) !== null;
    const introText = [
      "Thou who art Undead, art chosen...",
      "In thine exodus from the Undead Asylum,",
      "maketh pilgrimage to the land of Ancient Lords...",
      "When thou ringeth the Bell of Awakening,",
      "the fate of the Undead thou shalt know..."
    ];
    elements.splashText.innerHTML = hasExistingSave
      ? "Humanity Restored"
      : introText.join("<br>");

    content = await loadGameContent(SHEET_CSV_URLS);
    try {
      const savedSwapOrder = localStorage.getItem(INVENTORY_ORDER_KEY);
      elements.swapInventoryOrder.checked = savedSwapOrder === null || savedSwapOrder === "true";

      const savedHideStatusText = localStorage.getItem(HIDE_STATUS_TEXT_KEY);
      elements.hideStatusText.checked = savedHideStatusText === null || savedHideStatusText === "true";
      
      elements.settingsAutoHealEnabled.checked = localStorage.getItem("idlemon-auto-heal-enabled") === "true";
      const savedThreshold = localStorage.getItem("idlemon-auto-heal-threshold");
      if (savedThreshold !== null) {
        const parsed = parseInt(savedThreshold, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          elements.settingsAutoHealThreshold.value = parsed;
        }
      }
      
      const savedGameSpeed = Number(localStorage.getItem(GAME_SPEED_KEY));
      gameSpeed = GAME_SPEEDS.includes(savedGameSpeed) ? savedGameSpeed : 1;
    } catch (error) {
      setStatus(`Could not load this setting: ${error.message}`);
    }

    const restoreKey = window.location.hash;
    const isRestore = restoreKey.startsWith("#save=");
    const serialized = localStorage.getItem(SAVE_KEY);
    if (isRestore) {
      state = restoreStateFromKey(restoreKey, content, Date.now());
    } else {
      state = serialized === null
        ? createInitialState(content, Date.now())
        : parseSavedState(serialized, content);
    }

    // Apply standalone settings directly to state AFTER it is initialized
    elements.inventoryGrid.classList.toggle("is-swapped", elements.swapInventoryOrder.checked);
    elements.statusPanel.hidden = elements.hideStatusText.checked;
    
    state.autoHealEnabled = elements.settingsAutoHealEnabled.checked;
    const thresholdVal = parseInt(elements.settingsAutoHealThreshold.value, 10);
    if (!Number.isNaN(thresholdVal) && thresholdVal > 0) {
      state.autoHealThreshold = thresholdVal;
    }
    elements.settingsAutoHealEnabled.checked = Boolean(state.autoHealEnabled);
    elements.settingsAutoHealThreshold.value = state.autoHealThreshold ?? 100;

    elements.gameSpeed.value = String(GAME_SPEEDS.indexOf(gameSpeed));
    elements.gameSpeedValue.value = `${gameSpeed}×`;

    // Helper function to handle fading out, revealing the game, and starting the loop
    const dismissSplash = () => {
      elements.splashScreen.classList.add("fade-out");
      window.setTimeout(() => {
        elements.splashScreen.hidden = true;
        elements.errorPanel.hidden = true;
        elements.game.hidden = false;
        elements.menuToggle.hidden = false;
        elements.resetGame.hidden = false;
        elements.cheatMenuItem.hidden = !DEBUG_ENABLED;

        const now = Date.now();
        const offlineSeconds = isRestore || serialized === null
          || state.awaitingMonsterSelection
          ? 0
          : Math.min(MAX_OFFLINE_SECONDS, Math.max(0, (now - state.updatedAt) / 1000));
        const wasAwaitingMonsterSelection = state.awaitingMonsterSelection;
        if (offlineSeconds >= 1) {
          advanceGame(state, content, offlineSeconds * gameSpeed);
          setStatus(state.awaitingMonsterSelection && !wasAwaitingMonsterSelection
            ? "Boss defeated! Choose a new enemy to continue."
            : `Welcome back, chosen undead.`);
        } else {
          setStatus(state.awaitingMonsterSelection
            ? "Boss defeated! Choose a new enemy to continue."
            : "Combat and rewards happen automatically.");
        }
        const startupWarnings = [...(state.recoveryWarnings ?? []), ...content.warnings];
        if (startupWarnings.length > 0) {
          const warningSummary = startupWarnings.slice(0, 2).join(" ");
          const remainingWarnings = startupWarnings.length - 2;
          setStatus(`${warningSummary}${remainingWarnings > 0 ? ` And ${remainingWarnings} more sheet issue(s) were repaired.` : ""}`);
        }

        populateMonsterSelect();
        checkAndUpdateBackground();

        state.updatedAt = now;
        lastTickAt = now;
        renderCombatTab();
        renderCheatLoot();
        render();

        const saved = saveState();
        if (isRestore && saved) {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        }
        window.setInterval(tick, 1000);
        window.addEventListener("pagehide", saveState);
      }, 1000);
    };

    const splashWaitTime = 2000;
    if (hasExistingSave) {
      window.setTimeout(dismissSplash, splashWaitTime);
    } else {
      // New game: Show START button, wait for click
      elements.splashStartBtn.hidden = true;
      
      window.setTimeout(() => {
        elements.splashStartBtn.hidden = false; // Make the button visible

        elements.splashStartBtn.onclick = () => {
          elements.splashStartBtn.disabled = true;
          dismissSplash();
        };
      }, splashWaitTime+2000);
    }
  } catch (error) {
    if (elements.splashScreen) elements.splashScreen.hidden = true;
    showError(error.message);
  }
}

startGame();
