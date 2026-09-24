'use strict';
/**
 * The shared team building: role sets, the assembler, and the RP trainers.
 *
 *   node test/team-builders.test.js
 */

// The RP dex: these are RP's sets (Keystone Legion, Soul Toll...), which the official formats do not have.
const Dex = require('../src/rp-dex')();
const RS = require('../src/role-sets');
const A = require('../src/team-assembler');
const TL = require('../src/team-logic');
const E = require('../src/encounters');

let passed = 0, failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); ok ? passed++ : failed++; };
const seeded = seed => () => ((seed = seed * 16807 % 2147483647) / 2147483647);
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const has = (set, move) => set.moves.some(m => toID(m) === toID(move));

// Role sets: what the Pokemon is for, and this server's own kit.
const blissey = RS.buildSet(Dex, 'Blissey', { rng: seeded(1) });
check(has(blissey, 'Soft-Boiled') && ['Bold', 'Calm', 'Careful', 'Impish'].includes(blissey.nature), `Blissey is a Soft-Boiled wall (${blissey.nature}: ${blissey.moves})`);
const tomb = RS.buildSet(Dex, 'Spiritomb', { rng: seeded(2) });
check(tomb.ability === 'Keystone Legion' && has(tomb, 'Soul Toll'), `Spiritomb uses Keystone Legion and Soul Toll (${tomb.ability}: ${tomb.moves})`);
const kiss = RS.buildSet(Dex, 'Togekiss', { rng: seeded(3) });
check(kiss.ability === 'Serene Grace', `Togekiss has Serene Grace (${kiss.ability})`);
const ape = RS.buildSet(Dex, 'Infernape', { rng: seeded(4) });
check(ape.ability === 'Crown of Flame' && ape.moves.some(m => Dex.moves.get(m).num < 0), `Infernape uses its crown and its own moves (${ape.moves})`);
check(RS.buildSet(Dex, 'Alakazam', { role: 'Setup Sweeper', rng: seeded(5) }).moves.every(m => !['swordsdance', 'bulkup', 'dragondance'].includes(toID(m))), 'no physical setup on a special sweeper');

let broken = 0, species = 0;
for (const s of Dex.species.all()) {
	if (s.isNonstandard && s.isNonstandard !== 'Past') continue;
	species++;
	try {
		const set = RS.buildSet(Dex, s.name, { rng: seeded(species) });
		const learn = RS.learnable(Dex, s);
		if (!set || !set.moves.length || new Set(set.moves).size !== set.moves.length || set.moves.some(m => !learn.has(toID(m)))) broken++;
	} catch (e) { broken++; }
}
check(broken === 0, `every one of ${species} Pokemon gets a set of distinct moves it learns (${broken} broken)`);

// The assembler: a team, not the six biggest numbers.
const box = ['Spiritomb', 'Glaceon', 'Garchomp', 'Roserade', 'Togekiss', 'Lucario', 'Infernape', 'Torterra', 'Empoleon', 'Blissey', 'Dragonite', 'Kingambit']
	.map(name => ({ species: name, strength: 1 }));
const team = A.assemble(Dex, box, { rng: seeded(9) });
const report = TL.analyze(Dex, team);
check(team.length === 6, 'six picked from twelve');
check(report.stealthRock.length === 1, `exactly one Stealth Rock (${report.stealthRock})`);
check(!TL.issues(report, { stage: 'full' }).some(i => i.severity === 'hard'), `no hard checklist failure (${TL.issues(report).map(i => i.text).join('; ')})`);
const bagged = A.assemble(Dex, box, { rng: seeded(9), items: { bag: { leftovers: 1, pokeball: 3 } } });
check(bagged.filter(s => s.item).length === 1 && bagged.find(s => s.item).item === 'Leftovers', 'with a bag, only what is in it');

// RP trainers: legal moves by badges, a team by the checklist at six.
let legal = true, fullMoves = true, hard = 0, trainers = 0;
for (let b = 0; b <= 8; b++) {
	for (let i = 0; i < 6; i++) {
		const tr = E.rollTrainer({ place: null, badges: b, rng: seeded(100 + b * 10 + i) });
		trainers++;
		for (const mon of tr.team) {
			const learn = RS.learnable(Dex, Dex.species.get(mon.species));
			if (mon.moves.some(m => !learn.has(toID(m)))) legal = false;
			if (b >= 1 && mon.level >= 10 && mon.moves.length < 3) fullMoves = false;
			if (b < 6 && mon.item && !['Oran Berry'].includes(mon.item)) legal = false;
		}
		if (b >= 7) hard += TL.issues(TL.analyze(Dex, tr.team), { stage: 'full', themed: true }).filter(x => x.severity === 'hard').length;
	}
}
check(legal, 'trainer Pokemon only know moves they learn, and hold items only as badges allow');
check(fullMoves, 'trainer Pokemon past level 10 know at least three moves');
// Some trainers' Pokemon cannot learn Stealth Rock at all, so this is a rate, not a guarantee.
check(hard <= 12, `high-badge trainers seldom miss a hard checklist rule (${hard} across 12 teams)`);

// Move choice (docs/teambuilding-checklist.md; the owner's principles for role-sets.js).
{
	const mv = n => Dex.moves.get(n);
	// Coverage is worth what it does to the common walls of the STAB, not to all eighteen types.
	const steel = [{ name: 'Corviknight', weight: 30 }, { name: 'Skarmory', weight: 20 }, { name: 'Great Tusk', weight: 10 }];
	const fairy = [{ name: 'Clefable', weight: 30 }, { name: 'Iron Valiant', weight: 20 }, { name: 'Great Tusk', weight: 10 }];
	const stab = [mv('Earthquake'), mv('Scale Shot')];
	check(RS.threatGain(Dex, stab, mv('Fire Fang'), steel) > RS.threatGain(Dex, stab, mv('Stone Edge'), steel) &&
		RS.threatGain(Dex, stab, mv('Fire Fang'), steel) > RS.threatGain(Dex, stab, mv('Fire Fang'), fairy),
	'Fire on a Garchomp is worth what it does to the Steel walls, and only if they are common');
	check(RS.threatGain(Dex, stab, mv('Earthquake'), [{ name: 'Rotom-Wash', ability: 'Levitate' }]) === 0, 'a Levitate threat gains nothing from Ground');
	const fire = threats => [1, 2, 3, 4, 5, 6].filter(i => RS.buildSet(Dex, 'Garchomp', { role: 'Setup Sweeper', rng: seeded(i * 31), items: false, threats })
		.moves.some(m => mv(m).type === 'Fire')).length;
	check(fire(steel) > fire(fairy), `Swords Dance Garchomp carries Fire when Corviknight is common (${fire(steel)}/6), less when it is not (${fire(fairy)}/6)`);
	// No threat list (Build my team, gym trainers): the eighteen-types count, exactly as before.
	const plain = RS.buildSet(Dex, 'Garchomp', { role: 'Setup Sweeper', rng: seeded(7), items: false });
	const empty = RS.buildSet(Dex, 'Garchomp', { role: 'Setup Sweeper', rng: seeded(7), items: false, threats: [] });
	check(plain.moves.join() === empty.moves.join(), 'an empty threat list falls back to the type count');

	// A setup sweeper takes a strong priority attack it learns.
	for (const [name, move] of [['Dragonite', 'Extreme Speed'], ['Scizor', 'Bullet Punch'], ['Lucario', 'Vacuum Wave']]) {
		const set = RS.buildSet(Dex, name, { role: 'Setup Sweeper', rng: seeded(3), items: false });
		check(has(set, move), `${name}'s setup set has ${move} (${set.moves})`);
	}
	check(RS.priorityValue(Dex.species.get('Garchomp'), mv('Ice Shard'), 'Physical') < RS.STRONG_PRIORITY, 'a non-STAB Ice Shard is not worth a sweeper\'s slot');

	// Close Combat: fine on a fast attacker, marked down on a wall.
	check(RS.selfDrop(mv('Close Combat')) && RS.selfDrop(mv('Draco Meteor')) && !RS.selfDrop(mv('Hammer Arm')), 'self-dropping attacks are recognised (a Speed drop alone is not one)');
	const bulkyScizor = [1, 2, 3, 4, 5].filter(i => has(RS.buildSet(Dex, 'Scizor', { role: 'Bulky Support', rng: seeded(i * 17), items: false }), 'Close Combat')).length;
	check(bulkyScizor === 0, `a Bulky Support Scizor does not run Close Combat (${bulkyScizor}/5)`);
	check(has(RS.buildSet(Dex, 'Lucario', { role: 'Fast Attacker', rng: seeded(3), items: false }), 'Close Combat'), 'a fast Lucario still does');
	const zama = RS.buildSet(Dex, 'Zamazenta', { role: 'Bulky Setup', rng: seeded(3), items: false });
	check(!has(zama, 'Body Press') || has(zama, 'Iron Defense'), `a Body Press set has Iron Defense to press with (${zama.moves})`);
}

// The checklist rules added for the builders (src/team-logic.js).
{
	const set = (species, moves, extra = {}) => ({ species, ability: '', item: '', moves, ...extra });
	// Rule 11: two burners are one mechanism, and not one that stops Calm Mind.
	const burners = [set('Moltres', ['Will-O-Wisp', 'Flamethrower', 'Roost', 'Hurricane']), set('Sableye', ['Will-O-Wisp', 'Knock Off', 'Recover', 'Foul Play'])];
	let r = TL.analyze(Dex, burners);
	check(r.setupMechanisms.join() === 'burn' && !r.specialSetupAnswer, 'two Will-O-Wisp users are one setup answer, and none to special setup');
	r = TL.analyze(Dex, [...burners, set('Toxapex', ['Haze', 'Recover', 'Surf', 'Toxic'])]);
	check(r.setupMechanisms.length === 2 && r.specialSetupAnswer, 'Haze adds a second, special-proof one');
	// Rule 5: a threat hit neutrally by fewer than two members.
	const team = [set('Garchomp', ['Earthquake', 'Outrage']), set('Rhyperior', ['Earthquake', 'Megahorn']), set('Dragapult', ['Dragon Darts', 'U-turn'])];
	r = TL.analyze(Dex, team, { threats: [{ name: 'Corviknight' }, { name: 'Great Tusk' }] });
	check(r.threatsUnhit.join() === 'Corviknight', `Corviknight walls Ground and Dragon (${r.threatsUnhit})`);
	check(TL.issues(r).some(i => i.severity === 'hard' && /Corviknight/.test(i.text)), 'and that is a hard checklist failure');
	// Rule 7: real Speed, counted by style.
	check(TL.speedStat(Dex, set('Garchomp', [], { evs: { spe: 252 }, nature: 'Jolly' })) === 333 && TL.speedStat(Dex, set('Dragapult', [], { evs: { spe: 252 }, nature: 'Timid' })) === 421, 'Speed is computed from EVs and nature');
}

// Pinkacross's rules (docs/research-pinkacross.md, B1 B2 B4 B6-B8 B10), 24 Sep 2026.
{
	const set = (species, moves, extra = {}) => ({ species, ability: '', item: '', moves, ...extra });
	const texts = (sets, options = {}) => TL.issues(TL.analyze(Dex, sets, options), { stage: 'full' });
	const find = (found, re) => found.find(i => re.test(i.text));

	// Immediate power: setup sweepers do not count, a Band/Specs or Life Orb attacker does.
	const sd = set('Garchomp', ['Swords Dance', 'Earthquake', 'Scale Shot', 'Stone Edge'], { item: 'Life Orb' });
	const band = set('Garchomp', ['Earthquake', 'Outrage', 'Stone Edge', 'Fire Fang'], { item: 'Choice Band' });
	check(!TL.isBreaker(Dex, sd) && TL.isBreaker(Dex, band), 'a Swords Dance set is no breaker; a Choice Band one is');
	check(TL.isBreaker(Dex, set('Kyurem', ['Freeze-Dry', 'Earth Power', 'Draco Meteor'])) && !TL.isBreaker(Dex, set('Kyurem', ['Freeze-Dry', 'Earth Power', 'Draco Meteor'], { item: 'Leftovers' })),
		'with no item yet an all-out attacker counts; holding Leftovers it does not');
	const walls = [set('Blissey', ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Stealth Rock'], { item: 'Leftovers' }), set('Corviknight', ['Brave Bird', 'U-turn', 'Roost', 'Defog'], { item: 'Leftovers' })];
	const setupOnly = [...walls, sd, set('Dragonite', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Fire Punch'], { item: 'Heavy-Duty Boots' })];
	let found = texts(setupOnly);
	check(TL.analyze(Dex, setupOnly).style === 'balance' && (find(found, /immediate power/) || {}).severity === 'hard', 'a balance team of walls and setup sweepers lacks immediate power (hard)');
	check(!find(texts([...walls, band, setupOnly[3]]), /immediate power/), 'a Choice Band Garchomp is the immediate power it needs');

	// The 18 things: Toxic Spikes absorber, Steel, Knock Off, contact punisher, immunities, a fast member.
	const grounded = [set('Garchomp', ['Earthquake']), set('Kingambit', ['Kowtow Cleave']), set('Great Tusk', ['Headlong Rush']), set('Iron Valiant', ['Moonblast'])];
	check(TL.analyze(Dex, grounded).toxicSpikesVictims.join() === 'Garchomp,Great Tusk,Iron Valiant', 'Toxic Spikes would poison the grounded, non-Poison, non-Steel members');
	check(find(texts(grounded), /Toxic Spikes absorber/) && !find(texts([...grounded, set('Toxapex', ['Surf'])]), /Toxic Spikes absorber/), 'three poisoned and no absorber is flagged; a grounded Toxapex absorbs');
	check(find(texts([...grounded, set('Toxapex', ['Surf'], { item: 'Heavy-Duty Boots' })]), /Toxic Spikes absorber/), 'a Toxapex in Boots absorbs nothing');
	const noSteel = [walls[0], set('Pelipper', ['Hurricane', 'U-turn', 'Roost', 'Surf'], { item: 'Leftovers' }), set('Dragonite', ['Outrage', 'Extreme Speed', 'Earthquake', 'Fire Punch'], { item: 'Choice Band' })];
	found = texts(noSteel);
	check(find(found, /no Steel type/) && find(found, /no Knock Off/) && find(found, /contact punisher/) && find(found, /no Electric immunity/),
		'a team with no Steel, Knock Off, contact punisher or Electric immunity hears about each');
	check(!find(found, /no Ground immunity/), 'Pelipper is its Ground immunity');
	check(found.filter(i => /Steel type|Knock Off|contact punisher|immunity|Toxic Spikes/.test(i.text)).every(i => i.severity === 'soft'), 'and all of them are soft, as he frames them');
	const slow = [set('Hippowdon', ['Earthquake', 'Slack Off']), set('Blissey', ['Seismic Toss', 'Soft-Boiled']), set('Dondozo', ['Wave Crash', 'Rest'])];
	check(TL.analyze(Dex, slow, { threats: [{ name: 'Great Tusk' }] }).outsped === 'Great Tusk', 'nothing walls or outspeeds Great Tusk');
	check(!TL.analyze(Dex, [...slow, set('Dragapult', ['Shadow Ball'])], { threats: [{ name: 'Great Tusk' }] }).outsped, 'a Dragapult outspeeds it');

	// Passivity and pacing: a Rest wall on hyper offense, a Focus Sash on balance.
	const rest = set('Dondozo', ['Wave Crash', 'Rest', 'Sleep Talk', 'Earthquake'], { item: 'Leftovers' });
	check(TL.isPassive(Dex, rest) && TL.isPassive(Dex, walls[0]) && !TL.isPassive(Dex, band) && !TL.isPassive(Dex, walls[1]), 'Rest Dondozo and Blissey are passive; Band Garchomp and a U-turn Corviknight are not');
	check(TL.paceOf(Dex, set('Iron Valiant', ['Moonblast'], { item: 'Focus Sash' })) === 'fast' && TL.paceOf(Dex, walls[0]) === 'slow', 'a Sash is fast-paced, a Soft-Boiled wall slow');
	found = texts([rest, sd, band, set('Dragapult', ['Dragon Darts', 'Shadow Ball', 'U-turn'], { item: 'Choice Specs' })]);
	check(find(found, /passive with no other wall/), 'a passive wall alone on an offensive team is flagged');
	found = texts([...walls, set('Toxapex', ['Surf', 'Recover', 'Haze', 'Toxic']), set('Iron Valiant', ['Moonblast', 'Close Combat', 'Knock Off'], { item: 'Focus Sash' })]);
	check(find(found, /one-use sets on a (balance|stall) team \(Iron Valiant\)/), 'a Focus Sash on a balance team is flagged');
	const scored = TL.score(Dex, noSteel);
	check(scored.issues.some(i => i.weight < 3) && scored.score === -scored.issues.reduce((n, i) => n + (i.weight !== undefined ? i.weight : i.severity === 'hard' ? 10 : 3), 0), 'the lesser soft rules cost less than 3 each');

	// Item hygiene: no trap items as a fallback, no one-use items on a long game when anything else fits.
	const sp = Dex.species.get('Garchomp');
	check(RS.itemFor(Dex, sp, { role: 'Bulky Attacker' }, ['Earthquake', 'Outrage', 'Roar', 'Protect'], 'Physical', new Set(['shellbell', 'scopelens', 'widelens'])) === '', 'Shell Bell, Scope Lens and Wide Lens are never the fallback');
	const fast = { role: 'Fast Support' };
	check(RS.itemFor(Dex, sp, fast, ['Stealth Rock', 'Earthquake', 'Outrage', 'Roar'], 'Physical') === 'Focus Sash' &&
		RS.itemFor(Dex, sp, fast, ['Stealth Rock', 'Earthquake', 'Outrage', 'Roar'], 'Physical', null, { oneUse: false }) === 'Leftovers', 'a Fast Support lead gets a Sash, but not on a balance team');
	check(RS.itemFor(Dex, sp, { role: 'Bulky Support' }, ['Stealth Rock', 'Earthquake', 'Outrage', 'Roar'], 'Physical', new Set(['sitrusberry']), { oneUse: false }) === 'Sitrus Berry', 'a one-use item is still better than nothing');

	// The assembler: a breaker for the team, and one aimed at what a wall seed draws in.
	const assembled = A.assemble(Dex, box, { rng: seeded(9) });
	const ar = TL.analyze(Dex, assembled);
	check(ar.style === 'stall' || ar.breakers.length > 0, `the assembled team has immediate power (${ar.style}: ${ar.breakers})`);
	const pex = set('Toxapex', ['Surf', 'Toxic', 'Recover', 'Haze']);
	const drawn = A.drawnIn(Dex, pex, null);
	check(drawn.map(t => t.types[0]).sort().join() === 'Dragon,Grass,Water', `a Surf Toxapex draws in what resists Water (${drawn.map(t => t.types[0])})`);
	check(A.cover(Dex, set('Kyurem', ['Freeze-Dry', 'Earth Power', 'Draco Meteor']), drawn) > A.cover(Dex, set('Garchomp', ['Earthquake', 'Outrage']), drawn), 'Kyurem breaks what Toxapex draws in better than Garchomp does');
	const wallBox = ['Blissey', 'Toxapex', 'Corviknight', 'Clodsire', 'Dondozo', 'Garganacl', 'Heatran', 'Kingambit', 'Gholdengo', 'Great Tusk', 'Iron Valiant', 'Dragapult'].map(name => ({ species: name, strength: 1 }));
	let withBreaker = 0;
	for (let i = 1; i <= 4; i++) {
		const t = A.assemble(Dex, wallBox, { rng: seeded(i * 13), fixed: [wallBox[0]] });
		if (t.some(s => s.species !== 'Blissey' && TL.isBreaker(Dex, s))) withBreaker++;
	}
	check(withBreaker >= 3, `a team seeded with a Blissey gets a breaker (${withBreaker}/4)`);
}

// The ladder builder's repairs: an event Pokemon's fixed IVs, and no regional forme borrowing its base's sets.
{
	const { TeamBuilder } = require('../src/teambuilder');
	const tb = new TeamBuilder();
	const ctx = tb.context('gen9ou');
	const bolt = { species: 'Raging Bolt', name: 'Raging Bolt', moves: ['Thunderbolt', 'Draco Meteor', 'Thunderclap', 'Calm Mind'], ability: 'Protosynthesis', nature: 'Modest', evs: { hp: 252, spa: 252, spe: 4 }, ivs: { atk: 20 }, level: 100 };
	const problems = ctx.validator.validateSet(bolt, {});
	check(problems && tb.repair(ctx, bolt, problems, seeded(1)) && !ctx.validator.validateSet(bolt, {}), `Raging Bolt gets its event IVs rather than a learnset set (${JSON.stringify(bolt.ivs)})`);
	check(!tb.sameAsBase(ctx, ctx.dex.species.get('Zapdos-Galar')) && tb.sameAsBase(ctx, ctx.dex.species.get('Rillaboom-Gmax')), 'Zapdos-Galar does not borrow Zapdos\'s sets; a Gmax forme does');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
