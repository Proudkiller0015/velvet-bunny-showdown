# Teambuilding checklist (design notes for the bot's team builder)

Researched 2026-09-17 from Smogon teambuilding guides and new-player resources (sources at the bottom).
Tier-agnostic rules; the threat list per format should come from that format's usage stats.
H = hard constraint (reject the team), S = soft preference (scored). Numeric thresholds are a
calibration of the guides, which give almost no numbers.

**Status** (2026-09-23, Pinkacross's rules and set sanity added 2026-09-24) is marked on each rule: *implemented*, *partly* or *not*, with where.
The rules live in `src/team-logic.js` (`analyze()` measures, `issues()` judges; a hard issue
costs 10 in `score()`, a soft one 3, so "reject" means "loses to any team without it"). The
team is searched against that score by `src/team-assembler.js` (RP trainers, the RP bot's
Build my team, offline ladder teams) and by `TeamBuilder.chooseTeam()` in `src/teambuilder.js`
(ladder drafts); both also pass the format's threat list (`TeamBuilder.threats()`: usage stats
plus `data/velvet/rp-usage.json`) when there is one. Per-set move choice is `src/role-sets.js`.

## 1. Universal rules
1. **Stealth Rock**: exactly one setter (H >= 1; S penalty for a second).
   - *Implemented.* `issues()` (hard with none, soft for two); the assembler teaches one to the most supportive member and untrains extras (`assemble()`, `oneSetterEach()` for Spikes/Toxic Spikes/Web).
2. **Hazard control** (H on balance / bulky offense / stall): if >= 2 non-Boots members take >= 25% from SR, need a remover (Rapid Spin, Mortal Spin, Defog, Tidy Up, Court Change, Magic Bounce) or Boots on them. Balance needs 1 remover, stall 1-2, HO 0-1.
   - *Implemented.* `rockWeak` counts non-Boots members weak to Rock; no remover then is hard (soft on HO). A balance or stall team with no remover is a soft issue, a second remover off stall a soft one. Removers include Magic Bounce. The assembler teaches removal (`assemble()`); Boots come from `itemFor()`.
3. **Spinblocking** (S): Ghost blocks Rapid Spin; Good as Gold blocks Defog/Mortal Spin. Worth it with Spikes/Toxic Spikes.
   - *Implemented* (2026-09-24), soft, weight 1: with Stealth Rock and Spikes/Toxic Spikes on the team, nothing that keeps them up (a Ghost type, Good as Gold, Magic Bounce, or a Defiant/Competitive Defog punisher). `report.spinblockers`, `moreRules()`.
4. **Defensive typing**: per attacking type count weak (>= x2) and resist/immune (<= x0.5) members, abilities (Levitate, Earth Eater, Flash Fire, Well-Baked Body, Water Absorb, Storm Drain, Volt Absorb, Lightning Rod, Sap Sipper, Thick Fat, Purifying Salt) and Air Balloon included; ignore Tera.
   - H: no type hits >= 4 members super-effectively. S: <= 2.
   - H: >= 1 resist/immunity to Ground, Fighting, Dragon, Fairy, Water, Fire, Ice, Electric, Dark, Ghost, Steel. S: >= 2 for Water, Ground, Fighting, Dragon. (HO relaxes this.)
   - *Implemented* (`effectiveness()`, `issues()`): 4 weak is hard, 3 soft; a missing resist to a key type is hard except on HO (hard there only with 3 missing); one answer to Water/Ground/Fighting/Dragon is soft. Abilities and Air Balloon counted, Tera ignored.
5. **Offensive coverage** (H): every top threat is hit at least neutrally by >= 2 members. S: a super-effective hit on Steel, Fairy, Water, Dragon, Ground.
   - *Implemented where the threats are known.* `analyze(dex, sets, { threats })` lists threats fewer than two members hit neutrally with the moves they carry (ability immunities and Freeze-Dry included) - hard. Nothing hitting two or more of Steel/Fairy/Water/Dragon/Ground super effectively is soft. Per set, `threatGain()` in role-sets.js weights coverage moves by the threats they improve (see below). With no threat list (Build my team, gym trainers) only the super-effective part applies.
6. **Physical/special balance** (H, except stall): >= 2 attackers of each category; S: <= 4 of one.
   - *Implemented.* `issues()`: none on one side hard (4+ members); fewer than 2 hard (5+, not stall); 5+ of one side soft.
7. **Speed control** (H offense, S balance): points from priority attacks, Choice Scarf, Thunder Wave, final Speed >= 336. HO >= 3, bulky offense >= 2, balance >= 1.
   - *Implemented.* `speedStat()` computes real Speed from EVs/nature/level (336 scaled by level); priority, Scarf, Thunder Wave/Icy Wind/Tailwind/Trick Room count. HO needs 3, BO 2 (hard), balance 1. The assembler teaches a strong priority attack to an attacker when short (`addSpeedControl()`), and setup sweepers take one in role-sets.js.
8. **Pivoting** (H bulky offense/balance, S otherwise): U-turn, Volt Switch, Flip Turn, Teleport, Parting Shot, Chilly Reception, Shed Tail. Balance >= 2.
   - *Partly.* No pivot on BO/balance and a single pivot on BO or balance are soft issues (2026-09-24: bulky offense added, after Pinkacross's "at least 2 users, except stall and HO"). Not made hard: he frames it as a need, but each new hard rule costs the search raw strength.
9. **Recovery on defensive members** (H stall, S elsewhere): Recover/Roost/Slack Off/Soft-Boiled/Synthesis/Moonlight/Morning Sun/Strength Sap/Shore Up/Milk Drink/Rest/Wish, Regenerator, Poison Heal.
   - *Implemented.* Hard on stall for every defensive member without it (Regenerator/Poison Heal count), soft elsewhere when no wall has any.
10. **Status absorber** (S >= 1): Poison/Steel (Toxic), Fire (burn), Electric (paralysis), Guts, Poison Heal, Magic Guard, Natural Cure, Purifying Salt, Good as Gold, Comatose, Lum Berry, a cleric.
   - *Implemented* (soft), `statusAbsorb` in `analyze()`. A cleric is not counted.
11. **Answers to setup** (H: >= 2 distinct mechanisms, >= 1 working vs special setup): Unaware, phazing (Whirlwind/Roar/Dragon Tail/Circle Throw/Red Card), Haze/Clear Smog, Encore, Destiny Bond, burn/paralysis, faster Scarf, strong priority.
   - *Implemented.* Counted by distinct mechanism (`SETUP_ANSWERS`: Unaware, phazing incl. Red Card, Haze/Clear Smog, Encore, Destiny Bond, burn, paralysis, strong priority, Scarf); fewer than two, or none that works on special setup (burn alone), is hard. The assembler teaches a missing one to a wall (`answerSetup()`), never to an Assault Vest set.
12. **Stallbreaking** (S, H on HO/BO): Taunt, Knock Off, Trick, Encore, or a Band/Specs attacker.
   - *Implemented.* Hard on HO/BO, soft on balance.
13. **No role redundancy** (S): no duplicate SR, no second remover (except stall), <= 2 passive members on offense.
   - *Implemented* (2026-09-24). Second SR, second remover (off stall) and duplicate hazard setters are handled; more than two passive members off stall is soft (rule 23). Also soft: two members in the same kind of slot sharing a type with no distinct job (Fildrong's niche duplicates, weight 1), and four or more of one type (Pinkacross B3, weight 1.5; themed teams exempt).
14. **Every slot has a purpose** (S): reject a candidate that adds no new role or threat answer.
   - *Implemented* (2026-09-24), soft, weight 1.5: `report.purposeless` lists members that are not one of at most two doing anything (hazards, removal, pivot, speed control, a setup answer, stallbreaking, breaking or winning, status absorbing, an immunity, Knock Off, contact punishing, spinblocking, a cleric), not one of three or fewer walls, and not the only resist to a key type.

## 1b. Pinkacross's rules (added 2026-09-24)
From `docs/research-pinkacross.md` (his "18 things every team needs", "the #1 teambuilding mistake",
breaking cores, item traps). All in `src/team-logic.js` (`analyze()` fields, `issues()` and
`eighteenThings()`), soft unless said otherwise. A soft issue may carry a smaller `weight` in
`score()` (default 3) so the lesser ones cannot outvote a hard rule.

15. **Immediate power** (B2; H on balance and bulky offense, S on HO, stall exempt): a breaker that hits hard on entry without setting up - Choice Band/Specs or Life Orb, or an all-out set with Huge Power, Sheer Force, Adaptability and the like. Setup sweepers do not count.
    - *Implemented.* `isBreaker()`; `report.breakers`. With no item yet (the assembler's search, the RP bot before the first badge) an all-out attacker on 100+ Atk/SpA counts, since `itemFor()` makes it a Band/Specs/LO set. After items, `improveItems()` in the assembler swaps an attacker to Band/Specs/LO when that raises the score (never at the cost of the Scarf that was the team's speed control).
16. **Breaking core first** (B1): when the seed is a wall, the next pick is a breaker aimed at what the wall draws in.
    - *Partly.* `assemble()` treats the first fixed member (else the strongest candidate) as the seed; while it plays a wall, a breaker whose attacks hit what the wall's attacks cannot (the format's threats, else the 18 types: `drawnIn()`, `cover()`) adds up to 6 to the search score. Not done: usage/teammate data for the real switch-ins; choosing the archetype from the seed; `TeamBuilder.chooseTeam()` (the Smogon draw) has no seed.
17. **Toxic Spikes absorber** (B6; S): flagged when a layer would poison 3+ members (grounded, not Poison/Steel, no Boots or Immunity/Poison Heal/Magic Guard...) and no grounded, Boots-free Poison type is there. Weight 2. *Implemented.* The "1-2 poisoned and no removal" case is left to the removal rule.
18. **A Steel type** (S, weight 2; themed teams exempt). *Implemented.*
19. **Knock Off**: 1-2 users (none is S off HO/stall; 3+ is S, weight 1.5), and a **Knock Off absorber** (S off HO, weight 1.5: no item, a one-use item, Sticky Hold/Unburden/Klutz; only checked when items are known). *Implemented*; the assembler teaches Knock Off to its most supportive member when the six have none (`addKnockOff()`).
20. **Contact punisher** (S off HO/stall, weight 1 - "the least crucial"): Rocky Helmet, Rough Skin, Iron Barbs, Flame Body, Static... *Implemented*; `improveItems()` gives a Rocky Helmet to a wall that heals when that raises the score.
21. **Ground and Electric immunities**, apart from resists (B4; S, weight 2 each; themed exempt): Ground by a Flying type, Levitate or Earth Eater (Air Balloon only on HO); Electric by a Ground type, Volt Absorb, Lightning Rod or Motor Drive (HO exempt). *Implemented.* Left soft: rule 4 already makes the resist hard, and he allows "solid resists plus answers" instead of a Ground immunity.
22. **A fast member** (S): faster (Scarf counted) than the fastest threat nothing on the team walls (resists one of its types, weak to none). *Implemented* where threats are known (`report.outsped`).
23. **Passivity and pacing** (B8, his #1 mistake; S): per set, `isPassive()` (no pivot, no setup, and Rest or no attack worth a STAB-adjusted 90 from a real attacking stat) and `paceOf()` (fast: one-use item or a move that spends the user; slow: recovery/Regenerator/Leftovers wall). Flagged: a passive set on HO; a passive wall with no other wall behind it on bulky offense; 3+ passive members off stall; one-use sets on balance or stall.
    - *Implemented* (2026-09-24). Scored against, and sets are now chosen for the team's archetype (section 1c).
    - **Item hygiene** (B7, B10): `itemFor()` no longer falls back to Shell Bell, Scope Lens, Wide Lens, Quick Claw or King's Rock; `itemFor(..., { oneUse: false })` (the assembler passes it for balance and stall) skips Focus Sash, berries, Booster Energy, White Herb, Weakness Policy, Air Balloon unless nothing else fits. *Implemented.*

## 1c. Set sanity and archetype-aimed sets (added 2026-09-24)
Every build path now checks and repairs each set (`RS.setProblems()` / `RS.repairSet()` in `src/role-sets.js`):
the Smogon draw (`TeamBuilder.sane()`, with the format's own learn check), the assembler (moves only, before
items), and the role sets for this server's Pokemon. Tested by `test/set-sanity.test.js`.
- **Item against moves** (Smogon basics; Pinkacross B10): no Choice item with a status move (Trick/Switcheroo, and
  Healing Wish/Memento that end the user, aside; with Trick on the set the rest is free), no Assault Vest with one,
  no Band on a special set or Specs on a physical one, no Life Orb on a set with one attack, no trap item (Wide Lens,
  Scope Lens, Shell Bell, Quick Claw, King's Rock, Blunder Policy...), no status orb without a user for it. The cheaper
  side is changed: an attacking set with one stray status move swaps it for its best missing attack; a support set
  keeps its moves and gets an item that suits them.
- **Moves**: at least three that do something (a status move that only lowers a foe stat, Swagger, Focus Energy, or a
  charge move with no Power Herb or weather is not one), no dead slot where a real move fits, and a main STAB attack
  (fixed damage, Body Press, Foul Play and an orb Facade count).
- **Items by role** (`itemFor()`): a mixed attacker takes Life Orb, not a Choice item (Pinkacross B10); a Choice Scarf
  only where 1.5x Speed passes a quarter of the format's threats (research-teambuilding I1), else Band/Specs; Band/Specs
  only with an easy click - a STAB 70% of threat usage takes neutral damage from - or a pivot (Pinkacross R-T12), else
  Life Orb; Flame/Toxic Orb for Guts, Flare Boost, Toxic Boost, Poison Heal (Fildrong D5). Item-less sources (Random
  Battle data, the learnset) get `itemFor()` instead of a random pick from the format's list.
- **IVs** (research-teambuilding E4, E5): 0 Attack on a set with no physical attack; 0 Speed and a -Speed nature on a
  slow Trick Room or Gyro Ball user.
- **Archetype first** (checklist section 3 step 1; Pinkacross B8, B18): a drafted ladder team aims at an archetype
  (hyper offense 25%, bulky offense 30%, balance 35%, stall 10%); each species' Smogon or factory set is drawn weighted
  by how it suits it (setup, Choice, one-use item, pivot, wall; Choice below neutral on HO per R-T12), velvet role
  sets likewise (`RS.archetypeFit()`), a team that comes out as the aimed archetype earns 3, one-use items are skipped
  on balance and stall, and bulky offense/balance attackers take their pivot move. `assemble(..., { archetype })` does
  the same for the assembler. `RS.buildSet(..., { archetype })` draws a role by fit when none is asked for.
- **Draft polish**: after the six are chosen, a missing Stealth Rock and a missing second setup answer are taught to
  the most supportive member that legally learns them, kept only if the set validates and the score does not drop.
- **Lead order** (Pinkacross A2): `A.leadOrder()` puts a hazard setter/pivot first and setup sweepers last; the draft
  and the RP bot's Build my team use it.

Other rules added 2026-09-24, soft and light (weight 1 unless said): Defog on a team that sets its own hazards or
screens (research-teambuilding H1); one win condition only, off stall (T2); hyper offense with fewer than two
breakers or no cleaner (A1); stall with no cleric (A2); a common wall that walls four or more members with nothing to
break it (T4, weight 2); a balance team with only two pivots (Pinkacross R-T15); "no priority" now costs 5, not 3
(Pinkacross R-T11 would make it hard). Where Pinkacross and Fildrong differ, Pinkacross's reading was taken.

Not done from the research: priority made hard off stall (B7b), pivots hard on balance (B7c), Eviolite
only on proven NFE walls (B10), Tera planning (B14), speed/EV benchmarks (B15), threat weighting by usage
floor (B17).

## 2. Archetypes
- **Hyper offense**: 2-4 sweepers, 1-3 breakers, SR (often a suicide lead), 0-1 remover, >= 3 speed control; the check to one sweeper is what another sets up on. Avoid passive or slow members. Preview: >= 5 offensive species, Glimmora/Deoxys-S leads, Booster Energy Paradoxes.
- **Bulky offense**: 1 sweeper, 2-3 breakers, 1 stallbreaker, SR, 0-1 remover, defensive backbone and pivots.
- **Balance**: 0-1 sweeper, 1-2 breakers, 1 stallbreaker, 2-3 walls/pivots, SR, 1 remover (required); pivots that counter the checks to the breaker.
- **Semi-stall**: 4-5 walls, 1 setup/offensive stallbreaker, SR, 1-2 removers.
- **Stall**: 5-6 walls, 1 stallbreaker, SR, removers/blockers, Unaware, recovery on everyone. Preview: >= 3 of Blissey, Toxapex, Dondozo, Clodsire, Quagsire, Alomomola, Corviknight, Skarmory, Gliscor, Garganacl.
- **Weather**: setter plus abusers (Torkoal/Ninetales sun, Pelipper/Politoed rain, Tyranitar/Hippowdon sand, Ninetales-Alola snow).
- **Recognising at preview** (items are hidden): per-species defensive score from usage stats (share of sets with recovery, Leftovers, Rocky Helmet or Boots versus Choice, Life Orb or Booster). Sum of defensive members: 4+ stall, 2-3 balance, 1-2 bulky offense, 0 HO.

Archetypes: *partly*. `analyze()` classifies a team (stall / balance / bulky offense / hyper
offense by its walls and setup members) and the rules above scale with it, and weather cores are
checked. The ladder draft now picks an archetype first and draws sets for it (section 1c); the
quotas (sweepers, breakers, walls per archetype) are still only scored through the rules, and the
assembler takes an archetype only when the caller passes one.

## 3. Build procedure
1. Pick an archetype and a win condition (a 2-3 member core), plus a backup win condition.
2. List the win condition's checks (usage stats, dex overviews).
3. Add partners that remove those checks or cover its weaknesses; reassess after each addition.
4. Fill role slots: SR, removal/Boots, pivot, speed control, setup answers.
5. Patch shared weaknesses (rule 4).
6. Threat check: >= 2 checks or 1 counter per top threat. Counter: takes the threat's best hit from its top 2 sets at <= 50% and 2HKOs back. Check: faster and OHKOs, or survives and KOs. Score >= 2 (check = 1, counter = 2).
7. Reject hard-rule failures; rank the rest by weighted soft rules plus usage, with shared weaknesses and threat coverage weighted above raw usage.

Status: step 1 is *partly* there (the draft picks an archetype, not a win condition); steps 4, 5 and 7 are what the assembler and `chooseTeam()` do (the draft now fills step 4's Stealth Rock and setup answers after choosing); step 3 is *partly* there
for a wall seed (rule 16). Step 6 is *partly*: the
threat check is type-level (`TeamBuilder.threatCover()`: resists the threat's STAB or outspeeds
it and hits it super effectively; rule 5 above for the other direction), not a damage calculation
of checks and counters. Steps 1-3 (choosing a win condition first) are *not* implemented.

## Move choice per set (src/role-sets.js)
- Coverage is judged against the common Pokemon that wall the set's STAB (`threatGain()`): each threat
  counts by its usage weight and real type pair and ability; a walled threat gains in full, one already
  hit neutrally a quarter. The eighteen-types `coverageGain()` is kept as a one-fifth tie-break, and as
  the whole measure when no threat list is passed (`buildSet(..., { threats })` is optional).
- Setup sweepers take their strongest priority attack worth a slot (`priorityValue()` >= 60: STAB 40 or
  anything 60+, Technician counted), from the role pool or the learnset (Dragonite's Extreme Speed).
- Self-dropping attacks (Close Combat, Superpower, Draco Meteor; not Speed-only drops) are halved in value
  on bulky and support roles and are their last choice for a coverage slot; fast sets are unaffected.

## 4. Gen 9 OU threat check (Aug 2026 viability; from overviews, some inferred)
- **Zamazenta**: contact punishers (Flame Body Moltres, Static Zapdos, Rocky Helmet Corviknight), Will-O-Wisp, Unaware Dondozo, Hatterene, SR chip.
- **Gholdengo**: Ground/Dark attackers (Great Tusk, Ting-Lu, Samurott-H, Kingambit), faster Darkrai.
- **Great Tusk**: physically bulky Flying/Water (Corviknight, Moltres, Dragonite, Alomomola), Ogerpon-W; a Ghost spinblocker.
- **Dragonite**: Great Tusk, Zamazenta, Corviknight, Will-O-Wisp, Unaware, Ice/Fairy hits after Multiscale breaks.
- **Kingambit**: Fighting/Ground/Fire hits (Zamazenta, Great Tusk), Will-O-Wisp, Sucker Punch bait, priority.
- **Kyurem**: bulky Steels (Kingambit, Gholdengo, Iron Crown, Scizor), SR.
- **Ogerpon-W**: Raging Bolt, Kyurem, Hydrapple, Sinistcha, Pecharunt.
- **Iron Valiant**: Hatterene, Moltres, Tinkaton, Corviknight, Gholdengo, priority.
- **Gliscor**: Water/Ice attackers, Knock Off.
- **Ting-Lu**: Knock Off, status and hazard chip, Water/Grass attackers.
- **Pecharunt**: Ground attackers, Gholdengo.
- **Darkrai / Raging Bolt**: Ting-Lu, Blissey, faster Fighting/Fairy attackers.
- **Samurott-H**: Corviknight, Weezing-G, Fighting/Fairy attackers.
- **Dragapult / Ceruledge / Cinderace**: Kingambit/Sucker Punch against the Ghosts; Alomomola, Dondozo, Ting-Lu, Gliscor against the Fire types.

## Where sources disagree
- The BW intro guide sets fixed quotas (>= 2 Water resists, a Steel type, a Ground immunity, always a remover); the archetype guide says HO ignores defensive synergy and may skip removal.
- Stall uses 1-2 removers where other archetypes use at most 1.
- Viability rankings are not a recipe on their own.

## Sources
- https://www.smogon.com/forums/threads/teambuilding-guide.3552468/
- https://www.smogon.com/forums/threads/ou-introduction-to-team-building.3664196/
- https://www.smogon.com/articles/getting-started
- https://www.smogon.com/smog/issue39/synergy-cores-teambuilding
- https://www.smogon.com/forums/threads/team-building-basics.3450908/
- https://www.smogon.com/forums/threads/tips-on-teambuilding.3727229/
- https://www.smogon.com/forums/threads/sv-ou-indigo-disk-viability-ranking-thread-update-on-post-1393.3734134/
- https://www.smogon.com/forums/threads/sv-ou-sample-teams-new-samples-added-post-spl-and-tera-blast-ban.3712513/
- https://www.smogon.com/forums/threads/sv-ou-role-compendium.3713852/
