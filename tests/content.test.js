import assert from "node:assert/strict";
import test from "node:test";
import { loadGameContent } from "../src/content.js";
import { parseCsv } from "../src/csv.js";

const csvByCategory = {
  skills: "Name\nAttack\nDefend\nHeal\nRevive\nFlee\nMagic",
  monsters: "Name,Type,Level,Damage,Loot,Materials,Mat Count,Chance\nGreen,Normal,1,4,Feather; Spatula,Bottlecap,3,65\nBoss,Boss,2,10,,,,",
  loot: "Name,Slot,Value,Skill,Skill Effect,Rarity\nFeather,Hand,1,Attack,1,Common\nSpatula,Hand,3,Attack,2,Rare\nSheet Pan,Offhand,5,Defend,2,Uncommon\nDamage Potion,,0,Attack,3,Mythic\nMagic Wand,Head,2,Magic,3,Rare",
  materials: "Name,Value,Uses\nBottlecap,1,Shop",
};

test("parses quoted commas, escaped quotes, and line breaks", () => {
  assert.deepEqual(parseCsv('name,description\r\nSlime,"A ""sticky"", green\nfriend"\r\n'), [
    { name: "Slime", description: 'A "sticky", green\nfriend' },
  ]);
});

test("rejects malformed and duplicate-column CSV", () => {
  assert.throws(() => parseCsv('name,description\nSlime,"unfinished'), /not closed/);
  assert.throws(() => parseCsv("id,id\none,two"), /duplicate column/);
});

test("loads and validates all published worksheet CSVs", async () => {
  const urls = Object.fromEntries(Object.keys(csvByCategory).map((category) => [
    category,
    `https://sheets.example/${category}`,
  ]));
  const calls = [];
  const content = await loadGameContent(urls, async (url) => {
    calls.push(url);
    const category = new URL(url).pathname.slice(1);
    return { ok: true, text: async () => csvByCategory[category] };
  });

  assert.equal(calls.length, 4);
  assert.equal(content.skills[0].id, "attack");
  assert.equal(content.skills[0].name, "Attack");
  assert.equal(content.skills[0].effect, "damage_flat");
  assert.equal(content.monsters[0].id, "green");
  assert.equal(content.monsters[0].type, "Normal");
  assert.equal(content.monsters[1].type, "Boss");
  assert.equal(content.monsters[0].health, 10);
  assert.equal(content.monsters[0].xp, 10);
  assert.equal(content.monsters[0].damage, 4);
  assert.equal(content.monsters[0].lootChance, 65);
  assert.equal(content.monsters[0].materialCount, 3);
  assert.deepEqual(content.monsters[0].lootNames, ["Feather", "Spatula"]);
  assert.deepEqual(content.monsters[0].materialNames, ["Bottlecap"]);
  assert.equal(content.loot[0].value, 1);
  assert.equal(content.loot[0].effectValue, 1);
  assert.equal(content.loot[0].slot, "Hand");
  assert.equal(content.loot[0].rarity, "Common");
  assert.equal(content.loot[3].slot, "");
  assert.equal(content.materials[0].uses, "Shop");
  assert.equal(content.skills[1].effect, "defense_flat");
  assert.equal(content.skills[2].effect, "heal");
  assert.equal(content.skills[3].effect, "revive");
  assert.equal(content.skills[4].effect, "flee");
  assert.equal(content.skills[5].effect, "damage_flat");
  assert.equal(content.loot[2].description, "Associated skill: Defend");
  assert.equal(content.loot[4].skill, "Magic");
  assert.equal(content.loot[4].effectValue, 3);
});

test("treats loot linked to a removed skill as collectible loot", async () => {
  const urls = Object.fromEntries(Object.keys(csvByCategory).map((category) => [
    category,
    `https://sheets.example/${category}`,
  ]));
  const withoutDefend = {
    ...csvByCategory,
    skills: csvByCategory.skills.replace("\nDefend", ""),
  };
  const content = await loadGameContent(urls, async (url) => {
    const category = new URL(url).pathname.slice(1);
    return { ok: true, text: async () => withoutDefend[category] };
  });

  assert.equal(content.loot[2].skill, "");
  assert.equal(content.loot[2].description, "Collectible loot item");
  assert.match(content.warnings[0], /missing skill "Defend"/);
});

test("defaults an omitted Monsters Chance column to 100 percent and validates supplied values", async () => {
  const urls = Object.fromEntries(Object.keys(csvByCategory).map((category) => [
    category,
    `https://sheets.example/${category}`,
  ]));
  const loadWithMonsters = (monsters) => loadGameContent(urls, async (url) => {
    const category = new URL(url).pathname.slice(1);
    return { ok: true, text: async () => category === "monsters" ? monsters : csvByCategory[category] };
  });

  const withoutChance = await loadWithMonsters(
    "Name,Type,Level,Damage,Loot,Materials\nGreen,Normal,1,4,Feather; Spatula,Bottlecap",
  );
  assert.equal(withoutChance.monsters[0].lootChance, 100);
  assert.equal(withoutChance.monsters[0].materialCount, 1);
  const withZeroMaterials = await loadWithMonsters(
    "Name,Type,Level,Damage,Loot,Materials,Mat Count,Chance\nGreen,Normal,1,4,Feather,Bottlecap,0,100",
  );
  assert.equal(withZeroMaterials.monsters[0].materialCount, 0);
  await assert.rejects(
    loadWithMonsters("Name,Level,Damage,Loot,Materials,Chance\nGreen,1,4,Feather,,101"),
    /Chance.*percentage from 0 to 100/,
  );
  await assert.rejects(
    loadWithMonsters("Name,Level,Damage,Loot,Mat Count\nGreen,1,4,Feather,1.5"),
    /Mat Count.*whole number/,
  );
});

test("accepts a Monsters sheet without a Type column and defaults Type to blank", async () => {
  const urls = Object.fromEntries(Object.keys(csvByCategory).map((category) => [
    category,
    `https://sheets.example/${category}`,
  ]));
  const content = await loadGameContent(urls, async (url) => {
    const category = new URL(url).pathname.slice(1);
    const text = category === "monsters"
      ? csvByCategory.monsters.replace(
        "Name,Type,Level,Damage,Loot,Materials,Mat Count,Chance\nGreen,Normal,1,4,Feather; Spatula,Bottlecap,3,65\nBoss,Boss,2,10,,,,",
        "Name,Level,Damage,Loot,Materials,Mat Count,Chance\nGreen,1,4,Feather; Spatula,Bottlecap,3,65\nBoss,2,10,,,1,",
      )
      : csvByCategory[category];
    return { ok: true, text: async () => text };
  });

  assert.equal(content.monsters[0].type, "");
  assert.equal(content.monsters[1].type, "");
  assert.equal(content.monsters[0].lootChance, 65);
  assert.equal(content.monsters[0].materialCount, 3);
});

test("validates supported Skills names and numeric Loot effect strength", async () => {
  const urls = Object.fromEntries(Object.keys(csvByCategory).map((category) => [
    category,
    `https://sheets.example/${category}`,
  ]));
  const loadWithSheet = (categoryName, csv) => loadGameContent(urls, async (url) => {
    const category = new URL(url).pathname.slice(1);
    return { ok: true, text: async () => category === categoryName ? csv : csvByCategory[category] };
  });

  await assert.rejects(
    loadWithSheet("skills", "Name\nDamage"),
    /Skill "Damage" is not supported/,
  );
  await assert.rejects(
    loadWithSheet("loot", "Name,Slot,Value,Skill,Skill Effect,Rarity\nItem,Hand,1,Attack,strong,Common"),
    /"Skill Effect" must be a number/,
  );
});

test("reports missing sheet URLs and ignores stale worksheet references", async () => {
  await assert.rejects(
    loadGameContent({ skills: "", monsters: "", loot: "", materials: "" }),
    /published CSV URLs.*skills, monsters, loot, materials/,
  );

  const broken = { ...csvByCategory, monsters: csvByCategory.monsters.replace("Feather", "Missing") };
  const content = await loadGameContent(
    Object.fromEntries(Object.keys(broken).map((category) => [category, `https://sheets.example/${category}`])),
    async (url) => ({ ok: true, text: async () => broken[new URL(url).pathname.slice(1)] }),
  );
  assert.deepEqual(content.monsters[0].lootNames, ["Spatula"]);
  assert.match(content.warnings[0], /Monster "Green" refers to missing loot "Missing"/);
});
