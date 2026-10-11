import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceGame,
  addLootToBag,
  buyShopItem,
  canUseLoot,
  createShopOffers,
  createRestoreKey,
  createInitialState,
  equipLoot,
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
} from "../src/game.js";

const content = {
  skills: [
    { id: "attack", name: "Attack", effect: "damage_flat" },
    { id: "defend", name: "Defend", effect: "defense_flat" },
    { id: "heal", name: "Heal", effect: "heal" },
    { id: "revive", name: "Revive", effect: "revive" },
    { id: "flee", name: "Flee", effect: "flee" },
  ],
  monsters: [
    { id: "slime", name: "Slime", type: "Normal", level: 1, damage: 4, health: 2, xp: 30, unlock_level: 1, lootChance: 100, materialCount: 1, lootNames: ["Jelly"], materialNames: ["Bottlecap"] },
    { id: "wolf", name: "Wolf", type: "Normal", level: 2, damage: 0, health: 5, xp: 40, unlock_level: 2, lootChance: 100, lootNames: [], materialNames: [] },
  ],
  loot: [
    { id: "jelly", name: "Jelly", description: "Sticky", skill: "Attack", slot: "Hand", value: 3, effectValue: 2 },
    { id: "feather", name: "Feather", description: "Quick", skill: "Attack", slot: "Hand", value: 1, effectValue: 1 },
    { id: "pan", name: "Pan", description: "Sturdy", skill: "Defend", slot: "Offhand", value: 5, effectValue: 2 },
    { id: "revive", name: "Revive Charm", description: "Revives once", skill: "Revive", slot: "Charm", value: 0, effectValue: 0 },
    { id: "healing-potion", name: "Healing Potion", description: "Restore HP", skill: "Heal", slot: "", value: 0, effectValue: 30 },
    { id: "revive-potion", name: "Revive Potion", description: "Return from Game Over", skill: "Revive", slot: "", value: 0, effectValue: 0 },
    { id: "smoke-bomb", name: "Smoke Bomb", description: "Escape combat", skill: "Flee", slot: "", value: 0, effectValue: 0 },
  ],
  materials: [
    { id: "bottlecap", name: "Bottlecap", value: 1, uses: "Shop" },
  ],
};

test("combat is automatic and grants rewards, loot, and level-ups", () => {
  const state = createInitialState(content, 100);
  advanceGame(state, content, 2);

  assert.equal(state.kills.slime, 1);
  assert.equal(state.lootInventory.jelly, 1);
  assert.deepEqual(state.newLootIds, ["jelly"]);
  assert.equal(state.currencyInventory.bottlecap, 1);
  assert.equal(state.currencyBalance, 0);
  assert.equal(state.level, 2);
  assert.equal(state.xp, 5);
  assert.equal(state.hp, 96);
  assert.equal(state.gameOver, false);
  assert.equal(getPlayerStats(state, content).damage, 1);
  assert.equal(getPlayerStats(state, content).defense, 0);
});

test("monster loot uses one per-kill Chance roll while other rewards are unchanged", () => {
  const lootContent = {
    ...content,
    monsters: content.monsters.map((monster) => ({ ...monster, lootChance: 50 })),
  };
  const failedDrop = createInitialState(lootContent, 100);
  advanceGame(failedDrop, lootContent, 2, () => 0.5);
  assert.equal(failedDrop.lootInventory.jelly, undefined);
  assert.equal(failedDrop.currencyInventory.bottlecap, 1);
  assert.equal(failedDrop.kills.slime, 1);
  assert.deepEqual(failedDrop.lastLootCheck, {
    monsterName: "Slime",
    roll: 50,
    chance: 50,
    dropped: false,
  });

  const successfulDrop = createInitialState(lootContent, 100);
  advanceGame(successfulDrop, lootContent, 2, () => 0.49);
  assert.equal(successfulDrop.lootInventory.jelly, 1);
  assert.equal(successfulDrop.newLootIds.includes("jelly"), true);
  assert.deepEqual(successfulDrop.lastLootCheck, {
    monsterName: "Slime",
    roll: 49,
    chance: 50,
    dropped: true,
  });

  const guaranteedLoot = createInitialState(content, 100);
  advanceGame(guaranteedLoot, content, 2, () => 0.99);
  assert.equal(guaranteedLoot.lootInventory.jelly, 1);
});

test("debug loot grant adds an item to the bag and marks it as new", () => {
  const state = createInitialState(content);

  addLootToBag(state, content, "smoke-bomb");

  assert.equal(state.lootInventory["smoke-bomb"], 1);
  assert.deepEqual(state.newLootIds, ["smoke-bomb"]);
});

test("selling loot removes one bag copy and adds its Value to Currency", () => {
  const state = createInitialState(content);
  state.lootInventory.jelly = 2;
  state.newLootIds = ["jelly"];

  assert.equal(sellLoot(state, content, "jelly"), true);
  assert.equal(state.lootInventory.jelly, 1);
  assert.equal(state.currencyBalance, content.loot.find((item) => item.id === "jelly").value);
  assert.deepEqual(state.newLootIds, ["jelly"]);
  assert.equal(sellLoot(state, content, "jelly"), true);
  assert.equal(state.lootInventory.jelly, undefined);
  assert.deepEqual(state.newLootIds, []);
  assert.equal(sellLoot(state, content, "jelly"), false);
});

test("selling all of a loot stack removes the whole stack and grants its total value", () => {
  const state = createInitialState(content);
  state.lootInventory.jelly = 6;
  state.newLootIds = ["jelly"];

  assert.equal(sellLoot(state, content, "jelly", 6), true);
  assert.equal(state.lootInventory.jelly, undefined);
  assert.equal(state.currencyBalance, 6 * content.loot.find((item) => item.id === "jelly").value);
  assert.deepEqual(state.newLootIds, []);
  assert.equal(sellLoot(state, content, "jelly", 6), false);
});

test("Material drops stay in the bag until sold for Currency in the Shop", () => {
  const state = createInitialState(content);
  advanceGame(state, content, 2);
  assert.equal(state.currencyInventory.bottlecap, 1);
  assert.equal(state.currencyBalance, 0);

  assert.equal(sellMaterial(state, content, "bottlecap"), true);
  assert.equal(state.currencyInventory.bottlecap, undefined);
  assert.equal(state.currencyBalance, 1);
  assert.equal(sellMaterial(state, content, "bottlecap"), false);
});

test("defeating a monster grants its Mat Count for each listed Material", () => {
  const materialCountContent = {
    ...content,
    monsters: content.monsters.map((monster) => ({ ...monster, materialCount: 4 })),
  };
  const state = createInitialState(materialCountContent);

  advanceGame(state, materialCountContent, 2);

  assert.equal(state.currencyInventory.bottlecap, 4);
});

test("selling all of a Material stack grants its total value", () => {
  const state = createInitialState(content);
  state.currencyInventory.bottlecap = 6;

  assert.equal(sellMaterial(state, content, "bottlecap", 6), true);
  assert.equal(state.currencyInventory.bottlecap, undefined);
  assert.equal(state.currencyBalance, 6);
});

test("monster selection drives player choices and skills apply passively", () => {
  const state = createInitialState(content);
  assert.equal(getPlayerStats(state, content).damage, 1);
  assert.throws(() => selectMonster(state, content, "wolf"), /not unlocked/);
  state.level = 2;
  selectMonster(state, content, "wolf");
  assert.equal(state.targetMonsterId, "slime");
  assert.equal(state.pendingTargetMonsterId, "wolf");
  assert.equal(state.monsterHp, 2);
  advanceGame(state, content, 1);
  assert.equal(state.targetMonsterId, "slime");
  advanceGame(state, content, 1);
  assert.equal(state.targetMonsterId, "wolf");
  assert.equal(state.pendingTargetMonsterId, null);
  assert.equal(state.monsterHp, 5);
  assert.equal(getPlayerStats(state, content).damage, 1);
});

test("pending monster selection persists and can be canceled by selecting the current monster", () => {
  const state = createInitialState(content);
  state.level = 2;
  selectMonster(state, content, "wolf");
  const restored = parseSavedState(JSON.stringify(state), content);
  assert.equal(restored.targetMonsterId, "slime");
  assert.equal(restored.pendingTargetMonsterId, "wolf");

  selectMonster(state, content, "slime");
  assert.equal(state.pendingTargetMonsterId, null);
});

test("Shop offers are unique and purchases spend Currency, grant loot, and replace only the bought offer", () => {
  const shopContent = {
    ...content,
    loot: content.loot.map((item) => item.slot === "" ? { ...item, value: 1 } : item),
  };
  const state = createInitialState(shopContent);
  const offers = createShopOffers(shopContent, () => 0);
  assert.equal(offers.length, 2);
  assert.notEqual(offers[0], offers[1]);
  assert.ok(offers.every((id) => shopContent.loot.find((item) => item.id === id).slot === ""));
  state.shopOffers = offers;
  const purchasedId = offers[0];
  const otherOffer = offers[1];
  const purchasedItem = shopContent.loot.find((item) => item.id === purchasedId);
  const ownedBefore = state.lootInventory[purchasedId] ?? 0;

  assert.equal(buyShopItem(state, shopContent, 0, () => 0), false);
  assert.deepEqual(state.shopOffers, offers);
  state.shopUnlocked = true;
  assert.equal(buyShopItem(state, shopContent, 0, () => 0), false);
  state.currencyBalance = purchasedItem.value;
  assert.equal(buyShopItem(state, shopContent, 0, () => 0), true);
  assert.equal(state.currencyBalance, 0);
  assert.equal(state.lootInventory[purchasedId], ownedBefore + 1);
  assert.deepEqual(state.newLootIds, [purchasedId]);
  assert.notEqual(state.shopOffers[0], otherOffer);
  assert.notEqual(state.shopOffers[0], state.shopOffers[1]);
  assert.ok(state.shopOffers.every((id) => shopContent.loot.find((item) => item.id === id).slot === ""));
});

test("saved Shop offers with a Slot are replaced with slotless items", () => {
  const state = createInitialState(content);
  state.shopOffers = ["jelly", "pan"];

  const restored = parseSavedState(JSON.stringify(state), content);

  assert.ok(restored.shopOffers.every((id) => content.loot.find((item) => item.id === id).slot === ""));
  assert.notEqual(restored.shopOffers[0], restored.shopOffers[1]);
});

test("saved progress is repaired when loot or materials are removed from the sheets", () => {
  const changedContent = {
    ...content,
    loot: content.loot.filter((item) => item.id !== "jelly"),
    materials: [],
  };
  const state = createInitialState(content);
  state.lootInventory.jelly = 2;
  state.lootInventory.feather = 1;
  state.gear.Hand = "jelly";
  state.currencyInventory.bottlecap = 3;
  state.shopOffers = ["jelly", "feather"];
  state.newLootIds = ["jelly", "feather"];
  state.kills.removedMonster = 4;
  state.kills.slime = 2;

  const restored = parseSavedState(JSON.stringify(state), changedContent);

  assert.deepEqual(restored.lootInventory, { feather: 1 });
  assert.deepEqual(restored.gear, {});
  assert.deepEqual(restored.currencyInventory, {});
  assert.deepEqual(restored.newLootIds, ["feather"]);
  assert.deepEqual(restored.kills, { slime: 2 });
  assert.ok(restored.shopOffers.every((id) => changedContent.loot.some((item) => item.id === id && item.slot === "")));
});

test("invalid saved loot entries are discarded without losing valid loot or progress", () => {
  const state = createInitialState(content);
  state.lootInventory = {
    jelly: 2,
    feather: -1,
    "removed-loot": 3,
  };
  const originalLevel = state.level;

  const restored = parseSavedState(JSON.stringify(state), content);

  assert.deepEqual(restored.lootInventory, { jelly: 2 });
  assert.equal(restored.level, originalLevel);
  assert.equal(restored.recoveryWarnings.length, 2);

  state.lootInventory = "invalid";
  const recovered = parseSavedState(JSON.stringify(state), content);
  assert.deepEqual(recovered.lootInventory, {});
  assert.match(recovered.recoveryWarnings[0], /Cleared invalid saved loot inventory/);
});

test("saved target is reassigned when its monster is removed from the sheet", () => {
  const state = createInitialState(content);
  state.level = 5;
  state.xp = 42;
  const changedContent = {
    ...content,
    monsters: [
      ...content.monsters.filter((monster) => monster.id !== "slime"),
      { id: "new-monster", name: "New Monster", type: "Normal", level: 1, damage: 1, health: 10, xp: 10, unlock_level: 1, lootChance: 100, lootNames: [], materialNames: [] },
    ],
  };

  const restored = parseSavedState(JSON.stringify(state), changedContent);

  assert.equal(restored.targetMonsterId, "wolf");
  assert.equal(restored.monsterHp, 5);
  assert.equal(restored.level, state.level);
  assert.equal(restored.xp, state.xp);
});

test("refreshing the Shop costs five Currency and replaces both offers", () => {
  const state = createInitialState(content);
  const oldOffers = [...state.shopOffers];
  state.shopUnlocked = true;
  state.currencyBalance = SHOP_REFRESH_COST - 1;

  assert.equal(refreshShop(state, content, () => 0), false);
  assert.equal(state.currencyBalance, SHOP_REFRESH_COST - 1);
  assert.deepEqual(state.shopOffers, oldOffers);

  state.currencyBalance = SHOP_REFRESH_COST;
  assert.equal(refreshShop(state, content, () => 0.5), true);
  assert.equal(state.currencyBalance, 0);
  assert.deepEqual(state.shopOffers, createShopOffers(content, () => 0.5));
  assert.notEqual(state.shopOffers[0], state.shopOffers[1]);
});

test("defeating a Boss unlocks the Shop and pauses until a different monster is selected", () => {
  const bossContent = {
    ...content,
    monsters: [
      ...content.monsters,
      { id: "boss", name: "Boss", type: "Boss", level: 1, damage: 0, health: 1, xp: 1, unlock_level: 1, lootNames: [], materialNames: [] },
    ],
  };
  const state = createInitialState(bossContent);
  assert.equal(state.shopUnlocked, false);
  assert.equal(buyShopItem(state, bossContent, 0), false);

  selectMonster(state, bossContent, "boss");
  advanceGame(state, bossContent, 1);
  assert.equal(state.kills.boss, 1);
  assert.equal(state.shopUnlocked, true);
  assert.equal(state.awaitingMonsterSelection, true);
  assert.equal(state.activeTab, "fight");
  assert.equal(state.prepareViewed, false);
  assert.equal(state.monsterHp, 0);

  const killsAfterBoss = { ...state.kills };
  advanceGame(state, bossContent, 5);
  assert.deepEqual(state.kills, killsAfterBoss);
  assert.equal(state.activeTab, "fight");
  assert.equal(state.awaitingMonsterSelection, true);
  const pausedSave = parseSavedState(JSON.stringify(state), bossContent);
  assert.equal(pausedSave.activeTab, "fight");
  assert.equal(pausedSave.awaitingMonsterSelection, true);
  assert.throws(() => selectMonster(state, bossContent, "boss"), /different monster/);

  selectMonster(state, bossContent, "slime");
  assert.equal(state.awaitingMonsterSelection, false);
  assert.equal(state.activeTab, "fight");
  assert.equal(state.monsterHp, 2);

  const restored = parseSavedState(JSON.stringify(state), bossContent);
  assert.equal(restored.shopUnlocked, true);
  assert.equal(restored.awaitingMonsterSelection, false);
  assert.deepEqual(restored.shopOffers, state.shopOffers);
});

test("repairs saved Boss defeat health state instead of blocking startup", () => {
  const bossContent = {
    ...content,
    monsters: [
      ...content.monsters,
      { id: "boss", name: "Boss", type: "Boss", level: 1, damage: 0, health: 10, xp: 10, unlock_level: 1, lootNames: [], materialNames: [] },
    ],
  };
  const defeated = createInitialState(bossContent);
  defeated.targetMonsterId = "boss";
  defeated.monsterHp = 0;
  defeated.shopUnlocked = true;
  defeated.awaitingMonsterSelection = true;

  const inconsistentBossState = { ...defeated, monsterHp: 10 };
  const restored = parseSavedState(JSON.stringify(inconsistentBossState), bossContent);

  assert.equal(restored.awaitingMonsterSelection, true);
  assert.equal(restored.monsterHp, 0);
  assert.equal(restored.shopUnlocked, true);
  assert.ok(restored.recoveryWarnings.includes("Repaired saved Boss defeat state."));

  const missingPauseFlag = parseSavedState(JSON.stringify({
    ...defeated,
    awaitingMonsterSelection: false,
  }), bossContent);
  assert.equal(missingPauseFlag.awaitingMonsterSelection, true);
  assert.equal(missingPauseFlag.monsterHp, 0);
});

test("damage starts at one and equipped loot activates its skill", () => {
  const state = createInitialState(content);
  assert.equal(getPlayerStats(state, content).damage, 1);

  advanceGame(state, content, 2);
  assert.equal(state.lootInventory.jelly, 1);
  assert.equal(equipLoot(state, content, "jelly"), true);
  assert.equal(state.gear.Hand, "jelly");
  assert.equal(state.lootInventory.jelly, undefined);
  assert.equal(getPlayerStats(state, content).damage, 4);

  state.lootInventory.feather = 1;
  state.lootInventory.pan = 1;
  equipLoot(state, content, "feather");
  equipLoot(state, content, "pan");
  assert.equal(state.gear.Hand, "feather");
  assert.equal(state.gear.Offhand, "pan");
  assert.equal(state.lootInventory.jelly, 1);
  assert.equal(getPlayerStats(state, content).damage, 7);
  assert.equal(getPlayerStats(state, content).defense, 2);

  unequipLoot(state, content, "Hand");
  assert.equal(state.gear.Hand, undefined);
  assert.equal(state.lootInventory.feather, 1);
  assert.equal(getPlayerStats(state, content).damage, 6);
});

test("Magic gear and consumables deal damage like Attack", () => {
  const magicContent = {
    ...content,
    skills: [...content.skills, { id: "magic", name: "Magic", effect: "damage_flat" }],
    loot: [
      ...content.loot,
      { id: "magic-robe", name: "Magic Robe", skill: "Magic", slot: "Head", value: 4, effectValue: 0 },
      { id: "magic-orb", name: "Magic Orb", skill: "Magic", slot: "", value: 0, effectValue: 2 },
    ],
  };
  const state = createInitialState(magicContent);

  state.lootInventory["magic-robe"] = 1;
  equipLoot(state, magicContent, "magic-robe");
  assert.equal(getPlayerStats(state, magicContent).damage, 5);

  state.monsterHp = 5;
  state.lootInventory["magic-orb"] = 1;
  assert.equal(canUseLoot(state, magicContent, "magic-orb"), true);
  assert.equal(useLoot(state, magicContent, "magic-orb"), true);
  assert.equal(state.monsterHp, 3);
  assert.equal(state.lootInventory["magic-orb"], undefined);
});

test("slotless loot applies its skill once and is consumed", () => {
  const consumableContent = {
    ...content,
    loot: [
      ...content.loot,
      { id: "damage-potion", name: "Damage Potion", skill: "Attack", slot: "", value: 0, effectValue: 1 },
      { id: "shield-potion", name: "Shield Potion", skill: "Defend", slot: "", value: 0, effectValue: 2 },
    ],
  };
  const state = createInitialState(consumableContent);
  state.lootInventory["damage-potion"] = 1;
  assert.equal(useLoot(state, consumableContent, "damage-potion"), true);
  assert.equal(state.monsterHp, 1);
  assert.equal(state.lootInventory["damage-potion"], undefined);

  state.level = 2;
  selectMonster(state, consumableContent, "wolf");
  state.lootInventory["shield-potion"] = 1;
  assert.equal(useLoot(state, consumableContent, "shield-potion"), true);
  assert.equal(state.nextHitDefense, 2);
  assert.equal(parseSavedState(JSON.stringify(state), consumableContent).nextHitDefense, 2);
  advanceGame(state, consumableContent, 1);
  assert.equal(state.hp, 98);
  assert.equal(state.nextHitDefense, 0);
  assert.equal(state.lootInventory["shield-potion"], undefined);
});

test("Heal restores its Effect up to max HP and consumes a potion only when useful", () => {
  const state = createInitialState(content);
  state.hp = 80;
  state.lootInventory["healing-potion"] = 2;

  assert.equal(canUseLoot(state, content, "healing-potion"), true);
  assert.equal(useLoot(state, content, "healing-potion"), true);
  assert.equal(state.hp, 100);
  assert.equal(state.lootInventory["healing-potion"], 1);
  assert.equal(canUseLoot(state, content, "healing-potion"), false);
  assert.equal(useLoot(state, content, "healing-potion"), false);
  assert.equal(state.lootInventory["healing-potion"], 1);
});

test("Flee consumes its item, pauses combat, and returns without an active monster", () => {
  const state = createInitialState(content);
  advanceGame(state, content, 0.5);
  state.lootInventory["smoke-bomb"] = 1;

  assert.equal(useLoot(state, content, "smoke-bomb"), true);
  assert.equal(state.targetMonsterId, null);
  assert.equal(state.pendingTargetMonsterId, null);
  assert.equal(state.monsterHp, 0);
  assert.equal(state.awaitingMonsterSelection, true);
  assert.equal(state.activeTab, "prepare");
  assert.equal(state.attackRemainder, 0);
  assert.equal(state.lootInventory["smoke-bomb"], undefined);

  const restored = parseSavedState(JSON.stringify(state), content);
  assert.equal(restored.targetMonsterId, null);
  assert.equal(restored.activeTab, "prepare");
  advanceGame(restored, content, 20);
  assert.equal(restored.targetMonsterId, null);

  selectMonster(restored, content, "slime");
  assert.equal(restored.targetMonsterId, "slime");
  assert.equal(restored.awaitingMonsterSelection, false);
  assert.equal(restored.activeTab, "fight");
  assert.equal(restored.monsterHp, 2);
});

test("fractional elapsed time is retained between automatic attacks", () => {
  const state = createInitialState(content);
  advanceGame(state, content, 0.5);
  assert.equal(state.monsterHp, 2);
  assert.equal(state.attackRemainder, 0.5);
  advanceGame(state, content, 0.5);
  assert.equal(state.monsterHp, 1);
  assert.equal(state.attackRemainder, 0);
});

test("monster damage can end a run and Revive loot restores the player", () => {
  const lethalContent = {
    ...content,
    monsters: content.monsters.map((monster, index) => index === 0
      ? { ...monster, health: 100, damage: 50 }
      : monster),
  };
  const state = createInitialState(lethalContent);
  advanceGame(state, lethalContent, 2);

  assert.equal(state.hp, 0);
  assert.equal(state.gameOver, true);
  const killsAtGameOver = { ...state.kills };
  advanceGame(state, lethalContent, 10);
  assert.deepEqual(state.kills, killsAtGameOver);

  state.lootInventory["revive-potion"] = 1;
  assert.equal(useLoot(state, lethalContent, "revive-potion"), true);
  assert.equal(state.hp, 100);
  assert.equal(state.gameOver, false);
  assert.equal(state.lootInventory["revive-potion"], undefined);
});

test("offline simulation is capped at eight hours and saves are validated", () => {
  const capped = createInitialState(content);
  const exact = createInitialState(content);
  advanceGame(capped, content, MAX_OFFLINE_SECONDS + 60);
  advanceGame(exact, content, MAX_OFFLINE_SECONDS);
  assert.deepEqual(capped.kills, exact.kills);

  const restored = parseSavedState(JSON.stringify(exact), content);
  assert.equal(restored.level, exact.level);
  assert.throws(() => parseSavedState("{", content), /not valid JSON/);
});

test("prepared mode is preserved in saves", () => {
  const state = createInitialState(content);
  state.isPreparing = true;
  const restored = parseSavedState(JSON.stringify(state), content);
  assert.equal(restored.isPreparing, true);

  delete state.isPreparing;
  assert.equal(parseSavedState(JSON.stringify(state), content).isPreparing, false);
});

test("reset removes only the IdleMon local save", () => {
  const removed = [];
  resetSavedGame({
    removeItem(key) {
      removed.push(key);
    },
  });

  assert.deepEqual(removed, [SAVE_KEY]);
});

test("restore keys preserve progress and validate restored state", () => {
  const state = createInitialState(content, 100);
  advanceGame(state, content, 2);
  const key = createRestoreKey(state, 500);
  const restored = restoreStateFromKey(key, content, 700);

  assert.equal(restored.level, state.level);
  assert.equal(restored.xp, state.xp);
  assert.deepEqual(restored.kills, state.kills);
  assert.deepEqual(restored.lootInventory, state.lootInventory);
  assert.deepEqual(restored.gear, state.gear);
  assert.deepEqual(restored.currencyInventory, state.currencyInventory);
  assert.equal(restored.updatedAt, 700);
  assert.throws(() => restoreStateFromKey("#save=not-a-valid-key", content), /restore key/i);
});
