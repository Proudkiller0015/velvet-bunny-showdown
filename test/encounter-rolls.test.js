'use strict';
/**
 * Every place rolls, wild and trainer, at every badge count, for a new player and
 * for one with a full party.
 *
 * On 1 Oct 2026 a few lines meant for rollTrainer landed in rollWild and named a
 * variable it does not have: every wild encounter on the server threw ("Something
 * went wrong rolling that encounter") for a day, and nothing here rolled one to
 * notice. This rolls them all.
 *
 *   node test/encounter-rolls.test.js [rolls per case=1]
 */
const E = require('../src/encounters');

const ROLLS = Number(process.argv[2]) || 1;
const places = [];
for (const regionId of ['kagura', 'sinnoh']) {
	const tables = require(`../src/encounter-tables/${regionId}`);
	for (const [id, place] of Object.entries(tables.locations || {})) places.push({ id: `${regionId}/${id}`, place });
}
const PARTIES = [null, { size: 3, avg: 13, max: 13 }, { size: 6, avg: 48, max: 62 }];
const BADGES = [0, 3, 8];
const failures = new Map();
let rolls = 0;
const attempt = (what, fn) => {
	try {
		const r = fn();
		rolls++;
		if (!r || !Array.isArray(r.team)) throw new Error('no team came back');
	} catch (e) {
		const key = `${String(e.stack || e).split('\n').slice(0, 2).join(' | ')}`;
		if (!failures.has(key)) failures.set(key, what);
	}
};
for (const { id, place } of places) {
	for (const badges of BADGES) {
		for (const party of PARTIES) {
			const ace = party ? party.max : null;
			const levelCap = party ? Math.max(5, party.max) : null;
			for (let i = 0; i < ROLLS; i++) {
				if ((place.wild || []).length) {
					attempt(`wild ${id} badges ${badges}`, () => E.rollWild({ place, badges, levelCap, ace, shiny: {} }));
					for (const [channel, spot] of Object.entries(place.spots || {})) {
						attempt(`wild ${id} #${channel}`, () => E.rollWild({ place: { ...place, types: spot.types || place.types, common: spot.common || place.common, rare: spot.rare || place.rare }, badges, levelCap, ace, shiny: {} }));
					}
				}
				if ((place.trainers || []).length) {
					for (const channel of [...new Set([...(place.channels || []), ...(place.wild || [])])].slice(0, 2)) {
						attempt(`trainer ${id} #${channel} badges ${badges}`, () => E.rollTrainer({ place: E.gymPlace(place, channel), badges, levelCap, ace, party }));
					}
				}
			}
		}
	}
}
console.log(`encounter rolls: ${places.length} places, ${rolls} rolls`);
if (!places.length) { console.log('FAIL: no places found in the encounter tables'); process.exit(1); }
if (failures.size) {
	for (const [text, what] of failures) console.log(`FAIL [${what}] ${text}`);
	process.exit(1);
}
console.log('encounter rolls: PASS');
