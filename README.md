# IDLE SOULS

Idle Souls is a small text-based incremental game played in a web browser. Pick enemies to fight and kill them to gain experience, loot, and materials to get stronger. You can even craft and upgrade with certain materials.

The game does not have a traditional attack button but has a few other ways for you to control the game's flow. The game only continues for a few seconds when you leave the tab, but be sure to stop in a safe place!

Play the game online at: https://astralproxy.github.io/idlemon/idle-souls

It's very mobile friendly!

and be sure to read the menu > How to Play to understand the core mechanics!

The data behind it lives at: https://docs.google.com/spreadsheets/d/e/2PACX-1vTC0eRjsrgC8EcIsn1_Rt5zwkta1U5gVVAPfv7XJem4UKwmgNcUf8mlz2qjEzDBPmnBYEUECSrle6YU/pub

## Game behavior

- The game performs one automatic attack per second. This can be modified in the Settings. 
- Player max HP starts at 400 and increases by 15 per level-up initially, then 10 after to a cap at level 99. Player max Stamina starts at 91 and increases 1 every 2 levels. Certain items may affect these.
- Monsters deal their `Damage` value after each player attack that does not defeat them; equipped defensive gear reduces this damage. At zero player health, YOU DIED, but a special loot item with skill `Revive` can be consumed to restore HP and resume your journey; but if no Revive item is available, you can Start Over on a new run.
- Every attack consumes `Stamina` depending on your equipment (1H, 1Hx2 or 2H). If you run out of stamina during a fight, you receive unmitigated damage for a turn. When an enemy is defeated, you automatically regain full stamina for the next fight. Recover stamina with the Green Blossom item.
- Loot picked up from defeated enemies goes into the Bag; equipping a Bag item activates its associated skill. Each Equipment slot holds one item, and replacing an item returns it to the Bag.
- Equipment displays the Hand, Offhand, Head, Chest, Arms, and Leg slots, with each equipped item shown alongside its slot. A Two-Hand item occupies both hand slots, so be wary of losing the added defense of a shield.
- Use Fight, Prepare, and Shop tabs to switch modes. Manually going to Prepare does not pause combat. Combat only pauses after Flee item is used or defeating a special (bold) enemy, and beating a BOSS unlocks the Shop as well. Choose a different monster in the Fight dropdown to resume. After visiting the Shop, you can visit Prepare and return to the Shop safely, but switching back to Fight locks the Shop until another Boss is defeated.
- Changing targets during a fight queues the new target; the current monster must be defeated first. Selecting the current monster again cancels the queued target.
- The Shop keeps two distinct random slotless loot offers until purchased; equipment is not included in the offers. Buying an offer costs Souls equal to that loot item's `Value`, adds it to the Bag, and replaces the purchased offer. Refreshing both offers costs Souls. Materials awarded by monsters are stored in the Bag and add to your Souls only when sold in the Shop.
- Items type loot is consumable. Using it consumes one item and applies its associated skill. Some of these items are also available as quick-use buttons in a single row beneath the Combat sction.
- Defeating an enemy grants XP, souls, and possibly loot/materials as indicated.
- Progress is saved in this browser's local storage; no account or server is used. Use the Profile page's restore key to export a progress snapshot and restore it in another browser; anyone with the key can access that snapshot. Simply paste it after the main URL and refresh.

## Settings
- swap the display order of Bag and Equipment
- game speed 1×, 2×, or 5× makes the game "faster" by shortening time between attacks, both for you and the enemy
