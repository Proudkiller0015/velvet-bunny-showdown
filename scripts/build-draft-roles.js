'use strict';
/**
 * What each Pokémon in the Season 1 draft pool can do, for the RP bot's own seat
 * (rp-bot/src/draft/auto.js): the jobs a team needs, read from the draft's frozen
 * dex (gen9draftrp), so the tags never move with a balance patch either.
 *
 *   node scripts/build-draft-roles.js [out=../rp-bot/data/draft-roles.json]
 */

const fs = require('fs');
const path = require('path');
const { Dex } = require('pokemon-showdown');

const dex = Dex.forFormat(Dex.formats.get('gen9rpdraft'));
const pool = require('../data/velvet-draft-s1/draft-s1.json').pokemon;
const out = process.argv[2] || path.join(__dirname, '..', '..', 'rp-bot', 'data', 'draft-roles.json');

const MOVES = {
	hazards: ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'stoneaxe', 'ceaselessedge'],
	removal: ['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange'],
	pivot: ['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'shedtail', 'chillyreception'],
	priority: ['suckerpunch', 'extremespeed', 'jetpunch', 'grassyglide', 'firstimpression'],
	// 40 power: only priority worth the name off a real attacker (Alolan Muk's Shadow Sneak is chip, the owner).
	weakPriority: ['shadowsneak', 'aquajet', 'machpunch', 'bulletpunch', 'iceshard', 'accelerock', 'vacuumwave'],
	recovery: ['recover', 'roost', 'slackoff', 'softboiled', 'moonlight', 'synthesis', 'morningsun', 'wish', 'strengthsap', 'shoreup', 'milkdrink', 'moonlight', 'junglehealing', 'lunarblessing'],
	setup: ['swordsdance', 'dragondance', 'nastyplot', 'calmmind', 'quiverdance', 'bulkup', 'shellsmash', 'shiftgear', 'coil', 'victorydance', 'tidyup', 'agility', 'bellydrum'],
	trickroom: ['trickroom'],
	pursuit: ['pursuit'],
	// Ours halve the target's Defense (Gen 1-4 rule): a trade with almost anything not a Ghost.
	boom: ['explosion', 'selfdestruct'],
};

/** Every move a species can learn, through its pre-evolutions and base form. */
function movesOf(species) {
	const seen = new Set();
	for (let s = species; s && s.exists; s = s.prevo ? dex.species.get(s.prevo) : null) {
		for (const id of [s.id, toID(s.baseSpecies), toID(s.changesFrom || '')]) {
			const ls = id && dex.data.Learnsets[id];
			if (ls && ls.learnset) for (const m of Object.keys(ls.learnset)) seen.add(m);
		}
	}
	return seen;
}
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const roles = {};
for (const p of pool) {
	const s = dex.species.get(p.name);
	if (!s.exists) continue;
	const moves = movesOf(s);
	const b = s.baseStats;
	const has = key => MOVES[key].some(m => moves.has(m));
	const ability = Object.values(s.abilities).map(toID);
	const attack = Math.max(b.atk, b.spa);
	const tags = [];
	if (has('hazards')) tags.push('hazards');
	if (has('removal')) tags.push('removal');
	if (has('pivot') || ability.includes('regenerator')) tags.push('pivot');
	// Huge Power and Pure Power double the stat: about the same as base Attack 2x + 60 (Azumarill's 50 reads as 160).
	const atk = ability.includes('hugepower') || ability.includes('purepower') ? b.atk * 2 + 60 : b.atk;
	if ((has('priority') && atk >= 90) || (has('weakPriority') && atk >= 120)) tags.push('priority');
	if (has('recovery')) tags.push('recovery');
	if (has('pursuit')) tags.push('pursuit');
	if (has('boom') && atk >= 90) tags.push('boom');
	if (has('trickroom') && b.spe <= 70) tags.push('trsetter');
	if (b.spe <= 60 && attack >= 105) tags.push('trabuser');
	if (b.spe >= 100 && attack >= 105) tags.push('fast');
	if ((has('setup') || ability.includes('speedboost') || ability.includes('supremeoverlord')) && attack >= 100) tags.push('wincon');
	if (has('recovery') && (b.hp + b.def + b.spd) >= 270) tags.push('wall');
	if (s.isMega) tags.push('mega');
	roles[p.id] = { tags, spe: b.spe, atk: b.atk, spa: b.spa, bulk: b.hp + b.def + b.spd };
}
fs.writeFileSync(out, JSON.stringify(roles));
console.log(`${Object.keys(roles).length} Pokémon tagged -> ${out}`);
