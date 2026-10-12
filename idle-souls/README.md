# Idlemon

Idlemon is a small, static browser idle game. Choose a monster to target; attacks, experience, loot, Materials, and level-ups happen automatically. The game does not have an attack button but has a few other ways for you to control the game's flow.

Play the game online at: https://astralproxy.github.io/idlemon/

Copy this spreadsheet to make your own! https://docs.google.com/spreadsheets/d/1UqTGL5B_vqxDlY_2KNFmEFieJSYKh2h38o8x-rUshxI/edit?usp=sharing

## Connect a published Google Sheet

The game reads skills, monsters, loot, and Materials from published worksheet CSV URLs in one Google spreadsheet. It does not bundle fallback game definitions. If the URLs are missing or the sheet data is invalid/unavailable, the game displays an error instead of starting with substitute content.

1. Create one Google spreadsheet with worksheets named `Skills`, `Monsters`, `Loot`, and `Materials`.
2. Add the exact headers shown below in row 1. Monster `Loot` and `Materials` entries should match names in their respective worksheets; loot `Skill` entries should match a skill name.
3. Publish the spreadsheet to the web and make each worksheet available as CSV. For each worksheet, copy its published CSV URL. A typical published URL has the form `https://docs.google.com/spreadsheets/d/e/PUBLISHED_ID/pub?gid=WORKSHEET_GID&single=true&output=csv`.
4. Paste each worksheet URL into the matching field in [config.js](./config.js). The URLs for the supplied published spreadsheet are already configured.
5. Serve this folder over HTTP. For example, run `python -m http.server 8000` from the project directory and open `http://localhost:8000`.

The sheet should remain publicly readable. The browser fetches the CSV URLs directly, so the published endpoint must allow cross-origin requests from the origin serving the game.

When sheet data changes, missing Monster Loot/Material references are ignored and reported in the game status; Loot referring to a removed Skill becomes collectible loot. Saved progress is repaired when it refers to removed or changed monsters, loot, or materials, preserving unrelated progress. Invalid saved loot entries are removed individually and the repaired save is written on startup. If another error prevents startup, use the error screen's **Reset saved game and retry** button to clear the local save and retry with fresh progress.

### Worksheet schemas

Column names are case-sensitive. Every listed column is required, except `Monsters.Type`, `Monsters.Loot Chance`, and `Monsters.Mat Chance`, which may be omitted or left blank.

| Worksheet | Columns | Meaning |
| --- | --- | --- |
| `Skills` | `Name` | Each row names a supported effect type: `Attack`, `Magic`, `Defend`, `Heal`, `Revive`, or `Flee`. |
| `Monsters` | `Name,Type,Level,HP,Damage,Loot,Materials,Mat Count,Loot Chance,Mat Chance` | `HP` sets the monster's health. `Type` may be omitted or blank; set it to `Boss` for Boss enemies. Other type names are regular monsters. `Loot Chance` is the 0–100 percent chance of dropping listed loot; `Mat Chance` independently controls listed Material drops. Either chance may be omitted or blank and defaults to 100. `Mat Count` is the number of each listed Material awarded when materials drop; it defaults to 1 and may be 0. XP is `Level × 10`; `Level` also sets the player level required to unlock the monster. `Damage` is dealt between surviving player attacks. `Loot` and `Materials` are item names from the corresponding tabs. The material-reference column may also be omitted or use the legacy header `Currency`. Separate multiple Materials with commas, semicolons, or `|`; quote comma-separated names as one CSV cell. |
| `Loot` | `Name,Slot,Value,Skill,Skill Effect,Rarity` | Loot item, equipment slot, numeric damage/value, optional skill name from `Skills`, and skill strength as a number or (for `Defend` and `Heal`) a percentage such as `25%`; leave blank if unused. Rarity must be `Trash`, `Common`, `Uncommon`, `Rare`, `Epic`, `Legendary`, or `Mythic`. Leave `Slot` blank for an instant-use item. Monster defeats put referenced loot in the Bag. One item can occupy each slot in Equipment. |
| `Materials` | `Name,Value,Uses` | Material item, its numeric value, and its intended uses. Monsters award each referenced Material on every defeat; sell these items in the Shop to add their `Value` to your Souls. |
Valid `Skills.Name` values are:

- `Attack`: a consumable hits the selected monster for the Loot row's `Skill Effect`; equipped loot increases damage by its `Value`.
- `Magic`: deals damage like `Attack`; consumables hit the selected monster for the Loot row's `Skill Effect`, and equipped loot increases damage by its `Value`.
- `Defend`: a numeric `Skill Effect` reduces incoming damage by that amount; a percentage reduces damage by that percent. Equipped loot applies on each hit, while a consumable applies to the next incoming hit.
- `Heal`: a numeric `Skill Effect` restores that many HP; a percentage restores that percent of the player's current max HP. Healing is capped at max HP.
- `Revive`: a consumable item with this skill can be used after Game Over to restore full HP and resume the fight; its `Skill Effect` is ignored.
- `Flee`: using a consumable item with this skill abandons the current monster and pauses on Prepare.

Example rows (use these as a starting point in your own sheet):

```csv
Skills
Name
Attack
Magic
Defend
Heal
Revive
Flee

Monsters
Name,Type,Level,HP,Damage,Loot,Materials,Mat Count,Loot Chance,Mat Chance
Green,Normal,1,10,4,Feather; Spatula,Bottlecap,1,100,75
Blue,Normal,2,20,8,Sheet Pan,,1,50,100

Loot
Name,Slot,Value,Skill,Skill Effect,Rarity
Feather,Hand,1,Attack,1,Common
Spatula,Hand,3,Attack,2,Rare
Sheet Pan,Offhand,5,Defend,2,Uncommon
Damage Potion,,0,Attack,3,Mythic
Magic Orb,,0,Magic,3,Epic
Shield Potion,,0,Defend,50%,Uncommon
Healing Potion,,0,Heal,25%,Rare

Materials
Name,Value,Uses
Bottlecap,1,Shop
```

Each section above belongs on its own worksheet; do not include the section labels as CSV rows.

## Game behavior

- The game performs one automatic attack per game-second; Game Speed multiplies game time by 1×, 2×, or 5×. Excess damage does not carry into the next monster.
- Player max HP starts at 400 and increases by 15 per level-up, up to a cap of 1,900. Monsters deal their `Damage` value after each player attack that does not defeat them; equipped defense reduces this damage.
- At zero player health, combat pauses and Game Over shows total monsters defeated. A loot item with skill `Revive` in the Bag can be consumed to restore full HP and resume the fight; if no Revive item is available, use Start Over to clear the run and begin again.
- Damage starts at 1 and increases by the sum of the `Value`s of equipped loot. Loot picked up from monster defeats goes into the Bag; equipping a Bag item activates its associated skill. Each Equipment slot holds one item, and replacing an item returns it to the Bag.
- Equipment displays the Hand, Offhand, Head, Chest, Hands, and Leg slots, with each equipped item shown alongside its slot. A Two-Hand item occupies the Hand slot, returns any equipped Offhand item to the Bag, and disables the Offhand slot until it is unequipped.
- Player Stats, Equipment, and Bag sections can be collapsed independently.
- The Bag separates loot with a defined `Slot` under Equipment from slotless consumables under Items. Its Materials tab lists collected Materials and quantities; these items cannot be used directly.
- Newly acquired Bag loot gets a light-yellow border on the Prepare tab until the player returns to Fight.
- Use Fight, Prepare, and Shop tabs to switch modes. Manually viewing Prepare or Shop does not pause combat. Combat pauses after Flee or a Boss defeat until a new monster is selected. After visiting an unlocked Shop, you can visit Prepare and return to the Shop without locking it; switching to Fight prompts for confirmation and locks the Shop until another Boss is defeated. The selected mode remains saved across refreshes.
- Defeating a Boss pauses combat, opens the Shop, and displays a hint on the Boss Killed card. The hint and its marquee are dismissed when returning to Fight after visiting the Shop. Choose a different monster in the Fight dropdown to resume. There is no automatic switch to Prepare.
- Changing targets during a fight queues the new target; the current monster must be defeated first. Selecting the current monster again cancels the queued target.
- The Shop keeps two distinct random slotless loot offers until purchased; equipment is not included in the offers. Buying an offer costs Souls equal to that loot item's `Value`, adds it to the Bag, and replaces the purchased offer. Refreshing both offers costs 5 Souls. Materials awarded by monsters are stored in the Bag and add to your Souls only when sold in the Shop.
- In the Shop, the Player Stats section is hidden and Bag loot can be sold for its `Value`; equipment also has a separate Equip button. Selling Rare, Epic, Legendary, or Mythic loot requires confirmation. Bag rows show each item's Souls value separately from the Sell controls, and stacks of more than five can be sold all at once.
- Loot with a blank `Slot` is a consumable. Using it consumes one item and applies its associated skill once: `Attack` and `Magic` hit the selected monster for the Loot item's `Skill Effect`, while `Defend` reduces the next incoming hit by its numeric amount or percentage.
- Slotless items in the Bag are also available as quick-use buttons in a single row beneath the Monster section.
- A consumable with the `Heal` skill restores its numeric `Effect` in HP or the listed percentage of max HP, capped at the player's current max HP. A consumable with the `Revive` skill restores full HP and resumes combat after Game Over; its `Effect` is ignored.
- A consumable with the `Flee` skill ends the current fight and switches to Prepare. Returning to Fight leaves the target unselected until the player chooses a monster.
- Monster health is set by the `HP` column; XP is `Level × 10`, and monster level also sets its player-level unlock requirement.
- Defeating a monster grants its XP and each loot/Material item referenced by the monster.
- Each monster defeat checks `Loot Chance` and `Mat Chance` independently before granting listed loot or Materials; each listed Material is awarded in the amount set by `Mat Count`.
- When `DEBUG_ENABLED` is true, the Monster section shows the latest loot roll, Loot Chance, and whether loot dropped.
- XP to reach the next level is `round(0.02x³ + 3.06x² − 13.68x + 81.96)`, where `x` is the level being reached. For example, reaching level 2 requires 67 XP and reaching level 3 requires 69 XP. Monsters unlock based on player level.
- Progress is saved in this browser's local storage; no account or server is used.
- Use the Profile page's restore key to export a progress snapshot and restore it in another browser; anyone with the key can access that snapshot.
- Use Settings to swap the displayed order of Equipment and Bag; the preference is saved in this browser.
- Settings also provides a 1×, 2×, or 5× Game Speed slider that multiplies combat time between attacks; its selection is saved in this browser.
- Settings can hide the game status text; this preference is saved in this browser and is enabled by default. Player Stats is collapsed by default.
- Opening the main menu, Profile, Help, or any other menu page pauses combat without granting offline progress for the time spent there.
- Returning players receive at most eight hours of offline combat progress.
- A debug-only Reset button is enabled by default; it clears this game's local save and restarts at level 1.
- When `DEBUG_ENABLED` is true in [config.js](./config.js), the main menu also shows CHEAT, where selecting any Loot item adds one copy to the Bag for free.

## Development and tests

The app has no third-party dependencies. Run the built-in Node.js test suite with:

```sh
npm test
```
