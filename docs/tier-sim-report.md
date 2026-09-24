# Tier simulation report

**Pilot, stopped after about 2 minutes (126 games) - noise level, not a result.** Generated 2026-09-24 07:39 UTC from `data/tier-sim/games.jsonl` by `scripts/tier-report.js`.

- **124** games rated (2 crashed or abandoned, excluded), 780 Pokemon in the pool, stockfish AI on both sides, average 17.4 turns, 26 ms per decision.
- Appearances per Pokemon: median 2, minimum 0, 0 of 780 at 40 or more.
- Fitted tier means (logit strength per Pokemon): Uber 1.23, OU 1.11, UU 0.93, RU 0.71, NU 0.53, PU 0.36, ZU 0.18, NFE 0.01. Average gap between tiers 0.17.
- Utility slope (how much above-tier contribution raises the prior, fitted): 0.04. Fit took 1.2 s.
- Median 90% interval half-width 0.49 logit: 0 Pokemon have intervals narrower than half a tier band.

## How to read this

Strength is a Bradley-Terry coefficient: a team's log-odds of winning is the sum of its six strengths minus the opponent's, so each number is what the Pokemon adds to a team *after* its teammates and opponents are accounted for. Each Pokemon's prior is its current tier's fitted mean, shifted by how much more (or less) it contributed per game than its tier-mates - damage, KOs, hazard turns, removal, status, pivots, support, switch-ins absorbed, turns on the field - scaled by a slope fitted from the games themselves.

**A Pokemon is proposed to move only when its whole 90% interval lies outside its current tier's band.** Otherwise it stays where it is, whatever its point estimate says. BL tiers are compared where they are played (UUBL in OU, and so on). Teams were drafted around each tested Pokemon from its own band with the bots' team assembler, weighted by Smogon teammate data - peers first, not a sweeper carried by filler.

## Proposed moves (0)

None yet: no interval is clear of its tier band. This is the expected result of a short run.

## Watch list (point estimate in another tier, evidence not yet strong enough; 15+ appearances)

Nothing yet.

## Proposed tiers

**Uber** (71): Melmetal, Spectrier, Solgaleo, Chandelure-Mega, Ogerpon-Hearthflame, Arceus, Baxcalibur, Chi-Yu, Calyrex-Ice, Greninja-Mega, Metagross-Mega, Kyurem-White, Landorus, Iron Bundle, Darkrai, Eternatus, Deoxys-Attack, Chien-Pao, Urshifu, Zacian, Rayquaza, Kyogre, Naganadel, Sneasler, Regigigas, Gengar-Mega, Baxcalibur-Mega, Darkrai-Mega, Darmanitan-Galar, Kyogre-Primal, Lucario-Mega, Magearna-Mega, Palkia-Origin, Zygarde-Mega, Shaymin-Sky, Necrozma-Dawn-Wings, Giratina-Origin, Mewtwo-Mega-Y, Dialga-Origin, Yveltal, Gouging Fire, Mewtwo-Mega-X, Zekrom, Lunala, Flutter Mane, Starmie-Mega, Groudon, Mewtwo, Groudon-Primal, Reshiram, Urshifu-Rapid-Strike, Salamence-Mega, Ho-Oh, Necrozma-Dusk-Mane, Lugia, Dracovish, Kangaskhan-Mega, Annihilape, Alakazam-Mega, Terapagos, Giratina, Palkia, Blastoise-Mega, Palafin, Shedinja, Marshadow, Kyurem-Black, Dialga, Floette-Mega, Deoxys, Espathra

**OU** (95): Genesect, Dragonite, Spiritomb, Cinderace, Landorus-Therian, Meowscarada, Simipour*, Kommo-o, Roaring Moon, Pheromosa, Empoleon, Heatran-Mega, Blaziken-Mega, Moltres, Hatterene, Diancie-Mega, Garchomp, Tyranitar-Mega, Charizard-Mega-Y, Raging Bolt, Corviknight, Weezing-Galar, Hoopa-Unbound, Rillaboom, Kartana, Zapdos, Tapu Lele, Garchomp-Mega-Z, Infernape, Zygarde, Dragapult, Blaziken, Great Tusk, Zeraora-Mega, Ogerpon, Deoxys-Speed, Iron Treads, Glaceon, Kyurem, Lopunny-Mega, Toxapex, Weavile, Volcarona, Regieleki, Ogerpon-Wellspring, Iron Valiant, Walking Wake, Garganacl, Ferrothorn, Alomomola, Greninja-Bond, Scizor-Mega, Ursaluna-Bloodmoon, Tornadus-Therian, Samurott-Hisui, Dragonite-Mega, Gliscor, Simisage*, Luxray, Heatran, Lucario-Mega-Z, Absol-Mega-Z, Zamazenta, Magearna, Iron Hands, Latias, Slowking-Galar, Dondozo, Gholdengo, Ting-Lu, Gyarados, Xurkitree, Iron Moth, Gyarados-Mega, Zarude, Medicham-Mega, Latios-Mega, Manaphy, Clodsire, Simisear*, Charizard-Mega-X, Mawile-Mega, Pecharunt, Iron Crown, Kingambit, Tapu Koko, Arctozolt, Gallade-Mega, Okidogi, Dracozolt, Pinsir-Mega, Greninja, Pelipper, Ogerpon-Cornerstone, Thundurus-Therian

**UU** (120): Azelf, Espeon, Tapu Fini, Mesprit, Glimmora, Tangrowth, Vaporeon, Revavroom, Manectric-Mega, Thundurus, Arcanine-Hisui, Tyranitar, Iron Jugulis, Nihilego, Leafeon, Flareon, Latios, Hydreigon, Lokix, Fezandipiti, Amoonguss, Roserade, Metagross, Gardevoir-Mega, Mew, Glimmora-Mega, Hawlucha-Mega, Pidgeot-Mega, Zeraora, Swampert-Mega, Beedrill-Mega, Slowbro, Cobalion, Skarmory-Mega, Darmanitan, Slither Wing, Nidoking, Donphan, Venusaur-Mega, Hydrapple, Chansey, Rotom-Wash, Zygarde-10%, Goodra-Hisui, Tinkaton, Excadrill-Mega, Swampert, Aggron-Mega, Banette-Mega-Halloween, Garchomp-Mega, Sableye-Mega, Serperior, Bisharp, Sandy Shocks, Zapdos-Galar, Torterra, Talonflame, Skeledirge, Scizor, Aegislash, Steelix-Mega, Archaludon, Tapu Bulu, Keldeo, Blacephalon, Scolipede-Mega, Slowking, Hawlucha, Victini, Hippowdon, Buzzwole, Umbreon, Obstagoon, Clefable-Mega, Blissey, Sinistcha, Clefable, Celesteela, Ceruledge, Aerodactyl-Mega, Uxie, Mandibuzz, Excadrill, Skarmory, Lilligant-Hisui, Mamoswine, Slowbro-Mega, Moltres-Galar, Terrakion, Porygon-Z, Mienshao, Iron Leaves, Altaria-Mega, Houndoom-Mega, Sharpedo-Mega, Enamorus-Therian, Ursaluna, Diggersby, Latias-Mega, Azumarill, Haxorus, Polteageist, Zoroark-Hisui, Scolipede, Blastoise, Volcanion, Conkeldurr, Heracross-Mega, Jirachi, Iron Boulder, Armarouge, Oricorio-Pom-Pom, Enamorus, Salamence, Durant, Alakazam, Quaquaval, Absol-Mega, Gengar, Primarina

**RU** (91): Crawdaunt, Muk-Alola, Ampharos-Mega, Politoed, Toxtricity, Gastrodon, Togekiss, Kleavor, Iron Thorns, Banette-Mega, Crabominable-Mega, Chimecho-Mega, Raichu-Mega-X, Golisopod-Mega, Chesnaught, Marowak-Alola, Malamar-Mega, Yanmega, Meowstic-M-Mega, Scovillain-Mega, Regidrago, Staraptor-Mega, Lycanroc-Dusk, Forretress, Pyroar-Mega, Scrafty-Mega, Sceptile-Mega, Linoone, Feraligatr-Mega, Feraligatr, Steelix, Gallade, Crobat, Gardevoir, Toxtricity-Low-Key, Celebi, Basculegion-F, Meganium-Mega, Tatsugiri-Curly-Mega, Entei, Chesnaught-Mega, Mimikyu, Eelektross-Mega, Barbaracle-Mega, Golurk-Mega, Ribombee, Cyclizar, Drampa-Mega, Falinks-Mega, Breloom, Delphox-Mega, Krookodile, Camerupt-Mega, Necrozma, Golisopod, Barraskewda, Suicune, Comfey, Swellow, Victreebel-Mega, Raichu-Mega-Y, Magnezone, Nidoqueen, Articuno-Galar, Deoxys-Defense, Regice, Dragalge-Mega, Quagsire, Emboar-Mega, Diancie, Pangoro, Seismitoad, Sharpedo, Bewear, Reuniclus, Cloyster, Articuno, Registeel, Drednaw, Froslass-Mega, Maushold, Sirfetch’d, Cresselia, Barbaracle, Slurpuff, Noivern, Cetitan, Machamp, Sigilyph, Oricorio-Sensu, Lucario

**NU** (56): Escavalier, Dudunsparce, Avalugg, Chandelure, Cinccino, Bellibolt, Incineroar, Xatu, Staraptor, Goodra, Munkidori, Meloetta, Altaria, Copperajah, Inteleon, Scyther, Aerodactyl, Sylveon, Tsareena, Tornadus, Raikou, Dhelmise, Flygon, Duraludon, Decidueye, Basculegion, Brambleghast, Flamigo, Rhyperior, Mantine, Audino-Mega, Grafaiai, Stakataka, Heliolisk, Starmie, Scream Tail, Abomasnow-Mega, Indeedee, Braviary, Exploud, Houndstone, Drapion, Glalie-Mega, Kingler, Klefki, Vanilluxe, Bronzong, Tyrantrum, Gligar, Omastar, Drampa, Overqwil, Dragalge, Guzzlord, Tauros-Paldea-Aqua, Scrafty

**PU** (80): Floatzel, Pawmot, Gigalith, Pikachu, Sandslash-Alola, Qwilfish-Hisui, Dodrio, Turtonator, Eldegoss, Decidueye-Hisui, Salazzle, Milotic, Lilligant, Rotom-Mow, Absol, Qwilfish, Oricorio, Braviary-Hisui, Aromatisse, Charizard, Druddigon, Archeops, Florges, Ferroseed, Araquanid, Golurk, Slowbro-Galar, Ambipom, Palossand, Heracross, Venomoth, Tauros-Paldea-Blaze, Snorlax, Bombirdier, Glastrier, Delphox, Electrode-Hisui, Tentacruel, Wo-Chien, Grimmsnarl, Hoopa, Bellossom, Gorebyss, Centiskorch, Ninjask, Aggron, Shaymin, Jellicent, Garbodor, Raticate-Alola, Cramorant, Porygon2, Typhlosion-Hisui, Audino, Avalugg-Hisui, Ninetales-Alola, Coalossal, Alcremie, Togedemaru, Wishiwashi, Rhydon, Hariyama, Tatsugiri, Doublade, Bruxish, Galvantula, Zoroark, Kilowattrel, Kingdra, Arctovish, Lanturn, Rotom-Heat, Mudsdale, Aurorus, Claydol, Hitmonlee, Emboar, Frosmoth, Oricorio-Pa'u, Arcanine

**ZU** (249): Tauros, Shiftry, Magmortar, Dugtrio-Alola, Basculin-White-Striped, Vespiquen, Tauros-Paldea-Combat, Stunfisk, Seviper, Calyrex, Perrserker, Clawitzer, Passimian, Rotom-Frost, Cacturne, Sneasel, Beautifly, Butterfree, Mawile, Dugtrio, Seaking, Dewgong, Abomasnow, Poliwrath, Huntail, Boltund, Hitmontop, Thievul, Stunfisk-Galar, Lapras, Jolteon, Miltank, Dachsbun, Lycanroc, Musharna, Lurantis, Muk, Swalot, Eelektross, Camerupt, Gourgeist, Hitmonchan, Unfezant, Pinsir, Slaking, Oinkologne, Minun, Octillery, Sawk, Flapple, Unown, Beartic, Ludicolo, Rabsca, Cherrim, Ariados, Volbeat, Rapidash, Eiscue, Minior, Victreebel, Medicham, Scovillain, Farfetch’d, Arboliva, Silvally, Walrein, Banette, Stonjourner, Corsola, Gogoat, Squawkabilly-Yellow, Jumpluff, Kabutops, Manectric, Vivillon, Ampharos, Parasect, Houndoom, Carracosta, Samurott, Exeggutor, Mightyena, Luvdisc, Gourgeist-Large, Cryogonal, Lunatone, Delcatty, Rotom-Fan, Virizion, Persian, Raichu, Runerigus, Granbull, Cradily, Mr. Mime, Mabosstiff, Klinklang, Pyroar, Maractus, Meganium, Bibarel, Toxicroak, Wigglytuff, Exeggutor-Alola, Chatot, Cofagrigus, Liepard, Electrode, Whiscash, Dedenne, Hypno, Falinks, Lickilicky, Golem, Squawkabilly, Sableye, Whimsicott, Cursola, Ditto, Dubwool, Furret, Glalie, Komala, Kricketune, Ledian, Sawsbuck, Torkoal, Wormadam, Basculin-Blue-Striped, Wobbuffet, Kecleon, Sudowoodo, Ninetales, Mothim, Masquerain, Wormadam-Sandy, Wugtrio, Smeargle, Gothitelle, Lycanroc-Midnight, Wyrdeer, Accelgor, Spinda, Lumineon, Plusle, Vikavolt, Golem-Alola, Vileplume, Toedscruel, Klawf, Meowstic, Venusaur, Jynx, Magneton, Pyukumuku, Persian-Alola, Oinkologne-F, Probopass, Noctowl, Basculin, Orbeetle, Kangaskhan, Gumshoos, Pikachu-Original, Indeedee-F, Bastiodon, Sceptile, Morpeko, Chimecho, Shuckle, Zangoose, Stoutland, Crabominable, Farigiraf, Raichu-Alola, Appletun, Wormadam-Trash, Pincurchin, Wailord, Skuntank, Pidgeot, Trevenant, Lopunny, Gourgeist-Super, Sandslash, Illumise, Crustle, Leavanny, Fearow, Delibird, Froslass, Toucannon, Beedrill, Gourgeist-Small, Bouffalant, Castform, Relicanth, Armaldo, Furfrou, Sunflora, Grumpig, Regirock, Phione, Electivire, Typhlosion, Sneasel-Hisui, Heatmor, Tropius, Weezing, Watchog, Honchkrow, Swanna, Purugly, Solrock, Carnivine, Drifblim, Meowstic-F, Throh, Veluza, Grapploct, Zebstrika, Rotom, Oranguru, Beheeyem, Arbok, Mr. Rime, Mismagius, Shiinotic, Orthworm, Greedent, Golduck, Magcargo, Rapidash-Galar, Rampardos, Gurdurr, Raticate, Malamar, Sandaconda, Dusknoir, Carbink, Meltan, Spidops, Brute Bonnet, Pachirisu, Marowak, Dustox, Swoobat, Emolga

**NFE** (18): Sliggoo-Hisui, Sliggoo, Golbat, Lairon, Klang, Dipplin, Mr. Mime-Galar, Piloswine, Dusclops, Ursaring, Type: Null, Stantler, Girafarig, Primeape, Electabuzz, Metang, Corsola-Galar, Magmar

\* overtuned by design (the Simi monkeys).

## Top utility Pokemon (non-damage contribution per game, 15+ appearances)

Per appearance: hazard turns kept up, hazards removed, statuses inflicted, pivots, support actions (screens, Heal Bell, Wish to a teammate), switch-ins absorbed, % HP healed. The index is the sum of those fields standardised over every appearance in the run.

Not enough appearances yet.

## Strongest overall (15+ appearances)


## The Simi monkeys

- Simisage: tier OU, strength 1.06 (0.58 to 1.54), 3 appearances, 33% wins; proposed OU. Overtuned on purpose - read a high number as the patch doing what it was meant to.
- Simipour: tier OU, strength 1.17 (0.69 to 1.66), 3 appearances, 100% wins; proposed OU. Overtuned on purpose - read a high number as the patch doing what it was meant to.
- Simisear: tier OU, strength 0.98 (0.50 to 1.46), 3 appearances, 0% wins; proposed OU. Overtuned on purpose - read a high number as the patch doing what it was meant to.

## Run length estimate

Not enough Pokemon with 20+ appearances to estimate yet.

## Confidence notes

- The prior carries most of the weight until a Pokemon has played a few dozen games; with 2 median appearances, most strengths here are still close to their tier's mean by construction. "No move" means "no evidence yet", not "confirmed".
- Both sides are the same AI. A Pokemon whose value depends on play the AI does badly (e.g. careful Wish passing, prediction-heavy pivots) is under-rated; one the AI plays well is over-rated. The AI also plans with the calculator's copy of the dex, which knows our new moves, abilities and species but not stat or type changes to existing Pokemon (src/velvet-pkmn.js copies only species it has never heard of). Checked: Luxray, Roserade, Spiritomb, Togekiss, Cresselia, Pikachu and Eevee differ, so the AI plans with their pre-patch numbers on both sides - read their results with extra care.
- One set per role, from the role-set data and the assembler: a Pokemon whose best set is unusual may be judged on a worse one.
- The error bars come from the full inverse Hessian (teammate correlations included) but assume the model is right: that strengths add up on a team. Strong synergies (weather, Trick Room) break that and show up as noise.
- Teams are drafted from each Pokemon's band, so a Pokemon is judged mostly among peers; its estimate says how good it is *there*. A move of two tiers or more rests on fewer cross-band games and deserves a second look.
