import { DEBUG_ENABLED, SHEET_CSV_URLS } from "../config.js";
import { loadGameContent } from "./content.js";
import {
  advanceGame,
  addLootToBag,
  buyShopItem,
  canUseLoot,
  createRestoreKey,
  createInitialState,
  equipLoot,
  experienceForNextLevel,
  getPlayerStats,
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
  status: document.querySelector("#game-status"),
  resetGame: document.querySelector("#reset-game"),
  menuToggle: document.querySelector("#menu-toggle"),
  siteMenu: document.querySelector("#site-menu"),
  cheatMenuItem: document.querySelector("#cheat-menu-item"),
  profilePage: document.querySelector("#profile-page"),
  helpPage: document.querySelector("#help-page"),
  settingsPage: document.querySelector("#settings-page"),
  swapInventoryOrder: document.querySelector("#swap-inventory-order"),
  hideStatusText: document.querySelector("#hide-status-text"),
  statusPanel: document.querySelector(".status-panel"),
  gameSpeed: document.querySelector("#game-speed"),
  gameSpeedValue: document.querySelector("#game-speed-value"),
  inventoryGrid: document.querySelector(".inventory-grid"),
  cheatPage: document.querySelector("#cheat-page"),
  cheatLootList: document.querySelector("#cheat-loot-list"),
  restoreKey: document.querySelector("#restore-key"),
  copyRestoreKey: document.querySelector("#copy-restore-key"),
  copyStatus: document.querySelector("#copy-status"),
  errorPanel: document.querySelector("#error-panel"),
  errorMessage: document.querySelector("#error-message"),
  resetErrorGame: document.querySelector("#reset-error-game"),
  game: document.querySelector("#game"),
  fightTab: document.querySelector("#fight-tab"),
  prepareTab: document.querySelector("#prepare-tab"),
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
  playerStatsPanel: document.querySelector(".player-stats-panel"),
  monsterSection: document.querySelector("#monster-section"),
  activeMonsterCard: document.querySelector("#active-monster-card"),
  bossKilledCard: document.querySelector("#boss-killed-card"),
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
  armor: document.querySelector("#player-armor"),
  damage: document.querySelector("#player-damage"),
  playerStatsToggle: document.querySelector("#player-stats-toggle"),
  playerStatsDetails: document.querySelector("#player-stats-details"),
  playerStatsCompact: document.querySelector("#player-stats-compact"),
  compactPlayerLevel: document.querySelector("#compact-player-level"),
  compactPlayerHp: document.querySelector("#compact-player-hp"),
  compactPlayerArmor: document.querySelector("#compact-player-armor"),
  compactPlayerDamage: document.querySelector("#compact-player-damage"),
  monsterSelect: document.querySelector("#monster-select"),
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
  bagArmorTab: document.querySelector("#bag-armor-tab"),
  bagToggle: document.querySelector("#bag-toggle"),
  bagContent: document.querySelector("#bag-content"),
  bagShopNote: document.querySelector("#bag-shop-note"),
  bagItemsTab: document.querySelector("#bag-items-tab"),
  bagMaterialsTab: document.querySelector("#bag-materials-tab"),
  bagArmorPanel: document.querySelector("#bag-armor-panel"),
  bagItemsPanel: document.querySelector("#bag-items-panel"),
  bagMaterialsPanel: document.querySelector("#bag-materials-panel"),
  bagArmorList: document.querySelector("#bag-armor-list"),
  bagItemsList: document.querySelector("#bag-items-list"),
  bagMaterialsList: document.querySelector("#bag-materials-list"),
  gearToggle: document.querySelector("#gear-toggle"),
  gearContent: document.querySelector("#gear-content"),
};

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const GEAR_SLOTS = ["Hand", "Offhand", "Head", "Chest", "Hands", "Feet"];
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

function showError(message) {
  elements.game.hidden = true;
  elements.errorPanel.hidden = false;
  elements.errorMessage.textContent = message;
  elements.status.textContent = "Game unavailable.";
}

function setStatus(message) {
  window.clearTimeout(statusTimeout);
  const version = ++statusVersion;
  statusMessage = message;
  elements.status.textContent = message;
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
  return skill ? `${item.skill} (${numberFormat.format(item.effectValue)})` : item.skill;
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

function render() {
  const stats = getPlayerStats(state, content);
  const xpNeeded = experienceForNextLevel(state.level);
  renderCombatTab();
  elements.game.hidden = currentPage !== "game" || state.gameOver;
  elements.gameOver.hidden = currentPage !== "game" || !state.gameOver;
  elements.profilePage.hidden = currentPage !== "profile";
  elements.helpPage.hidden = currentPage !== "help";
  elements.settingsPage.hidden = currentPage !== "settings";
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
  elements.hp.textContent = numberFormat.format(state.hp);
  elements.armor.textContent = numberFormat.format(stats.defense);
  elements.damage.textContent = numberFormat.format(stats.damage);
  elements.compactPlayerLevel.textContent = numberFormat.format(state.level);
  elements.compactPlayerHp.textContent = numberFormat.format(state.hp);
  elements.compactPlayerArmor.textContent = numberFormat.format(stats.defense);
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
  if (!elements.profilePage.hidden && document.activeElement !== elements.restoreKey) {
    elements.restoreKey.value = createRestoreKey(state);
  }

  const target = content.monsters.find((monster) => monster.id === state.targetMonsterId);
  const availableMonsters = content.monsters.filter((monster) => monster.unlock_level <= state.level);
  elements.monsterSelect.replaceChildren();
  if (state.awaitingMonsterSelection) {
    const prompt = document.createElement("option");
    prompt.value = "";
    prompt.textContent = target ? "Choose a different monster..." : "Choose a monster...";
    prompt.disabled = Boolean(target);
    prompt.selected = true;
    elements.monsterSelect.append(prompt);
  }
  for (const monster of content.monsters) {
    const option = document.createElement("option");
    option.value = monster.id;
    const isPendingTarget = monster.id === state.pendingTargetMonsterId;
    const displayName = monsterDisplayName(monster);
    const monsterLabel = monster.unlock_level <= state.level
      ? `${displayName} (LVL ${monster.level})`
      : `${displayName} (Unlocks at P-LVL ${monster.unlock_level})`;
    option.textContent = isPendingTarget ? `${monsterLabel} (after current monster)` : monsterLabel;
    option.disabled = monster.unlock_level > state.level
      || (state.awaitingMonsterSelection && monster.id === state.targetMonsterId);
    option.selected = state.awaitingMonsterSelection
      ? false
      : monster.id === (state.pendingTargetMonsterId ?? state.targetMonsterId);
    elements.monsterSelect.append(option);
  }

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
    const lootRewards = [...target.lootNames];
    const itemRewards = [
      ...lootRewards,
      ...(target.materialNames ?? target.currencyNames ?? []),
    ];
    const bossRewards = [
      ...lootRewards,
      ...(target.materialNames ?? target.currencyNames ?? []).map(
        (name) => `${numberFormat.format(target.materialCount ?? 1)} ${name}`,
      ),
    ];
    elements.monsterLevel.textContent = `Level ${target.level}`;
    elements.bossKilledName.textContent = target.name;
    const bossRewardsText = bossRewards.length > 0 ? `\n• ${bossRewards.join("\n• ")}` : "";
    elements.bossKilledReward.textContent = `Rewards: ${numberFormat.format(target.xp)} XP${bossRewardsText}`;
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
    elements.monsterSelect.value = "";
    elements.defeatedCount.textContent = `Defeated: ${numberFormat.format(Object.values(state.kills).reduce((total, count) => total + count, 0))} monsters`;
    elements.unlockedCount.textContent = `${numberFormat.format(availableMonsters.length)} of ${numberFormat.format(content.monsters.length)} unlocked`;
  }

  const totalKills = Object.values(state.kills).reduce((total, count) => total + count, 0);
  elements.gameOverStats.textContent = `Monsters defeated: ${numberFormat.format(totalKills)}\nPlayer level: ${numberFormat.format(state.level)}`;
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
    elements.reviveMessage.textContent = `${reviveItem.name} in your Bag can bring you back.`;
    elements.revivePlayer.textContent = `Use ${reviveItem.name} to revive`;
    elements.revivePlayer.dataset.lootId = reviveItem.id;
  }

  renderList(elements.gearList, GEAR_SLOTS, "", (slot) => {
    const item = content.loot.find((loot) => loot.id === state.gear[slot]);
    const row = document.createElement("article");
    row.className = "list-item gear-item";
    row.append(
      createTextElement("strong", "gear-slot", slot),
    );
    const itemColumn = createTextElement("div", "gear-equipped-item", "");
    if (item) {
      itemColumn.append(
        createTextElement("span", `item-title loot-rarity rarity-${item.rarity.toLowerCase()}`, item.name),
        createTextElement("span", "muted item-description", `Value ${numberFormat.format(item.value)} · ${lootEffectText(item)}`),
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
    const isNewLootVisible = state.activeTab === "prepare" && state.newLootIds.includes(item.id);
    row.className = `list-item loot-item${isNewLootVisible ? " is-new-loot" : ""}`;
    row.append(
      createTextElement("div", "skill-copy", ""),
      createTextElement("span", "badge", `×${state.lootInventory[item.id]}`),
    );
    const isShop = state.activeTab === "shop";
    row.firstElementChild.append(
      createTextElement("h3", `item-title loot-rarity rarity-${item.rarity.toLowerCase()}`, item.name),
      createTextElement("p", "muted item-description", `${item.slot ? `${item.slot}` : "Consumable"}${isShop ? "" : ` · Value ${numberFormat.format(item.value)}`} · ${lootEffectText(item)}`),
    );
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";
    button.textContent = isShop ? "Sell" : item.slot ? "Equip" : "Use";
    button.disabled = !isShop && item.slot === "" && !canUseLoot(state, content, item.id);
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
          ? `Sold ${count} ${item.name} for ${numberFormat.format(totalValue)} Currency.`
          : `${item.name} sold for ${numberFormat.format(totalValue)} Currency.`);
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
          await sellLootCount(1);
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
    if (isShop) {
      const actions = createTextElement("div", "bag-sale-actions", "");
      actions.append(createTextElement("span", "bag-sale-value", `Value: ${numberFormat.format(item.value)}`));
      actions.append(button);
      const count = state.lootInventory[item.id];
      if (count > 5) {
        const sellAllButton = document.createElement("button");
        sellAllButton.type = "button";
        sellAllButton.className = "button secondary";
        sellAllButton.textContent = "Sell All";
        sellAllButton.addEventListener("click", () => sellLootCount(count));
        actions.append(sellAllButton);
      }
      row.append(actions);
    } else {
      row.append(button);
    }
    return row;
  };
  renderList(
    elements.bagArmorList,
    bagLoot.filter((item) => item.slot !== ""),
    "No armor in your bag.",
    renderBagItem,
  );
  renderList(
    elements.bagItemsList,
    bagLoot.filter((item) => item.slot === ""),
    "No items in your bag.",
    renderBagItem,
  );
  renderList(
    elements.bagMaterialsList,
    content.materials.filter((item) => (state.currencyInventory[item.id] ?? 0) > 0),
    "No Materials in your bag.",
    (item) => {
      const row = document.createElement("article");
      row.className = "list-item loot-item";
      row.append(
        createTextElement("strong", "item-title", item.name),
        createTextElement("span", "badge", `×${state.currencyInventory[item.id]}`),
      );
      if (state.activeTab === "shop") {
        const actions = createTextElement("div", "bag-sale-actions", "");
        actions.append(createTextElement("span", "bag-sale-value", `Value: ${numberFormat.format(item.value)}`));
        const sellMaterialCount = (count) => {
          try {
            if (!sellMaterial(state, content, item.id, count)) {
              setStatus(`${item.name} is no longer in your Bag.`);
              render();
              return;
            }
            const totalValue = item.value * count;
            setStatus(count > 1
              ? `Sold ${count} ${item.name} for ${numberFormat.format(totalValue)} Currency.`
              : `${item.name} sold for ${numberFormat.format(totalValue)} Currency.`);
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
        button.addEventListener("click", () => sellMaterialCount(1));
        actions.append(button);
        const count = state.currencyInventory[item.id];
        if (count > 5) {
          const sellAllButton = document.createElement("button");
          sellAllButton.type = "button";
          sellAllButton.className = "button secondary";
          sellAllButton.textContent = "Sell All";
          sellAllButton.addEventListener("click", () => sellMaterialCount(count));
          actions.append(sellAllButton);
        }
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
          setStatus(`Not enough Currency to buy ${item.name}.`);
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

elements.refreshShop.addEventListener("click", () => {
  try {
    if (!refreshShop(state, content)) {
      setStatus(`Refreshing the Shop costs ${SHOP_REFRESH_COST} Currency.`);
      return;
    }
    setStatus(`Shop offers refreshed for ${SHOP_REFRESH_COST} Currency.`);
    render();
    saveState();
  } catch (error) {
    setStatus(`Could not refresh the Shop: ${error.message}`);
  }
});

function renderCheatLoot() {
  elements.cheatLootList.replaceChildren();
  for (const item of content.loot) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "list-item cheat-loot-item";
    button.append(
      createTextElement("strong", `loot-rarity rarity-${item.rarity.toLowerCase()}`, item.name),
      createTextElement(
        "span",
        "muted",
        `${item.slot ? `${item.slot}` : "Consumable"} · Value ${numberFormat.format(item.value)} · ${item.skill || "No associated skill"} · In Bag: ${state.lootInventory[item.id] ?? 0}`,
      ),
    );
    button.addEventListener("click", () => {
      try {
        addLootToBag(state, content, item.id);
        setStatus(`${item.name} added to your Bag for free.`);
        renderCheatLoot();
        render();
        saveState();
      } catch (error) {
        setStatus(`Could not add ${item.name}: ${error.message}`);
      }
    });
    elements.cheatLootList.append(button);
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
  const tabs = [
    ["armor", elements.bagArmorTab, elements.bagArmorPanel],
    ["items", elements.bagItemsTab, elements.bagItemsPanel],
    ["materials", elements.bagMaterialsTab, elements.bagMaterialsPanel],
  ];
  for (const [name, button, panel] of tabs) {
    const selected = name === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    panel.hidden = !selected;
  }
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
  elements.prepareMonster.hidden = state.activeTab !== "prepare" || state.awaitingMonsterSelection;
  elements.shopSection.hidden = state.activeTab !== "shop";
}

function selectCombatTab(tabName) {
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
  if (previousTab === "shop" && state.shopUnlocked
      && !window.confirm("Leaving the Shop will lock it. You cannot return until another Boss is defeated. Leave the Shop?")) {
    return;
  }
  if (previousTab === "shop") {
    state.shopUnlocked = false;
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
      ? "Choose a monster to begin fighting."
      : state.awaitingMonsterSelection
        ? "Boss defeated. Choose a new monster to continue."
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

elements.bagArmorTab.addEventListener("click", () => selectBagTab("armor"));
elements.bagItemsTab.addEventListener("click", () => selectBagTab("items"));
elements.bagMaterialsTab.addEventListener("click", () => selectBagTab("materials"));
const bagTabs = [
  [elements.bagArmorTab, "armor"],
  [elements.bagItemsTab, "items"],
  [elements.bagMaterialsTab, "materials"],
];
for (const [tab] of bagTabs) {
  tab.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const index = bagTabs.findIndex(([candidate]) => candidate === tab);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = bagTabs[(index + direction + bagTabs.length) % bagTabs.length];
      selectBagTab(next[1]);
      next[0].focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const targetTab = event.key === "Home" ? bagTabs[0] : bagTabs[bagTabs.length - 1];
      selectBagTab(targetTab[1]);
      targetTab[0].focus();
    }
  });
}

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
  }
  if (!wasAwaitingMonsterSelection && state.awaitingMonsterSelection) {
    setStatus(state.targetMonsterId === null
      ? "Fled from combat. Choose a monster when you're ready to fight again."
      : "Boss defeated! Choose a new monster to continue.");
    render();
    saveState();
    return;
  }
  if (previousTargetId !== state.targetMonsterId) {
    const previousTarget = content.monsters.find((monster) => monster.id === previousTargetId);
    const nextTarget = content.monsters.find((monster) => monster.id === state.targetMonsterId);
    setStatus(`${monsterDisplayName(previousTarget)} defeated. Now fighting ${monsterDisplayName(nextTarget)}.`);
  } else if (previousTargetId && state.kills[previousTargetId] > previousTargetKills) {
    const defeatedMonster = content.monsters.find((monster) => monster.id === previousTargetId);
    setStatus(`${monsterDisplayName(defeatedMonster)} defeated.`);
  }
  render();
  if (now - state.updatedAt >= 15_000) {
    saveState();
  }
}

elements.monsterSelect.addEventListener("change", () => {
  if (!elements.monsterSelect.value) {
    return;
  }
  const wasPaused = state.awaitingMonsterSelection;
  const wasAwaitingMonsterSelection = state.awaitingMonsterSelection;
  const hadPendingTarget = state.pendingTargetMonsterId !== null;
  const selectedMonster = content.monsters.find((monster) => monster.id === elements.monsterSelect.value);
  selectMonster(state, content, elements.monsterSelect.value);
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

elements.resetGame.hidden = !DEBUG_ENABLED;
elements.cheatMenuItem.hidden = !DEBUG_ENABLED;
function restartGame() {
  if (!window.confirm("Start over and clear all IdleMon progress in this browser?")) {
    return;
  }

  resetAndReload();
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
elements.resetErrorGame.addEventListener("click", resetAndReload);

async function startGame() {
  try {
    content = await loadGameContent(SHEET_CSV_URLS);
    try {
      elements.swapInventoryOrder.checked = localStorage.getItem(INVENTORY_ORDER_KEY) === "true";
      const savedHideStatusText = localStorage.getItem(HIDE_STATUS_TEXT_KEY);
      elements.hideStatusText.checked = savedHideStatusText === null || savedHideStatusText === "true";
      const savedGameSpeed = Number(localStorage.getItem(GAME_SPEED_KEY));
      gameSpeed = GAME_SPEEDS.includes(savedGameSpeed) ? savedGameSpeed : 1;
    } catch (error) {
      setStatus(`Could not load this setting: ${error.message}`);
    }
    elements.gameSpeed.value = String(GAME_SPEEDS.indexOf(gameSpeed));
    elements.gameSpeedValue.value = `${gameSpeed}×`;
    elements.inventoryGrid.classList.toggle("is-swapped", elements.swapInventoryOrder.checked);
    elements.statusPanel.hidden = elements.hideStatusText.checked;
    const now = Date.now();
    const restoreKey = window.location.hash;
    const isRestore = restoreKey.startsWith("#save=");
    const serialized = localStorage.getItem(SAVE_KEY);
    if (isRestore) {
      state = restoreStateFromKey(restoreKey, content, now);
    } else {
      state = serialized === null
        ? createInitialState(content, now)
        : parseSavedState(serialized, content);
    }

    const offlineSeconds = isRestore || serialized === null
      || state.awaitingMonsterSelection
      ? 0
      : Math.min(MAX_OFFLINE_SECONDS, Math.max(0, (now - state.updatedAt) / 1000));
    const wasAwaitingMonsterSelection = state.awaitingMonsterSelection;
    if (offlineSeconds >= 1) {
      advanceGame(state, content, offlineSeconds * gameSpeed);
      setStatus(state.awaitingMonsterSelection && !wasAwaitingMonsterSelection
        ? "Boss defeated! Choose a new monster to continue."
        : `Welcome back. ${numberFormat.format(offlineSeconds / 60)} minutes of offline progress applied.`);
    } else {
      setStatus(state.awaitingMonsterSelection
        ? "Boss defeated. Choose a new monster to continue."
        : "Combat and rewards happen automatically.");
    }
    const startupWarnings = [...(state.recoveryWarnings ?? []), ...content.warnings];
    if (startupWarnings.length > 0) {
      const warningSummary = startupWarnings.slice(0, 2).join(" ");
      const remainingWarnings = startupWarnings.length - 2;
      setStatus(`${warningSummary}${remainingWarnings > 0 ? ` And ${remainingWarnings} more sheet issue(s) were repaired.` : ""}`);
    }
    state.updatedAt = now;
    lastTickAt = now;
    renderCombatTab();
    elements.errorPanel.hidden = true;
    elements.game.hidden = false;
    elements.menuToggle.hidden = false;
    elements.resetGame.hidden = !DEBUG_ENABLED;
    elements.cheatMenuItem.hidden = !DEBUG_ENABLED;
    renderCheatLoot();
    render();
    const saved = saveState();
    if (isRestore && saved) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    window.setInterval(tick, 1000);
    window.addEventListener("pagehide", saveState);
  } catch (error) {
    showError(error.message);
  }
}

startGame();
