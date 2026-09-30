'use strict';
/**
 * Every Pokemon's RP tier, as the RP ladders enforce it, for the RP bot.
 *
 *   node scripts/build-rp-tiers.js     -> src/rp-tiers.json (+ a copy into ../rp-bot/src/pokemon/)
 *
 * The RP bot's rarity (src/rarity.js, copied there) cannot load this server's
 * patched dex, so it went on reading Smogon's tiers and no tier shift ever
 * reached rarity (the owner, 30 Sep 2026). The tier is the tier sim's pool
 * reading (src/tier-sim/pool.js currentTier = config/custom-formats.js lowTierOf).
 * Run it after changing data/velvet/tiering.js, then `npm run setup`.
 */
const fs = require('fs');
const path = require('path');

const dex = require('../src/rp-dex')();
const { buildPool } = require('../src/tier-sim/pool');

const out = {};
for (const e of buildPool(dex, { includeNfe: false })) out[e.id] = e.tier;
const json = JSON.stringify(out, Object.keys(out).sort(), 0);
const here = path.join(__dirname, '..', 'src', 'rp-tiers.json');
fs.writeFileSync(here, json + '\n');
const bot = path.join(__dirname, '..', '..', 'rp-bot', 'src', 'pokemon', 'rp-tiers.json');
if (fs.existsSync(path.dirname(bot))) fs.writeFileSync(bot, json + '\n');
console.log(`${Object.keys(out).length} RP tiers -> ${path.relative(process.cwd(), here)}${fs.existsSync(bot) ? ' and the RP bot' : ''}`);
