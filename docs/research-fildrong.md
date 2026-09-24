# Research: what Fildrong teaches about building, sets and what makes a Pokémon strong

Researched 2026-09-24, for the team builders (`src/team-logic.js`, `src/team-assembler.js`, `src/teambuilder.js`,
`src/role-sets.js`), the battle AI (`src/ai.js`), the paper scorer (`src/paper-strength.js`) and the owner's
balance work on the server's own data (`data/velvet/*`).

**The creator.** Fildrong: a French YouTuber and streamer (channel id `UCO35rCYrO_3t6f4tEU83WKg`, about 389k
subscribers; Showdown user `fildrong`). He makes competitive Pokémon Showdown content: a beginner course
("Tutodrong"), a meta-analysis series ("Pourquoi ce Pokémon est devenu nul?", *why this Pokémon fell off*),
replay commentary ("Danse avec les strats", "Vraie/Nouvelle Strat") and a lot of pure entertainment such as
nuzlockes and fangames, which was skipped. Everything he says is in French. The principles below are my
English paraphrase. No transcript is reproduced.

**Status legend**, checked against `docs/teambuilding-checklist.md`, `docs/research-pinkacross.md` and the
code as of today:
- **covered**: already in the checklist or Pinkacross doc *and* in code.
- **partly**: in one of those docs or in the code, but narrower.
- **new**: nothing has it yet.

Each principle is written as the general reason first, with his species examples after it. His examples come
from Gen 6-9 Smogon OU and lower tiers. The reasoning carries over to this server's patched metagame. The
species names do not.

---

## 0. What was read

| Video | Kind | Why it matters |
|---|---|---|
| Tutodrong #1: before you start ([EfM3rSEZkek](https://www.youtube.com/watch?v=EfM3rSEZkek)) | full transcript | basics: stats, STAB, set built from the best offensive stat |
| Tutodrong #3: strategic roles ([J7WBpC6ICrU](https://www.youtube.com/watch?v=J7WBpC6ICrU)) | full transcript | check vs counter, niche, role compression, speed tiers, lure |
| Tutodrong #4: advanced terms ([y0k2Mh-IKss](https://www.youtube.com/watch?v=y0k2Mh-IKss)) | full transcript | win condition, pressure/momentum/tempo, safe play, bluff, information |
| Tutodrong #5: team archetypes ([W2lWHQgmEss](https://www.youtube.com/watch?v=W2lWHQgmEss)) | full transcript | HO, bulky offense, balance, fat, stall, type spam, VoltTurn |
| Teaching a beginner to build a team, 2 h live ([jUSOEUIpX28](https://www.youtube.com/watch?v=jUSOEUIpX28)) | full transcript | his whole build process, step by step, then a test game |
| Why Landorus-T fell ([FcVSgOM8rvE](https://www.youtube.com/watch?v=FcVSgOM8rvE)) | full transcript | movepool losses, a direct rival, meta fit |
| Why Blissey fell in Gen 9 ([vWtQGiX4KZY](https://www.youtube.com/watch?v=vWtQGiX4KZY)) | full transcript | recovery PP, passive walls, Teleport and Boots |
| Why Aegislash fell ([rxEg-dvM8-0](https://www.youtube.com/watch?v=rxEg-dvM8-0)) | full transcript | how one number in a signature ability changes a tier |
| Gengar's historic fall ([PnyhkpunuUs](https://www.youtube.com/watch?v=PnyhkpunuUs)) | full transcript | losing an immunity ability, power creep, crowded niche |
| Why Snorlax fell ([eK35n3eX2MI](https://www.youtube.com/watch?v=eK35n3eX2MI)) | full transcript | "team-slot syndrome", tempo, Rest-only recovery |
| Why Ribombee sees more use in Ubers ([_eg3Q4g-HnY](https://www.youtube.com/watch?v=_eg3Q4g-HnY)) | full transcript | value depends on the metagame's context |
| Hyped abilities that disappointed ([8t-Fh6xZ6WA](https://www.youtube.com/watch?v=8t-Fh6xZ6WA)) | full transcript | an ability is worth what its carrier can do with it |
| A little-known ability makes a bad Pokémon a monster ([71kElN7LzrM](https://www.youtube.com/watch?v=71kElN7LzrM)) | full transcript | self-status ability sets (Drifblim), a Justified/Beat Up combo |
| Mega Golisopod or Mega Scizor ([JQ4kXa0Wch0](https://www.youtube.com/watch?v=JQ4kXa0Wch0)) | full transcript (short) | the speed-vs-bulk trade, recovery in singles |
| The strategy nerfed three times ([OHTB9roKdac](https://www.youtube.com/watch?v=OHTB9roKdac)) | full transcript (short) | why priority on chance-based denial is unhealthy |
| A paradox returns, Slither Wing ([UGzOUKXYbIU](https://www.youtube.com/watch?v=UGzOUKXYbIU)) | full transcript | a speed tier just under the pack, the strongest priority, niche rivals |

Transcripts were YouTube's French auto-captions, which mangle names ("Démétéros" is Landorus). The reasoning
comes through clearly. The rest of the Tutodrong series (#2, terms and items) and his many replay videos were
not read. There is no Tutodrong episode on teambuilding itself (the series stopped at #5). The 2-hour live
build is the closest thing to one.

---

## A. What makes a Pokémon strong: a checklist

These are general criteria from the "why it fell" series and the ability and comparison videos. Use them to
judge a custom or buffed Pokémon before it reaches players. For each one: the question to ask, why it
matters, his evidence, and whether `src/paper-strength.js` (the scorer for Pokémon with no usage data) already
checks it.

| # | Criterion (the question) | Why it matters | His evidence | paper-strength.js |
|---|---|---|---|---|
| S1 | **Does the typing fix teammates' problems, or add to them?** Count immunities and resists against the attacking types the meta actually uses, not against the whole chart. | A slot is worth what it does for the other five. A typing with one weakness and no useful resists (pure Normal) has "no synergy", so a better-typed rival takes the slot even when the Normal type's stats are better. | Snorlax fell because Normal typing gives nothing to a team, and slots now have to do several jobs. He calls this "team-slot syndrome". Landorus-T's Ground/Flying plus Intimidate covered every popular physical coverage type. | **partly**: `typingScore()` counts resists, weaknesses and immunities over all 18 types, weighted equally |
| S2 | **Does an ability remove a weakness?** Levitate, Flash Fire, Water Absorb and the like act as extra typing. | Immunities let a frail Pokémon switch in indefinitely. Resists still cost HP. | Gengar lost Levitate and went from 3 immunities and 3 weaknesses to 2 and 4. It also started sharing a Ground weakness with its Steel partners, and it dropped a tier. | **new**: `typingScore()` reads types only. Levitate gets a flat 8 in `ABILITIES`, but it is not counted as a Ground immunity |
| S3 | **Can this carrier actually use its ability?** The boosted stat must be the one it attacks with. The boosted moves must be in its movepool and worth clicking. A status-spreading ability belongs on a Pokémon with time to spread status. | Strong abilities on the wrong Pokémon did nothing. | Corrosion went to frail attackers (Salazzle, Glimmora) that would rather just attack. Mega Launcher's best Water move for its users is 60 BP. The Mega Eelektross ability boosts its best attacking stat after a KO, but at base 80 Speed it rarely gets a second KO. Harvest is a coin flip under short weather. Comatose Komala got no moves that exploit it. | **new**: `ABILITIES` prices an ability the same on every carrier |
| S4 | **How many turns before it threatens something?** Rate the damage it does on entry, not after 2-3 setup turns. | Metagames speed up (power creep: stronger items, abilities and Pokémon), and each extra turn is a turn the opponent gets to answer. | Snorlax needs Curse, Curse, Rest and a sleep to do what a Choice Band Melmetal does on entry. | **partly**: offence is the best raw stat; setup counts as a plus with no tempo cost |
| S5 | **Where does its Speed sit relative to this metagame's clusters?** A few points below a crowded speed tier is much worse than a few above it. A base Speed that is middling elsewhere can be fast in a slow tier. | Speed decides who acts first in every exchange. What counts is the order against the Pokémon it actually meets, not the absolute number. | Slither Wing's 81 sits just under the 84-86 pack in OU, and that alone kept it in UU. Ribombee's 124 Speed is top of the Ubers range, while in RU it is just "fast". Landorus-T's max Speed stat was a number every OU team was built around. | **partly**: `speedScore()` uses fixed absolute bands |
| S6 | **Does its movepool punish switch-ins?** Knock Off, reliable status (Toxic, Will-O-Wisp), pivots and hazard removal matter more than a long list of attacking types. | A strong Pokémon draws its counters in. Punishing that switch keeps its value up when the counter arrives. | Landorus-T lost Knock Off, Toxic and Defog in Gen 9 and dropped from #1 in usage to about 14th. Great Tusk kept Knock Off and Rapid Spin and took the #1 spot. Blissey lost Toxic, its only way to hurt anything. | **partly**: `movepoolScore()` counts attacking types, recovery, setup, hazards, pivot and priority, not Knock Off, status or hazard removal |
| S7 | **Is its recovery reliable?** Rest is not the same as Recover. PP counts too: 8 PP of Recover wins far fewer long games than 16. Regenerator and Teleport also count as healing. | Walls win by coming in again and again. Rest costs two turns, and low PP runs out in long games. | Snorlax has only Rest. Blissey fell when Gen 9 halved recovery PP. Mega Scizor beats Mega Golisopod in singles partly through Roost. | **partly**: the `RECOVERY` regex counts Rest as full recovery, and PP is ignored |
| S8 | **Can it damage what walls it, even a little?** A wall with near-zero attacking stats is setup fodder for anything immune to its one damaging move. | A totally passive Pokémon gives the opponent free turns. | Blissey (Atk 5, SpA 35) can't touch Ghosts with Seismic Toss, so Gholdengo, Dragapult and Flutter Mane set up on it. | **partly**: `isPassive()` in team-logic.js checks sets; paper-strength does not penalise it |
| S9 | **Is there a strictly better rival in the same niche?** Same role and similar typing means teams pick one of the two. | Usage goes to the better of two near-copies, so the weaker one drops even when it is good in the abstract. | Great Tusk vs Landorus-T; Slither Wing vs Lokix ("you play one or the other"); Gholdengo, Pecharunt and Ceruledge crowding Gengar out; Latios sharing Gengar's stat line. | **new** |
| S10 | **Is its strength tied to a number that can be tuned?** A ratio in a signature ability (a stat drop, a damage share, a chance) can move a Pokémon a whole tier. | Balance changes should be small steps. | Aegislash went from Ubers to UU when King's Shield's Attack drop went from -2 to -1 and its stats dropped by 10. That turned Choice Band Tyranitar from a matchup it won into one it lost. | not a scorer item; a balance rule (section E) |
| S11 | **What does the metagame force on its opponents?** Items that can't be changed (Megas, plates, crowned forms can't hold Boots), a slow speed pack, and centralising threats all make some tools stronger. | The same Pokémon has a different value in a different context. | Ribombee's Sticky Web works in Ubers because the top threats must hold their own items (no Boots), the tier is speed-tied, and few players spin. | **new**: nothing reads the format's item or speed context |
| S12 | **How many roles does one set cover?** Pivot plus wall plus hazards plus removal plus breaking. | Top Pokémon compress roles, which frees slots for niche picks. | Landorus-T "did everything": Intimidate pivot, Stealth Rock, Defog, a strong Earthquake. | **partly**: breadth flags in `movepoolScore()`; Pinkacross B13 |

**How to use it.** S1-S3 decide whether a Pokémon *fits*. S4-S8 decide whether it *works* in a real game.
S9 and S11 are about the *metagame*, and only usage (or a close look at the tier) can answer them. A Pokémon
can pass S1-S8 and still be low-tier because of S9, the way Gengar is rarely used while still being strong.

---

## B. Teambuilding

| # | Principle | Bot rule (testable) | Status | Where |
|---|---|---|---|---|
| T1 | **Start from something you want to use, then fix its problems.** The first Pokémon's set suggests the archetype. Almost any Pokémon becomes playable when the team covers its weaknesses. A defensive Pokémon is not automatically a stall Pokémon (Slowbro fits offense as a pivot). | Seed first; archetype from the seed's set (pivot/wall seed → bulky offense or balance; setup seed → offense). | partly: rule 16 seeds on a wall; archetype from the seed is not done (checklist §3) | `team-assembler.js` seed phase |
| T2 | **Second pick: the breaker the seed makes room for.** A slow Regenerator/Teleport pivot is paired with a slow, hard-hitting breaker it can bring in for free (Slowbro + Choice Band Melmetal). | Covered by Pinkacross B1 (breaking core); his specific form is the slow-pivot → slow-breaker pairing. | partly (rule 16) | `team-assembler.js` |
| T3 | **The base toolbox** (his "summary for beginners"): speed control (fast, Scarf or priority), hazards set *and* removed, a wall-breaker, pivots, and answers to both the opponent's walls and its attackers. Role compression fills several boxes with one Pokémon. | Same as checklist rules 1, 2, 7, 8, 12. | covered | `team-logic.js` |
| T4 | **Mandatory immunities**: a Ground type (Electric immunity) and a Flying/Levitate member (Ground immunity). | Pinkacross B4 / checklist rule 21. He is stricter (see section F). | covered (soft) | `team-logic.js` |
| T5 | **Meta-adaptation phase.** Once four members work well together, stop picking by role. List the common threats the team still can't handle, and fill the last slots with answers to them. An *offensive check* (comes in on a resisted hit and hits back hard) counts as an answer. | After 4 members, rank candidates only by how many unanswered usage-weighted threats they fix (resist the STAB they would click, or outspeed and KO). | partly: `threats` feed rule 5 and `threatCover()` for the whole six; the assembler does not switch its objective after 4 | `team-assembler.js`, `teambuilder.js chooseTeam()` |
| T6 | **The win condition can come last**, once the backbone is sound: pick the sweeper that beats what the core leaves standing. In his live build, Tapu Fini with Calm Mind, Taunt and Draining Kiss was added fifth: it beats Toxapex and Clefable-style walls because Taunt stops their passive setup. | Alternative order for the assembler (see F2). A setup win condition that must get past walls carries Taunt or another way through them. | partly: rule 12 (stallbreaking) exists; the order is a disagreement | `team-assembler.js`, `role-sets.js` |
| T7 | **Answers that are not counters.** A *check* wins the one-on-one from full HP but may not switch in safely; a *counter* switches in, takes the hit, and beats it. Two checks or one counter per threat is enough. | Checklist §3 step 6. | partly (type-level `threatCover()`) | `teambuilder.js` |
| T8 | **Niche duplicates.** Two Pokémon that fill the same niche with similar typing waste a slot. Keep the one with the better typing or ability for *this* team. (Type-stacking on purpose, "type spam offense", is a different thing: see F4.) | Soft: two members with the same role *and* ≥ 1 shared STAB type *and* no distinct job (hazards, removal, pivot). | new (Pinkacross B3 covers defensive overlap only) | `team-logic.js`, `team-assembler.js` |
| T9 | **Forced-item metagames raise the value of hazards.** Where many top threats can't hold Heavy-Duty Boots (Megas, Arceus plates, Zacian-Crowned, Z-A Megas on this server), Stealth Rock, Spikes and Sticky Web are worth more, and removal on the other side is rarer. | When ≥ 3 of a format's top threats have a fixed item (Mega stone, plate, Rusted item), raise the hazard and Web scores in team scoring and in `statusScore()`. | new | `teambuilder.js`, `team-logic.js`, `ai.js statusScore()` |
| T10 | **Archetypes** as he defines them: HO (one chance per member, needs constant pressure), sticky-web HO, screens HO, type spam (several attackers of one type wear down its resist), bulky offense (easiest to learn, forgives mistakes), trick room, rain, balance, fat (the offensive half heals too), semi-stall/stall, hazard stack, VoltTurn. | Checklist §2 already lists most; type spam and VoltTurn are new names for existing ideas. | partly | `team-logic.js` classification |

---

## C. Set design

| # | Principle | Bot rule (testable) | Status | Where |
|---|---|---|---|---|
| D1 | **Build the set from the better offensive stat.** Nature boosts Speed if it is fast, the attacking stat if it is slow, and EVs go where the role needs them. | Existing `spreadFor()` roles. | covered | `role-sets.js` |
| D2 | **Speed EVs: just enough to pass a named target**, not max. Put the rest in bulk. Melmetal gets enough Speed to pass Clefable. Landorus-T runs about 112 Speed EVs to pass Modest Heatran, since passing max-Speed targets costs too much. | Pinkacross B15(d). | partly (fixed spreads) | `role-sets.js spreadFor()` |
| D3 | **Slow pivots use a -Speed nature**, so Teleport and U-turn go last, even in the mirror. | Pinkacross B15(a). | partly | `role-sets.js` |
| D4 | **Odd HP for hazard-weak or pivot sets** (8 Stealth Rock entries leave 1 HP). | Pinkacross B15(c). | partly | `role-sets.js` |
| D5 | **Self-status abilities want a status orb.** Guts, Flare Boost, Toxic Boost, Poison Heal, Quick Feet and Marvel Scale are triggered on purpose with Flame or Toxic Orb. The orb chips HP, so the set carries recovery or draining (Drifblim: Flare Boost, Flame Orb, Calm Mind, Drain Punch, Tera Fighting). | `itemFor()`: an ability in that list → Flame/Toxic Orb first (Toxic for Poison Heal/Toxic Boost, Flame for Guts/Flare Boost unless Fire-type). `buildSet()`: prefer Facade on Guts sets, and a draining or recovery move when the orb hurts. | **new**: `itemFor()` never picks an orb | `role-sets.js itemFor()`, `buildSet()` |
| D6 | **Choice sets carry four attacks**, one of them for the most common thing that walls the STAB (Melmetal: Double Iron Bash, Earthquake, Thunder Punch for Flying types, Superpower for Ferrothorn). | Existing coverage logic (`threatGain()`). | covered | `role-sets.js` |
| D7 | **Teleport + Future Sight pivot.** Fire Future Sight when the foe switches out, then Teleport into a breaker. Whatever answers the breaker takes two hits in one turn. Pick Future Sight when the team's breaker is checked by Psychic-weak or Psychic-neutral walls. | Set: a Teleport user with a breaker teammate gets Future Sight. AI: fire Future Sight on a predicted switch, Teleport next turn. | new (the AI only blocks double Future Sight) | `role-sets.js`, `ai.js` |
| D8 | **Lures are real but occasional.** An offensive set on a usually defensive species (offensive Clefable) beats its usual checks by surprise, at the cost of raw power. | See F3; Pinkacross advises against lure moves. | disagreement | `role-sets.js` |
| D9 | **Signature items matter**: Heavy-Duty Boots on anything that switches in often (the math: 2 turns of Leftovers to repay one Stealth Rock, 4 with Spikes). Boots also hide Leftovers healing, which can make the opponent think it is chipped. | Covered by rule 2 and `itemFor()`. | covered | none |

---

## D. Battling

He covers little of this in depth. The Pinkacross doc already has the stronger in-battle rules. Two concepts
from Tutodrong #4 are worth keeping as vocabulary:

- **Pressure, momentum, tempo.** *Pressure*: your action forces them to react. *Momentum*: the move or switch
  that gets you into a pressure position (double switch, pivot, surprise set). *Tempo*: cancelling their
  pressure without losing ground (safe switch, revealing a set, sacking a weakened member). His exercise: every
  turn, say who is pressuring whom and what changed it. This matches Pinkacross A15 (**covered** as a concept,
  **partly** in `ai.js`).
- **Safe plays are readable.** A safe play is easy to predict, so an opponent can exploit it. Bluffing (acting
  as if you hold a Choice Scarf) and gathering information (team preview style, reveals, the opponent's own
  habits) are the counterweights. This matches Pinkacross A19 (mixed strategy) and A24 (opponent model), both
  **new** in code.
- **Taunt ends passive setup.** In his test game, a Taunt from the win condition stopped a Cosmic Power
  Clefable, and the game was over. For the AI: Taunt scores high against a foe whose revealed moves are all
  setup/recovery and which can't hurt us. **partly** (`statusScore()` has Taunt; check that it keys on the
  foe's revealed passivity).

---

## E. Balance lessons (for `data/velvet/*`)

General rules for anyone designing or patching a Pokémon, move or ability on this server:

1. **Priority combined with chance-based denial is unhealthy**, whatever the stats. Prankster Swagger plus
   paralysis let even weak teams beat top-tier ones, because it took away the opponent's turns. Game Freak
   fixed it three ways at once: confusion's self-hit chance went down, Thunder Wave's accuracy dropped, and Dark
   types became immune to Prankster moves. Smogon had already banned it. Never give a status move priority *and*
   a lost-turn effect.
2. **Tune signature numbers in small steps.** Aegislash's -2 → -1 drop was a whole tier (S10).
3. **A buff should give a reason to pick the Pokémon, not three.** Balance Patch 1 already states this. He adds
   that what separates a Pokémon from its niche rival (S9) is the thing to buff.
4. **Check the carrier (S3) before approving an ability.** A strong ability on a mismatched body is a waste.
   One on a perfect body can be a ban.
5. **Movepool additions are the most common and the strongest buffs.** Landorus-T's decade at the top came from
   Knock Off's boost and Defog, not from its stats. Losing Knock Off and Toxic ended it. Treat Knock Off, Toxic,
   Will-O-Wisp, removal, pivots and priority as the high-impact additions.
6. **Strong priority alone can carry mediocre stats.** Slither Wing's First Impression under sun one-shots
   resisted targets. Judge a new priority move by its effective power after STAB, weather and items, not by its
   listed BP.

---

## F. Where Fildrong and Pinkacross differ

The owner's rule: **Pinkacross's view is the default for the bots**. Fildrong's is a considered alternative,
worth using when its conditions apply.

| # | Topic | Pinkacross (default) | Fildrong (alternative) | When Fildrong's view might apply |
|---|---|---|---|---|
| F1 | Which Pokémon to build around | B16: a viability test first; don't build from outclassed or low-tier picks. | Start from a Pokémon you like. Almost anything is playable with the right support (his old "make an unpopular Pokémon work" series). | **Themed or story teams**: RP gym trainers, monotype and "favourite Pokémon" trainers, where the seed is fixed by the theme, not by viability. |
| F2 | When the win condition is chosen | Checklist §3 step 1 and B18: pick the win condition/core first. | Build a sound pivot/breaker/hazard backbone first; add the sweeper last to beat whatever the core leaves standing. | **When the seed is a wall or pivot** (not a sweeper), or when the RP bot's fixed members are defensive. The assembler could try both orders and keep the better score. |
| F3 | Lure moves and lure sets | B11: don't add a lure move for one counter; it only works in the rare game it targets. | "Lure" is a legitimate role. A surprise offensive set on a normally defensive species beats its usual checks. | **High-level play against human opponents who assume the standard set**, where surprise is worth something. It is not for the bots, which gain nothing from surprise against other bots. Keep Pinkacross's rule in `role-sets.js`. |
| F4 | Overlap between members | B3: defensive overlap is bad, offensive type-stacking is good (up to 3). | Two Pokémon in the same niche: pick the better one (S9, T8). He also describes "type spam" as an archetype. | Both hold: Fildrong's point is about *niche* (same job, same typing), Pinkacross's about *type* (several attackers of one type). Only a same-role duplicate with no distinct job should be flagged (T8). |
| F5 | Immunities | B4 / rule 21: Ground and Electric immunities, but solid resists plus answers can substitute; soft. | Treats a Ground type and a Flying type as close to mandatory in a basic team. | **Beginner or generated teams with weak threat data** (Build my team, gym trainers without usage stats), where a missing immunity is less likely to be covered by the other five. |
| F6 | Future Sight | A15: firing Future Sight into a likely switch to its answer wastes momentum. | Teambuilds around Future Sight + Teleport so the breaker's check takes both hits. | Not really a disagreement: Pinkacross warns about *timing*, and Fildrong shows the *team* that makes the timing work. Use D7 for the set and A15 for when to click it. |

---

## G. Applying the checklist to this server's Pokémon (my analysis, not Fildrong's)

These are brief applications of section A to buffed Pokémon in `data/velvet/`. They are judgements from the
data files, not from play or usage, and should be checked against ladder results.

**Simisear / Simipour / Simisage** (`buffs.js`: a weather- or terrain-setting ability, the Rush moves, the
monkey coverage and status lists). The stats are 75/98/63/98/63/101, 498 BST (the comment in buffs.js says
480, which is the wrong figure). S1-S3 fit: each sets up its own weather or terrain on entry, which powers
its own STAB. S5: 101 Speed is fine low down. The main issue is the **effective power of the Rush moves**
(balance lesson 6). Cinder Rush is 80 BP with +1 priority in sun: STAB x sun is about 180 effective power at
+1, well above Extreme Speed's 120. Torrent Rush in rain is the same. Jungle Rush on Grassy Terrain with
Verdant Surge is also about 180, but only for grounded users. The weather or terrain comes on entry, so the
condition is almost always met for the first turns. **Looks over-tuned for PU/NU-level bodies.** The frail
63/63 defences are the only limit, since any priority or faster hit removes them. If they dominate lower RP
tiers, the lever is the move, not the Pokémon: 60-70 BP, or +1 only when the weather wasn't set by the user.

**Regigigas** (Balance Patch 1: Colossus Unbound first, plus Continental Heave). Colossus Unbound combines
Mold Breaker, Clear Body and 1.2x Attack above half HP. On 160 base Attack that is roughly Choice Band power
without the lock. Continental Heave is 110 BP Normal STAB, goes through Protect, breaks screens, but has 5
PP. S1/S6: Normal STAB is the weakest offensive type (Steel and Rock resist, Ghost is immune). Mold Breaker
does not get past a type immunity, so Gholdengo, Corviknight and bulky Ghosts still wall it unless it runs
Earthquake or Knock Off. S7: no reliable recovery beyond Drain Punch, and the 1.2x turns off under 50% HP, so
hazards and Life Orb recoil blunt it. S5: 100 Speed with no priority. **Looks well-tuned**: a strong breaker
(UU to low OU), not a sweeper. Watch that the Protect-ignoring hit plus Intimidate immunity doesn't make it
the only good Normal attacker. If it does, the 1.2x boost is the number to trim (S10).

**Obstagoon** (`buffs.js`: Extreme Speed for the whole Galarian line). 93/90/101/60/81/95, with Guts. S6/lesson
6: Flame Orb Guts Extreme Speed is 80 x 1.5 STAB x 1.5 Guts, about 180 effective power at +2 priority. That
matches the strongest priority in the game, and it comes with 101/81 bulk and Knock Off/Obstruct. Ghosts are
immune to Extreme Speed but take its Dark STAB, so S1 is covered. **Probably right for RU/UU, strong below
that.** It is a revenge killer with no speed tier to worry about (S5 no longer applies). The 5 PP (8 with PP
Ups) and orb chip are its natural limits. Keep it off Choice Band in `role-sets.js` so the Guts set stays the
standard.

**Chandelure line** (`buffs.js`: Shadow Tag). 60/55/90/145/90/80. S11: trapping is only as good as the
trapper's ability to beat what it traps. At 80 Speed it loses to most of what it would catch in Ubers, but it
traps and removes slower special walls. Blissey can't touch a Ghost with Seismic Toss, so a Calm Mind set wins
that fight (S8 from the other side). **Fair in RP Ubers, which is where the tiers already put it.** It would be
over-tuned lower down, where the tier bans correctly keep it. The buffs.js comment says the same.

**Recovery PP restored to Gen 8** (`unnerfs.js`). Fildrong named halved recovery PP as one of three reasons
Blissey fell (S7). The other two were losing Toxic and Teleport, and a metagame of Ghosts it can't touch.
Restoring the PP brings back PP-stalling, and walls with real attacking stats gain the most. **Not
over-tuned on its own.** Passive walls stay setup fodder (S8), and Toxic is still scarce. The combination to
watch is restored PP *and* a broad Toxic or Teleport redistribution. Doing both would bring Gen 7-8 stall
back.

---

## H. Ten rules worth doing first (teambuilding and set design first)

1. **Status-orb sets** (D5): `itemFor()` gives Flame/Toxic Orb to Guts, Flare Boost, Toxic Boost, Poison Heal,
   Quick Feet and Marvel Scale sets. `buildSet()` adds Facade on Guts, and drain or recovery when the orb
   chips. `src/role-sets.js`.
2. **Meta-adaptation phase** (T5): after four members, the assembler scores candidates by how many unanswered,
   usage-weighted threats they fix; offensive checks count. `src/team-assembler.js` and
   `TeamBuilder.chooseTeam()` in `src/teambuilder.js`.
3. **Niche-duplicate penalty** (T8/S9): soft issue for two members with the same role, a shared STAB and no
   distinct job. `src/team-logic.js issues()`, used by the assembler.
4. **Forced-item context** (T9/S11): when several top threats hold fixed items (Megas, plates), raise
   hazard/Web value in team scoring and in the AI's hazard score. `src/teambuilder.js` threat data,
   `src/team-logic.js`, `src/ai.js statusScore()`.
5. **Teleport + Future Sight pivot** (D7): give Future Sight to a Teleport user whose team has a breaker; the
   AI fires it on a predicted switch and Teleports next turn. `src/role-sets.js`, `src/ai.js`.
6. **Ability-fit check** (S3): scale an ability's value by whether the carrier uses the boosted stat or moves.
   The same test decides which ability `role-sets.js` picks when a species has several. `src/paper-strength.js
   ABILITIES`, `src/role-sets.js`.
7. **Immunity abilities count as typing** (S2): Levitate, Flash Fire, Water/Volt Absorb, Sap Sipper and Earth
   Eater enter `typingScore()` as immunities (`team-logic.js` already does this for teams).
   `src/paper-strength.js`.
8. **Movepool quality over breadth** (S6/S7): add Knock Off, reliable status and hazard removal to
   `movepoolScore()`. Count Rest as half recovery. `src/paper-strength.js`; for teams, count Rest in rule 9
   only when paired with Sleep Talk (`src/team-logic.js`).
9. **Speed relative to the format** (S5/D2): score Speed by its place in the format's usage-weighted speed
   distribution, with a penalty just below a crowded tier. Give EV targets from the fastest common threat a
   set can reasonably pass. `src/paper-strength.js speedScore()`, `src/role-sets.js spreadFor()`.
10. **Tempo cost of setup** (S4): an offence that needs 2+ setup turns (Curse plus Rest style) scores below
    one that threatens on entry. `src/paper-strength.js`, and in `role-sets.js` when choosing between a
    setup set and a Choice set.

## Confidence

- High: every principle in A-C and E comes from a full transcript of the videos in section 0. The examples are
  his.
- Medium: the "bot rule" wording and the thresholds are mine.
- Section G is my own analysis of the data files, not his, and has not been checked in play.
- Status marks come from reading the code today (`paper-strength.js`, `role-sets.js itemFor()`,
  `team-logic.js`, `ai.js` greps), not from running it.

## Sources

Fildrong (YouTube channel id `UCO35rCYrO_3t6f4tEU83WKg`, https://www.youtube.com/channel/UCO35rCYrO_3t6f4tEU83WKg;
Showdown profile https://pokemonshowdown.com/users/fildrong):
- Playlists: Pourquoi ce Pokémon est devenu nul ? https://www.youtube.com/playlist?list=PLLVXOvjpWK7n69Vff4wI7wspN01c83nwk ;
  Danse avec les strats https://www.youtube.com/playlist?list=PLLVXOvjpWK7l3a5f_HQJh0ajVY4TSLuH-
- Transcripts read: Tutodrong #1 https://www.youtube.com/watch?v=EfM3rSEZkek ; Tutodrong #3 https://www.youtube.com/watch?v=J7WBpC6ICrU ;
  Tutodrong #4 https://www.youtube.com/watch?v=y0k2Mh-IKss ; Tutodrong #5 https://www.youtube.com/watch?v=W2lWHQgmEss ;
  Team-building live https://www.youtube.com/watch?v=jUSOEUIpX28 ; Landorus-T https://www.youtube.com/watch?v=FcVSgOM8rvE ;
  Blissey https://www.youtube.com/watch?v=vWtQGiX4KZY ; Aegislash https://www.youtube.com/watch?v=rxEg-dvM8-0 ;
  Gengar https://www.youtube.com/watch?v=PnyhkpunuUs ; Snorlax https://www.youtube.com/watch?v=eK35n3eX2MI ;
  Ribombee in Ubers https://www.youtube.com/watch?v=_eg3Q4g-HnY ; Hyped abilities https://www.youtube.com/watch?v=8t-Fh6xZ6WA ;
  Drifblim / little-known ability https://www.youtube.com/watch?v=71kElN7LzrM ; Mega Golisopod vs Mega Scizor https://www.youtube.com/watch?v=JQ4kXa0Wch0 ;
  Prankster Swagger https://www.youtube.com/watch?v=OHTB9roKdac ; Slither Wing https://www.youtube.com/watch?v=UGzOUKXYbIU
- Not read (identified only): Tutodrong #2 https://www.youtube.com/watch?v=_0IzAhd2bsI ; the rest of the "devenu nul"
  playlist (Venusaur, Swampert, Froslass, Jolteon, Celebi, Blaziken, Tyranitar).
