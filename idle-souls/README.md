# Idle Souls

Idle Souls is a small browser-based idle game. Pick enemies to fight and kill them to gain experience, loot, and materials to get stronger. The game does not have an attack button but has a few other ways for you to control the game's flow.

Play the game online at: https://astralproxy.github.io/idlemon/idle-souls

The data behind it lives at: https://docs.google.com/spreadsheets/d/e/2PACX-1vTC0eRjsrgC8EcIsn1_Rt5zwkta1U5gVVAPfv7XJem4UKwmgNcUf8mlz2qjEzDBPmnBYEUECSrle6YU/pub

## Game behavior

- The game performs one automatic attack per game-second; Game Speed multiplies game time by 1×, 2×, or 5×. Excess damage does not carry into the next monster.
- Player max HP starts at 400 and increases by 15 per level-up, up to a cap of 1,900. Monsters deal their `Damage` value after each player attack that does not defeat them; equipped defense reduces this damage.
- At zero player health, combat pauses and Game Over shows total monsters defeated. A loot item with skill `Revive` in the Bag can be consumed to restore full HP and resume the fight; if no Revive item is available, use Start Over to clear the run and begin again.
- Damage starts at 1 and increases by the sum of the `Value`s of equipped loot. Loot picked up from monster defeats goes into the Bag; equipping a Bag item activates its associated skill. Each Equipment slot holds one item, and replacing an item returns it to the Bag.
- Equipment displays the Hand, Offhand, Head, Chest, Arms, and Leg slots, with each equipped item shown alongside its slot. A Two-Hand item occupies the Hand slot, returns any equipped Offhand item to the Bag, and disables the Offhand slot until it is unequipped.
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
