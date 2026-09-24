# Research: teambuilding rules the builders don't have yet

Researched 2026-09-24 from Smogon articles, forum resources and strong players' written advice (sources at
the bottom, cited as [S1]...). This builds on `docs/teambuilding-checklist.md` (the checklist) and
`docs/research-pinkacross.md` (Pinkacross, rows B1-B21). It lists only rules those two leave out, or cover
only in part. Where a rule is already there, it is listed briefly so the overlap is visible.

**How each rule is written.** The server has its own Pokémon, signature moves and abilities, and a
balance patch (`data/velvet/*`), so every rule starts with the **why**: the reason a good player does it, in a
form that holds in any metagame. Species from the sources appear only as examples, turned into the property
that matters ("a bulky Steel/Flying Defog user" rather than a name). Thresholds come from the format's usage
list (`TeamBuilder.threats()`), not from Gen 9 OU names.

**Status** is against the two docs (and a quick read of the code where noted):
- **covered**: already a rule in the checklist or Pinkacross doc.
- **partly**: something close is there, but narrower.
- **new**: neither doc has it.

**Ladder formats only** marks rules about Tera, Dynamax, Z-moves or Megas. RP formats lock those behind story
items, so in RP the rule is skipped unless the trainer holds the item.

**Where**: `team-logic.js` (analyze/issues/score), `team-assembler.js` (RP and offline search),
`teambuilder.js` (ladder draft, `chooseTeam()`, `threatCover()`), `role-sets.js` (moves, `itemFor()`, `spreadFor()`).

---

## 1. Build process and win conditions

| # | Why (tier-agnostic) | Rule | Bot rule (testable) | Status | Where | Src |
|---|---|---|---|---|---|---|
| T1 | A rater's first question is what the team is trying to do. Without a stated plan, members get picked for general strength and pull in different directions. | The team has one stated purpose, for example "hazards plus a late setup sweep" or "defensive attrition". Every member serves it. | The assembler carries a `plan` object: {archetype, wincons[], enablers[]}. Each member is tagged with the plan item it serves. A member that serves none is a soft issue. | partly: checklist rule 14 and step 1 are not implemented | assembler, team-logic | S2, S10 |
| T2 | One win condition has a counter. If that counter is in the opponent's six, the game is lost at team preview. Two win conditions **with different counters** make that much less likely. | Have a backup win condition that a different set of Pokémon stops. | At least 2 members pass `winCondition`. Their check sets (threats that resist their STABs and survive, or outspeed and KO them) overlap by 50% or less. Otherwise soft. Stall is exempt. | partly: checklist step 1 names it; the code requires only one | team-logic | S10, S17 |
| T3 | A core works when each partner removes what stops the other. Taking out a sweeper's check is worth more than adding raw power. | Choose the partner by what it does to the win condition's checks, whatever kind of Pokémon the seed is. | For any seed (not only walls, as in checklist rule 16), list the seed's checks from the threat list. Partner bonus = usage-weighted damage the partner's best move does to those checks. | partly: rule 16 covers a wall seed only | assembler seed phase | S1, S11, S24 |
| T4 | A wall that can switch into most of your team heals for free each time and never loses. This is the classic way a team loses to stall or fat balance. | No common defensive Pokémon may wall most of the team. | For each defensive threat in the list: count our members it walls (none of their attacks hits it super effectively, and none 2HKOs it). At 4 or more, need a member that 2HKOs it, or Knock Off, Taunt, or Toxic on something it can't block. Soft; hard on offense. | partly: rule 5 counts neutral hits and rule 12 counts stallbreakers, but neither looks at one wall against the whole team | team-logic (needs threats) | S9 |
| T5 | No single threat may win on its own. A threat that "runs through" the team (nothing outspeeds it, nothing survives it) ends the game. | Every top threat has at least one answer that doesn't depend on hax. | Covered by checklist step 6 and B5. Listed for completeness. | covered | none | S9 |
| T6 | Good raters change as little as possible. Improve efficiency first (a spread, an item, a redundant member), then patch any hole the change opened. When 3 or more members must change, the team needs rebuilding, not rating. | Refine by small changes, then re-check. | After assembly, a repair pass: try single swaps (move, item, EVs, then member) and keep any that raises `score()`. After each accepted swap, re-run `issues()` for new holes. If the best team differs from the seed by 3 or more members, re-seed instead. | verify: the assembler search may already do the first part | assembler | S2 |
| T7 | Synergy on paper often fails in play. Every guide says to test before judging. | Test the team in games. | Offline ladder teams: play N self-play games against the format's sample teams. Drop candidates below a win-rate floor. Costly, so use it for ladder presets only. | new | teambuilder.js (offline) | S2, S15, S24 |

## 2. Archetype structures

| # | Why | Rule | Bot rule | Status | Where | Src |
|---|---|---|---|---|---|---|
| A1 | Hyper offense wins by trading. Breakers soften, sweepers win, and cleaners pick off what is left. With no cleaner, one faster revenge killer stops the team. | HO: 1 lead (hazards), **2 wallbreakers**, 1-2 setup sweepers, 1-2 cleaners (naturally fast or Scarf, with strong attacks or priority). Quote: "Most hyper offensive teams run two wallbreakers." | On HO: 2 breakers (soft if 1 or 3 or more). At least 1 **cleaner**: a non-setup member with a Scarf or top-tier speed, or a strong priority STAB. It counts separately from the sweepers. | partly: the checklist allows 2-4 sweepers and 1-3 breakers; there is no cleaner slot | team-logic | S1 |
| A2 | Stall wins only if it outlasts. Status wears walls down, so one member must be able to cure it. And stall facing stall is decided by who has a way through. | Stall: recovery on every member (covered), plus **a cleric** (Heal Bell or Aromatherapy, or Wish support). One physical wall and one special wall. A way to beat opposing stall (Taunt, Knock Off, Toxic on a Steel/Poison-proof holder, a setup win condition). | Stall: soft when there is no cleric or Wish. Soft when the team lacks both a physically and a specially defensive wall. Soft when nothing beats an opposing stall mirror (no Taunt, Knock Off or setup, and no Toxic user). | new (cleric; the checklist says a cleric is not counted); partly (anti-stall) | team-logic | S3, S5 |
| A3 | Hazards hurt stall most because it switches the most. Without a remover, stall has to make hazards irrelevant. | Stall with no remover: Heavy-Duty Boots on 4-5 members. A Knock Off absorber is then required, because Knock Off strips the Boots. | Stall and no remover: soft for each hazard-weak member without Boots. The Knock Off absorber (rule 19) becomes hard. | partly (rule 2 counts Boots; rule 19 is soft) | team-logic, itemFor | S26 |
| A4 | Weather is a one-slot engine for several abusers. It is wasted if only one member uses it, and short if the setter has no extender. | Weather: 1 setter. A **duration rock** on the setter when the team runs one weather. **At least 2 abusers** (speed abilities, or moves the weather powers). Something that beats the opposing weather setter. Partners cover the setter's own weaknesses. | With one weather: soft when the setter lacks its rock (Damp/Heat/Smooth/Icy Rock) and isn't the team's Choice or Boots user by need. Soft with fewer than 2 abusers (ability, or 2+ weather-boosted attacks). Soft when nothing beats a rival weather setter (resists its STABs and 2HKOs it). | partly: setter/abuser pairing and clashing weathers are coded; rock and abuser count are not (B21 has the rock only on two-weather teams) | team-logic, itemFor | S4, S5 |
| A5 | Trick Room turns slowness into speed, but only for a few turns and only once it is up. One setter can be Taunted or KO'd. | Trick Room: **2-3 setters**. Abusers are slow: base Speed well below the tier's slow benchmark (the DPP guide's cut-off is base 85, under the slowest common OU wall). **0 Speed IV and a -Spe nature** on abusers and setters. Strong attacks on both sides (mixed), since there are only about 4 turns to use it. | Recognise `style: 'trickroom'` when 2 or more members have Trick Room. Then: (a) soft with fewer than 2 setters; (b) abusers get `spe: 0` IV, a -Spe nature and 0 Speed EVs; (c) for speed control, count TR setters and don't count Scarf or high Speed; (d) soft when a TR abuser has base Speed above the 40th percentile of the format's threats. | new | team-logic (style), spreadFor | S20, S5 |
| A6 | Screens halve damage for 5 turns (8 with Light Clay). They only pay off when sweepers use those turns to set up. | Dual screens: one setter with **both screens, Light Clay** and ideally a pivot move to bring a sweeper in safely. **3 or more setup sweepers**. **No Defog** on the team: it clears your own screens. | Recognise a screens team (one member with Reflect and Light Screen, or Aurora Veil). Then: Light Clay on the setter; soft with fewer than 3 setup sweepers; soft when a teammate carries Defog. | new | team-logic, itemFor | S21 |
| A7 | Volt Switch and U-turn keep the initiative, but a Ground type stops Volt Switch, and every pivot eats hazards on each entry. | VoltTurn: pair a **U-turn user with a Volt Switch user** (U-turn hits the Ground types that stop Volt Switch). Hazard removal, or Boots on the pivots, is required. Mix a **slow pivot** (brings a teammate in safely after the foe moves) with a **fast one** (scouts, escapes before a hit). | With 3 or more pivot users: soft when all are Volt Switch (or all U-turn). Soft when there is no remover and 2 or more pivots lack Boots. Soft when every pivot is faster than the median threat (no slow pivot). | partly: rule 8 counts pivots; B15 gives slow pivots min Speed | team-logic | S12, S13 |
| A8 | Stacked hazards only pay while they stay up. A spinner or Defog user undoes three turns of setup in one move. | Hazard stack (2 or more hazard types): a **spinblocker** (a Ghost type blocks Rapid Spin, Good as Gold blocks Defog), or a **Defog punisher** (a Defiant or Competitive member that gains from the stat drop). A **phazer** (Whirlwind, Roar, Dragon Tail) multiplies the damage. Boots on our own hazard-weak members (B20). | When Spikes or Toxic Spikes are set alongside SR: soft with no spinblocker or Defiant/Competitive member. +1 bonus for a phazer. | partly: checklist rule 3 lists spinblocking but it isn't coded; the Defiant/Competitive deterrent and the phazer bonus are new | team-logic | S14 |
| A9 | Bulky offense needs momentum. Passive walls stop it, and defensive pivots keep it. | BO: defensive pivots plus breakers; no passive walls. | Covered by checklist rules 8 and 23, B8. | covered | none | S5 |

## 3. Hazards and removal

| # | Why | Rule | Bot rule | Status | Where | Src |
|---|---|---|---|---|---|---|
| H1 | Defog clears hazards (and screens) on **both** sides. On a team that sets its own hazards or screens, Defog undoes its own work. Rapid Spin, Mortal Spin and Court Change only touch our side, or swap. | On a team with Spikes or Toxic Spikes, or with screens, prefer Rapid Spin or Mortal Spin as the removal (Court Change on offense). Take Defog only when there is nothing else. | When the assembler teaches removal and the team sets Spikes, Toxic Spikes or screens: rank spin-type removal above Defog. Soft issue: Defog plus our own screens, or plus 2 or more hazard types. | new | assembler `assemble()`, team-logic | S21, S14 |
| H2 **[G]** | Rapid Spin fails into a Ghost type, and opposing hazard teams bring one to block it. A spinner that can't hurt the Ghost is shut out. | A Rapid Spin or Mortal Spin user carries a move that hits Ghost types hard (a Dark move, Knock Off, or a strong neutral STAB). | Soft when the team's only removal is spin-based and that member has no Dark or Ghost move and no STAB of 80+ BP that is neutral on Ghost. | new | role-sets `pickMoves()` | S14 (spinblocker role); inference |
| H3 | The lead sets the pace. Offense wants hazards up before the opponent can stop them. A defensive team needs no special lead. | Offense (HO, and screens or hazard HO): one member built as a lead. It sets hazards reliably (a Focus Sash or Custap Berry on a frail one, or Taunt). A defensive team skips this. | HO: soft when no hazard setter has Sash or Custap, Taunt, or a speed above the median threat. | partly: the checklist names a suicide lead for HO; A2 covers choosing the lead in battle, not building one | team-logic, itemFor | S15, S1 |
| H4 | An anti-lead that is useless after turn 1 is a wasted slot. | Build an anti-lead only when it has another job later in the game. | Never add a member whose only value is "beats leads". It must also pass `strength` or fill a role. | new (low value) | assembler | S15 |

## 4. Speed and EVs

| # | Why | Rule | Bot rule | Status | Where | Src |
|---|---|---|---|---|---|---|
| E1 | EVs are scarce. Each point above what a benchmark needs is bulk or power thrown away. | Put Speed EVs only up to the benchmark the set needs. EVs = 252 - 4 x (maxSpeed - target - 1). With a +Spe nature, use target/1.1; with a Scarf, target/1.5. The surplus goes to HP and defences. | `spreadFor(..., { threats })`: target = the fastest threat in the list this set can pass at 252 EVs, plus 1. Compute EVs with the formula. Unless the set is a sweeper facing its own mirror, move the surplus to HP or the weaker defence. | partly: B15 lists benchmarks; the formula and the surplus rule are new | role-sets `spreadFor()` | S6, S7, S8 |
| E2 | Bulk multiplies: roughly HP x Def and HP x SpD. The biggest gain goes to the lower factor, so keep them close. | On mixed walls, invest in whichever of HP, Def, SpD gives the largest gain in the weaker product. Usually HP first. | Mixed or unspecified walls: fill EVs 4 at a time into whichever of HP/Def/SpD most raises min(HP x Def, HP x SpD). Specialised walls keep their side. | partly: B15 says put it in the lower one; `spreadFor()` is fixed at 252/252 | role-sets `spreadFor()` | S6 |
| E3 | Attack EVs beyond the damage a KO needs do nothing. Strong players invest to "OHKO X after SR" and put the rest into survival. | On bulky attackers: invest Attack only up to the benchmark (for example a 2HKO on the most-used wall), then invest in bulk. | Bulky Attacker / AV Pivot: find the least Atk/SpA that keeps the same KO counts (via `@smogon/calc`) on the top 3 walls in the threat list. Move the rest to HP. | new | role-sets `spreadFor()` | S6, S8 |
| E4 | Foul Play uses the target's Attack, and confusion hits with your own. A special set gains nothing from Attack. | **0 Attack IV** on any set with no physical attack. This is Smogon's default for such sets. | In `buildSet()`: when no move is physical (Foul Play and Body Press don't count as needing Atk; Body Press uses Def), set `ivs.atk = 0`. Pair it with a -Atk nature (Bold, Calm, Timid, Modest). | new: `role-sets.js` sets no IVs | role-sets `buildSet()` | S22 |
| E5 | Moving last is an advantage for Trick Room abusers, Gyro Ball users and slow pivots. The last one brings a teammate in after the foe has moved. | **0 Speed IV** and a -Spe nature on TR abusers, Gyro Ball users, and slow pivots (Teleport, Chilly Reception, slow U-turn/Flip Turn/Volt Switch, Regenerator). | `spreadFor()`: those sets get `ivs.spe = 0`, a -Spe nature (Relaxed, Sassy, Brave, Quiet) and no Speed EVs. | partly: B15 covers slow pivots; TR and Gyro Ball are new | role-sets | S20, S13 |
| E6 | Residual damage rounds down, so HP numbers matter. | Leftovers/Black Sludge: HP a multiple of 16. SR-weak: HP not a multiple of 4 (8 for 4x weak). Life Orb: HP not a multiple of 10. **Substitute: HP = 4n+1** (four Subs, or Sub and survive). | After EVs are set, nudge HP EVs by up to 8 to hit the parity for the set's item and moves. | partly: B15 has the first three; Substitute is new | role-sets | S6 |
| E7 | The nature should raise the stat that is most invested, and lower an attacking stat the set never uses. Mixed attackers must lower a defence instead. | Mixed attackers: Naive, Hasty, Lonely or Mild. Never lower an attacking stat the set uses. | `spreadFor()` for a set with both physical and special attacks: a nature that lowers Def or SpD, whichever the set's role needs least. | partly: single-stat roles are right; mixed sets are not handled | role-sets | S6 |

## 5. Items per role

| # | Why | Rule | Bot rule | Status | Where | Src |
|---|---|---|---|---|---|---|
| I1 | A Choice Scarf trades power and flexibility for speed. It pays only when the extra speed changes what the Pokémon outspeeds. A naturally fastest-tier attacker gains little; one in the middle speed band that jumps past the tier's fastest threats and +1 sweepers gains a lot. | Scarf goes on attackers whose scarfed Speed passes key benchmarks (the fastest common unboosted threat, common +1 sweepers) that their unscarfed Speed does not. Otherwise Band, Specs or Life Orb. A Scarf user wants a pivot move or strong STABs to clean with. | In `itemFor()` (Fast Attacker, all attacks): Scarf only when, against the threat list, 1.5x Speed outspeeds at least 2 more usage-weighted threats (or +1 boosted sweepers) than 1.0x does. Otherwise Band/Specs. | new: `itemFor()` gives Scarf to any all-attack Fast Attacker | role-sets `itemFor()` | S7, S1 |
| I2 | Boots stop all hazard damage but cost the item slot. They are worth most on SR-weak members and frequent switchers, and least when the team has removal and the member needs a power item. | Boots: SR-weak members, pivots on teams without removal, all of stall with no remover (A3). Offensive members drop Boots for a power item when the team has removal. | `itemFor()`: when the team has a remover and the set is a breaker, prefer the power item over Boots unless the member is 4x Rock-weak. | partly: `itemFor()` puts Boots on any Rock-weak member first | itemFor, assembler `improveItems()` | S16 |
| I3 | Contact punishment is at its best on physically defensive pivots that take U-turns and contact hits all game. | Rocky Helmet on the physically defensive pivot. | Covered (rule 20). | covered | none | S8 |
| I4 | Duration items double what a one-slot engine buys. | Light Clay on the screens setter (A6). A weather rock on a single-weather setter (A4). | See A4 and A6. | new | itemFor | S21, S5 |
| I5 | A Trick Room turn spent locked into the wrong move is a wasted TR turn. Life Orb keeps flexibility inside the short window. | TR abusers: prefer Life Orb (or a type boost) over Choice items. Sources disagree: SM TR ran Choice breakers, so this is soft. | On `style: 'trickroom'`: small bonus for Life Orb over Band/Specs, never a Scarf. | new | itemFor | S20 (S5 differs) |

## 6. Sets and moves

| # | Why | Rule | Bot rule | Status | Where | Src |
|---|---|---|---|---|---|---|
| M1 | On offense, a hazard setter that only sets hazards hands the opponent a free turn. An **offensive setter** keeps pressure while it works. | On offense, the hazard setter carries at least 2 real attacks. | Offense: soft when the SR (or Spikes) setter has fewer than 2 attacks worth 60% or more of its best STAB. | partly: B8 passivity is team-wide, not about the setter | role-sets, team-logic | S12 |
| M2 | Every member must do something every turn it is in. Two passive members on the field in a row give away tempo. | No member with a single useful action. | Covered (B8, rule 23). | covered | none | S20, S2 |
| M3 | Burn and paralysis from one member each open setup chances for the rest. | A status spreader (Will-O-Wisp, Thunder Wave, Glare) on balance. | Covered as setup answers (rule 11) and speed control. | covered | none | S8 |

## 7. Tera (ladder formats only)

| # | Why | Rule | Bot rule | Status | Where | Src |
|---|---|---|---|---|---|---|
| X1 | Tera changes a threat's type in the middle of the battle, so a check that relies on typing can fail. Players say counters became unreliable. | Count a check only if it still checks after the threat's common Tera. | In `threatCover()`: evaluate each threat under its base types and its top usage Tera type (from the Tera index or usage), and use the worse result. Ladder formats only. | partly: B6 says "counting Tera", not coded | teambuilder `threatCover()`, team-logic | S19, S25 |
| X2 | One Tera type can do several jobs at once: remove a weakness, power a STAB, and fill a gap in the team (for example a Poison Tera that also absorbs Toxic Spikes). | Pick the Tera that does the most jobs. | Score each legal Tera type: +2 removes the set's worst weakness to a top threat; +2 boosts a STAB or Tera Blast; +1 for each team gap it fills (Ghost spinblock, Poison Toxic Spikes absorb, Flying/Fairy immunity, a missing resist). Take the best. `role-sets` now takes `teraTypes[0]`. | partly: B14 lists utility Teras | role-sets `buildSet()`, assembler | S8, S19 |
| X3 | Walls want a Tera that flips a weakness. Breakers and sweepers want one that powers their main attack (an Adaptability-like boost) or lets Tera Blast hit their check. | Defensive roles take a defensive Tera, offensive roles a STAB or coverage Tera. | Role to policy: walls score the weakness term x2; attackers score the STAB term x2. | new | role-sets | S17, S19 |
| X4 | Tera Blast costs the Tera and a moveslot. It is worth both only when nothing else in the movepool hits the set's main check. | Tera Blast only when it lets the set beat a top check no other learnable move threatens. At most one per team (B14). | Take Tera Blast only if `threatGain()` for it is higher than for every learnable non-Tera move by a margin. | partly: B14 limits it to one per team | role-sets | S18, S8 |

## 8. Where sources disagree

- **Trick Room items**: the DPP guide wants Life Orb and mixed attackers; the SM playstyle post and SV RMTs run Choice-spam TR. Keep it soft.
- **Ground immunities**: an ADV-era heuristic asks for about 1.5 on offense and 2 on slower teams. Modern guides (checklist rule 21, B4) ask for 1. Keep 1, with a fractional count (Air Balloon 0.5) as a tie-break.
- **Hazard removal on hazard-stack teams**: the stack guide makes a spinblocker mandatory; SV samples pair a stack with their own spinner. Both agree removal must not be Defog (H1).
- **Leads**: the old lead articles treat leads as a role. Modern guides say only offense needs one (H3).

## 9. Ten to do first

1. **0 Attack IV on non-physical sets**, 0 Speed IV on TR, Gyro Ball and slow pivots (E4, E5). One-line change, and it affects every special set.
2. **Scarf only where it changes the speed tier** (I1).
3. **Spin over Defog** on hazard-stack and screens teams (H1).
4. **Trick Room archetype**: recognise it, 2-3 setters, min-Speed abusers, inverted speed control (A5).
5. **Dual screens archetype**: Light Clay, both screens, 3+ setup sweepers, no Defog (A6).
6. **Weather completion**: a rock on a single-weather setter, 2+ abusers, an answer to a rival setter (A4).
7. **"No wall heals for free"**: no common wall may wall 4 or more members (T4).
8. **Backup win condition** with different counters (T2).
9. **HO cleaner slot and 2 breakers** (A1). **Stall cleric** (A2).
10. **Checks survive the threat's common Tera** (X1, ladder only), then a multi-job Tera choice (X2, X3).

Runners-up: speed EVs to the benchmark with the surplus in bulk (E1, E3); a spinner that hits Ghosts (H2); an offensive hazard setter on offense (M1); the refinement pass (T6).

## 10. Confidence

- Most pages were read through a page summariser, not word for word. The rules are paraphrased, and numbers were kept only where the page gave them.
- S26 (stall Boots and Knock Off absorber advice) and S27 (leads) were seen only as search snippets.
- H2 is marked **[G]**: general knowledge inferred from the spinblocker role, not stated in a source.
- Several sources are older generations (DPP, BW, SM). Only their principles are used here; their Pokémon and numbers are not.

## Sources

- S1 Building Hyper Offense in OU (Smogon University): https://www.smogon.com/articles/hyper-offense-in-ou
- S2 How to Rate (Smogon RMT guide): https://www.smogon.com/rmt/guide
- S3 How to Build a Great Stall: https://www.smogon.com/forums/threads/how-to-build-a-great-stall.3504635/
- S4 A "Brief" Guide to Weather: https://www.smogon.com/forums/threads/a-brief-guide-to-weather.3664292/
- S5 USUM Playstyle Analysis: https://www.smogon.com/forums/threads/usum-playstyle-analysis.3621912/
- S6 A Beginner's Guide to Distributing EVs: https://www.smogon.com/forums/threads/a-beginners-guide-to-distributing-evs.40667/
- S7 SV OU Speed Tiers: https://www.smogon.com/forums/threads/sv-ou-speed-tiers.3711207/
- S8 SV OU Teambuilding Lab: https://www.smogon.com/forums/threads/sv-ou-teambuilding-lab-open.3743918/ and https://www.smogon.com/forums/threads/sv-ou-teambuilding-lab-open.3743918/page-2
- S9 Teambuilding heuristics: https://www.smogon.com/forums/threads/teambuilding-heuristics.3687455/
- S10 Knowing How to Find Your Win Condition: https://www.smogon.com/forums/threads/knowing-how-to-find-your-win-condition.3474271/
- S11 Good Teambuilding Cores in OU: https://www.smogon.com/smog/issue42/good-teambuilding-cores-ou
- S12 VoltTurn in OU: https://www.smogon.com/articles/voltturn-in-ou
- S13 Pivots in SM OU: https://www.smogon.com/articles/pivots-sm-ou
- S14 Introduction to Hazard Stacking: https://www.smogon.com/forums/threads/introduction-to-hazard-stacking.3533058/
- S15 Creating / Selecting a Lead: https://www.smogon.com/smog/issue10/leads
- S16 Heavy-Duty Boots discussion: https://www.smogon.com/forums/threads/heavy-duty-boots.3667472/
- S17 SV OU Sample Teams: https://www.smogon.com/forums/threads/sv-ou-sample-teams-new-samples-added-post-spl-and-tera-blast-ban.3712513/
- S18 Tera Blast in SV OU: https://www.smogon.com/articles/ou-tera-blast
- S19 SV OU Suspect Coverage: Terastallization: https://www.smogon.com/articles/svou-suspect-terastallization
- S20 A Guide to DPP Trick Room Teams: https://www.smogon.com/dp/articles/trick_room_guide
- S21 Dual screen hyper offense: https://www.smogon.com/forums/threads/dual-screen-hyper-offense.3732003/
- S22 Default Atk IVs to 0 without a physical attack: https://www.smogon.com/forums/threads/done-setting-the-default-atk-ivs-to-0-if-the-pokemon-doesnt-have-a-physical-attack.3569510/ ; https://www.smogon.com/forums/threads/why-are-some-pokemon-recommended-to-have-0-attack-ivs.3754240/
- S23 SV OU Role Compendium: https://www.smogon.com/forums/threads/sv-ou-role-compendium.3713852/
- S24 Synergy and Cores: https://www.smogon.com/smog/issue39/synergy-cores-teambuilding
- S25 Tera Type Index: https://www.smogon.com/forums/threads/tera-type-index.3759328/
- S26 SV OU stall advice thread (search snippet): https://www.smogon.com/forums/threads/looking-for-advice-for-my-sv-ou-stall-team.3763663/
- S27 Leads in Pokemon (search snippet): https://www.smogon.com/smog/issue8/leads
