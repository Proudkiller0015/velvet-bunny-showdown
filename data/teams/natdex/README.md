# Gen 9 National Dex OU sample teams

These are test teams for teaching the stockfish AI (`src/ai.js`, `src/search.js`) to play stall, and for the
opponents it plays against. Collected 2026-09-24.

**Format id:** `gen9nationaldex`, displayed as `[Gen 9] National Dex`
(`node_modules/pokemon-showdown/dist/config/formats.js`, section "National Dex"). Its ruleset is
`Standard NatDex` plus `Terastal Clause`, and it bans `ND Uber`, `ND AG`, Arena Trap, Moody, Power Construct,
Shadow Tag, King's Rock, Quick Claw, Razor Fang, Assist, Baton Pass, Last Respects and Shed Tail. Megas and
Z-moves are allowed. **Tera is not.** Terastal Clause removes it, and Smogon banned Tera in NatDex OU in
Nov 2024. Separately, this server's RP OU (`config/custom-formats.js` line 1335, `rpTier('OU', '[Gen 9] National Dex', { rules: UNBAN_TERA ... })`)
stands on National Dex *with* Tera turned back on, so don't confuse the two.

## Where they come from

Every team comes from Smogon's official **National Dex Sample Teams** thread:
https://www.smogon.com/forums/threads/national-dex-sample-teams.3714863/
- Current samples: post #1, last edited Jun 15 2026 (https://www.smogon.com/forums/threads/national-dex-sample-teams.3714863/post-9480320)
- Archive of older samples: post #2 (https://www.smogon.com/forums/threads/national-dex-sample-teams.3714863/post-9535321)

Each `.txt` file is a byte-for-byte copy of `https://pokepast.es/<id>/raw`: the sets are exactly as published,
with the original CRLF line endings and nicknames. The thread gives only an archetype label for each team, so
the one-line game plans below are our own summary of the sets.

| File | Thread label / credit | Paste | Date | Game plan |
|---|---|---|---|---|
| stall-1.txt | Pecharunt + Payapa Berry Toxapex Stall, FerroFodder (with council edits); paste uploaded by sealoo ("Galaxy Gas") | https://pokepast.es/2a02b39e07e3ac77 | current (Jun 2026) | Full stall. Counter Blissey, Clodsire, Toxapex, Pecharunt, SD Gliscor and Corviknight set Stealth Rock, Spikes and Toxic Spikes, spread poison, and wall with Recover, Roost and Defog. |
| stall-2.txt | Swords Dance Gliscor Semi-Stall, Isza ("Pech Stall") | https://pokepast.es/74805bc60c1aab98 | Jan 4 2026 update (archived Jun 2026) | Semi-stall. Pecharunt, Wish Blissey, Clodsire and Wish Alomomola form a Regenerator, Wish and Unaware core. SD Gliscor and Iron Defense Corviknight are the ways to win. |
| stall-3.txt | Stall, hainiu; paste "TLOH IV - anique" by setset77, probably a Leader of the Hill IV tournament team | https://pokepast.es/654b2f83ddd888e5 | Sep 2024 (**before the Tera ban**) | Full stall with a double Unaware core (Rest/Sleep Talk Dondozo and Amnesia Clodsire), plus Wish Blissey, Gliscor, Corviknight and Toxapex. Wins with hazards, Toxic and passive damage. |
| ho-1.txt | Screens, Lameflame; "NDWC VI WEEK 3 - Tpunch Mmaw Screens vs Darkness" (NatDex World Cup VI) | https://pokepast.es/fd24e99dc670da57 | 2025 (approximate) | Dual-screens HO. Light Clay Zamazenta sets screens for Mega Mawile, Ceruledge, Ogerpon-W, Flyinium Z Moltres-Galar and Booster Energy Iron Treads to set up and sweep. |
| ho-2.txt | Life Orb Volcarona Hyper Offense, Isza ("Orb Volc HO") | https://pokepast.es/6dfbc381997d7cc0 | current (Jun 2026) | HO. Red Card Ting-Lu sets hazards. LO Volcarona, Dragonium Z Dragonite, Terapagos, Ogerpon-W and Balloon Gholdengo break through. |
| bo-1.txt | Choice Specs Raging Bolt Bulky Offense, slopcat | https://pokepast.es/d1230138268836ed | current (Jun 2026) | Bulky offense. Specs Raging Bolt and Fightinium Z Zamazenta break. Corviknight, Ting-Lu, Hatterene and Ogerpon-W form the defensive backbone. |
| bo-2.txt | Swords Dance Kingambit Bulky Offense, sealoo ("kgb tankchomp v1") | https://pokepast.es/5919fad1285863ac | current (Jun 2026) | Bulky offense. Rocky Helmet Garchomp, Gholdengo and Terapagos wear the opponent down so that SD Kingambit, LO Zamazenta or Scarf Tapu Lele can clean. |
| balance-1.txt | Mega Latios Balance, Xurkiyee | https://pokepast.es/0f252ecb934bce9c | current (Jun 2026) | Balance. Mega Latios and Scarf Landorus-T are the offensive pivots. Zamazenta, Zapdos, Heatran and Ogerpon-W form the bulky core. |
| balance-2.txt | Mega Lopunny Balance, sealoo ("$LIGHTNESS678") | https://pokepast.es/a1180c7057c8f282 | current (Jun 2026) | Balance. Toxapex, Moltres, Ting-Lu and Ferrothorn handle hazards and walling. Mega Lopunny and Scarf Gholdengo pressure, spinblock and revenge-kill. |

Other stall pastes found in the archive but not saved here, because all three predate the Tera ban:
Double Unaware Stall by hainiu (https://pokepast.es/e47e1c95188bda32, Mar 2024), Dondozo Stall by ezra
(https://pokepast.es/3abf671807158d9f) and Garganacl Semi Stall by gamer but swag
(https://pokepast.es/d383cf3097b8993f, 2023). **None of the three saved stall teams uses Mega Sableye**, which
Smogon's Sep 2026 NatDex stall article (https://www.smogon.com/articles/nd-ou-stall) calls the most defining
stall Pokémon. The three are also very similar to each other (Blissey, Clodsire, Gliscor and Corviknight in
every one). If you want coverage of the Mega Sableye plus Dondozo style, add a Sableye team later.

## Legality check

Checked with the stock validator: `TeamValidator.get('gen9nationaldex')` from `node_modules/pokemon-showdown`,
validation only, no battles. **All 9 teams pass stock Smogon rules.**

The live server differs from stock, so on the live server these will not all be legal:
- **Terapagos (ho-2, bo-2): expected to be rejected on this server.** `data/velvet/tiering.js` sets
  `terapagos: 'Uber'` dex-wide, which puts its `natDexTier` into ND Uber, and `gen9nationaldex` bans ND Uber.
  The pastes list it as `Terapagos-Terastal`. That forme has no tier row of its own in `formats-data`, so it
  inherits the base form's tier. This was read from the code, not run through the live validator. For the
  tests, either use a custom rule (`+Terapagos`) or swap that slot for a test-only variant, and record which
  you did.
- **`Tera Type:` lines.** Most pastes still carry them from the export, even though Tera is banned (stall-3 is
  from before the ban, so its Tera types were real choices then). The validator accepts them and Terastal
  Clause makes them inert. They are left in because the sets are kept exactly as published.
- **Nicknames with emoji** in balance-2 (for example `ILuvVal 🦋 (Toxapex)`). These are valid but worth knowing
  about if a parser trips on them.
- **Heads-up for the AI, not a legality problem: Z-crystals.** ho-1 (Flyinium Z Moltres-Galar), ho-2
  (Dragonium Z Dragonite) and bo-1 (Fightinium Z Zamazenta) hold Z-crystals. `chooseForSlot()` in
  `src/ai.js` (around line 2512) appends `mega`, `ultra`, `dynamax` and `terastallize`, but never `zmove`, so
  when the bot pilots these teams it never uses its Z-move. Such matches are really "team minus its Z-move".
- **Server-wide velvet changes still apply in `gen9nationaldex`.** For example, recovery moves are back to
  10 PP (16 with PP Ups) through `data/velvet/unnerfs.js` ("holds in every format on this server"). That
  lengthens every stall game compared with Smogon's 5/8 PP.
