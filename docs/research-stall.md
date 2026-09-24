# Research: playing stall well (Gen 9 National Dex OU)

Researched 2026-09-24 for the stockfish battle AI (`src/ai.js`, `src/search.js`). The test teams are in
`data/teams/natdex/` (see its README).

**Format facts that change the rules**
- Format id `gen9nationaldex`. It has **no Tera** (Terastal Clause) but allows **Megas and Z-moves**.
  Mega Sableye (Magic Bounce) and Z-crystal breakers (Tapu Lele, Tornadus-T, Gholdengo) define the stall
  matchup [S1].
- **Recovery PP on this server is 10, or 16 with PP Ups, not Smogon's 5/8.** `data/velvet/unnerfs.js`
  `RECOVERY_PP` covers Recover, Roost, Soft-Boiled, Slack Off, Milk Drink, Shore Up and Rest, and applies in
  every format. PP stalling is therefore about twice as strong here as in the Smogon sources. Wish (10/16),
  Protect (10/16) and Haze (30/48) are unchanged.
- **Pressure** makes every move aimed at the Pressure Pokémon cost 2 PP. Hazard moves carry `mustpressure`,
  so Stealth Rock and Spikes set while a Pressure Pokémon is in also cost 2.
- Pursuit exists in NatDex (Kingambit). Switching a Blissey or Chansey out in front of it can be punished [S1].

**Sources** (tag in brackets):
- [S1] Smogon article, *Stall in National Dex OU*, Princess, 3 Sep 2026: https://www.smogon.com/articles/nd-ou-stall
  (forum thread https://www.smogon.com/forums/threads/stall-in-national-dex-ou.3787838/). This is the main source.
- [S2] Ezra, *National Dex OU Stall (>2100 ELO, 92% GXE)*, RMT, 27 Oct 2024: https://www.smogon.com/forums/threads/national-dex-ou-stall-2100-elo-92-gxe.3753913/
- [S3] Highv0ltag3, *SV OU Ultimate Stall (peaked #1, 2139)*, RMT, 8 Mar 2023: https://www.smogon.com/forums/threads/ultimate-stall-peaked-1-2139-elo.3717661/
- [S4] Ehmcee, *Surface Pressure (PP stall, Suicune and Cresselia)*, 18 Jan 2024: https://www.smogon.com/forums/threads/surface-pressure-the-grimiest-pp-stall-team-feat-suicune-cresselia.3734704/
- [S5] Amane Misa, *Stall in SM UU* (Smogon article): https://www.smogon.com/articles/sm-uu-stall
- [S6] ThePillsburyDoughBoy, *BW OU Stall Guide*, 17 Feb 2012: https://www.smogon.com/forums/threads/bw-ou-stall-guide.3462376/
- [P] `docs/research-pinkacross.md`: A12 (hazards early), A14 (sacking), A15 (momentum sinks), A23 (be
  patient vs stall, watch PP, Knock Off the Boots), R-T6 (answers counted in entries; stall needs 3+),
  R-T16/R-T17 (Knock Off value grows with game length; bulky teams need a repeatable remover), R-T18
  (hazard stack structure), B8/R-T22 (passivity).
- [F] `docs/research-fildrong.md`: S6 (Toxic and Knock Off punish switch-ins), S7 (recovery reliability and
  PP; Rest is not Recover), and the note on restored recovery PP.
- [G] General competitive knowledge or my own inference. These rules are marked so they can be tested
  before anyone trusts them.

The sources are a mix of NatDex-specific material ([S1], [S2]) and older or other-tier guides ([S3] to
[S6]). The older guides are cited only for principles that carry over.

---

## 1. Decision rules

Each row gives the rule, a condition a program can check, the source, whether the AI already does it
(**covered**, **partly** or **new**), and where it would hook in. Line numbers are for `src/ai.js` unless
another file is named, as of 24 Sep 2026.

Notation: `hp` is our active's HP%. `I` is the expected incoming damage this turn: the `incoming` variable
in `chooseForSlot()` (line ~2182), the max over the foe's shown and hidden attacks. `H` is the heal amount
(Recover, Roost, Soft-Boiled and Slack Off heal 50; Wish heals 50% of the user's max HP next turn). `R` is
residual per turn (Leftovers +6.25, Black Sludge +6.25, Poison Heal +12.5, poison and burn damage, and so on).

### A. Recovery and HP management

| # | Rule | Checkable condition | Source | Status | Hook |
|---|---|---|---|---|---|
| A1 | **Recover when the heal outpaces the damage, not just "below 55%".** A wall that heals 50 a turn while taking 55 is losing and should leave. One that takes 30 can stay in forever. | Recover if `H > I` **and** (`hp <= 100 - 0.8H`, which is 60% for H=50, **or** `hp - I <= I`, meaning the next hit puts us in KO range). If `I >= H`, recovery is a losing loop: score it low and let the switch logic find a better wall. | [S6] (sustain), [F] S7, [G] thresholds | **partly**: line 1255 is `myHpPct < 55 ? 60 - myHpPct : -10`. It ignores `I`, so the bot heals into a 2HKO loop and also skips healing at 60% when it is safe to. | `statusScore()` line 1255 (pass `incoming`, already an argument) |
| A2 | **Heal on the free turn.** When the foe is likely to switch (a passive foe, or high switch pressure), recover up to about 75% rather than attacking into the switch-in. | `switchPressure() >= 0.55` and `hp <= 75` and `I < H`: Recover scores above a chip attack. | [S3] ("Slack Off when necessary until it runs out of PP"), [G] | **new** | `statusScore()` (`pressure` is already computed at line ~1221) |
| A3 | **Don't recover at full or near full.** It wastes PP (8 to 16 per game). | `hp >= 90`: Recover `-10`. | [S5] (PP management) | covered (returns -10 above 55) | line 1255 |
| A4 | **Rest is not Recover.** Rest heals to full and cures status, but costs 2 turns asleep (1 with Sleep Talk). Use it only with Sleep Talk, when statused, or when the 2 sleeping turns are safe (the foe is passive or cannot break it). | Rest scores as Recover only if (Sleep Talk in the set **or** `2 * I < hp + 100`) and no foe on the field can set up freely. Rest while at `hp >= 60` without status: -10. | [F] S7, [S1] (Dondozo RestTalk) | **partly**: Rest is in `RECOVERY` (line 81) with the same flat score. Sleep Talk falls to the default 6. | `statusScore()`; add `sleeptalk` (high when asleep) |
| A5 | **Wish plus Protect, and Wish passing.** Wish heals next turn. Use Wish then Protect when `hp <= 55` and a Protect is available. Use Wish then switch to pass it to a teammate at 50% or below that must stay healthy (for example the Blissey that checks Tapu Lele). | Wish score = `max(own need, max over bench of teammate need x value)`, where need = `(100 - hp)` capped at 50. Protect the turn after our Wish = +30. | [S3], [S5] (Wish PP is precious), [S6] (Wish passing) | **new**: Wish falls to 6, Protect is a flat 8 (line 1439) | `statusScore()`; the state must remember "our Wish is pending" (`move` line with `Wish` from our side) |
| A6 | **Protect for scouting and residual.** A Poison Heal or Leftovers user Protects to heal and to see what a Choice user locks into. Protect is also good when the foe is badly poisoned or burned and we are not. | Protect +20 when (our `R > 0` or the foe's residual is `>= 12`) and we did not Protect last turn. +15 when the foe's item is unknown or Choice and it has just come in. | [S2] ("Protect to scout Choice users", Gliscor), [S4] | **partly**: the double-Protect guard exists (line ~1285). The value is a flat 8. | `statusScore()` line 1439 |
| A7 | **Keep the checks to the biggest threat healthy, and spend the others.** Stall's Tapu Lele answer (Blissey, Chansey or special Corviknight) must be kept in check range for the whole game [S1]. | For each live foe threat, the sole or best check (`teamPlan` row `.sole`) gets an HP-preservation bonus when `hp < 70`: prefer recovering or switching over tanking a hit that another wall could take. | [S1], [P] A1/R-B1 | **partly**: `teamPlan().sole` feeds `monValue()` (line ~932), but nothing prioritises healing it | `monValueOf()`, `statusScore()` recovery branch |

### B. Status spreading

| # | Rule | Checkable condition | Source | Status | Hook |
|---|---|---|---|---|---|
| B1 | **Status is stall's main damage.** Toxic and burn keep adding damage without needing to force the foe out. Status the foe you will see again and again: walls, pivots and wincons. | Toxic value = base 32 x (1.3 if the foe has reliable recovery or is a wincon) x (0.6 if the foe has Regenerator, because switching resets the counter and heals 33%) x (0 if the foe has Poison Heal, Guts, Toxic Boost, Magic Guard, Quick Feet or Marvel Scale) x (0.5 if Natural Cure) x (0.3 if Synchronize and we can be poisoned). | [S6], [F] S6, [S1] | **partly**: a flat 32 (line ~1379). Only immunities (Steel/Poison, Purifying Salt, Comatose, Magic Bounce) are handled. | `statusScore()` status branch (~1376) |
| B2 | **Burn physical attackers first, poison the rest.** Will-O-Wisp on a physical wincon (Kingambit, Ogerpon-W, Mega Lopunny) halves its damage for the rest of the game [S1][S2]. | Will-O-Wisp +20 when the foe's attacks shown or expected are mostly physical. Will-O-Wisp -25 into Fire, Guts, Flare Boost, Water Veil, Water Bubble or Thermal Exchange. | [S1], [S2] | **partly**: Fire immunity only | `statusScore()` |
| B3 | **Don't spend Heal Bell or Aromatherapy on every status.** Their PP runs out before the foe's Toxic does. Cure only when a key wall or wincon is statused. | Cleric scores high only when a statused teammate's `monValue` rank is >= 0.6 or it is our sole answer to a live threat. | [S5] | **new** | `statusScore()` |
| B4 | **Knock Off and Will-O-Wisp is one package.** Pokémon that absorb burns (Galarian Slowking, Tornadus-T) hate losing their Boots, and Megas and Z users hate burn chip [S1]. | See H1 for Knock Off. Status the foe that lost its item first. | [S1] | **new** | `statusScore()` / damaging Knock Off scoring |
| B5 | **Don't let the opponent's status spread go unchecked.** A Natural Cure or Regenerator switch, Poison Heal Gliscor or a grounded Poison type absorbs poison. Take Toxic with the member that doesn't care (Poison/Steel types, Poison Heal, Natural Cure Blissey switching out). | In `benchScore()`, when the foe has shown Toxic or Will-O-Wisp or runs Toxic Spikes and our candidate is immune or indifferent: +15. A candidate that would be crippled (a physical wincon against Will-O-Wisp): -15. | [S3], [G] | **new** | `benchScore()` line 1593 |

### C. Hazards

| # | Rule | Checkable condition | Source | Status | Hook |
|---|---|---|---|---|---|
| C1 | **Hazards are stall's main offence, and Spikes stack.** SR takes one layer, Spikes three, Toxic Spikes two [S6]. They limit how often a breaker can switch in (Tapu Lele) [S1]. | Hazard value per layer = sum over remaining foes that are not Boots or Magic Guard (Spikes: grounded; Toxic Spikes: grounded and not Poison/Steel) of `layerDamage% x expectedEntries`, where `expectedEntries ~ 2 + turnsLeftEstimate/10`. Allow Spikes layers 2 and 3, and Toxic Spikes layer 2 if 2+ targets remain. The value is 0 if the foe has an unblocked remover and we lack a blocker (C3). | [S6], [S1], [P] A12 | **partly, with a bug**: line 1307 `theirSide[move.name] ? -30 : 38`. Once one layer of Spikes or Toxic Spikes is up, more layers score -30, so **the bot never stacks Spikes**. It is also a flat 38, whatever the number of Boots users. | `statusScore()` line 1305 |
| C2 | **Protect our side, and avoid Boots-less entries.** Each switch into our hazards costs HP, so stall members carry Boots, and the remover (Defog Corviknight or Gliscor) clears when the cost of the hazards is higher than the cost of the turn. | Defog/Spin value = sum over our alive, non-Boots members of the per-entry cost x expected entries, minus the foe's hazards we would clear (Defog). Clear as soon as the value is above 30, unless the foe's hazard setter will simply reset them (then remove after it is KOed or crippled). | [S1] (double Defog), [S6], [P] R-T17 | **partly**: line 1403 scores 20 + 10 per layer, but not per affected teammate and without the setter check | `statusScore()` line 1403 |
| C3 | **Deny removal.** Spinblock Rapid Spin, Mortal Spin and Tidy Up with a Ghost (Pecharunt). Keep a hazard on the field against a Defogger by using Pressure Corviknight, whose Pressure makes Defog cost 2 PP. Good as Gold (Gholdengo) makes Defog fail against it. Hazard rebound: Magic Bounce sends their hazards back [S1][S3]. | When the foe's active has shown a spin move and we have a Ghost that is not weak to it, bench score +20 for that Ghost. When the foe's active has Defog and our side is clean while theirs has 2+ layers, keep Pressure in (Defog costs 2 PP): score the Pressure mon's switch-in +10. | [S1], [S2] ("Pressure ensures Corviknight wins the Defog vs hazards war"), [S3] | **new** | `benchScore()`, `weighReplies()` in `search.js` (they will spin) |
| C4 | **Stealth Rock early, once.** Set it on the first free turn, most of all against Heavy-Duty Boots-light teams and Mega Charizard-Y or Volcarona style SR-weak threats. | Covered by the base 38 while SR is absent. Scale it by the number of non-Boots foes (0 when every foe that is left has Boots or Magic Guard). | [S6], [P] A12 | partly | line 1305 |
| C5 | **Toxic Spikes and grounded Poison.** Don't set Toxic Spikes into a team whose grounded Poison-type will just absorb it. On our side, send in a grounded Poison type to absorb theirs. | Toxic Spikes: 0 if a grounded Poison-type foe is alive and not yet absorbed. `entryHazards()` should add poison status (plus about 12% "value loss") for our non-Poison, non-Steel grounded, non-Boots members. | [S2], [G] | **new**: `entryHazards()` (line 1705) ignores Toxic Spikes | `entryHazards()`, `statusScore()` |

### D. Controlling boosts (phazing, Haze, Unaware)

| # | Rule | Checkable condition | Source | Status | Hook |
|---|---|---|---|---|---|
| D1 | **Answer a setup sweeper right away.** At +1/+2, phaze (Roar/Whirlwind/Dragon Tail), Haze or Clear Smog, or switch in the Unaware wall. Don't let it reach +2 in front of a non-answer. | When the foe has any positive boost: Haze and phazes score high (they already do at >= 2). The new part: at +1 with a known boosting move, a phaze scores 45 and bringing in an Unaware wall gets +25 in `benchScore()`. | [S6], [S3] (Clodsire Haze vs Nasty Plot), [S1] (Dondozo, Clodsire) | **partly**: Haze (line 1388) and Roar/Whirlwind (line 1425) scale with boosts. Dragon Tail and Circle Throw are damaging, so they get no phaze value. `benchScore()` gives no Unaware bonus. | `statusScore()`; damaging-move loop (Dragon Tail); `benchScore()` |
| D2 | **Unaware walls ignore boosts. Use them as the switch-in, not as a sack.** | In `benchScore()`, if the foe has boosts `>= 1` and our candidate has Unaware, compute incoming damage with the foe's boosts at 0 (the calc does this if the ability is passed) and add +20. | [S1], [S3] | **partly**: the calc handles Unaware if the ability is set on our side. Check that `myPokemon()` passes it. | `benchScore()` line 1593 |
| D3 | **Phaze with hazards up to wear the foe down.** Roar or Whirlwind with 2+ hazard layers on their side and no boosts is still chip damage plus scouting. | Already scored: `theirHazards ? 12` up to `22 + 4 per layer`. Raise it to about 10 per layer when the foe's team is non-Boots. | [S6] | partly | line 1425 |
| D4 | **Hazing and phazing loop.** Against a Nasty Plot or Calm Mind user, let Blissey keep Seismic Tossing until +4, then Haze with Clodsire, and repeat until the boosting move is out of PP. | Handled by D1 plus E1: once the foe's boost-move PP is counted, a Haze or phaze loop counts as progress. | [S3] | new (needs E1) | `statusScore()` |
| D5 | **Don't set up into Unaware or Haze** (the other direction). | Covered by `setupIsWasted()` (line 1150). | [P] | **covered** | none |

### E. PP stalling

| # | Rule | Checkable condition | Source | Status | Hook |
|---|---|---|---|---|---|
| E1 | **Count the foe's PP.** Track uses per foe move from the protocol `move` lines (+1 per use, +1 more if the target had Pressure; mustpressure hazard moves also +1 under Pressure). Assume max PP = base PP x 8/5, using the server's data (recovery moves 16). | `state.opponent[slot].ppUsed[move]++` in `battle.js` `case 'move'` (line 344). `ppLeft = maxPP - used`. | [S5] ("smart PP management"), [S4], [P] A23 | **new**: `battle.js` stores only a `Set` of moves | `src/battle.js` line 344; read it in `ai.js` |
| E2 | **Stall out their key moves when it is cheap.** When the foe's only way to hurt a wall (or its recovery, or its Defog) has 8 PP or fewer left, and our wall can outlast it (our recovery PP x H > their remaining PP x I), keep switching or Protecting between walls instead of trading HP. | Let `outlast = ourRecoveryPP x H - theirKeyPP x I`. If `outlast > 0` and we are not being boosted on, prefer Protect, Recover or a wall switch over attacking. A Pressure mon doubles the effective `theirKeyPP` drain. | [S4], [S3] ("until Garganacl runs out of PP"), [S1] (Corviknight Pressure) | **new** | `statusScore()` (Protect/Recover), `search.js` `playTurn()` (value PP as a resource) |
| E3 | **Don't try to PP stall a Pokémon that has a free switch loop or high PP**, for example Calm Mind Tapu Lele with Z. That is "completely impossible" [S1]. Use hazards and chip instead. | E2 applies only when `theirKeyPP <= 16` and the move is their only real damage. Otherwise fall back to attacking or statusing. | [S1] | new | same |
| E4 | **Watch our own PP.** Don't Recover at high HP (A3), and keep the last 2 to 3 recovery PP for the matchup that needs them (the wall that checks the wincon). | Recovery scoring x (0.5 if `pp <= 3` and `hp > 45`). The request has `m.pp` and `m.maxpp` for our moves. | [S5], [F] S7 | **new**: PP is read only as `pp > 0` (line 2169) | `chooseForSlot()` (pass pp into `statusScore` ctx) |

### F. Switching into the right wall

| # | Rule | Checkable condition | Source | Status | Hook |
|---|---|---|---|---|---|
| F1 | **Pick the wall by what it takes and whether it can come in again.** The right switch-in takes the least from the foe's likely move **as a fraction of what it can recover over the next turns**, has the right role (Unaware vs boosters, Regenerator vs chip, Magic Bounce vs status and hazards), and has enough HP to take two more hits. | Switch-in score = `-(takes + entryHazards)` + role bonuses (Unaware vs a boosted or setup foe +20; Regenerator +8 when `hp < 70`; Magic Bounce vs a status or hazard user +15; Ghost vs a spinner +15) + (`hp - 2 x takes > 0` ? +10 : -20). | [S3] (route Knock Offs through specific members), [S1], [P] R-T6 | **partly**: `benchScore()` (line 1593) is `best - worst` plus setup-fodder and revenge terms. It has no role bonuses and no "can come in twice" term. | `benchScore()` |
| F2 | **Scout with a Regenerator first.** Against an unknown set, bring in the Regenerator pivot (Toxapex, Alomomola) rather than the Unaware wall that must not be chipped. Commit the key wall only when the set is known. | When the foe has fewer than 2 moves revealed and a Regenerator candidate takes 45% or less: +12 to it, -10 to the sole-answer wall. | [S3] ("don't immediately switch Unaware users into unknown sets") | **new** | `benchScore()` |
| F3 | **Leave the Pursuit or Knock Off user alone with the right member.** Against Kingambit, avoid switching Blissey or Chansey out (Pursuit), and route Knock Off into members whose item matters least (Toxic-Orb-activated Gliscor, a Z-crystal user, Mega Sableye). | If the foe has shown or can have Pursuit: switching out a Pokémon it KOs or heavily damages with a doubled Pursuit is penalised by that damage. Knock Off absorbers (item already gone, Mega, Z-crystal, Orb activated, Sticky Hold) get +10 in `benchScore()` vs a Knock Off user. | [S1], [S3] | **new** | `benchScore()`; the switch branch of `chooseForSlot()` (line ~2386) |
| F4 | **Don't swap two walls forever when neither makes progress.** | Covered by the `walled` rule (line 2406). Check it doesn't fire while E2 PP stalling is doing its job: skip `walled` when E2 says `outlast > 0`. | [G] | covered, needs a guard | line 2406 |

### G. Sacking vs preserving

| # | Rule | Checkable condition | Source | Status | Hook |
|---|---|---|---|---|---|
| G1 | **Stall almost never sacks a wall, because every wall is a sole answer to something.** Sack only a member whose checks are all gone (its threats have fainted) or that is dead to hazards anyway. | For team archetype `stall` (G3): the tempo "let the spare one go" margin (line ~2466, `margin = 70`) applies only when `teamPlan().rows.get(key).sole == 0`. | [S1], [P] A14 | **partly**: `sole` exists, but the tempo margin can still sack a sole answer if its value rank is low | `chooseForSlot()` switch branch |
| G2 | **Trade HP for a status or a crippled wincon.** Taking a hit to burn Archaludon or Kingambit is worth it [S2]. | If our move is Will-O-Wisp or Toxic into a physical or setup wincon and we survive `I`, treat the status as worth `min(40, value of foe x 0.4)`, not a flat 32. | [S2] | new | `statusScore()` |
| G3 | **Know that we are stall.** Classify our own team at preview: 4+ members with reliable recovery or Regenerator, and 2 or fewer offensive (Choice, LO, setup) members. Several rules above switch on for stall. | `this.ourArchetype` set once from `request.side.pokemon` moves and items. | [P] B8/R-T22 | **new**: no archetype notion in `ai.js` (grep finds none) | `teamOrder()` (line 1462) or the first `decide()` |

### H. Knock Off, Taunt, items

| # | Rule | Checkable condition | Source | Status | Hook |
|---|---|---|---|---|---|
| H1 | **Knock Off is worth the item, not only the damage.** Removing Boots from a hazard-weak foe, Leftovers or Black Sludge from a wall, Eviolite from Chansey, or an Air Balloon (Gholdengo, so Clodsire's Earthquake hits [S1]) is a lasting gain. | Knock Off score += item value: Boots `10 x hazard% on entry x expected entries/2`; Leftovers or Black Sludge 20; Eviolite 35; Air Balloon 25 when we have a Ground move; Assault Vest 20; 0 when the item is known gone, is a Mega Stone or Z-crystal, or the foe has Sticky Hold. | [S1], [P] A23/R-T16, [F] S6 | **partly**: Knock Off is a damaging move, so it goes through the damage loop. The `/knockoff/` in line 1438 is only reached by Status moves and is dead code for it. | damaging-move loop in `chooseForSlot()` (~line 2240) |
| H2 | **Taunt users are stall's nightmare; answer them fast.** A Taunted wall can't recover, status or phaze. Against a foe that has shown Taunt (Tornadus-T, Hisuian Samurott), switch to the member that damages it (Poison Jab Clodsire, Iron Head Corviknight) or KOs it, not to a pure status wall. Track the Taunt volatile (3 turns) and don't click status moves while Taunted. | Parse `-start ... move: Taunt` in `battle.js`. While Taunted, the status moves are disabled in the request anyway. The new part: switch-in selection weights "damage we deal" x 1.5 vs a foe with Taunt shown. | [S1], [S6] | **new**: `battle.js` `-start` handles only Dynamax and Charge (line 377) | `battle.js` line 377; `benchScore()` |
| H3 | **Heavy-Duty Boots logic.** Our Boots members are free switch-ins through hazards. A member that lost Boots should switch in only when needed, and our remover should prioritise clearing when non-Boots members must keep coming in. | `entryHazards()` already returns 0 with Boots (line 1711). It needs to read `entry.item` after it has been knocked off (verify that the request's item is updated). C2 weighs the non-Boots teammates. | [S1] (Blissey preferred for Boots), [S3] | partly | `entryHazards()`, C2 |

### I. When stall attacks

| # | Rule | Checkable condition | Source | Status | Hook |
|---|---|---|---|---|---|
| I1 | **Attack when the foe is passive or already dying, and to stop setup; otherwise status, hazard or heal.** Stall "prioritises longevity over a KO" and waits for the opening [S5]. | Attack (not status) when: the attack KOs; or the foe is set up and a phaze or Haze is not available; or all of the foe's residual threats are applied (statused, hazards maxed) and `I < H`; or the foe is at 50% or below with no recovery. | [S5], [S6] | partly: the scoring already weighs damage vs status. The missing part is the "everything applied" check. | `statusScore()` / move loop |
| I2 | **Fixed damage and Body Press are stall's attacks.** Seismic Toss (100 HP flat) ignores boosts and resists. Body Press uses Defence, so Iron Defense + Body Press makes progress. Iron Defense is worth it only while the foe is physical (already checked) and not Haze or phaze. | Covered by `FIXED_DAMAGE` (line 119) and setup scoring (defensive boost vs matching attacker, line ~1195). | [S1] | **covered** | none |
| I3 | **Stall's own wincon: a setup wall.** SD Gliscor, Curse Dondozo, Calm Mind Blissey and Amnesia Clodsire win late, once the foe's phazers, Haze, Unaware and Knock Off users are gone or crippled. | `sweepPotential()` with the defensive-boost variant; set up when no living foe has shown Haze, phaze, Unaware or Taunt and `I < H/2`. | [S1], [S2] | partly: `setupIsWasted()` and `sweepPotential()` exist | `statusScore()` setup branch |

### J. Megas, Z-moves, Tera

| # | Rule | Checkable condition | Source | Status | Hook |
|---|---|---|---|---|---|
| J1 | **Mega Sableye: consider holding the Mega.** Base Sableye keeps Prankster, so it can Will-O-Wisp a Choice Band Dragonite before it moves. Mega Evolve when Magic Bounce is what matters (hazards or status incoming). | If our Sablenite holder has Prankster and a Will-O-Wisp or Taunt target that outspeeds, don't Mega this turn. | [S2] | **new**: line 2519 always appends ` mega` | `chooseForSlot()` line 2519 |
| J2 | **Z-moves exist and the bot never uses them.** A Z-crystal on the offensive teams (and Hydrapple Dragonium Z on stall [S1]) is a once-per-game nuke. Use it for the KO or the break (Z-Flying Tornadus-T through Chansey). | Add `canZMove` handling: if `active.canZMove` has a Z move whose damage KOs, or breaks a wall that is otherwise walling us, append ` zmove`. | [S1] | **new**: no `zmove` anywhere in `chooseForSlot()` | `chooseForSlot()` gimmick block (~line 2512) |
| J3 | **Tera: none in `gen9nationaldex`.** `teraWorthIt()` is simply never reached, because `canTerastallize` is absent. On this server's RP OU, which is NatDex *with* Tera, the stall-side Tera rules from SV apply (Tera Flying Alomomola vs Salt Cure [S3]). | Nothing to do for NatDex. | format | n/a | `teraWorthIt()` |

---

## 2. How stall loses (what the bot must avoid)

1. **Recovering into a 2HKO.** Healing 50 while taking 55 or more each turn: every Recover is a turn closer to
   death. See A1: switch to the wall that takes less instead. [S6] [G]
2. **Letting a setup sweeper get free boosts.** A non-answer is in front of a +1 Nasty Plot or Calm Mind user,
   or the Haze or phaze member has been chipped too low to come in. Keep the Unaware or Haze member healthy
   (A7, D1). Tornadus-T with Taunt, NP and Z, and Tapu Lele with CM and Z, are the "6-0" threats. [S1]
3. **Losing the hazard war.** Our hazards get removed for free (no spinblocker, Defog without Pressure),
   while theirs stay up because our Defogger was worn down or Knocked. [S1] [S2] [S6]
4. **Items stripped by Knock Off.** A Boots-less wall bleeds on every entry, and a Leftovers-less one loses
   its sustain. Route Knock Offs into absorbers (F3). Kingambit and Hisuian Samurott are "the two strongest
   Knock Off users in OU history". [S1] [S3]
5. **Taunt.** A Taunted stall mon can't heal, status or phaze. Answer with damage, not with another status
   wall (H2). [S6] [S1]
6. **Running out of recovery PP first.** Recovering at high HP, curing every status, or entering a PP war
   that can't be won (E3, E4). [S5]
7. **Sacking a sole answer, or letting it get worn down**, for example the Blissey that checks Gholdengo or
   Tapu Lele. [S1] [P] A14
8. **Passive attacks when the foe has nothing left to be statused**, meaning the "wall swap forever" draw.
   Stall must still make progress (I1). [G]
9. **Pursuit trapping** Blissey or Chansey as they switch out in front of Kingambit. [S1]
10. **Unprepared-for breakers**: Choice-locked mixed attackers, and Future Sight plus a Fighting type.
    Mega Sableye blanks the classic Future Sight plus Fighting counterplay. [S1] [S6]

## 3. The other side: how HO and BO beat stall (for the bot's offensive teams)

- **Taunt and setup on the passive wall.** Nasty Plot or Calm Mind users with Taunt or Z (Tornadus-T,
  Tapu Lele), boosting on Blissey or Chansey. Don't set up into Unaware (Clodsire, Dondozo) or a shown Haze
  (already covered by `setupIsWasted()`). [S1]
- **Knock Off everything early**, the Boots walls first, then stack hazards so every entry costs HP. That
  is Pinkacross A23: "remove the wall's Boots with Knock Off before the breaker goes in". [P] [S1]
- **Hazard stack plus a spinblocker, or Good as Gold vs Defog** (Gholdengo), and **Hisuian Samurott**
  (Ceaseless Edge Spikes through Magic Bounce, plus Taunt). [S1]
- **Stack breakers on the same checks.** Chip the Unaware or special wall with the first breaker so the
  second one gets through (Pinkacross R-T20). Z-moves are the one-time break: fire them into the wall they
  are meant to break, not into a random switch-in (J2).
- **Burn and poison immunity**: Guts, Poison Heal, Magic Guard and Mega Sableye-proof breakers. Count
  stall's PP: a stall team with 16-PP recovery on this server can outlast a 5/8-PP nuke (Draco Meteor,
  Focus Blast), so switch breakers before PP runs out. [P] A23, [F]
- **Don't feed free recovery turns.** Against a wall with `I < H` that will just heal, set hazards, Knock Off
  or switch to a breaker. That wall is a momentum sink [P] A15.

## 4. Code map: what's covered, what's missing, where it hooks

**Already covered:**
- Setup is not attempted into Unaware or a shown Haze or phaze (`setupIsWasted()`, line 1150).
- Haze, Roar and Whirlwind scale with foe boosts (lines 1388 and 1425).
- Defog and Spin are worth 0 with no hazards, and Defog counts the foe hazards it clears (line 1403).
- Hazards are not re-clicked when already up (line 1307). This is too blunt for Spikes; see bug C1.
- Magic Bounce and status immunities are handled (lines ~1262 and 1290-1303).
- Fixed-damage moves go through `FIXED_DAMAGE` (line 119).
- Our own hazard entry cost is in `benchScore()` via `entryHazards()` (line 1705; Boots and Magic Guard
  are exempt).
- Setup-fodder avoidance when switching (`benchScore()` line ~1622).
- Sole-answer and walled tags (`teamPlan()` line 840, feeding `monValue()`).
- Walled "no progress" switching (line 2406).
- Endgame tree search (`search.js` `endgameModel()` line 306). Note that it explicitly models "no status
  chip, no boosts". Stall endgames are mostly residual damage, so the endgame planner misjudges them.

**Missing state (needs `src/battle.js`):**
1. Foe PP used per move, with Pressure doubling (`case 'move'`, line 344). Needed for E1 to E3.
2. Volatiles: Taunt, Encore and Substitute (`case '-start'`, line 377 handles only Dynamax and Charge), plus
   the toxic counter and our pending Wish (`move` from our side named Wish; it lands at the end of the next
   turn).
3. Whether the foe's item is known gone (`-enditem` exists at line 332; check that the AI reads it as
   "no Boots" for C1 and H1).

**Missing in the search (`src/search.js`):**
- `playTurn()` (line 203) has no residual: poison or burn on the foe, Leftovers, Black Sludge or Poison
  Heal on us, hazard damage on their switch-in (the `theirs.switch` branch at line ~240 counts only our
  hit on the incoming mon), recovery healing, or Wish. Status and heal moves count only through
  `heuristic x 0.4`. For stall, add to the evaluation: foe residual per turn x 3 (expected turns it stays
  in) and our heal amount when the move is a recovery.
- `weighReplies()` (line 131) has no "they use their hazard, remover or setup move" reply. Status moves of
  theirs never appear, because `theirActions()` lists only damage.

## 5. Top 10 rules by expected impact

1. **C1: Stack Spikes and Toxic Spikes, valued per non-Boots foe.** This fixes a real bug: line 1307 never
   allows layer 2 or 3. `statusScore()`.
2. **A1: Recover against expected damage.** Heal when `H > I` and `hp <= 60` or in KO range. When `I >= H`,
   switch instead. `statusScore()` line 1255.
3. **H1: Knock Off valued by the item it removes** (Boots, Leftovers, Eviolite, Balloon). Damaging-move loop
   in `chooseForSlot()`.
4. **B1/B2: Status by target value.** Toxic the recovering or wincon walls, burn the physical attackers,
   skip Guts, Poison Heal, Magic Guard and Natural Cure. `statusScore()` status branch.
5. **F1/F2: Wall selection by role and by whether it can come in twice** (Unaware vs boosters, Regenerator
   to scout, Magic Bounce vs status, Ghost vs spinners). `benchScore()`.
6. **E1/E2: Count foe PP (Pressure x2) and stall out key moves when we outlast them.** `battle.js` line 344,
   plus the `statusScore()` Protect and Recover branches.
7. **D1: Answer +1 immediately** (phaze or Haze at +1, Unaware switch-in bonus, Dragon Tail as a phaze).
   `statusScore()`, `benchScore()`.
8. **A5/A6: Wish plus Protect, Wish passing, Protect for residual and scouting.** `statusScore()`, plus
   pending-Wish state.
9. **J2: Use Z-moves at all.** Every offensive NatDex team here carries one. `chooseForSlot()` gimmick
   block, line ~2512.
10. **Residual in the search evaluation** (the `playTurn()` gap), so the one-turn search stops ranking
    Toxic, Spikes and Recover below a 20% chip attack. `search.js` line 203.

Runners-up: G3 (know that we are stall, and switch these rules on), C3 (spinblocking and Pressure vs Defog),
H2 (Taunt tracking), J1 (hold Mega Sableye for Prankster), E4 (save our own recovery PP).
