'use strict';
/*
 * Build src/encounter-tables/sinnoh.js.
 *
 * Channels and catch types come from the atlas (regions/sinnoh.js) so the map
 * and the encounter table cannot drift - the same reason tools/map-links.js
 * reads the atlas rather than repeating it. What lives where is written below.
 *
 * The rule, as in Kagura: the region comes first but is not a fence. `common`
 * is Sinnoh's own - Starly, Bidoof, Shinx, Kricketot on the early roads, snow
 * Pokemon in the north, Galactic's machines round the Windworks - and `rare`
 * is where anything else in the world may turn up. No legendaries and no
 * mythicals, exactly as Kagura has none: Dialga at the Spear Pillar and
 * Giratina behind Turnback Cave are story, run by staff, not a wild roll.
 *
 *   node tools/build-sinnoh-encounters.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ATLAS = process.env.ATLAS_DIR || path.join(__dirname, '..', '..', 'pokemon-rp', 'atlas');
global.window = { ATLAS_REGIONS: {}, ATLAS_SPOTS: {} };
// eslint-disable-next-line no-eval
eval(fs.readFileSync(path.join(ATLAS, 'regions', 'sinnoh.js'), 'utf8'));
const REGION = global.window.ATLAS_REGIONS.sinnoh;

/* Rooms you cannot be jumped in: indoors, or somebody's counter. */
const INDOOR = /(centre|mart|shop|lab|library|house|inn|museum|school|press|day-care|tv|global-trade|poketch|berth|gates|syndicate|villa|hall-of|champions-room|league-gate|ticket|the-villa|hot-spring|clearing-house|foreign-building|amity-square|contest-hall)/;

/* What lives where. common: Sinnoh's own. rare: the rest of the world. */
const LIFE = {
  twinleaf:      [['youngster', 'lass', 'schoolkid'], ['Bidoof', 'Starly', 'Kricketot', 'Zigzagoon', 'Wurmple', 'Bunnelby'], ['Eevee', 'Munchlax', 'Riolu']],
  lakeverity:    [['fisherman', 'swimmer', 'picnicker'], ['Psyduck', 'Magikarp', 'Marill', 'Starly', 'Bidoof', 'Wooper'], ['Chingling', 'Ralts', 'Feebas']],
  sandgem:       [['youngster', 'lass', 'fisherman', 'schoolkid'], ['Bidoof', 'Starly', 'Shellos', 'Wingull', 'Krabby', 'Magikarp'], ['Eevee', 'Clamperl', 'Tentacool']],
  palpark:       [['ranger', 'rangerf', 'breeder', 'pokefan'], ['Bibarel', 'Girafarig', 'Stantler', 'Sudowoodo', 'Miltank', 'Bidoof'], ['Tropius', 'Bouffalant', 'Dunsparce']],
  jubilife:      [['worker', 'gentleman', 'policeman', 'schoolkid', 'guitarist', 'richboy'], ['Rattata', 'Zigzagoon', 'Meowth', 'Magnemite', 'Voltorb', 'Pidove', 'Glameow'], ['Rotom', 'Porygon', 'Varoom']],
  ravagedpath:   [['hiker', 'camper', 'fisherman'], ['Zubat', 'Psyduck', 'Geodude', 'Wooper', 'Bidoof'], ['Barboach', 'Woobat']],
  canalave:      [['sailor', 'worker', 'fisherman', 'scientist', 'blackbelt'], ['Magikarp', 'Tentacool', 'Wingull', 'Magnemite', 'Bronzor', 'Klink', 'Skarmory'], ['Beldum', 'Riolu', 'Togedemaru']],
  ironisland:    [['hiker', 'worker', 'blackbelt', 'ruinmaniac'], ['Geodude', 'Onix', 'Machop', 'Zubat', 'Bronzor', 'Aron', 'Magnemite'], ['Riolu', 'Beldum', 'Larvitar']],
  fullmoon:      [['psychic', 'psychicf', 'sage'], ['Clefairy', 'Munna', 'Drifloon', 'Hoothoot', 'Swablu'], ['Ralts', 'Cutiefly', 'Sinistea']],
  newmoon:       [['hexmaniac', 'channeler', 'delinquent'], ['Sableye', 'Murkrow', 'Gastly', 'Houndour', 'Spiritomb'], ['Absol', 'Zorua', 'Impidimp']],
  oreburghgate:  [['hiker', 'camper', 'blackbelt'], ['Zubat', 'Geodude', 'Psyduck', 'Machop', 'Onix'], ['Gible', 'Nosepass']],
  oreburgh:      [['hiker', 'worker', 'ruinmaniac', 'blackbelt', 'scientist'], ['Geodude', 'Onix', 'Machop', 'Aron', 'Roggenrola', 'Nosepass', 'Cranidos', 'Shieldon'], ['Gible', 'Larvitar', 'Rolycoly']],
  waywardcave:   [['hiker', 'cyclist', 'ruinmaniac'], ['Zubat', 'Geodude', 'Bronzor', 'Onix', 'Gible'], ['Gabite', 'Carbink']],
  floaroma:      [['picnicker', 'beauty', 'breeder', 'lady'], ['Budew', 'Combee', 'Cherubi', 'Roselia', 'Beautifly', 'Dustox', 'Petilil'], ['Cherrim', 'Comfey', 'Flabebe']],
  windworks:     [['galacticgrunt', 'scientist', 'worker'], ['Magnemite', 'Voltorb', 'Electabuzz', 'Pachirisu', 'Shinx', 'Klink'], ['Rotom', 'Elekid', 'Tadbulb']],
  fuego:         [['kindler', 'firebreather', 'worker'], ['Magmar', 'Slugma', 'Numel', 'Magnemite', 'Klink', 'Torkoal'], ['Magby', 'Rotom-Heat', 'Charcadet']],
  eternaforest:  [['bugcatcher', 'camper', 'picnicker', 'hexmaniac'], ['Wurmple', 'Silcoon', 'Cascoon', 'Budew', 'Buneary', 'Hoothoot', 'Murkrow', 'Bidoof'], ['Chingling', 'Eevee', 'Sewaddle']],
  chateau:       [['hexmaniac', 'channeler', 'psychicf'], ['Gastly', 'Haunter', 'Drifloon', 'Duskull', 'Mismagius', 'Murkrow'], ['Rotom', 'Spiritomb', 'Sinistea']],
  eterna:        [['bugcatcher', 'cyclist', 'breeder', 'galacticgrunt', 'ruinmaniac'], ['Budew', 'Roselia', 'Kricketot', 'Combee', 'Cherubi', 'Wurmple'], ['Turtwig', 'Sunkern', 'Bramblin']],
  coronet:       [['hiker', 'blackbelt', 'psychic', 'veteran', 'ruinmaniac'], ['Zubat', 'Golbat', 'Geodude', 'Graveler', 'Machop', 'Machoke', 'Bronzor', 'Nosepass', 'Chingling', 'Meditite', 'Clefairy'], ['Bagon', 'Beldum', 'Absol']],
  hearthome:     [['beauty', 'artist', 'lady', 'acetrainerf', 'kimonogirl'], ['Glameow', 'Buneary', 'Drifloon', 'Duskull', 'Chingling', 'Ralts', 'Kirlia', 'Mime Jr.'], ['Gothita', 'Espurr', 'Milcery']],
  losttower:     [['channeler', 'hexmaniac', 'sage'], ['Gastly', 'Haunter', 'Duskull', 'Murkrow', 'Zubat', 'Golbat'], ['Misdreavus', 'Yamask', 'Greavard']],
  solaceon:      [['breeder', 'pokefan', 'ruinmaniac', 'schoolkid'], ['Bidoof', 'Bibarel', 'Kricketot', 'Chansey', 'Hoothoot', 'Ponyta'], ['Happiny', 'Togepi', 'Dunsparce']],
  solaceonruins: [['ruinmaniac', 'psychic', 'hexmaniac'], ['Unown', 'Geodude', 'Zubat', 'Bronzor'], ['Sigilyph', 'Baltoy', 'Klawf']],
  veilstone:     [['blackbelt', 'battlegirl', 'galacticgrunt', 'punk', 'delinquent'], ['Machop', 'Meditite', 'Stunky', 'Bronzor', 'Croagunk', 'Makuhita'], ['Riolu', 'Mienfoo', 'Falinks']],
  lakevalor:     [['fisherman', 'swimmer', 'swimmerf', 'galacticgrunt'], ['Psyduck', 'Golduck', 'Magikarp', 'Gyarados', 'Marill', 'Buizel', 'Barboach'], ['Chingling', 'Feebas', 'Dratini']],
  valorlakefront:[['tuber', 'beauty', 'richboy', 'acetrainer'], ['Staravia', 'Bibarel', 'Shellos', 'Buizel', 'Wingull', 'Glameow'], ['Finneon', 'Lumineon', 'Chatot']],
  sendoff:       [['veteran', 'hexmaniac', 'psychic'], ['Golduck', 'Dusclops', 'Mismagius', 'Gastly', 'Sableye', 'Drifblim'], ['Spiritomb', 'Duskull', 'Sandygast']],
  turnback:      [['veteran', 'hexmaniac', 'channeler'], ['Duskull', 'Dusclops', 'Gastly', 'Haunter', 'Sableye', 'Spiritomb', 'Golbat'], ['Drifblim', 'Absol', 'Dreepy']],
  pastoria:      [['fisherman', 'swimmer', 'ranger', 'tuber'], ['Croagunk', 'Wooper', 'Quagsire', 'Marill', 'Psyduck', 'Shellos', 'Barboach'], ['Toxicroak', 'Gastrodon', 'Tympole']],
  greatmarsh:    [['ranger', 'rangerf', 'bugcatcher', 'pokefan'], ['Croagunk', 'Quagsire', 'Wooper', 'Bidoof', 'Barboach', 'Skorupi', 'Tangela', 'Yanma', 'Kecleon', 'Tropius'], ['Carnivine', 'Politoed', 'Shroomish']],
  sunyshore:     [['sailor', 'guitarist', 'scientist', 'acetrainer', 'swimmer'], ['Pikachu', 'Magnemite', 'Voltorb', 'Electabuzz', 'Pachirisu', 'Chinchou', 'Wingull'], ['Rotom', 'Tynamo', 'Pawmi']],
  celestic:      [['sage', 'ruinmaniac', 'psychicf', 'gentleman'], ['Bidoof', 'Bibarel', 'Hoothoot', 'Noctowl', 'Chingling', 'Bronzor', 'Geodude'], ['Sigilyph', 'Unown', 'Munna']],
  spearpillar:   [['veteran', 'acetrainer', 'psychic', 'galacticgrunt'], ['Golbat', 'Machoke', 'Bronzong', 'Absol', 'Sneasel', 'Medicham', 'Clefairy'], ['Bagon', 'Beldum', 'Deino']],
  distortion:    [['hexmaniac', 'veteran', 'channeler'], ['Gastly', 'Haunter', 'Duskull', 'Drifblim', 'Sableye', 'Mismagius', 'Spiritomb'], ['Dusknoir', 'Chandelure', 'Dreepy']],
  lakeacuity:    [['skier', 'swimmer', 'galacticgrunt'], ['Snover', 'Sneasel', 'Snorunt', 'Swinub', 'Magikarp', 'Golduck'], ['Froslass', 'Chingling', 'Cubchoo']],
  snowpoint:     [['skier', 'blackbelt', 'veteran', 'sage'], ['Snover', 'Sneasel', 'Snorunt', 'Swinub', 'Zubat', 'Glalie', 'Delibird'], ['Weavile', 'Cubchoo', 'Frigibax']],
  snowpointtemple:[['sage', 'ruinmaniac', 'veteran'], ['Snorunt', 'Glalie', 'Sneasel', 'Golbat', 'Bronzor', 'Nosepass'], ['Froslass', 'Beldum', 'Bergmite']],
  sinnohvictory: [['veteran', 'acetrainer', 'acetrainerf', 'blackbelt', 'dragontamer'], ['Golbat', 'Graveler', 'Machoke', 'Steelix', 'Rhyhorn', 'Onix', 'Gabite', 'Floatzel'], ['Gible', 'Larvitar', 'Bagon']],
  sinnohleague:  [[], [], []],
  flowerparadise:[['beauty', 'lady', 'breeder'], ['Roselia', 'Cherubi', 'Cherrim', 'Combee', 'Vespiquen', 'Petilil'], ['Comfey', 'Flabebe', 'Sunflora']],
  battlefrontier:[[], [], []],
  fightarea:     [['blackbelt', 'battlegirl', 'veteran', 'acetrainer'], ['Machoke', 'Rhyhorn', 'Magmar', 'Staraptor', 'Kricketune', 'Makuhita'], ['Hitmonlee', 'Hitmonchan', 'Pawniard']],
  survivalarea:  [['blackbelt', 'hiker', 'veteran', 'kindler'], ['Machoke', 'Rhyhorn', 'Magmar', 'Graveler', 'Numel', 'Camerupt'], ['Hitmontop', 'Riolu', 'Toxel']],
  resortarea:    [['richboy', 'lady', 'beauty', 'veteran', 'swimmerf'], ['Wingull', 'Pelipper', 'Staravia', 'Bibarel', 'Chansey', 'Miltank'], ['Tropius', 'Chatot', 'Alcremie']],
  starkmountain: [['kindler', 'firebreather', 'veteran', 'hiker'], ['Magmar', 'Slugma', 'Magcargo', 'Numel', 'Camerupt', 'Rhyhorn', 'Graveler', 'Torkoal'], ['Magby', 'Larvitar', 'Charcadet']],
};

/* Routes: number -> [trainers, common, rare]. */
const ROUTES = {
  201: [['youngster', 'lass'], ['Starly', 'Bidoof', 'Kricketot'], ['Shinx', 'Buneary']],
  202: [['youngster', 'lass', 'schoolkid'], ['Starly', 'Bidoof', 'Shinx', 'Kricketot'], ['Buneary', 'Pachirisu']],
  203: [['youngster', 'bugcatcher', 'lass', 'schoolkid'], ['Starly', 'Bidoof', 'Shinx', 'Abra', 'Zubat'], ['Machop', 'Ralts']],
  204: [['bugcatcher', 'picnicker', 'camper'], ['Starly', 'Bidoof', 'Shinx', 'Budew', 'Wurmple', 'Kricketot'], ['Burmy', 'Combee']],
  205: [['bugcatcher', 'fisherman', 'camper', 'galacticgrunt'], ['Bidoof', 'Buizel', 'Shellos', 'Wurmple', 'Silcoon', 'Cascoon'], ['Pachirisu', 'Chatot']],
  206: [['cyclist', 'hiker', 'camper', 'picnicker'], ['Geodude', 'Machop', 'Ponyta', 'Gligar', 'Kricketune', 'Stunky'], ['Gible', 'Bronzor']],
  207: [['hiker', 'camper', 'ruinmaniac'], ['Geodude', 'Machop', 'Ponyta', 'Kricketune', 'Bronzor'], ['Gligar', 'Nosepass']],
  208: [['fisherman', 'breeder', 'schoolkid', 'picnicker'], ['Bidoof', 'Bibarel', 'Psyduck', 'Machop', 'Roselia'], ['Chansey', 'Feebas']],
  209: [['schoolkid', 'lass', 'hexmaniac', 'breeder', 'ruinmaniac'], ['Staravia', 'Bibarel', 'Psyduck', 'Roselia', 'Ralts', 'Bronzor'], ['Chansey', 'Happiny']],
  210: [['camper', 'picnicker', 'breeder', 'sage'], ['Ponyta', 'Machoke', 'Meditite', 'Bibarel', 'Noctowl', 'Hoothoot'], ['Chansey', 'Stantler']],
  211: [['hiker', 'psychic', 'camper'], ['Meditite', 'Bronzor', 'Machoke', 'Chingling', 'Hoothoot', 'Geodude'], ['Clefairy', 'Absol']],
  212: [['fisherman', 'beauty', 'ranger', 'breeder', 'tuber'], ['Croagunk', 'Marill', 'Psyduck', 'Machoke', 'Wooper', 'Roselia', 'Shellos'], ['Kricketune', 'Tympole']],
  213: [['swimmer', 'swimmerf', 'fisherman', 'tuber', 'sailor'], ['Wingull', 'Shellos', 'Buizel', 'Staravia', 'Machoke', 'Krabby'], ['Finneon', 'Corphish']],
  214: [['hiker', 'punk', 'delinquent', 'blackbelt'], ['Stunky', 'Girafarig', 'Houndour', 'Kricketune', 'Graveler', 'Skorupi'], ['Gible', 'Absol']],
  215: [['blackbelt', 'battlegirl', 'ninjaboy', 'acetrainer'], ['Machoke', 'Kricketune', 'Stunky', 'Houndour', 'Girafarig', 'Bibarel'], ['Sneasel', 'Mienfoo']],
  216: [['skier', 'hiker', 'blackbelt'], ['Snover', 'Sneasel', 'Meditite', 'Zubat', 'Snorunt', 'Swinub'], ['Sneasel', 'Cubchoo']],
  217: [['skier', 'hiker', 'veteran'], ['Snover', 'Sneasel', 'Snorunt', 'Swinub', 'Zubat', 'Glalie'], ['Delibird', 'Bergmite']],
  218: [['fisherman', 'swimmer', 'sailor'], ['Wingull', 'Buizel', 'Shellos', 'Machop', 'Magikarp'], ['Finneon', 'Mantyke']],
  219: [['swimmer', 'swimmerf', 'fisherman'], ['Tentacool', 'Magikarp', 'Finneon', 'Wingull'], ['Mantyke', 'Clamperl']],
  220: [['swimmer', 'swimmerf', 'sailor'], ['Tentacool', 'Magikarp', 'Finneon', 'Mantyke'], ['Lumineon', 'Remoraid']],
  221: [['breeder', 'pokefan', 'camper'], ['Staravia', 'Bibarel', 'Girafarig', 'Glameow', 'Stunky'], ['Pachirisu', 'Dunsparce']],
  222: [['guitarist', 'swimmer', 'fisherman', 'acetrainer'], ['Wingull', 'Buizel', 'Floatzel', 'Electabuzz', 'Magikarp', 'Finneon'], ['Chatot', 'Chinchou']],
  223: [['swimmer', 'swimmerf', 'sailor', 'veteran'], ['Tentacool', 'Mantyke', 'Wingull', 'Pelipper', 'Finneon'], ['Remoraid', 'Wailmer']],
  224: [['veteran', 'acetrainerf', 'artist'], ['Staraptor', 'Bibarel', 'Roselia', 'Sudowoodo', 'Kricketune'], ['Chatot', 'Tropius']],
  225: [['blackbelt', 'veteran', 'hiker', 'battlegirl'], ['Rhyhorn', 'Magmar', 'Machoke', 'Staraptor', 'Floatzel'], ['Torkoal', 'Pawniard']],
  226: [['birdkeeper', 'swimmer', 'veteran'], ['Wingull', 'Pelipper', 'Skarmory', 'Golbat', 'Staraptor'], ['Tropius', 'Rufflet']],
  227: [['kindler', 'hiker', 'veteran', 'firebreather'], ['Numel', 'Camerupt', 'Magmar', 'Rhyhorn', 'Graveler', 'Slugma'], ['Torkoal', 'Turtonator']],
  228: [['ruinmaniac', 'hiker', 'veteran'], ['Cacnea', 'Sandslash', 'Hippopotas', 'Gligar', 'Trapinch'], ['Larvitar', 'Silicobra']],
  229: [['camper', 'picnicker', 'pokefan'], ['Staravia', 'Bibarel', 'Kricketune', 'Roselia', 'Pachirisu'], ['Chatot', 'Buneary']],
  230: [['swimmer', 'swimmerf', 'sailor', 'veteran'], ['Tentacruel', 'Mantyke', 'Pelipper', 'Wailmer', 'Finneon'], ['Lumineon', 'Dratini']],
};

const q = (a) => '[' + a.map((x) => `'${x.replace(/'/g, "\\'")}'`).join(', ') + ']';
const out = [];

for (const place of REGION.PLACES) {
  const life = LIFE[place.id];
  if (!life) { console.log(`  ! no species written for ${place.id}`); continue; }
  const [trainers, common, rare] = life;
  const chans = (place.chans || []).map((c) => c.replace(/^#/, ''));
  const indoor = chans.filter((c) => INDOOR.test(c));
  const wild = common.length ? chans.filter((c) => !INDOOR.test(c)) : [];
  out.push(`    '${place.id}': {
      name: ${q([place.name])[0] === '[' ? `'${place.name}'` : `'${place.name}'`},
      channels: ${q(chans)},
      types: ${q(place.catch || [])},
      wild: ${q(wild)},
      trainers: ${q(trainers)},
      noTrainers: ${q(indoor)},
      common: ${q(common)},
      rare: ${q(rare)},
    },`);
}

for (const n of Object.keys(ROUTES)) {
  const [trainers, common, rare] = ROUTES[n];
  const info = REGION.ROUTE_INFO[n] || {};
  out.push(`    'route-${n}': {
      name: '${info.name || `Route ${n}`}',
      channels: ['route-${n}'],
      types: ${q(info.catch || [])},
      wild: ['route-${n}'],
      trainers: ${q(trainers)},
      noTrainers: [],
      common: ${q(common)},
      rare: ${q(rare)},
    },`);
}

const header = `'use strict';
/**
 * Sinnoh encounter tables.
 *
 * Built by tools/build-sinnoh-encounters.js from the atlas region file, so the
 * channels here are exactly the channels on the map. Do not edit by hand: edit
 * the builder and run it again.
 *
 * Same shape as kagura.js, and the same rule - the region comes first but is
 * not a fence. \`common\` is Sinnoh's own, \`rare\` is where the rest of the world
 * turns up, so every Pokemon can be met somewhere without the place stopping
 * feeling like Sinnoh. No legendaries and no mythicals, as in Kagura: Dialga on
 * the Spear Pillar and Giratina behind Turnback Cave are story that staff run,
 * not a wild roll.
 */
module.exports = {
  region: 'sinnoh',
  locations: {
${out.join('\n')}
  },
};
`;

const file = path.join(__dirname, '..', 'src', 'encounter-tables', 'sinnoh.js');
fs.writeFileSync(file, header);
console.log(`${out.length} entries -> ${path.relative(process.cwd(), file)}`);
