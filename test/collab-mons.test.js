'use strict';
/**
 * The collab Pokemon after Funerfly (data/velvet/collab-*.js; Funerfly and the tier
 * itself are in test/collab.test.js):
 *
 *  - Punibird: Punishment's 3 angry turns, restarted by another hit, ended by a switch;
 *    Peck of Sin's +1 priority and its 20 or 120 power.
 *  - Laetitia: Wee Witch's Gift bursting for a third three turns on, once per target,
 *    following its carrier through switches; Dear Friends' 1.3x into a carrier.
 *  - Freischutz: Magic Bullet through accuracy, Protect, substitutes and redirection;
 *    The Devil's Seventh sending every seventh at a random Pokemon, the count kept
 *    across switches.
 *  - Hatrequeen: Arcana Slave's charge and its Photon Geyser category; Love and Justice
 *    turning her for good after two quiet turns, a hit or a switch starting them over.
 *  - King Boo: Bashful King's 2/3 from faster attackers and 1.3x on slower targets;
 *    Painting Prison's 4-5 turn trap, let go when he switches, never on Ghosts.
 *  - The bot's reading of them, and full random battles.
 *
 * Reads the data installed in node_modules by scripts/setup-config.js.
 */
const assert = require('assert');
const { Battle, Dex, Teams } = require('pokemon-showdown');
const rpDex = Dex.forFormat('gen9rpcollab');

const mon = (species, moves, extra = {}) => ({ name: species, species, ability: '', item: '', moves, nature: 'Serious', evs: { hp: 252 }, level: 100, ...extra });
const punibird = (extra = {}) => mon('Punibird', ['Peck of Sin', 'Splash', 'Protect'], { ability: 'Punishment', evs: { hp: 252, atk: 252 }, nature: 'Adamant', ...extra });
const laetitia = (extra = {}) => mon('Laetitia', ["Wee Witch's Gift", 'Play Rough', 'Splash'], { ability: 'Dear Friends', ...extra });
const freischutz = (extra = {}) => mon('Freischutz', ['Magic Bullet', 'Splash'], { ability: "The Devil's Seventh", ...extra });
const hatrequeen = (extra = {}) => mon('Hatrequeen', ['Arcana Slave', 'Splash', 'Calm Mind'], { ability: 'Love and Justice', ...extra });
// A punching bag that lives through everything here.
const wall = (moves = ['Splash'], extra = {}) => mon('Blissey', moves, { evs: { hp: 252, def: 252 }, nature: 'Bold', item: 'Eviolite', ...extra });
const battle = (mine, theirs, formatid = 'gen9rpcollab', seed = [1, 2, 3, 4]) => {
	const b = new Battle({ formatid, seed });
	b.setPlayer('p1', { team: Teams.pack(mine) });
	b.setPlayer('p2', { team: Teams.pack(theirs) });
	const lead = formatid.includes('doubles') ? 'team 12' : 'team 1';
	b.choose('p1', lead);
	b.choose('p2', lead);
	return b;
};
const turn = (b, p1, p2) => { b.choose('p1', p1); b.choose('p2', p2); };
const logSince = (b, from) => b.log.slice(from).join('\n');
let n = 0;
const ok = (cond, what) => { assert.ok(cond, what); n++; };

// ---- Punibird: Punishment and Peck of Sin.
{
	const b = battle([punibird(), mon('Chansey', ['Splash'])], [wall(['Tackle', 'Splash', 'Dual Wingbeat', 'Growl'])]);
	const me = () => b.p1.pokemon.find(p => p.baseSpecies.baseSpecies === 'Punibird');
	ok(me().species.id === 'punibird' && me().species.bst === 400, 'starts calm, 400 base stats');
	const calmAtk = me().storedStats.atk;
	let from = b.log.length;
	turn(b, 'move 2', 'move 1');
	ok(me().species.id === 'punibirdangry', 'a hit angers it');
	ok(/\|-formechange\|p1a: Punibird\|Punibird-Angry\|\|\[from\] ability: Punishment/.test(logSince(b, from)), 'and says so');
	const bs = me().species.baseStats;
	ok(bs.hp === 75 && bs.atk === 150 && bs.def === 80 && bs.spa === 40 && bs.spd === 80 && bs.spe === 110, 'with the angry stats');
	ok(me().storedStats.atk > calmAtk + 150, `stats recalculated (Atk ${calmAtk} -> ${me().storedStats.atk})`);
	turn(b, 'move 2', 'move 2');
	ok(me().species.id === 'punibirdangry', 'still angry the turn after');
	from = b.log.length;
	turn(b, 'move 2', 'move 2');
	ok(me().species.id === 'punibird', 'calm again after the third turn');
	ok(logSince(b, from).includes('Punibird calmed down.'), 'and says so');
	// A status move is no offence.
	turn(b, 'move 2', 'move 4');
	ok(me().species.id === 'punibird', 'a status move does not anger it');
	// The hits of one multi-hit move are one offence: one anger, no restart.
	from = b.log.length;
	turn(b, 'move 2', 'move 3');
	ok(me().species.id === 'punibirdangry' && me().volatiles['punishment'].duration === 2 && !/\|-activate\|p1a: Punibird\|ability: Punishment/.test(logSince(b, from)),
		'Dual Wingbeat angers it once');
	// Struck again while angry: the 3 turns start over.
	from = b.log.length;
	turn(b, 'move 2', 'move 1');
	ok(/\|-activate\|p1a: Punibird\|ability: Punishment/.test(logSince(b, from)), 'hit while angry: the anger flares up again');
	turn(b, 'move 2', 'move 2');
	ok(me().species.id === 'punibirdangry', 'past the end of the first anger: the turns run from the second hit');
	turn(b, 'move 2', 'move 2');
	ok(me().species.id === 'punibird', 'then calm');
	// A switch ends the anger.
	turn(b, 'move 2', 'move 1');
	ok(me().species.id === 'punibirdangry', 'angry again');
	turn(b, 'switch 2', 'move 2');
	turn(b, 'switch 2', 'move 2');
	ok(me().species.id === 'punibird' && !me().volatiles['punishment'], 'back from a switch: calm');
}
{
	const move = rpDex.moves.get('peckofsin');
	ok(move.type === 'Flying' && move.category === 'Physical' && move.basePower === 20 && move.priority === 1 && move.accuracy === 100, 'Peck of Sin: Flying, physical, 20, +1, 100%');
	const b = battle([punibird()], [wall(['Tackle', 'Splash'])]);
	const user = b.p1.active[0];
	const power = () => {
		const m = b.dex.getActiveMove('peckofsin');
		return m.basePowerCallback.call(b, user, b.p2.active[0], m);
	};
	ok(power() === 20, `20 from calm Punibird (${power()})`);
	turn(b, 'move 2', 'move 1');
	ok(power() === 120, `120 from Punibird-Angry (${power()})`);
	// It goes first against a faster foe.
	const fast = battle([punibird()], [mon('Regieleki', ['Splash'], { evs: { spe: 252 }, nature: 'Timid' })]);
	const from = fast.log.length;
	turn(fast, 'move 1', 'move 1');
	const log = logSince(fast, from);
	ok(log.indexOf('|move|p1a: Punibird|Peck of Sin') < log.indexOf('|move|p2a: Regieleki|Splash'), 'Peck of Sin moves before a faster Regieleki');
}

// ---- Laetitia: Wee Witch's Gift and Dear Friends.
{
	const b = battle([laetitia()], [wall()]);
	const foe = () => b.p2.pokemon.find(p => p.species.name === 'Blissey');
	let from = b.log.length;
	turn(b, 'move 1', 'move 1');
	ok(foe().m.weeWitchGift && /\|-start\|p2a: Blissey\|move: Wee Witch's Gift/.test(logSince(b, from)), 'the target is given a gift');
	from = b.log.length;
	turn(b, 'move 1', 'move 1');
	ok(/\|-fail\|/.test(logSince(b, from)), 'a second gift fails');
	turn(b, 'move 3', 'move 1');
	ok(foe().m.weeWitchGift && foe().hp === foe().maxhp, 'still wrapped at the end of the second turn after');
	from = b.log.length;
	turn(b, 'move 3', 'move 1');
	const dealt = foe().maxhp - foe().hp;
	ok(dealt === Math.floor(foe().baseMaxhp / 3), `bursts at the end of the third turn after, for a third (${dealt} of ${foe().maxhp})`);
	ok(/\|-end\|p2a: Blissey\|move: Wee Witch's Gift/.test(logSince(b, from)) && /\|-damage\|p2a: Blissey\|.*\[from\] Wee Witch's Gift/.test(logSince(b, from)), 'and the log says what burst');
	ok(!foe().m.weeWitchGift && !b.p2.sideConditions['weewitchsgift'], 'gone, and the clock with it');
	turn(b, 'move 1', 'move 1');
	ok(foe().m.weeWitchGift, 'and she can give another');
}
{
	// It follows the target: switched out when its time came, it bursts the first turn back.
	const b = battle([laetitia()], [wall(), mon('Chansey', ['Splash'], { evs: { hp: 252, def: 252 }, item: 'Eviolite' })]);
	const blissey = () => b.p2.pokemon.find(p => p.species.name === 'Blissey');
	turn(b, 'move 1', 'move 1');
	turn(b, 'move 3', 'switch 2');
	ok(blissey().m.weeWitchGift && !blissey().isActive, 'switched out, it keeps the gift');
	for (let i = 0; i < 4; i++) turn(b, 'move 3', 'move 1');
	ok(blissey().m.weeWitchGift && blissey().hp === blissey().maxhp, 'nothing bursts while it is out of play');
	let from = b.log.length;
	turn(b, 'move 3', 'switch 2');
	ok(/\|-start\|p2a: Blissey\|move: Wee Witch's Gift\|\[silent\]/.test(logSince(b, from)), 'back in, it is seen carrying it');
	ok(blissey().hp === blissey().maxhp - Math.floor(blissey().baseMaxhp / 3), 'and it bursts at the end of that turn');
	// Two carriers: the clock stays until the last gift is gone.
	const c = battle([laetitia()], [wall(), mon('Chansey', ['Splash'], { evs: { hp: 252, def: 252 }, item: 'Eviolite' })]);
	turn(c, 'move 1', 'move 1');
	turn(c, 'move 3', 'switch 2');
	turn(c, 'move 1', 'move 1');
	turn(c, 'move 3', 'move 1');
	from = c.log.length;
	turn(c, 'move 3', 'switch 2');
	turn(c, 'move 3', 'move 1');
	ok(/\|-end\|p2a: Blissey/.test(logSince(c, from)) && c.p2.sideConditions['weewitchsgift'], 'one burst, the other gift still ticking');
	turn(c, 'move 3', 'switch 2');
	ok(!c.p2.pokemon.some(p => p.m.weeWitchGift) && !c.p2.sideConditions['weewitchsgift'], 'both burst, the clock is gone');
}
{
	// Magic Guard keeps the burst off; a carrier that faints takes its gift with it.
	const b = battle([laetitia()], [mon('Clefable', ['Splash'], { ability: 'Magic Guard' })]);
	turn(b, 'move 1', 'move 1');
	for (let i = 0; i < 3; i++) turn(b, 'move 3', 'move 1');
	ok(b.p2.active[0].hp === b.p2.active[0].maxhp && !b.p2.active[0].m.weeWitchGift, 'Magic Guard takes no damage from it');
	const c = battle([laetitia({ moves: ["Wee Witch's Gift", 'Splash'] })], [mon('Magikarp', ['Splash'], { level: 1 }), wall()]);
	turn(c, 'move 1', 'move 1');
	const karp = c.p2.active[0];
	karp.faint();
	c.faintMessages();
	ok(!karp.m.weeWitchGift, 'a fainted carrier keeps no gift');
}
{
	// Dear Friends: 1.3x into a target carrying a gift from her side, and only that.
	const b = battle([laetitia()], [wall()]);
	const user = b.p1.active[0];
	const foe = b.p2.active[0];
	const modified = () => b.runEvent('ModifyDamage', user, foe, b.dex.getActiveMove('playrough'), 1000);
	ok(modified() === 1000, `no gift, no boost (${modified()})`);
	turn(b, 'move 1', 'move 1');
	ok(modified() === 1300, `a gift from her: 1.3x (${modified()})`);
	foe.m.weeWitchGift.side = 'p2';
	ok(modified() === 1000, 'a gift from the other side: no boost');
	// And in a real hit.
	const dmg = gift => {
		let total = 0;
		for (let seed = 1; seed <= 4; seed++) {
			const t = battle([laetitia()], [wall()], 'gen9rpcollab', [seed, seed, seed, seed]);
			if (gift) t.p2.active[0].m.weeWitchGift = { turn: 99, side: 'p1' };
			const f = t.p2.active[0];
			turn(t, 'move 2', 'move 1');
			total += f.maxhp - f.hp;
		}
		return total;
	};
	const withGift = dmg(true);
	const without = dmg(false);
	ok(withGift > without * 1.2, `Play Rough hits a carrier harder (${withGift} vs ${without})`);
}

// ---- Freischutz: Magic Bullet and The Devil's Seventh.
{
	const move = rpDex.moves.get('magicbullet');
	ok(move.type === 'Dark' && move.category === 'Physical' && move.basePower === 80 && move.accuracy === true, 'Magic Bullet: Dark, physical, 80, never misses');
	// Through Protect.
	let b = battle([freischutz()], [wall(['Protect'])]);
	turn(b, 'move 1', 'move 1');
	ok(b.p2.active[0].hp < b.p2.active[0].maxhp, 'through Protect');
	// Through a substitute: the Pokemon behind it is hit, the doll is not.
	b = battle([freischutz()], [wall(['Substitute', 'Splash'])]);
	turn(b, 'move 2', 'move 1');
	const subHp = b.p2.active[0].volatiles['substitute'].hp;
	const before = b.p2.active[0].hp;
	turn(b, 'move 1', 'move 2');
	ok(b.p2.active[0].hp < before && b.p2.active[0].volatiles['substitute'].hp === subHp, 'through a substitute');
	// Through evasion: +6 and it still lands every time.
	b = battle([freischutz()], [wall()]);
	b.p2.active[0].boosts.evasion = 6;
	let hits = 0;
	for (let i = 0; i < 6; i++) {
		b.p2.active[0].hp = b.p2.active[0].maxhp;
		turn(b, 'move 1', 'move 1');
		if (b.p2.active[0].hp < b.p2.active[0].maxhp) hits++;
	}
	ok(hits === 6, `never misses (${hits} of 6 into +6 evasion)`);
	// Not redirected: Follow Me draws nothing.
	b = battle([freischutz(), mon('Chansey', ['Splash'])], [mon('Clefairy', ['Follow Me'], { item: 'Eviolite' }), wall()], 'gen9rpbattledoubles');
	const blissey = b.p2.active[1];
	turn(b, 'move 1 2, move 1', 'move 1, move 1');
	ok(blissey.hp < blissey.maxhp && b.p2.active[0].hp === b.p2.active[0].maxhp, 'Follow Me does not draw it');
}
{
	// The count: six, then the seventh goes astray, wherever it goes.
	const b = battle([freischutz(), mon('Chansey', ['Splash'])], [wall()]);
	const me = () => b.p1.pokemon.find(p => p.species.name === 'Freischutz');
	// Kept standing through eight bullets.
	const heal = () => { b.p2.active[0].hp = b.p2.active[0].maxhp; for (const p of b.p1.pokemon) p.hp = p.maxhp; };
	const fire = () => { heal(); turn(b, 'move 1', 'move 1'); };
	let from = b.log.length;
	for (let i = 0; i < 3; i++) fire();
	// Switches keep the count.
	turn(b, 'switch 2', 'move 1');
	turn(b, 'switch 2', 'move 1');
	for (let i = 0; i < 3; i++) fire();
	ok(me().m.magicBullets === 6 && !/The Devil's Seventh/.test(logSince(b, from)), 'six fired, across a switch, none astray');
	from = b.log.length;
	fire();
	ok(me().m.magicBullets === 7 && /\|-activate\|p1a: Freischutz\|ability: The Devil's Seventh/.test(logSince(b, from)), 'the seventh belongs to the devil');
	from = b.log.length;
	fire();
	ok(!/The Devil's Seventh/.test(logSince(b, from)), 'the eighth is his again');
}
{
	// In singles the seventh hits the foe or Freischutz itself; over enough seeds, both.
	const where = new Set();
	for (let seed = 1; seed <= 20 && where.size < 2; seed++) {
		const b = battle([freischutz()], [wall()], 'gen9rpcollab', [seed, seed + 1, seed + 2, seed + 3]);
		b.p1.active[0].m.magicBullets = 6;
		const from = b.log.length;
		const mine = b.p1.active[0].hp;
		turn(b, 'move 1', 'move 1');
		const log = logSince(b, from);
		if (/\|move\|p1a: Freischutz\|Magic Bullet\|p1a: Freischutz/.test(log) && b.p1.active[0].hp < mine) where.add('self');
		if (/\|move\|p1a: Freischutz\|Magic Bullet\|p2a: Blissey/.test(log) && b.p2.active[0].hp < b.p2.active[0].maxhp) where.add('foe');
	}
	ok(where.has('self') && where.has('foe'), `the devil's bullet hits either (${[...where].join(', ')})`);
	// In doubles, its ally too.
	const hit = new Set();
	for (let seed = 1; seed <= 40 && hit.size < 4; seed++) {
		const b = battle([freischutz(), wall()], [wall(), wall()], 'gen9rpbattledoubles', [seed, seed + 1, seed + 2, seed + 3]);
		b.p1.active[0].m.magicBullets = 6;
		const from = b.log.length;
		turn(b, 'move 1 1, move 1', 'move 1, move 1');
		const target = (/\|move\|p1a: Freischutz\|Magic Bullet\|(p[12][ab])/.exec(logSince(b, from)) || [])[1];
		if (target) hit.add(target);
	}
	ok(hit.size === 4, `in doubles any of the four (${[...hit].sort().join(', ')})`);
}

// ---- Hatrequeen: Arcana Slave and Love and Justice.
{
	const b = battle([hatrequeen(), mon('Chansey', ['Splash'])], [wall(['Splash', 'Tackle'])]);
	const me = () => b.p1.pokemon.find(p => p.baseSpecies.baseSpecies === 'Hatrequeen');
	const move = b.dex.moves.get('arcanaslave');
	ok(move.type === 'Fairy' && move.basePower === 150 && move.flags.charge, 'Arcana Slave: Fairy, 150, a charge move');
	let from = b.log.length;
	turn(b, 'move 1', 'move 1');
	ok(/\|-prepare\|p1a: Hatrequeen\|Arcana Slave/.test(logSince(b, from)) && b.p2.active[0].hp === b.p2.active[0].maxhp, 'charges on the first turn');
	ok(me().species.id === 'hatrequeen', 'one quiet turn: still the Magical Girl');
	from = b.log.length;
	turn(b, 'move 1', 'move 1');
	ok(b.p2.active[0].hp < b.p2.active[0].maxhp, 'and fires on the second');
	ok(me().species.id === 'hatrequeenhatred' && me().baseSpecies.id === 'hatrequeenhatred', 'two quiet turns: Hatrequeen-Hatred');
	ok(/\|-activate\|p1a: Hatrequeen\|ability: Love and Justice/.test(logSince(b, from)) && logSince(b, from).includes('The Queen of Hatred has turned hysterical!'), 'and says so');
	const bs = me().species.baseStats;
	ok(me().species.types.join() === 'Fairy,Dark' && bs.hp === 90 && bs.atk === 110 && bs.def === 80 && bs.spa === 150 && bs.spd === 80 && bs.spe === 120, 'Fairy/Dark, with the Hatred stats');
	from = b.log.length;
	const hp = b.p2.active[0].hp;
	turn(b, 'move 1', 'move 1');
	ok(!/\|-prepare\|/.test(logSince(b, from)) && b.p2.active[0].hp < hp, 'Hatred fires Arcana Slave at once');
	turn(b, 'switch 2', 'move 1');
	turn(b, 'switch 2', 'move 1');
	ok(me().species.id === 'hatrequeenhatred', 'for good: still Hatred after a switch');
	// Back to the Magical Girl when she faints (Revival Blessing).
	me().faint();
	b.faintMessages();
	ok(me().baseSpecies.id === 'hatrequeen', 'fainted, she is Hatrequeen again');
}
{
	// A hit starts the two turns over; so does a switch.
	const b = battle([hatrequeen(), mon('Chansey', ['Splash'])], [wall(['Splash', 'Tackle'])]);
	const me = () => b.p1.pokemon.find(p => p.baseSpecies.baseSpecies === 'Hatrequeen');
	turn(b, 'move 2', 'move 1');
	turn(b, 'move 2', 'move 2');
	ok(me().species.id === 'hatrequeen', 'quiet, then hit: still the Magical Girl');
	turn(b, 'move 2', 'move 1');
	ok(me().species.id === 'hatrequeen', 'one quiet turn after the hit');
	turn(b, 'switch 2', 'move 1');
	turn(b, 'switch 2', 'move 1');
	ok(me().species.id === 'hatrequeen', 'one quiet turn, a switch, one more: not yet');
	turn(b, 'move 2', 'move 1');
	ok(me().species.id === 'hatrequeenhatred', 'two in a row on the field: Hatred');
}
{
	// Photon Geyser's choice: physical when Attack is the higher, boosts counted.
	const b = battle([hatrequeen()], [wall()]);
	const user = b.p1.active[0];
	const category = () => {
		const m = b.dex.getActiveMove('arcanaslave');
		b.singleEvent('ModifyMove', m, null, user, b.p2.active[0], m, m);
		return m.category;
	};
	ok(category() === 'Special', 'special from her Sp. Atk');
	user.boosts.atk = 6;
	ok(category() === 'Physical', 'physical at +6 Attack');
}

// ---- King Boo: Bashful King and Painting Prison.
{
	// The same seed with and without the ability: the same rolls, so the ratio is the ability's.
	const lost = (ability, mine, theirs, p1, p2) => {
		const b = battle([{ ...mine, ability }], [theirs], 'gen9rpcollab', [5, 6, 7, 8]);
		turn(b, p1, p2);
		return [b.p1.active[0].maxhp - b.p1.active[0].hp, b.p2.active[0].maxhp - b.p2.active[0].hp];
	};
	const boo = mon('King Boo', ['Moonblast', 'Painting Prison', 'Splash'], { evs: { hp: 252, spa: 252 }, nature: 'Modest' });
	const quick = mon('Regieleki', ['Dark Pulse', 'Splash'], { evs: { spa: 252, spe: 252 }, nature: 'Timid' });
	const hid = lost('Bashful King', boo, quick, 'move 3', 'move 1')[0] / lost('Pressure', boo, quick, 'move 3', 'move 1')[0];
	ok(hid > 0.62 && hid < 0.71, `a faster attacker does 2/3 (${hid.toFixed(3)})`);
	const chased = lost('Bashful King', boo, wall(), 'move 1', 'move 1')[1] / lost('Pressure', boo, wall(), 'move 1', 'move 1')[1];
	ok(chased > 1.25 && chased < 1.35, `his hits on a slower target do 1.3x (${chased.toFixed(3)})`);
	const slow = mon('Snorlax', ['Crunch'], { evs: { atk: 252 } });
	ok(lost('Bashful King', boo, slow, 'move 3', 'move 1')[0] === lost('Pressure', boo, slow, 'move 3', 'move 1')[0], 'a slower attacker hits him in full');
}
{
	const boo = mon('King Boo', ['Painting Prison', 'Splash'], { ability: 'Bashful King' });
	// Slowking, which a Ghost move can hit; the Normal-type wall is immune.
	const sitter = () => mon('Slowking', ['Splash'], { evs: { hp: 252, spd: 252 }, nature: 'Calm', item: 'Leftovers' });
	const b = battle([boo, mon('Chansey', ['Splash'])], [sitter(), mon('Clefable', ['Splash'])]);
	const from = b.log.length;
	turn(b, 'move 1', 'move 1');
	ok(b.p2.active[0].volatiles['paintingprison'] && logSince(b, from).includes('sealed inside a painting'), 'Painting Prison seals the target');
	ok(b.p2.activeRequest.active[0].trapped, 'it cannot switch');
	const length = b.p2.active[0].volatiles['paintingprison'].duration;
	ok(length === 4 || length === 5, `for 4 or 5 turns (${length})`);
	turn(b, 'switch 2', 'move 1');
	ok(!b.p2.active[0].volatiles['paintingprison'] && !b.p2.activeRequest.active[0].trapped, 'King Boo switching out lets it go');
	const ghost = battle([boo], [mon('Gengar', ['Splash'])]);
	turn(ghost, 'move 1', 'move 1');
	ok(!ghost.p2.activeRequest.active[0].trapped, 'a Ghost type still switches out');
	const held = battle([boo], [sitter(), mon('Clefable', ['Splash'])]);
	turn(held, 'move 1', 'move 1');
	let turns = 0;
	while (held.p2.active[0].volatiles['paintingprison'] && turns < 8) { turn(held, 'move 2', 'move 1'); turns++; }
	ok(turns >= 3 && turns <= 4 && !held.p2.activeRequest.active[0].trapped, `and the painting gives way on its own (${turns} more turns)`);
}

// ---- The bot's reading of them (src/ai.js).
{
	const { BattleAI } = require('../src/ai');
	const ai = new BattleAI({ difficulty: 'stockfish' });
	ai.setFormat('gen9rpcollab');
	const gen = ai.gen(9);
	const foe = (species, extra = {}) => ai.foePokemon(gen, { species, level: 100, hp: 100, maxhp: 100, status: '', boosts: {}, moves: new Set(), ...extra });
	const calm = ai.damagePct(gen, foe('Punibird', { ability: 'Punishment' }), foe('Blissey'), 'Peck of Sin');
	const angry = ai.damagePct(gen, foe('Punibird-Angry', { ability: 'Punishment' }), foe('Blissey'), 'Peck of Sin');
	ok(calm > 0 && angry > calm * 6, `Peck of Sin reads 120 from Punibird-Angry (${calm.toFixed(1)}% -> ${angry.toFixed(1)}%)`);
	const charging = ai.damagePct(gen, foe('Hatrequeen'), foe('Garchomp'), 'Arcana Slave');
	const hatred = ai.damagePct(gen, foe('Hatrequeen-Hatred'), foe('Garchomp'), 'Arcana Slave');
	ok(charging > 0 && hatred > charging * 1.8, `Arcana Slave: half a hit a turn while it charges (${charging.toFixed(1)}% vs Hatred ${hatred.toFixed(1)}%)`);
	const plain = ai.damagePct(gen, foe('Laetitia', { ability: 'Dear Friends' }), foe('Blissey'), 'Play Rough');
	const gifted = ai.damagePct(gen, foe('Laetitia', { ability: 'Dear Friends' }), foe('Blissey', { volatiles: new Set(['weewitchsgift']) }), 'Play Rough');
	ok(Math.abs(gifted / plain - 1.3) < 0.01, `Dear Friends: 1.3x into a carrier (${plain.toFixed(1)}% -> ${gifted.toFixed(1)}%)`);
	ok(ai.damagePct(gen, foe('Freischutz'), foe('Blissey'), 'Magic Bullet') > 0, 'Magic Bullet has a damage estimate');
	const me = foe('Laetitia', { ability: 'Dear Friends' });
	ai.myMoveNames = ["Wee Witch's Gift", 'Play Rough'];
	const field = new (require('@smogon/calc').Field)({});
	const them = volatiles => ({ species: 'Blissey', level: 100, hp: 100, maxhp: 100, status: '', boosts: {}, moves: new Set(), volatiles });
	const score = volatiles => ai.statusScore(gen, "Wee Witch's Gift", me, foe('Blissey'), { hazards: {}, turn: 1 }, 10, { foes: [them(volatiles)], field });
	ok(score(new Set()) > 20, `Wee Witch's Gift is worth a turn (${score(new Set())})`);
	ok(score(new Set(['weewitchsgift'])) < 0, 'and not into a foe that already carries one');
}

// ---- Full battles with random choices, all six guests on both sides: nothing throws.
{
	const pick = (rng, list) => list[Math.floor(rng() * list.length)];
	let seed = 11;
	const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
	const choiceFor = (side) => {
		const req = side.activeRequest;
		if (!req || req.wait) return null;
		const alive = req.side.pokemon.map((p, i) => [p, i + 1]).filter(([p]) => !p.active && !p.condition.endsWith(' fnt'));
		if (req.forceSwitch) {
			const left = alive.slice();
			return req.forceSwitch.map(must => {
				if (!must || !left.length) return 'pass';
				return `switch ${left.splice(Math.floor(rng() * left.length), 1)[0][1]}`;
			}).join(', ');
		}
		if (req.teamPreview) return 'default';
		return req.active.map((a, slot) => {
			const moves = a.moves.map((m, i) => [m, i + 1]).filter(([m]) => !m.disabled);
			if (!a.trapped && alive.length && rng() < 0.15 && slot === 0) return `switch ${pick(rng, alive)[1]}`;
			if (!moves.length) return 'default';
			const [m, i] = pick(rng, moves);
			// A target for moves that want one in doubles: a random foe.
			return req.active.length > 1 && /normal|any|adjacentFoe/.test(m.target || '') ? `move ${i} ${1 + Math.floor(rng() * 2)}` : `move ${i}`;
		}).join(', ');
	};
	const team = () => [
		punibird({ moves: ['Peck of Sin', 'Brave Bird', 'Knock Off', 'Roost'], evs: { atk: 252, spe: 252 } }),
		laetitia({ moves: ["Wee Witch's Gift", 'Play Rough', 'Poltergeist', 'Shadow Sneak'], item: 'Leftovers' }),
		freischutz({ moves: ['Magic Bullet', 'Iron Head', 'Sucker Punch', 'Protect'], item: 'Life Orb' }),
		hatrequeen({ moves: ['Arcana Slave', 'Psyshock', 'Dark Pulse', 'Calm Mind'], item: 'Power Herb' }),
		mon('Funerfly', ['Solemn Lament', 'Butterfly Procession', 'Last Rites', 'Quiver Dance'], { ability: 'Qliphoth Counter' }),
		mon('King Boo', ['Painting Prison', 'Moonblast', 'Will-O-Wisp', 'Trick Room'], { ability: 'Bashful King' }),
	];
	for (const [games, formatid] of [[6, 'gen9rpcollab'], [3, 'gen9rpbattledoubles']]) {
		for (let game = 0; game < games; game++) {
			const b = battle(team(), team(), formatid, [game + 1, 2, 3, 4]);
			let guard = 0;
			while (!b.ended && guard++ < 600) {
				for (const side of [b.p1, b.p2]) {
					const c = choiceFor(side);
					if (c && !b.ended) { if (!b.choose(side.id, c)) b.choose(side.id, 'default'); }
				}
			}
			ok(b.ended, `${formatid} random battle ${game + 1} finished (${b.turn} turns, ${b.winner || 'tie'})`);
		}
	}
}

console.log(`collab-mons: ${n} checks passed`);
