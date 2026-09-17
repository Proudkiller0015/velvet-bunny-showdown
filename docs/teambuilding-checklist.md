# Teambuilding checklist (design notes for the bot's team builder)

Researched 2026-09-17 from Smogon teambuilding guides and new-player resources (sources at the bottom).
Tier-agnostic rules; the threat list per format should come from that format's usage stats.
H = hard constraint (reject the team), S = soft preference (scored). Numeric thresholds are a
calibration of the guides, which give almost no numbers.

## 1. Universal rules
1. **Stealth Rock**: exactly one setter (H >= 1; S penalty for a second).
2. **Hazard control** (H on balance / bulky offense / stall): if >= 2 non-Boots members take >= 25% from SR, need a remover (Rapid Spin, Mortal Spin, Defog, Tidy Up, Court Change, Magic Bounce) or Boots on them. Balance needs 1 remover, stall 1-2, HO 0-1.
3. **Spinblocking** (S): Ghost blocks Rapid Spin; Good as Gold blocks Defog/Mortal Spin. Worth it with Spikes/Toxic Spikes.
4. **Defensive typing**: per attacking type count weak (>= x2) and resist/immune (<= x0.5) members, abilities (Levitate, Earth Eater, Flash Fire, Well-Baked Body, Water Absorb, Storm Drain, Volt Absorb, Lightning Rod, Sap Sipper, Thick Fat, Purifying Salt) and Air Balloon included; ignore Tera.
   - H: no type hits >= 4 members super-effectively. S: <= 2.
   - H: >= 1 resist/immunity to Ground, Fighting, Dragon, Fairy, Water, Fire, Ice, Electric, Dark, Ghost, Steel. S: >= 2 for Water, Ground, Fighting, Dragon. (HO relaxes this.)
5. **Offensive coverage** (H): every top threat is hit at least neutrally by >= 2 members. S: a super-effective hit on Steel, Fairy, Water, Dragon, Ground.
6. **Physical/special balance** (H, except stall): >= 2 attackers of each category; S: <= 4 of one.
7. **Speed control** (H offense, S balance): points from priority attacks, Choice Scarf, Thunder Wave, final Speed >= 336. HO >= 3, bulky offense >= 2, balance >= 1.
8. **Pivoting** (H bulky offense/balance, S otherwise): U-turn, Volt Switch, Flip Turn, Teleport, Parting Shot, Chilly Reception, Shed Tail. Balance >= 2.
9. **Recovery on defensive members** (H stall, S elsewhere): Recover/Roost/Slack Off/Soft-Boiled/Synthesis/Moonlight/Morning Sun/Strength Sap/Shore Up/Milk Drink/Rest/Wish, Regenerator, Poison Heal.
10. **Status absorber** (S >= 1): Poison/Steel (Toxic), Fire (burn), Electric (paralysis), Guts, Poison Heal, Magic Guard, Natural Cure, Purifying Salt, Good as Gold, Comatose, Lum Berry, a cleric.
11. **Answers to setup** (H: >= 2 distinct mechanisms, >= 1 working vs special setup): Unaware, phazing (Whirlwind/Roar/Dragon Tail/Circle Throw/Red Card), Haze/Clear Smog, Encore, Destiny Bond, burn/paralysis, faster Scarf, strong priority.
12. **Stallbreaking** (S, H on HO/BO): Taunt, Knock Off, Trick, Encore, or a Band/Specs attacker.
13. **No role redundancy** (S): no duplicate SR, no second remover (except stall), <= 2 passive members on offense.
14. **Every slot has a purpose** (S): reject a candidate that adds no new role or threat answer.

## 2. Archetypes
- **Hyper offense**: 2-4 sweepers, 1-3 breakers, SR (often a suicide lead), 0-1 remover, >= 3 speed control; the check to one sweeper is what another sets up on. Avoid passive or slow members. Preview: >= 5 offensive species, Glimmora/Deoxys-S leads, Booster Energy Paradoxes.
- **Bulky offense**: 1 sweeper, 2-3 breakers, 1 stallbreaker, SR, 0-1 remover, defensive backbone and pivots.
- **Balance**: 0-1 sweeper, 1-2 breakers, 1 stallbreaker, 2-3 walls/pivots, SR, 1 remover (required); pivots that counter the checks to the breaker.
- **Semi-stall**: 4-5 walls, 1 setup/offensive stallbreaker, SR, 1-2 removers.
- **Stall**: 5-6 walls, 1 stallbreaker, SR, removers/blockers, Unaware, recovery on everyone. Preview: >= 3 of Blissey, Toxapex, Dondozo, Clodsire, Quagsire, Alomomola, Corviknight, Skarmory, Gliscor, Garganacl.
- **Weather**: setter plus abusers (Torkoal/Ninetales sun, Pelipper/Politoed rain, Tyranitar/Hippowdon sand, Ninetales-Alola snow).
- **Recognising at preview** (items are hidden): per-species defensive score from usage stats (share of sets with recovery, Leftovers, Rocky Helmet or Boots versus Choice, Life Orb or Booster). Sum of defensive members: 4+ stall, 2-3 balance, 1-2 bulky offense, 0 HO.

## 3. Build procedure
1. Pick an archetype and a win condition (a 2-3 member core), plus a backup win condition.
2. List the win condition's checks (usage stats, dex overviews).
3. Add partners that remove those checks or cover its weaknesses; reassess after each addition.
4. Fill role slots: SR, removal/Boots, pivot, speed control, setup answers.
5. Patch shared weaknesses (rule 4).
6. Threat check: >= 2 checks or 1 counter per top threat. Counter: takes the threat's best hit from its top 2 sets at <= 50% and 2HKOs back. Check: faster and OHKOs, or survives and KOs. Score >= 2 (check = 1, counter = 2).
7. Reject hard-rule failures; rank the rest by weighted soft rules plus usage, with shared weaknesses and threat coverage weighted above raw usage.

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
