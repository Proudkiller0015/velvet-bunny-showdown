'use strict';
/**
 * Gensokyo encounter tables (21 Oct 2026).
 *
 * Gensokyo is the Touhou world, arrived through the region collision. Its places
 * and channels are the RP bot's (rp-bot/tools/gensokyo-channels.js, data/map-places.json)
 * and the atlas's (pokemon-rp/atlas/regions/gensokyo.js); routes 301-306 are keyed
 * "route-3xx" here and "r3xx" on the map, as Kagura's are.
 *
 * Same shape and the same rules as kagura.js: `types` mirror the atlas catch types,
 * `common` is the base of each line that makes the place feel like itself, `rare` holds
 * the surprises, `spots` are channels with Pokemon of their own. Places are not early
 * or late game: badges decide strength and levels everywhere (the owner's open-world
 * rule), so a "harder" place is one whose lines grow stronger - Former Hell's
 * Druddigon and Gible, the mountain's Skarmory and Bagon - not one with a level floor.
 * Starters and pseudo-legendaries only in `rare`, at no more than two places each; no
 * legendaries, mythicals, Ultra Beasts or Paradox Pokemon anywhere.
 *
 * What only Gensokyo has: `boneka`. The Touhou Pokemon (data/velvet/touhou.js) live
 * here and nowhere else, each at its canon home. Every Boneka a place (or a spot)
 * names is exactly 1% of what turns up there (encounters.js BONEKA_SHARE), whatever
 * the badges, and the rest of the table shares the remainder as it always would. A
 * spot's `boneka` replaces the place's in that channel: Patchouli and Koakuma read in
 * the library, Flandre stays in the basement. The legendary Touhou Pokemon
 * (touhou.js LEGENDS: Yukari, Kanako, Suwako, the Yama...) are never listed: the
 * story hands those out. encounters.js refuses Boneka from any other region's table.
 */
module.exports = {
  region: 'gensokyo',
  locations: {
    // -------------------------------------------------------- Human Village
    'village': {
      name: 'Human Village',
      channels: ['poke-center-village', 'village-mart', 'village-square', 'suzunaan', 'village-tea-house', 'terakoya', 'village-gate'],
      types: ['Normal', 'Flying', 'Grass', 'Fairy'],
      wild: ['village-square', 'village-gate', 'suzunaan', 'village-tea-house', 'terakoya'],
      trainers: ['schoolkid', 'youngster', 'lass', 'teacher', 'gentleman', 'kimonogirl', 'worker', 'artist'],
      noTrainers: ['poke-center-village', 'village-mart', 'suzunaan', 'village-tea-house', 'terakoya'],
      // Townsfolk: house dogs and cats, sparrows and pigeons, mice in the rice stores.
      common: ['Lillipup', 'Pidove', 'Rattata', 'Meowth', 'Skitty', 'Minccino', 'Tandemaus', 'Fidough', 'Mime Jr.', 'Mareep', 'Smoliv'],
      rare: ['Smeargle', 'Eevee', 'Sprigatito', 'Farfetch’d'],
      spots: {
        // Kosuzu's book rental: youkai books that read you back
        'suzunaan': { types: ['Psychic', 'Ghost', 'Normal'], common: ['Unown', 'Natu', 'Elgyem', 'Spoink', 'Mime Jr.'], rare: ['Smeargle'] },
        // the village school: little ones, and Keine's lessons
        'terakoya': { types: ['Normal', 'Fairy', 'Psychic'], common: ['Cleffa', 'Igglybuff', 'Happiny', 'Azurill', 'Smoochum', 'Wynaut'], rare: ['Togepi', 'Munchlax'] },
        // tea, sweets and whatever is steeping in the pot
        'village-tea-house': { types: ['Ghost', 'Fairy', 'Normal'], common: ['Sinistea', 'Milcery', 'Swirlix', 'Fidough', 'Skitty'], rare: ['Poltchageist'] },
      },
      boneka: ['Keine', 'Mamizou Futatsuiwa', 'Hata no Kokoro', 'Sekibanki', 'Joon Yorigami', 'Mike Gotoukuji'],
    },
    'myouren': {
      name: 'Myouren Temple',
      channels: ['myouren-gate', 'myouren-temple', 'myouren-graveyard', 'myouren-gym'],
      types: ['Fighting', 'Ghost', 'Normal', 'Psychic'],
      wild: ['myouren-gate', 'myouren-temple', 'myouren-graveyard'],
      trainers: ['sage', 'blackbelt', 'battlegirl', 'channeler', 'psychic', 'hexmaniac'],
      noTrainers: [],
      // Monks and their discipline; a temple bell; the youkai the temple takes in.
      common: ['Timburr', 'Mienfoo', 'Meditite', 'Throh', 'Sawk', 'Bronzor', 'Drowzee', 'Mankey', 'Natu', 'Croagunk', 'Stantler'],
      rare: ['Spiritomb', 'Riolu', 'Jangmo-o', 'Oranguru'],
      spots: {
        // the graveyard, and the mausoleum of the Taoists beneath it
        'myouren-graveyard': {
          types: ['Ghost', 'Dark', 'Poison'],
          common: ['Gastly', 'Misdreavus', 'Pumpkaboo', 'Drifloon', 'Murkrow', 'Zubat', 'Stunky', 'Greavard'],
          rare: ['Spiritomb', 'Zorua'],
          boneka: ['Kogasa Tatara', 'Yoshika Miyako', 'Seiga Kaku', 'Soga no Tojiko', 'Mononobe no Futo', 'Toyosatomimi no Miko'],
        },
      },
      boneka: ['Byakuren Hijiri', 'Ichirin Kumoi', 'Minamitsu Murasa', 'Shou Toramaru', 'Nazrin', 'Nue Houjuu', 'Kyouko Kasodani'],
    },

    // ------------------------------------------------------- Hakurei Shrine
    'hakurei': {
      name: 'Hakurei Shrine',
      channels: ['hakurei-steps', 'hakurei-grounds', 'donation-box', 'hakurei-hot-spring', 'hakurei-gym'],
      types: ['Fairy', 'Psychic', 'Flying', 'Normal'],
      wild: ['hakurei-steps', 'hakurei-grounds', 'donation-box', 'hakurei-hot-spring'],
      trainers: ['kimonogirl', 'channeler', 'psychicf', 'lass', 'pokefan', 'beauty'],
      noTrainers: ['donation-box', 'hakurei-hot-spring'],
      // Shrine fairies and fox spirits; the Barrier's oddities; birds on the torii.
      common: ['Snubbull', 'Spritzee', 'Ralts', 'Inkay', 'Vulpix', 'Dedenne', 'Mawile', 'Pidgey', 'Starly', 'Hatenna', 'Impidimp'],
      // Mr. Mime makes barriers, Sigilyph guards a border, Oricorio dances the shrine's kagura.
      rare: ['Mr. Mime', 'Sigilyph', 'Oricorio-Sensu'],
      spots: {
        // usually empty, the shrine maiden will tell you so
        'donation-box': { types: ['Normal', 'Dark', 'Steel'], common: ['Meowth', 'Pawmi', 'Rattata', 'Purrloin', 'Zigzagoon', 'Nickit'], rare: ['Gimmighoul'], boneka: ['Reimu Hakurei', 'Shion Yorigami'] },
        // the hot spring behind the shrine, and an oni who never leaves it
        'hakurei-hot-spring': { types: ['Water', 'Fire', 'Normal'], common: ['Psyduck', 'Slowpoke', 'Buizel', 'Panpour', 'Pansear', 'Litleo'], rare: ['Spinda'], boneka: ['Suika Ibuki', 'Reimu Hakurei'] },
      },
      boneka: ['Reimu Hakurei', 'Suika Ibuki', 'Sunny Milk', 'Luna Child', 'Star Sapphire', 'Shinmyoumaru Sukuna', 'Clownpiece', 'Aunn Komano'],
    },

    // ------------------------------------------------------ Forest of Magic
    'forestofmagic': {
      name: 'Forest of Magic',
      channels: ['magic-forest-edge', 'mushroom-glade', 'kirisame-house', 'margatroid-house'],
      types: ['Poison', 'Grass', 'Bug', 'Ghost'],
      wild: ['magic-forest-edge', 'mushroom-glade'],
      trainers: ['hexmaniac', 'bugcatcher', 'ranger', 'rangerf', 'camper', 'ninjaboy'],
      noTrainers: ['kirisame-house', 'margatroid-house'],
      // Magic-grade mushrooms, witches' familiars and the things in the dark between the trees.
      common: ['Foongus', 'Shroomish', 'Paras', 'Morelull', 'Toedscool', 'Hatenna', 'Impidimp', 'Gothita', 'Spinarak', 'Venonat', 'Oddish', 'Phantump'],
      // A witch's fox, a doll that wanted to be loved, and a seed that should not grow here.
      rare: ['Fennekin', 'Mimikyu', 'Bulbasaur'],
      boneka: ['Marisa Kirisame', 'Alice Margatroid', 'Narumi Yatadera', 'Chimi Houjuu'],
    },
    'kourindou': {
      name: 'Kourindou',
      channels: ['kourindou', 'kourindou-storeroom'],
      types: ['Steel', 'Electric', 'Normal', 'Ghost'],
      wild: ['kourindou', 'kourindou-storeroom'],
      trainers: ['scientist', 'gentleman', 'worker', 'artist'],
      noTrainers: ['kourindou-storeroom'],
      // Things that fell in from the outside world, some of them still switched on.
      common: ['Magnemite', 'Klefki', 'Trubbish', 'Voltorb', 'Klink', 'Nosepass', 'Varoom', 'Tadbulb', 'Plusle', 'Minun', 'Ferroseed'],
      rare: ['Rotom', 'Porygon', 'Beldum'],
      spots: {
        // nobody has sorted it; some of it has started sorting itself
        'kourindou-storeroom': { types: ['Ghost', 'Steel', 'Electric'], common: ['Shuppet', 'Golett', 'Magnemite', 'Klefki', 'Trubbish', 'Bronzor'], rare: ['Rotom', 'Gimmighoul'] },
      },
      // Instruments and a robot maid that came to life among the junk.
      boneka: ['Benben Tsukumo', 'Yatsuhashi Tsukumo', 'Raiko Horikawa', 'VIVIT'],
    },

    // ------------------------------------------------ Scarlet Devil Mansion
    'mistylake': {
      name: 'Misty Lake',
      channels: ['misty-lake', 'fairy-shallows'],
      types: ['Water', 'Ice', 'Fairy', 'Bug'],
      wild: ['misty-lake', 'fairy-shallows'],
      trainers: ['fisherman', 'swimmerf', 'tuber', 'lass', 'picnicker', 'skier'],
      noTrainers: [],
      // Fog, cold water and an ice fairy's playground.
      common: ['Snorunt', 'Spheal', 'Wingull', 'Lotad', 'Marill', 'Surskit', 'Goldeen', 'Poliwag', 'Snom', 'Ducklett', 'Vanillite', 'Magikarp'],
      rare: ['Froakie', 'Goomy', 'Lapras'],
      spots: {
        // the fairies' end of the lake
        'fairy-shallows': { types: ['Fairy', 'Water', 'Ice'], common: ['Marill', 'Snorunt', 'Spheal', 'Cutiefly', 'Flabébé', 'Swablu', 'Vanillite'], rare: ['Froakie', 'Lapras'] },
      },
      boneka: ['Cirno', 'Daiyousei', 'Wakasagihime'],
    },
    'scarletmansion': {
      name: 'Scarlet Devil Mansion',
      channels: ['mansion-gate', 'mansion-garden', 'voile-library', 'clock-tower', 'mansion-basement', 'scarlet-gym'],
      types: ['Dark', 'Ghost', 'Psychic', 'Fire'],
      wild: ['mansion-gate', 'mansion-garden', 'voile-library', 'clock-tower', 'mansion-basement'],
      trainers: ['gentleman', 'lady', 'hexmaniac', 'psychicf', 'blackbelt', 'kimonogirl'],
      noTrainers: ['voile-library', 'mansion-basement'],
      // A vampire's house: bats, candles, cats in the corridors and a mansion larger inside than out.
      common: ['Zubat', 'Noibat', 'Woobat', 'Litwick', 'Sableye', 'Espurr', 'Abra', 'Houndour', 'Purrloin', 'Sinistea', 'Klefki', 'Gastly'],
      rare: ['Mimikyu', 'Deino', 'Chimecho'],
      spots: {
        // a gatekeeper who is usually asleep, and the company she keeps
        'mansion-gate': { types: ['Fighting', 'Dark', 'Normal'], common: ['Scraggy', 'Tyrogue', 'Houndour', 'Slakoth', 'Komala', 'Mienfoo'], rare: ['Snorlax', 'Hawlucha'], boneka: ['Hong Meiling'] },
        // Voile, the great library, and its little devil
        'voile-library': { types: ['Psychic', 'Ghost', 'Normal'], common: ['Abra', 'Solosis', 'Litwick', 'Espurr', 'Woobat', 'Hatenna', 'Unown'], rare: ['Indeedee'], boneka: ['Patchouli Knowledge', 'Koakuma'] },
        // the clock tower, where time is kept and sometimes stopped
        'clock-tower': { types: ['Steel', 'Psychic', 'Flying'], common: ['Chimecho', 'Klink', 'Bronzor', 'Noibat', 'Hoothoot', 'Honedge'], rare: ['Sigilyph'], boneka: ['Sakuya Izayoi', 'Remilia Scarlet'] },
        // do not go down to the basement
        'mansion-basement': { types: ['Dark', 'Fire', 'Ghost'], common: ['Houndour', 'Litwick', 'Zubat', 'Sableye', 'Gastly', 'Salandit'], rare: ['Deino'], boneka: ['Flandre Scarlet'] },
      },
      // The garden: the gatekeeper tends it, the maid crosses it, the mistress takes tea in it.
      boneka: ['Hong Meiling', 'Sakuya Izayoi', 'Remilia Scarlet'],
    },

    // -------------------------------------------- Bamboo Forest of the Lost
    'bamboo': {
      name: 'Bamboo Forest of the Lost',
      channels: ['bamboo-forest', 'lost-paths', 'rabbit-warren'],
      types: ['Grass', 'Normal', 'Bug', 'Fire'],
      wild: ['bamboo-forest', 'lost-paths', 'rabbit-warren'],
      trainers: ['ranger', 'rangerf', 'camper', 'picnicker', 'ninjaboy', 'bugcatcher'],
      noTrainers: ['rabbit-warren'],
      // Rabbits who know the way and will not tell you; pandas in the bamboo; a phoenix's embers.
      common: ['Pancham', 'Bunnelby', 'Buneary', 'Kricketot', 'Pikipek', 'Sewaddle', 'Skwovet', 'Nincada', 'Shroomish', 'Ponyta', 'Teddiursa'],
      rare: ['Scorbunny', 'Grookey', 'Charcadet'],
      spots: {
        // the rabbits' warren, earth rabbits and moon rabbits both
        'rabbit-warren': { types: ['Normal', 'Fairy', 'Ground'], common: ['Bunnelby', 'Buneary', 'Diglett', 'Skwovet', 'Clefairy', 'Fidough'], rare: ['Scorbunny'], boneka: ['Tewi Inaba', 'Seiran', 'Ringo'] },
      },
      boneka: ['Tewi Inaba', 'Fujiwara no Mokou', 'Kagerou Imaizumi'],
    },
    'eientei': {
      name: 'Eientei',
      channels: ['eientei-gate', 'eientei-halls', 'eientei-pharmacy', 'eientei-gym'],
      types: ['Psychic', 'Normal', 'Fairy', 'Grass'],
      wild: ['eientei-gate', 'eientei-halls', 'eientei-pharmacy'],
      trainers: ['nurse', 'psychicf', 'kimonogirl', 'lady', 'scientist'],
      noTrainers: ['eientei-pharmacy'],
      // The moon (Clefairy, Lunatone, Munna's dreams) and the best medicine in Gensokyo.
      common: ['Clefairy', 'Munna', 'Chingling', 'Lunatone', 'Minior', 'Elgyem', 'Spoink', 'Flittle', 'Chansey', 'Audino', 'Comfey'],
      // Kaguya's impossible requests: a fire-rat's robe, a jewel from a dragon's neck.
      rare: ['Eevee', 'Cyndaquil', 'Carbink'],
      spots: {
        // Eirin's pharmacy: healers, and what goes into the medicine
        'eientei-pharmacy': { types: ['Normal', 'Fairy', 'Poison', 'Grass'], common: ['Chansey', 'Audino', 'Comfey', 'Shroomish', 'Paras', 'Croagunk'], rare: ['Toxel'] },
      },
      boneka: ['Reisen Inaba', 'Eirin Yagokoro', 'Kaguya Houraisan'],
    },

    // ------------------------------------------------------ Youkai Mountain
    'genbu': {
      name: 'Genbu Ravine',
      channels: ['genbu-ravine', 'kappa-workshop', 'mountain-river'],
      types: ['Water', 'Steel', 'Electric', 'Rock'],
      wild: ['genbu-ravine', 'mountain-river', 'kappa-workshop'],
      trainers: ['scientist', 'worker', 'fisherman', 'hiker', 'swimmer', 'guitarist'],
      noTrainers: [],
      // Kappa country: plates on their heads, cucumbers in the river, machines on the bank.
      common: ['Lotad', 'Klink', 'Magnemite', 'Barboach', 'Basculin', 'Chewtle', 'Roggenrola', 'Wooper', 'Corphish', 'Tynamo', 'Dwebble'],
      rare: ['Oshawott', 'Rotom-Wash', 'Duraludon'],
      spots: {
        // the kappa workshop: everything here has a spanner in it
        'kappa-workshop': { types: ['Steel', 'Electric', 'Water'], common: ['Klink', 'Magnemite', 'Tinkatink', 'Togedemaru', 'Helioptile', 'Lotad'], rare: ['Rotom-Wash', 'Duraludon'] },
      },
      boneka: ['Nitori Kawashiro', 'Hina Kagiyama', 'Takane Yamashiro', 'Kasen Ibaraki', 'Nina Watari'],
    },
    'tenguvillage': {
      name: 'Tengu Village',
      channels: ['poke-center-mountain', 'tengu-village', 'nine-heavens-falls', 'bunbunmaru-press'],
      types: ['Flying', 'Dark', 'Rock', 'Water'],
      wild: ['tengu-village', 'nine-heavens-falls'],
      trainers: ['birdkeeper', 'hiker', 'ninjaboy', 'veteran', 'acetrainer', 'acetrainerf'],
      noTrainers: ['poke-center-mountain', 'bunbunmaru-press'],
      // Crow and wolf tengu, the long-nosed ones, and the birds of the high slopes.
      common: ['Murkrow', 'Nuzleaf', 'Rookidee', 'Vullaby', 'Poochyena', 'Rockruff', 'Spearow', 'Rufflet', 'Taillow', 'Geodude', 'Sneasel', 'Bombirdier'],
      rare: ['Bagon', 'Hawlucha', 'Skarmory'],
      spots: {
        // the Waterfall of Nine Heavens: carp that might climb it, and a wolf on watch
        'nine-heavens-falls': { types: ['Water', 'Rock', 'Flying'], common: ['Magikarp', 'Goldeen', 'Poliwag', 'Psyduck', 'Ducklett', 'Rockruff', 'Nuzleaf'], rare: ['Dratini'] },
      },
      boneka: ['Aya Shameimaru', 'Momiji Inubashiri', 'Hatate Himekaidou', 'Megumu Iizunamaru', 'Tsukasa Kudamaki', 'Sannyo Komakusa', 'Nemuno Sakata'],
    },
    'moriya': {
      name: 'Moriya Shrine',
      channels: ['moriya-steps', 'moriya-shrine', 'moriya-lake', 'moriya-gym'],
      types: ['Water', 'Flying', 'Poison', 'Ice'],
      wild: ['moriya-steps', 'moriya-shrine', 'moriya-lake'],
      trainers: ['kimonogirl', 'channeler', 'skier', 'birdkeeper', 'hiker', 'sage'],
      noTrainers: [],
      // A snake goddess and a frog goddess, wind at the summit, snow on the steps.
      common: ['Ekans', 'Seviper', 'Croagunk', 'Tympole', 'Poliwag', 'Hoppip', 'Swablu', 'Snover', 'Swinub', 'Cubchoo', 'Bergmite', 'Wattrel'],
      // A mongoose among the snakes; the frog; the dragon of the snowline.
      rare: ['Froakie', 'Frigibax', 'Zangoose'],
      spots: {
        // the lake the shrine brought with it
        'moriya-lake': { types: ['Water', 'Poison', 'Flying'], common: ['Tympole', 'Poliwag', 'Croagunk', 'Magikarp', 'Barboach', 'Surskit', 'Chewtle'], rare: ['Dratini', 'Feebas'] },
      },
      boneka: ['Sanae Kochiya', 'Letty Whiterock', 'Iku Nagae', 'Tenshi Hinanawi'],
    },

    // --------------------------------------------------------- Netherworld
    'netherworld': {
      name: 'The Netherworld',
      channels: ['netherworld-gate', 'phantom-fields'],
      types: ['Ghost', 'Fairy', 'Psychic', 'Flying'],
      wild: ['netherworld-gate', 'phantom-fields'],
      trainers: ['channeler', 'hexmaniac', 'sage', 'psychic', 'kimonogirl'],
      noTrainers: [],
      // Phantoms in the fields above the clouds, and cherry blossom that never quite falls.
      common: ['Shuppet', 'Duskull', 'Frillish', 'Drifloon', 'Misdreavus', 'Gastly', 'Bellsprout', 'Cherubi', 'Swablu', 'Spritzee', 'Cottonee'],
      // A dragon's ghost, and the vengeful spirits of an older age.
      rare: ['Dreepy', 'Zorua-Hisui', 'Sinistea'],
      boneka: ['Lunasa Prismriver', 'Merlin Prismriver', 'Lyrica Prismriver', 'Doremy Sweet', 'Yuiman Asama'],
    },
    'hakugyokurou': {
      name: 'Hakugyokurou',
      channels: ['hakugyokurou-stairs', 'hakugyokurou-garden', 'saigyou-ayakashi', 'hakugyokurou-gym'],
      types: ['Ghost', 'Grass', 'Fairy', 'Steel'],
      wild: ['hakugyokurou-stairs', 'hakugyokurou-garden', 'saigyou-ayakashi'],
      trainers: ['kimonogirl', 'channeler', 'sage', 'lady', 'ninjaboy'],
      noTrainers: ['saigyou-ayakashi'],
      // A ghost princess's estate: a gardener's blades, a bonsai, the cherry trees.
      common: ['Cherubi', 'Phantump', 'Pumpkaboo', 'Bramblin', 'Pawniard', 'Deerling', 'Bonsly', 'Flabébé', 'Petilil', 'Hoothoot'],
      rare: ['Honedge', 'Turtwig', 'Spiritomb'],
      spots: {
        // the Saigyou Ayakashi, which has never bloomed
        'saigyou-ayakashi': { types: ['Ghost', 'Grass', 'Dark'], common: ['Phantump', 'Cherubi', 'Bramblin', 'Duskull', 'Drifloon', 'Misdreavus'], rare: ['Honedge', 'Dreepy'] },
      },
      boneka: ['Youmu Konpaku', 'Yuyuko Saigyouji', 'Ran Yakumo'],
    },

    // ---------------------------------------------------------- Former Hell
    'windcave': {
      name: 'Wind Cave',
      channels: ['wind-cave', 'underground-bridge'],
      types: ['Rock', 'Ground', 'Dark', 'Poison'],
      wild: ['wind-cave', 'underground-bridge'],
      trainers: ['hiker', 'ruinmaniac', 'punk', 'backpacker', 'worker'],
      noTrainers: [],
      // The way down: bats, spiders in the dark, a centipede miner's tunnels and warm wind from below.
      common: ['Woobat', 'Zubat', 'Roggenrola', 'Diglett', 'Tarountula', 'Joltik', 'Venipede', 'Onix', 'Drilbur', 'Aron', 'Skorupi', 'Nacli'],
      rare: ['Larvitar', 'Shuckle', 'Sableye'],
      spots: {
        // the bridge at the bottom, where someone is always waiting and jealous of you
        'underground-bridge': { types: ['Dark', 'Water', 'Ghost'], common: ['Barboach', 'Shellos', 'Wooper', 'Zubat', 'Woobat', 'Stunky'], rare: ['Sableye', 'Relicanth'] },
      },
      boneka: ['Kisume', 'Yamame Kurodani', 'Parsee Mizuhashi', 'Misumaru Tamatsukuri', 'Momoyo Himemushi'],
    },
    'formercapital': {
      name: 'Former Capital',
      channels: ['poke-center-underground', 'former-capital', 'oni-tavern'],
      types: ['Fighting', 'Fire', 'Dark', 'Rock'],
      wild: ['former-capital', 'oni-tavern'],
      trainers: ['blackbelt', 'battlegirl', 'delinquent', 'punk', 'firebreather', 'veteran', 'worker'],
      noTrainers: ['poke-center-underground'],
      // The oni's city: strength, sake, lanterns and arguments settled with a fight.
      common: ['Machop', 'Makuhita', 'Litleo', 'Sandile', 'Silicobra', 'Druddigon', 'Golett', 'Scraggy', 'Crabrawler', 'Torkoal', 'Heatmor', 'Houndour'],
      rare: ['Gible', 'Chimchar', 'Darumaka'],
      boneka: ['Yuugi Hoshiguma', 'Yachie Kicchou', 'Saki Kurokuma', 'Mayumi Joutouguu'],
    },
    'chireiden': {
      name: 'Palace of the Earth Spirits',
      channels: ['chireiden-halls', 'hell-of-blazing-fires', 'chireiden-gym'],
      types: ['Fire', 'Psychic', 'Dark', 'Steel'],
      wild: ['chireiden-halls', 'hell-of-blazing-fires'],
      trainers: ['psychicf', 'hexmaniac', 'breeder', 'firebreather', 'kindler', 'scientist'],
      noTrainers: [],
      // Satori's pets - cats, crows, hell's ravens - and a mistress who reads minds.
      common: ['Purrloin', 'Glameow', 'Murkrow', 'Shinx', 'Sneasel', 'Fletchling', 'Espurr', 'Numel', 'Slugma', 'Magby'],
      rare: ['Litten', 'Torchic', 'Meowth-Galar'],
      spots: {
        // the old fires of hell, and the sun a raven swallowed
        'hell-of-blazing-fires': {
          types: ['Fire', 'Steel', 'Ground'],
          common: ['Numel', 'Slugma', 'Silicobra', 'Salandit', 'Sizzlipede', 'Magby', 'Glimmet', 'Fletchling'],
          rare: ['Torchic', 'Larvesta'],
          boneka: ['Utsuho Reiuji', 'Rin Kaenbyou', 'Yuuma Toutetsu', 'Chiyari Tenkajin', 'Hisami Yomotsu'],
        },
      },
      boneka: ['Satori Komeiji', 'Koishi Komeiji', 'Rin Kaenbyou', 'Utsuho Reiuji'],
    },

    // -------------------------------------------------- Wilds & Ways
    'gardenofsun': {
      name: 'Garden of the Sun',
      channels: ['sunflower-fields', 'sunflower-gym'],
      types: ['Grass', 'Bug', 'Fire', 'Fairy'],
      wild: ['sunflower-fields'],
      trainers: ['picnicker', 'camper', 'bugcatcher', 'beauty', 'lady', 'artist'],
      noTrainers: [],
      // Sunflowers taller than you, all turned the same way, and everything that feeds on them.
      common: ['Sunkern', 'Petilil', 'Cottonee', 'Floette', 'Bounsweet', 'Comfey', 'Combee', 'Cutiefly', 'Caterpie', 'Scatterbug', 'Fomantis', 'Ledyba'],
      rare: ['Chikorita', 'Snivy', 'Heracross'],
      boneka: ['Yuuka Kazami', 'Lily White', 'Eternity Larva'],
    },
    'namelesshill': {
      name: 'Nameless Hill',
      channels: ['nameless-hill'],
      types: ['Poison', 'Fairy', 'Grass'],
      wild: ['nameless-hill'],
      trainers: ['hexmaniac', 'picnicker', 'beauty', 'scientist', 'ninjaboy'],
      noTrainers: [],
      // Lily of the valley, all of it poisonous, and a doll that minds.
      common: ['Budew', 'Oddish', 'Trubbish', 'Foongus', 'Nidoran-F', 'Nidoran-M', 'Grimer', 'Koffing', 'Shroodle', 'Spinarak'],
      rare: ['Grimer-Alola', 'Weezing-Galar', 'Banette'],
      boneka: ['Medicine Melancholy'],
    },
    'muenzuka': {
      name: 'Muenzuka',
      channels: ['muenzuka'],
      types: ['Ghost', 'Dark', 'Steel', 'Poison'],
      wild: ['muenzuka'],
      trainers: ['channeler', 'hexmaniac', 'ruinmaniac', 'punk', 'backpacker', 'sage'],
      noTrainers: [],
      // Unmarked graves, red spider lilies, the road to Higan, and outside things washed up.
      common: ['Yamask', 'Litwick', 'Duskull', 'Greavard', 'Mareanie', 'Sandygast', 'Cubone', 'Stunky', 'Nickit', 'Rattata-Alola', 'Pawniard'],
      rare: ['Honedge', 'Absol', 'Yamask-Galar'],
      boneka: ['Komachi Onozuka', 'Nazrin', 'Sumireko Usami', 'Eika Ebisu', 'Urumi Ushizaki', 'Kutaka Niwatari', 'Ubame Chirizuka'],
    },

    // ---------------------------------------------------------------- Routes
    'route-301': {
      name: 'Route 301',
      channels: ['route-301'],
      types: ['Normal', 'Flying', 'Fairy'],
      wild: ['route-301'],
      trainers: ['youngster', 'lass', 'birdkeeper', 'backpacker', 'cyclist', 'kimonogirl'],
      // The long road to the shrine: open country, and youkai at the treeline.
      common: ['Pidgey', 'Zigzagoon', 'Patrat', 'Yungoos', 'Doduo', 'Lechonk', 'Bidoof', 'Teddiursa', 'Fletchling', 'Snubbull'],
      rare: ['Pichu', 'Kangaskhan', 'Zorua'],
      boneka: ['Seija Kijin', 'Enoko Mitsugashira', 'Nareko Michigami'],
    },
    'route-302': {
      name: 'Route 302',
      channels: ['route-302'],
      types: ['Grass', 'Bug', 'Poison'],
      wild: ['route-302'],
      trainers: ['bugcatcher', 'camper', 'picnicker', 'youngster', 'ranger'],
      // Across the river and into the trees at dusk.
      common: ['Weedle', 'Wurmple', 'Gossifleur', 'Nymble', 'Burmy', 'Blipbug', 'Grubbin', 'Rellor', 'Dewpider', 'Surskit', 'Bellsprout'],
      rare: ['Pinsir', 'Scyther'],
      boneka: ['Rumia'],
    },
    'route-303': {
      name: 'Route 303',
      channels: ['route-303'],
      types: ['Normal', 'Water', 'Fairy'],
      wild: ['route-303'],
      trainers: ['fisherman', 'lass', 'picnicker', 'tuber', 'youngster'],
      // Spring Lane's blossom, then fog thickening all the way to the lake shore.
      common: ['Psyduck', 'Buizel', 'Shellos', 'Ducklett', 'Spritzee', 'Igglybuff', 'Snubbull', 'Pidove', 'Sentret', 'Wooper'],
      rare: ['Sobble', 'Dedenne'],
      boneka: ['Lily White', 'Rumia'],
    },
    'route-304': {
      name: 'Route 304',
      channels: ['route-304'],
      types: ['Normal', 'Grass', 'Bug'],
      wild: ['route-304'],
      trainers: ['ranger', 'rangerf', 'bugcatcher', 'camper', 'ninjaboy', 'backpacker'],
      // The Yokai Trail at night: fireflies, night sparrows and owls.
      common: ['Volbeat', 'Illumise', 'Yanma', 'Ledyba', 'Nincada', 'Sentret', 'Hoothoot', 'Pidove', 'Kricketot', 'Bunnelby'],
      rare: ['Treecko', 'Kecleon'],
      boneka: ['Wriggle Nightbug', 'Mystia Lorelei'],
    },
    'route-305': {
      name: 'Route 305',
      channels: ['route-305'],
      types: ['Water', 'Rock', 'Flying'],
      wild: ['route-305'],
      trainers: ['fisherman', 'hiker', 'birdkeeper', 'swimmer', 'backpacker'],
      // Down the lake's outflow toward the mountain: rocks, crabs, and fossils in the ravine walls.
      common: ['Rhyhorn', 'Phanpy', 'Gligar', 'Mudbray', 'Krabby', 'Klawf', 'Sandshrew', 'Wingull', 'Skiddo', 'Geodude'],
      rare: ['Aerodactyl', 'Archen', 'Relicanth'],
      boneka: ['Chen', 'Shizuha Aki', 'Son Biten'],
    },
    'route-306': {
      name: 'Route 306',
      channels: ['route-306'],
      types: ['Grass', 'Bug', 'Flying'],
      wild: ['route-306'],
      trainers: ['picnicker', 'camper', 'bugcatcher', 'birdkeeper', 'breeder', 'lass'],
      // The Human Fields: farms and orchards, then sunflowers on either side.
      common: ['Smoliv', 'Applin', 'Miltank', 'Tauros', 'Squawkabilly', 'Hoppip', 'Starly', 'Sunkern', 'Seedot', 'Combee'],
      rare: ['Chespin', 'Tropius'],
      boneka: ['Minoriko Aki', 'Lily White', 'Mai Teireida', 'Satono Nishida'],
    },
  },
};
