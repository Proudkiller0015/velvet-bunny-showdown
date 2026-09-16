/*
 * The starter moves the games never gave them.
 *
 *   node scripts/build-rp-moves.js
 *
 * A starter is the Pokemon somebody plays the whole RP with, and the ones from
 * the older generations were left behind by every tutor and TM list since. Grass
 * starters in particular have no way at all to hit a Fire or Steel type that is
 * standing still - Meganium has never learned Earth Power in any game.
 *
 * So each starter line is given the coverage its own type received everywhere
 * else: nothing exotic, nothing from another type's list, and nothing that is
 * already legal. The table is per species id and is read by config/custom-formats.js.
 */
const { Dex } = require('pokemon-showdown');
const d = Dex.mod('gen9');
const fs = require('fs');

const STARTERS = 'Bulbasaur Charmander Squirtle Chikorita Cyndaquil Totodile Treecko Torchic Mudkip Turtwig Chimchar Piplup Snivy Tepig Oshawott Chespin Fennekin Froakie Rowlet Litten Popplio Grookey Scorbunny Sobble Sprigatito Fuecoco Quaxly Pikachu Eevee'.split(' ');
const BY_TYPE = {
  Grass: ['earthpower', 'weatherball', 'gigadrain', 'energyball'],
  Fire: ['earthpower', 'scorchingsands', 'heatwave', 'flamethrower'],
  Water: ['muddywater', 'flipturn', 'icebeam', 'surf'],
};

(async () => {
  const out = {};
  for (const name of STARTERS) {
    let s = d.species.get(name);
    while (s && s.exists) {
      const base = s.baseSpecies && s.baseSpecies !== s.name ? d.toID(s.baseSpecies) : s.id;
      const ls = await d.species.getLearnsetData(base);
      const have = new Set(Object.keys(ls.learnset || {}));
      // Only the first type: the second type's list belongs to that type's Pokemon.
      const want = (BY_TYPE[s.types[0]] || []).filter((m) => !have.has(m));
      if (want.length) out[base] = [...new Set([...(out[base] || []), ...want])];
      const next = (s.evos || [])[0];
      s = next ? d.species.get(next) : null;
    }
  }
  fs.writeFileSync('data/velvet/rp-moves.json', JSON.stringify(out, null, 1) + '\n');
  console.log(`${Object.keys(out).length} starter species given moves`);
  console.log('chikorita:', out.chikorita, '| meganium:', out.meganium, '| oshawott:', out.oshawott);
})();
