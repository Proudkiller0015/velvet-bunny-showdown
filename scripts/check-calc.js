'use strict';
/**
 * Does our calculator agree with the server it is a calculator for?
 *
 *   node scripts/check-calc.js
 *
 * The calculator page is Showdown's own with our data and our effects added
 * (client/js/velvet-calc.js). Showdown's half is theirs and well tested; our
 * half is not, and the failure it would produce is the worst kind - a number
 * that looks entirely reasonable and is wrong.
 *
 * So both sides are asked the same question. The real simulator runs the attack
 * and reports all sixteen damage rolls; the page runs the same attack in a real
 * browser, with the real calculator files, and reports its sixteen. They should
 * be identical, roll for roll. Anything else is printed.
 *
 * The engine side works by overriding `battle.randomizer`, which is the one
 * place the damage roll is chosen - so each of the sixteen can be asked for by
 * name instead of fished out of a thousand random battles.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { Teams } = require(path.join(ROOT, 'node_modules', 'pokemon-showdown', 'dist', 'sim', 'teams.js'));
const { Battle } = require(path.join(ROOT, 'node_modules', 'pokemon-showdown', 'dist', 'sim', 'battle.js'));

/**
 * The fights worth checking: every one of ours, and a control.
 *
 * `set` is packed-team format. The control is first and is not ours at all -
 * if Tackle from a Blissey disagrees, the harness is broken rather than the
 * calculator, and that is worth knowing before reading anything below it.
 */
const CASES = [
	{
		name: 'control: Tackle, no abilities involved',
		attacker: 'A|blissey||naturalcure|tackle,protect,rest,softboiled|Adamant|252,252,4,,,|||||',
		defender: 'B|blissey||naturalcure|tackle,protect,rest,softboiled|Bold|252,,252,,,|||||',
		move: 'Tackle',
	},
	{
		name: 'Queen Wrath doubles Attack',
		attacker: 'A|samantha||queenwrath|tackle,queenbeam,queensblitz,queensheal|Adamant|252,252,4,,,|||||',
		defender: 'B|blissey||naturalcure|tackle,protect,rest,softboiled|Bold|252,,252,,,|||||',
		move: 'Tackle',
	},
	{
		name: 'Queen Wrath doubles Special Attack',
		attacker: 'A|samantha||queenwrath|surf,queenbeam,queensblitz,queensheal|Modest|252,,4,252,,|||||',
		defender: 'B|blissey||naturalcure|tackle,protect,rest,softboiled|Bold|252,,252,,,|||||',
		move: 'Surf',
	},
	{
		name: "Queen's Blitz: neutral on a Fairy",
		attacker: 'A|samantha||queenwrath|queensblitz,tackle,rest,protect|Adamant|252,252,4,,,|||||',
		defender: 'B|clefable||unaware|moonblast,protect,rest,softboiled|Bold|252,,252,,,|||||',
		move: "Queen's Blitz",
	},
	{
		name: "Queen's Blitz: neutral on a Dark type it would resist",
		attacker: 'A|samantha||queenwrath|queensblitz,tackle,rest,protect|Adamant|252,252,4,,,|||||',
		defender: 'B|umbreon||synchronize|foulplay,protect,rest,moonlight|Bold|252,,252,,,|||||',
		move: "Queen's Blitz",
	},
	{
		name: 'Elemental Banana: 1.3x Attack on a Simisage',
		attacker: 'A|simisage|elementalbanana|overgrow|seedbomb,protect,rest,nastyplot|Adamant|252,252,4,,,|||||',
		defender: 'B|blissey||naturalcure|tackle,protect,rest,softboiled|Bold|252,,252,,,|||||',
		move: 'Seed Bomb',
	},
	{
		name: 'Elemental Banana: 1.3x Special Attack on a Simisear',
		attacker: 'A|simisear|elementalbanana|blaze|flamethrower,protect,rest,nastyplot|Modest|252,,4,252,,|||||',
		defender: 'B|blissey||naturalcure|tackle,protect,rest,softboiled|Bold|252,,252,,,|||||',
		move: 'Flamethrower',
	},
	{
		name: 'Nuzleaf-SOLD hits with 190 Attack',
		attacker: 'A|nuzleafsold||norefunds|leafblade,protect,rest,swordsdance|Adamant|252,252,4,,,|||||',
		defender: 'B|blissey||naturalcure|tackle,protect,rest,softboiled|Bold|252,,252,,,|||||',
		move: 'Leaf Blade',
	},
	{
		name: 'Verdant Surge: its own boost, and the terrain it sets',
		attacker: 'A|simisage||verdantsurge|seedbomb,protect,rest,nastyplot|Adamant|252,252,4,,,|||||',
		defender: 'B|blissey||naturalcure|tackle,protect,rest,softboiled|Bold|252,,252,,,|||||',
		move: 'Seed Bomb',
	},
	{
		name: 'Solar Surge: the sun it sets, on a Fire move',
		attacker: 'A|simisear||solarsurge|flamethrower,protect,rest,nastyplot|Modest|252,,4,252,,|||||',
		defender: 'B|blissey||naturalcure|tackle,protect,rest,softboiled|Bold|252,,252,,,|||||',
		move: 'Flamethrower',
	},
	{
		name: "Merchant's Call: the whole HP bar, as damage",
		attacker: 'A|nuzleaf|brokenpact|chlorophyll|merchantscall,tackle,protect,rest|Adamant|252,252,4,,,|||||',
		defender: 'B|blissey||naturalcure|tackle,protect,rest,softboiled|Bold|252,,252,,,|||||',
		move: "Merchant's Call",
		fixed: true,
	},
	{
		name: 'a +2 Attack boost, on top of Queen Wrath',
		attacker: 'A|samantha||queenwrath|tackle,queensdance,rest,protect|Adamant|252,252,4,,,|||||',
		defender: 'B|blissey||naturalcure|tackle,protect,rest,softboiled|Bold|252,,252,,,|||||',
		move: 'Tackle',
		boosts: { atk: 2 },
	},
];

/* ------------------------------------------------------------------- engine */

/**
 * Every damage roll the simulator would produce for one attack.
 *
 * Critical hits and the roll are the only random parts, and both are pinned:
 * `willCrit` is set explicitly and `randomizer` is replaced with the roll being
 * asked for, which is exactly what it does with a random number anyway.
 */
function engineRolls(testCase) {
	const battle = new Battle({ formatid: 'gen9customgame', strictChoices: false });
	battle.setPlayer('p1', { name: 'A', team: Teams.unpack(testCase.attacker) });
	battle.setPlayer('p2', { name: 'B', team: Teams.unpack(testCase.defender) });
	battle.makeChoices('default', 'default');

	const attacker = battle.p1.active[0];
	const defender = battle.p2.active[0];
	if (testCase.boosts) attacker.boostBy(testCase.boosts);

	// A fixed-damage move is asked once. Asking sixteen times gets one answer and
	// fifteen zeroes, because the first call is what faints the user - the damage
	// *is* its remaining HP, and it has none afterwards.
	const rolls = [];
	for (let i = 0; i < (testCase.fixed ? 1 : 16); i++) {
		const trunc = battle.trunc.bind(battle);
		battle.randomizer = base => trunc(trunc(base * (100 - i)) / 100);
		const move = battle.dex.getActiveMove(testCase.move);
		// Pinned rather than left to chance: `getMoveHitData` rolls for a crit
		// when `willCrit` is undefined, which put a doubled roll or two into
		// every set of sixteen and made the comparison meaningless. A move that
		// always crits keeps its own answer.
		if (move.willCrit === undefined) move.willCrit = !!testCase.crit;
		const damage = battle.actions.getDamage(attacker, defender, move);
		rolls.push(typeof damage === 'number' ? damage : null);
	}
	battle.destroy();
	return rolls;
}

/* ------------------------------------------------------------------ browser */

function findChrome() {
	return ['C:/Program Files/Google/Chrome/Application/chrome.exe',
		'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
		'/usr/bin/google-chrome'].find(fs.existsSync);
}

/**
 * The same attacks, through the real calculator files and our own.
 *
 * The page is built here rather than loading client/calc.html, because that
 * page is a user interface and this is a question about the mathematics
 * underneath it - the same scripts, without the six hundred form controls.
 */
const CALC = 'https://calc.pokemonshowdown.com/';
const FILES = ['calc/util.js', 'calc/stats.js', 'calc/data/species.js', 'calc/data/types.js',
	'calc/data/natures.js', 'calc/data/abilities.js', 'calc/data/moves.js', 'calc/data/items.js',
	'calc/data/index.js', 'calc/move.js', 'calc/pokemon.js', 'calc/field.js', 'calc/items.js',
	'calc/mechanics/util.js', 'calc/mechanics/gen789.js', 'calc/mechanics/gen56.js',
	'calc/mechanics/gen4.js', 'calc/mechanics/gen3.js', 'calc/mechanics/gen12.js',
	'calc/calc.js', 'calc/desc.js', 'calc/result.js'];
// calc/adaptable.js and calc/index.js are deliberately not in that list. Both
// re-export the other files, and under the `require() { return exports }` shim
// that means re-exporting the one shared object onto itself: every name becomes
// a getter that returns itself, so reading one is either undefined or an
// infinite loop. Loading the two of them cost an afternoon of "Generations is
// undefined" on an object that visibly had Generations on it. Everything they
// would publish - calculate, Pokemon, Move, Field, Generations - is already
// published by the files above.

/**
 * Their calculator, on this disk.
 *
 * Fetched once and kept in cache/, because twenty-four scripts over the network
 * on every run made this check fail for reasons that had nothing to do with the
 * calculator - which is the one thing a check like this must never do. Delete
 * the folder to pick up their changes.
 */
function vendor() {
	const dir = path.join(ROOT, 'cache', 'calc');
	const missing = FILES.filter(f => !fs.existsSync(path.join(dir, f)));
	if (missing.length) {
		console.log(`fetching ${missing.length} calculator file(s) from ${CALC}`);
		for (const file of missing) {
			const target = path.join(dir, file);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			execFileSync('curl', ['-sS', '-o', target, CALC + file]);
		}
	}
	return dir;
}

function browserRolls(cases) {
	const vendored = vendor();
	const work = fs.mkdtempSync(path.join(os.tmpdir(), 'calccheck-'));
	// The vendored tree already has a `calc/` of its own inside it; copying the
	// folder rather than its contents put every script one level too deep, where
	// they all 404 in silence and the page simply had no calculator in it.
	fs.cpSync(path.join(vendored, 'calc'), path.join(work, 'calc'), { recursive: true });
	fs.copyFileSync(path.join(ROOT, 'client', 'js', 'velvet-calc-data.js'), path.join(work, 'data.js'));
	fs.copyFileSync(path.join(ROOT, 'client', 'js', 'velvet-calc.js'), path.join(work, 'velvet.js'));
	const files = FILES;

	fs.writeFileSync(path.join(work, 'page.html'), `<!doctype html>
<meta charset="utf-8"><title>check</title><div id="OUT">pending</div>
<script>
	// Anything that goes wrong, at load time included, comes back as the result.
	window.onerror = function (message, url, line) {
		document.getElementById('OUT').textContent =
			'RESULT:[{"error":' + JSON.stringify(String(message) + ' @ ' + String(url).split('/').pop() + ':' + line) + '}]';
		return true;
	};
	// The shim their own page uses: every file requires the one shared exports
	// object and writes onto it, which is how these load without a bundler.
	var exports = {}; var calc = exports;
	function require() { return exports; }
</script>
${files.map(f => `<script src="${f}"></script>`).join('\n')}
<script>window.calc = Object.assign(window.calc || {}, exports);</script>
<script src="data.js"></script>
<script src="velvet.js"></script>
<script>
var CASES = ${JSON.stringify(cases)};
function go() {
	var gen = calc.Generations.get(9);
	var out = [];
	for (var i = 0; i < CASES.length; i++) {
		var c = CASES[i];
		try {
			var attacker = new calc.Pokemon(gen, c.attackerName, {
				ability: c.attackerAbility, item: c.attackerItem, nature: c.attackerNature,
				evs: c.attackerEvs, boosts: c.boosts || {},
			});
			var defender = new calc.Pokemon(gen, c.defenderName, {
				ability: c.defenderAbility, nature: c.defenderNature, evs: c.defenderEvs,
			});
			var move = new calc.Move(gen, c.move, { ability: c.attackerAbility, item: c.attackerItem });
			if (c.crit) move.isCrit = true;
			var result = calc.calculate(gen, attacker, defender, move, new calc.Field({}));
			var damage = result.damage;
			out.push(Array.isArray(damage) ? damage : [damage]);
		} catch (e) {
			out.push({ error: String(e && e.message || e) });
		}
	}
	document.getElementById('OUT').textContent = 'RESULT:' + JSON.stringify(out);
}
setTimeout(go, 300);
</script>`);

	const dom = execFileSync(findChrome(), [
		'--headless=new', '--disable-gpu', '--allow-file-access-from-files',
		'--virtual-time-budget=30000', '--dump-dom',
		'file:///' + path.join(work, 'page.html').replace(/\\/g, '/'),
	], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });

	const match = /RESULT:(\[[\s\S]*?\])</.exec(dom);
	try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { /* temp */ }
	if (!match) throw new Error('the browser reported nothing:\n' + dom.slice(0, 600));
	return JSON.parse(match[1]);
}

/** A packed set, in the pieces the calculator's constructor wants. */
function unpackForCalc(packed) {
	const [name, species, item, ability, moves, nature, evs] = packed.split('|');
	const [hp, atk, def, spa, spd, spe] = (evs || '').split(',').map(n => Number(n) || 0);
	const { Dex } = require(path.join(ROOT, 'node_modules', 'pokemon-showdown', 'dist', 'sim', 'dex.js'));
	return {
		name: Dex.species.get(species || name).name,
		item: item ? Dex.items.get(item).name : '',
		ability: ability ? Dex.abilities.get(ability).name : '',
		nature: nature || 'Serious',
		evs: { hp, atk, def, spa, spd, spe },
	};
}

/* --------------------------------------------------------------------- main */

const forBrowser = CASES.map(c => {
	const a = unpackForCalc(c.attacker);
	const d = unpackForCalc(c.defender);
	return {
		move: c.move, boosts: c.boosts, crit: c.crit,
		attackerName: a.name, attackerAbility: a.ability, attackerItem: a.item,
		attackerNature: a.nature, attackerEvs: a.evs,
		defenderName: d.name, defenderAbility: d.ability,
		defenderNature: d.nature, defenderEvs: d.evs,
	};
});

console.log('asking the simulator...');
const engine = CASES.map(engineRolls);
console.log('asking the calculator, in a browser...');
const browser = browserRolls(forBrowser);

let bad = 0;
for (let i = 0; i < CASES.length; i++) {
	const want = engine[i];
	const got = browser[i];
	// A fixed-damage move has one answer rather than sixteen rolls, and the two
	// sides say so differently: the simulator repeats it, the calculator states
	// it once.
	const flatten = list => Array.isArray(list) ?
		(new Set(list).size === 1 ? [list[0]] : list) : list;
	const sorted = list => Array.isArray(list) ? flatten(list).slice().sort((a, b) => a - b) : list;
	const mine = sorted(want), theirs = sorted(got);
	const same = Array.isArray(theirs) && mine.length === theirs.length &&
		mine.every((v, n) => v === theirs[n]);
	if (!same) bad++;
	console.log(`\n${same ? 'OK  ' : 'DIFF'}  ${CASES[i].name}`);
	if (!same) {
		console.log(`      simulator : ${JSON.stringify(want)}`);
		console.log(`      calculator: ${JSON.stringify(got)}`);
	} else {
		console.log(`      ${want[0]} - ${want[want.length - 1]}`);
	}
}

console.log(`\n${CASES.length - bad}/${CASES.length} agree`);
process.exit(bad ? 1 : 0);
