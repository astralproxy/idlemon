import { parseCsv } from "./csv.js";

const SKILL_ABILITIES = new Map([
  ["attack", "damage_flat"],
  ["magic", "damage_flat"],
  ["fire", "damage_flat"],
  ["lightning", "damage_flat"],
  ["poison", "damage_flat"],
  ["defend", "defense_flat"],
  ["heal", "heal"],
  ["revive", "revive"],
  ["flee", "flee"],
]);

export const LOOT_RARITIES = new Map([
  ["trash", "Trash"],
  ["common", "Common"],
  ["uncommon", "Uncommon"],
  ["rare", "Rare"],
  ["epic", "Epic"],
  ["legendary", "Legendary"],
  ["mythic", "Mythic"],
]);

// Exported array matching the exact map order (low to high)
export const RARITY_ORDER = [...LOOT_RARITIES.keys()];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function references(value, separator = /[;|]/) {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  const cleaned = value.trim().replace(/^["']|["']$/g, "");
  return cleaned.split(/,\s*|[;|]/).map((reference) => reference.trim()).filter(Boolean);
}

const SCHEMAS = {
  skills: {
    required: ["Name"],
    parse: parseSkill,
  },
  monsters: {
    required: ["Name", "Level", "HP", "Damage", "Loot"],
    parse: parseMonster,
  },
  loot: {
    required: ["Name", "Slot", "Value", "Skill", "Skill Effect", "Rarity"],
    parse: (row) => {
      const name = requiredText(row.Name, "Name");
      const skillRaw = row.Skill ? row.Skill.trim() : "";
      const skills = references(skillRaw);
      const rarity = LOOT_RARITIES.get(row.Rarity.trim().toLowerCase());
      if (!rarity) {
        throw new Error(`"Rarity" must be one of: ${[...LOOT_RARITIES.values()].join(", ")}.`);
      }

      const effectRaw = row["Skill Effect"] ? row["Skill Effect"].trim() : "";
      // Strip outer quotes if the entire cell was wrapped in quotes (e.g. "12,5")
      const cleanedEffectRaw = effectRaw.replace(/^["']|["']$/g, "");
      const effectParts = cleanedEffectRaw === "" ? [] : cleanedEffectRaw.split(/,\s*|[;|]/).map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);

      const skillEffects = skills.map((sk, idx) => parseSingleSkillEffect(effectParts[idx] ?? "", sk));
      const primarySkill = skills[0] ?? "";
      const primaryEffect = skillEffects[0] ?? { effectValue: 0, effectIsPercentage: false };

      // Read Description column if available
      const csvDescription = row.Description ? row.Description.trim() : "";
      //const defaultDesc = skills.length > 0 ? `Associated skills: ${skills.join(", ")}` : "Collectible loot item";

      return {
        id: slug(name),
        name,
        description: csvDescription,//skills.length > 0 ? `Associated skills: ${skills.join(", ")}` : "Collectible loot item",
        skill: primarySkill,
        skills,
        skillEffects,
        slot: row.Slot.trim(),
        value: number(row.Value, "Value", 0),
        effectValue: primaryEffect.effectValue,
        effectIsPercentage: primaryEffect.effectIsPercentage,
        rarity,
        notes: row.Notes?.trim() ?? "",
      };
    },
  },
  materials: {
    required: ["Name", "Value", "Uses"],
    parse: (row) => {
      const name = requiredText(row.Name, "Name");
      return {
        id: slug(name),
        name,
        value: number(row.Value, "Value", 0),
        uses: requiredText(row.Uses, "Uses"),
        crafted: row.Crafted?.trim() ?? "",
        notes: row.Notes?.trim() ?? "",
      };
    },
  },
};

function parseSingleSkillEffect(value, skill) {
  const effect = (value ?? "").trim();
  const sk = (skill ?? "").trim().toLowerCase();
  if (effect === "") {
    return { effectValue: 0, effectIsPercentage: false };
  }
  if (!effect.endsWith("%")) {
    return { effectValue: number(effect, "Skill Effect", 0), effectIsPercentage: false };
  }
  if (!["defend", "heal"].includes(sk)) {
    throw new Error(`"Skill Effect" percentages are only supported for Defend and Heal.`);
  }
  return {
    effectValue: percentage(effect.slice(0, -1).trim(), "Skill Effect"),
    effectIsPercentage: true,
  };
}

function parseSkillEffect(value, skill) {
  const effect = value.trim();
  if (effect === "") {
    return { effectValue: 0, effectIsPercentage: false };
  }
  if (!effect.endsWith("%")) {
    return { effectValue: number(effect, "Skill Effect", 0), effectIsPercentage: false };
  }
  if (!["defend", "heal"].includes(skill.toLowerCase())) {
    throw new Error(`"Skill Effect" percentages are only supported for Defend and Heal.`);
  }
  return {
    effectValue: percentage(effect.slice(0, -1).trim(), "Skill Effect"),
    effectIsPercentage: true,
  };
}

function parseSkill(row) {
  const name = requiredText(row.Name, "Name");
  const mappedEffect = SKILL_ABILITIES.get(name.toLowerCase());
  if (!mappedEffect) {
    throw new Error(`Skill "${name}" is not supported.`);
  }

  return {
    id: slug(name),
    name,
    effect: mappedEffect,
  };
}

function parseMonster(row) {
  const name = requiredText(row.Name, "Name");
  const level = integer(row.Level, "Level", 1);
  const lootNames = references(row.Loot);

  let lootChances = [];
  const lootChanceRaw = row["Loot Chance"]?.trim();
  if (lootChanceRaw) {
    const parts = lootChanceRaw.replace(/^["']|["']$/g, "").split(/,\s*/).filter(Boolean);
    lootChances = parts.map((part) => percentage(part, "Loot Chance"));
  } else {
    lootChances = Array(lootNames.length).fill(100);
  }

  if (lootChances.length === 1 && lootNames.length > 1) {
    lootChances = Array(lootNames.length).fill(lootChances[0]);
  }

  const notes = (row.Notes ?? "").trim().toLowerCase();

  return {
    id: slug(name),
    name,
    type: row.Type?.trim() ?? "",
    level,
    health: number(row.HP, "HP", 1),
    souls: row.Souls?.trim() ? integer(row.Souls, "Souls", 0) : 0,
    damage: number(row.Damage, "Damage", 0),
    xp: level * 10,
    unlock_level: level,
    location: row.Location?.trim() ?? "",
    lootChance: lootChances[0],
    lootChances,
    materialCount: row["Mat Count"]?.trim() ? integer(row["Mat Count"], "Mat Count", 0) : 1,
    materialChance: row["Mat Chance"]?.trim() ? percentage(row["Mat Chance"], "Mat Chance") : 100,
    lootNames,
    materialNames: references(row.Materials ?? row.Currency ?? "", /[;,|]/),
    requirements: row.Requirements?.trim() ?? "",
    notes: row.Notes?.trim() ?? "",
    isOptional: notes.includes("optional"),
  };
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`"${field}" must not be empty.`);
  }
  return value.trim();
}

function number(value, field, minimum) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`"${field}" must be a number.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > 1_000_000_000) {
    throw new Error(`"${field}" must be a number from ${minimum} to 1,000,000,000.`);
  }
  return parsed;
}

function integer(value, field, minimum) {
  const parsed = number(value, field, minimum);
  if (!Number.isInteger(parsed)) {
    throw new Error(`"${field}" must be a whole number.`);
  }
  return parsed;
}

function percentage(value, field) {
  const parsed = number(value, field, 0);
  if (parsed > 100) {
    throw new Error(`"${field}" must be a percentage from 0 to 100.`);
  }
  return parsed;
}

function validateRows(category, rows) {
  const schema = SCHEMAS[category];
  const parsed = rows.map((row, index) => {
    const missing = schema.required.filter((field) => !(field in row));
    if (missing.length > 0) {
      throw new Error(`${category} row ${index + 2} is missing columns: ${missing.join(", ")}.`);
    }
    try {
      return schema.parse(row);
    } catch (error) {
      throw new Error(`${category} row ${index + 2}: ${error.message}`);
    }
  });

  if (parsed.length === 0) {
    throw new Error(`The ${category} sheet must contain at least one data row.`);
  }

  const ids = new Set();
  for (const entry of parsed) {
    if (ids.has(entry.id)) {
      throw new Error(`${category} contains duplicate id "${entry.id}".`);
    }
    ids.add(entry.id);
  }
  return parsed;
}

export function validateContent(content) {
  for (const category of Object.keys(SCHEMAS)) {
    if (!Array.isArray(content[category]) || content[category].length === 0) {
      throw new Error(`The ${category} sheet must contain at least one data row.`);
    }
  }

  if (!content.monsters.some((monster) => monster.unlock_level === 1)) {
    throw new Error("At least one monster must have unlock_level set to 1.");
  }
  const warnings = [];
  const lootNames = new Set(content.loot.map((item) => item.name));
  const materialNames = new Set(content.materials.map((item) => item.name));
  
  const skillsByName = new Map(content.skills.map((skill) => [skill.name.toLowerCase(), skill]));

  // Automatically register any skill present in SKILL_ABILITIES even if missing from the CSV sheet
  for (const [skillName, effect] of SKILL_ABILITIES.entries()) {
    if (!skillsByName.has(skillName)) {
      const capitalized = skillName.charAt(0).toUpperCase() + skillName.slice(1);
      const dummySkill = { id: slug(capitalized), name: capitalized, effect };
      skillsByName.set(skillName, dummySkill);
      content.skills.push(dummySkill);
    }
  }

  for (const item of content.loot) {
    if (item.skill) {
      const skill = skillsByName.get(item.skill.toLowerCase());
      if (!skill) {
        warnings.push(`Loot "${item.name}" refers to missing skill "${item.skill}"; it will be treated as collectible loot.`);
        item.skill = "";
        item.description = "Collectible loot item";
      } else {
        item.skill = skill.name;
      }
    }
  }

  for (const monster of content.monsters) {
    const missingLoot = monster.lootNames.filter((name) => !lootNames.has(name));
    if (missingLoot.length > 0) {
      warnings.push(`Monster "${monster.name}" refers to missing loot ${missingLoot.map((name) => `"${name}"`).join(", ")}; those rewards will be ignored.`);
      monster.lootNames = monster.lootNames.filter((name) => lootNames.has(name));
    }
    const missingMaterials = monster.materialNames.filter((name) => !materialNames.has(name));
    if (missingMaterials.length > 0) {
      warnings.push(`Monster "${monster.name}" refers to missing material ${missingMaterials.map((name) => `"${name}"`).join(", ")}; those rewards will be ignored.`);
      monster.materialNames = monster.materialNames.filter((name) => materialNames.has(name));
    }
  }

  for (const item of content.loot) {
    if (item.skills && item.skills.length > 0) {
      const validatedSkills = [];
      for (const skName of item.skills) {
        const skill = skillsByName.get(skName.toLowerCase());
        if (!skill) {
          warnings.push(`Loot "${item.name}" refers to missing skill "${skName}"; it will be ignored.`);
        } else {
          validatedSkills.push(skill.name);
        }
      }
      item.skills = validatedSkills;
      item.skill = validatedSkills[0] ?? "";
    }
  }
  
  content.warnings = warnings;
  return content;
}

export async function loadGameContent(urls, fetchImpl = globalThis.fetch) {
  const categories = Object.keys(SCHEMAS);
  const missing = categories.filter((category) => typeof urls[category] !== "string" || urls[category].trim() === "");
  if (missing.length > 0) {
    throw new Error(`Add the published CSV URL${missing.length > 1 ? "s" : ""} for ${missing.join(", ")} in config.js.`);
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("This browser does not support fetching published sheet data.");
  }

  const entries = await Promise.all(categories.map(async (category) => {
    let url;
    try {
      url = new URL(urls[category]);
    } catch {
      throw new Error(`The published CSV URL for ${category} is invalid.`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(`The published CSV URL for ${category} must use HTTP or HTTPS.`);
    }

    url.searchParams.set("_", String(Date.now()));
    const response = await fetchImpl(url.href, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load the ${category} sheet (HTTP ${response.status}).`);
    }
    let rows;
    try {
      rows = parseCsv(await response.text());
    } catch (error) {
      throw new Error(`Could not read the ${category} sheet: ${error.message}`);
    }
    return [category, validateRows(category, rows)];
  }));

  return validateContent(Object.fromEntries(entries));
}
