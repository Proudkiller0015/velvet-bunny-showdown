'use strict';
/**
 * Touhou (data/velvet/touhou.js): the Touhoumons solomod's characters (DH2, MIT), a guest
 * tier at the top of the ladder. Legal in RP Touhou and the RP Battle formats, refused by
 * every other RP format, RP Collab included; never in the wild, drafted by the bot only in
 * RP Touhou. Every species and forme has its sprites, every move, ability and item of
 * theirs has its descriptions, a handful of their mechanics do what they say, and random
 * Touhou teams play whole battles without the engine throwing.
 *
 * Reads the data installed in node_modules by scripts/setup-config.js: run that first.
 *
 *   node test/touhou.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Battle, Dex, Teams, TeamValidator } = require('pokemon-showdown');
const touhou = require('pokemon-showdown/dist/data/velvet/touhou.js');

const dex = Dex.mod('gen9rp');
const ROOT = path.join(__dirname, '..');
const ALL = [...touhou.SPECIES, ...touhou.FORMES];
let n = 0;
const ok = (cond, what) => { assert.ok(cond, what); n++; };

/** A set the validator takes: the first ability, four moves it learns, the item its forme needs. */
function setFor(id, extra = {}) {
	const s = dex.species.get(id);
	const learner = s.battleOnly ? dex.species.get(s.battleOnly).id : s.id;
	const moves = Object.keys(dex.species.getLearnsetData(learner).learnset || {}).slice(0, 4);
	return {
		name: s.name, species: s.name, ability: s.requiredAbility || Object.values(s.abilities)[0], item: s.requiredItem || '',
		moves, nature: 'Serious', evs: { hp: 4 }, level: 100, ...extra,
	};
}
const problems = (format, team) => new TeamValidator(format).validateTeam(team) || [];

// ---- They exist, all of them, in RP's dex and nowhere else.
ok(touhou.SPECIES.length === 129 && touhou.FORMES.length === 9, `129 species and 9 formes (${touhou.SPECIES.length}, ${touhou.FORMES.length})`);
for (const id of ALL) {
	const s = dex.species.get(id);
	ok(s.exists && s.num >= 2101 && s.tier === 'Touhou' && s.natDexTier === 'Touhou', `${id} exists, numbered past the real dex, tiered Touhou`);
}
ok(!Dex.species.get('Reimu Hakurei').exists, 'the official dex never sees them');
ok(dex.species.get('Hecatia').otherFormes.includes('Hecatia-Earth') && dex.species.get('Okina Matara-Winter').battleOnly === 'Okina Matara', 'formes hang off their bases');

// ---- Legal in RP Touhou and the RP Battle formats; refused everywhere else with the reason.
const OTHER = ['gen9rpag', 'gen9rpcollab', 'gen9rpubers', 'gen9rpou', 'gen9rplc', 'gen9rpdraft', 'gen8rpou'];
for (const id of ALL) {
	const set = setFor(id);
	ok(!problems('gen9rptouhou', [set]).length, `${id} legal in RP Touhou (${problems('gen9rptouhou', [set])})`);
	ok(!problems('gen9rpbattle', [set]).length, `${id} legal in RP Battle`);
	ok(!problems('gen9rpbattledoubles', [set, setFor('reimuhakurei')]).length, `${id} legal in RP Battle (Doubles)`);
	for (const f of ['gen9rpag', 'gen9rpcollab', 'gen9rpou', 'gen9rpdraft']) {
		const p = problems(f, [setFor(id)]);
		ok(p.some(x => /is a Touhou Pokémon: legal only in \[Gen 9\] RP Touhou/.test(x)), `${id} refused in ${f}, saying why`);
	}
}
for (const f of OTHER) ok(problems(f, [setFor('cirno')]).length, `refused in ${f}`);
ok(problems('gen9rptouhou', [{ name: 'Funerfly', species: 'Funerfly', ability: 'Qliphoth Counter', moves: ['Solemn Lament'], evs: { hp: 4 } }]).some(x => /Collab/.test(x)), 'RP Touhou takes no collab Pokemon');
// The Summer Backdoor makes Cirno Cirno-Tanned, as the Griseous Core does Giratina-Origin.
{
	const cirno = setFor('cirno', { item: 'Summer Backdoor', ability: 'Drought' });
	const p = problems('gen9rptouhou', [cirno]);
	ok(!p.length && cirno.species === 'Cirno-Tanned', `Cirno holding a Summer Backdoor is Cirno-Tanned (${p})`);
	ok(problems('gen9rptouhou', [setFor('cirnotanned', { item: '' })]).length, 'and Cirno-Tanned without one is refused');
}

// ---- The tier table: Touhou, at the top of the ladder.
{
	const tiers = require('../src/rp-tiers.json');
	for (const id of ALL) if (!dex.species.get(id).battleOnly) ok(tiers[id] === 'Touhou', `src/rp-tiers.json files ${id} under Touhou`);
	const formats = fs.readFileSync(path.join(ROOT, 'config', 'custom-formats.js'), 'utf8');
	ok(/const LOW_LADDER = \['Touhou', 'Collab', 'AG'/.test(formats), 'Touhou tops the RP ladder, above Collab');
}

// ---- Sprites: front, back, both shinies and an icon for every species and forme, and a row in the client.
{
	const dir = path.join(ROOT, 'client', 'sprites', 'touhou');
	const client = fs.readFileSync(path.join(ROOT, 'client', 'js', 'velvet-data.js'), 'utf8');
	const art = JSON.parse(/var TOUHOU_ART = (\[.*\]);/.exec(client)[1]);
	const iconOf = JSON.parse(/var TOUHOU_ICON_OF = (\{.*\});/.exec(client)[1]);
	for (const id of ALL) {
		for (const suffix of ['', '-back', '-shiny', '-back-shiny']) ok(fs.existsSync(path.join(dir, `${id}${suffix}.png`)), `sprite touhou/${id}${suffix}.png`);
		ok(fs.existsSync(path.join(dir, `${iconOf[id] || id}-icon.png`)), `icon for ${id}`);
		ok(art.includes(id), `${id} has a row in the client's sprite table`);
	}
	const buffs = fs.readFileSync(path.join(ROOT, 'client', 'js', 'velvet-buffs.js'), 'utf8');
	for (const id of ALL) ok(buffs.includes(`"${id}":{"num":`), `${id} ships to the client (newSpecies)`);
	ok(buffs.includes('"reimu","pokemon"') && buffs.includes('"patchy","pokemon"'), 'their nicknames are search aliases');
}

// ---- Every move, ability and item of theirs is ours, numbered and described.
for (const [kind, ids, table] of [['move', touhou.MOVE_IDS, dex.moves], ['ability', touhou.ABILITY_IDS, dex.abilities], ['item', touhou.ITEM_IDS, dex.items]]) {
	for (const id of ids) {
		const x = table.get(id);
		ok(x.exists && x.num < 0 && x.shortDesc && x.desc && x.desc !== 'No additional effect.', `${kind} ${x.name || id} exists with both descriptions`);
		ok(!Dex[kind === 'ability' ? 'abilities' : kind + 's'].get(id).exists, `${kind} ${id} is not an official id`);
	}
}

// ---- Never wild; drafted by the bot in RP Touhou only.
{
	const { encounterable } = require('../src/encounters');
	for (const id of ALL) ok(!encounterable(dex.species.get(id)), `${id} never spawns wild`);
	const { TeamBuilder } = require('../src/teambuilder');
	const tb = new TeamBuilder();
	for (const f of ['gen9rpag', 'gen9rpcollab', 'gen9rpou', 'gen9rpbattle', 'gen9rpbattledoubles']) {
		ok(!tb.context(f).pool.some(s => s.tier === 'Touhou'), `not in the bot's ${f} pool`);
	}
	ok(tb.context('gen9rptouhou').pool.filter(s => s.tier === 'Touhou').length > 100, 'in the bot\'s RP Touhou pool');
	for (let seed = 1; seed <= 3; seed++) {
		const team = Teams.unpack(tb.build('gen9rptouhou', seed));
		ok(team.some(s => dex.species.get(s.species).tier === 'Touhou') && !problems('gen9rptouhou', team).length, `the bot's RP Touhou team ${seed} brings one, legally`);
		ok(!Teams.unpack(tb.build('gen9rpag', seed)).some(s => dex.species.get(s.species).tier === 'Touhou'), `its RP AG team ${seed} does not`);
	}
}

// ---- A few of their mechanics.
const mon = (species, moves, extra = {}) => ({ name: species, species, ability: '', item: '', moves, nature: 'Serious', evs: { hp: 252 }, level: 100, ...extra });
const battle = (mine, theirs, seed = [1, 2, 3, 4]) => {
	const b = new Battle({ formatid: 'gen9rpcustomgame', seed });
	b.setPlayer('p1', { team: Teams.pack(mine) });
	b.setPlayer('p2', { team: Teams.pack(theirs) });
	b.choose('p1', 'team 1');
	b.choose('p2', 'team 1');
	return b;
};
const turn = (b, p1, p2) => { b.choose('p1', p1); b.choose('p2', p2); };
{
	// Hakkero: rain does not halve Marisa's Fire moves.
	const hit = ability => {
		const b = battle([mon('Marisa Kirisame', ['Flamethrower'], { ability })], [mon('Blissey', ['Splash'], { ability: 'Drizzle' })]);
		turn(b, 'move 1', 'move 1');
		return b.p2.active[0].maxhp - b.p2.active[0].hp;
	};
	const kept = hit('Hakkero');
	const halved = hit('Reckless');
	ok(kept > halved * 1.7, `Hakkero: Fire in rain is not halved (${kept} vs ${halved})`);
}
{
	// Body Swap: Otherworld -> Earth (a healing move, so it fails at full HP, as in the mod).
	const b = battle([mon('Hecatia', ['Body Swap'], { ability: 'Pressure' })], [mon('Blissey', ['Splash'])]);
	b.p1.active[0].sethp(100);
	turn(b, 'move 1', 'move 1');
	ok(b.p1.active[0].species.name === 'Hecatia-Earth', 'Body Swap: Hecatia becomes Hecatia-Earth');
}
{
	// Four Seasons: rain makes Okina Matara Spring.
	const b = battle([mon('Okina Matara', ['Splash'], { ability: 'Four Seasons' })], [mon('Pelipper', ['Splash'], { ability: 'Drizzle' })]);
	ok(b.p1.active[0].species.name === 'Okina Matara-Spring', `Four Seasons: rain is Spring (${b.p1.active[0].species.name})`);
}
{
	// Summon Nyuudou: Ichirin comes back with Unzan.
	const b = battle([mon('Ichirin Kumoi', ['Splash'], { ability: 'Summon Nyuudou' }), mon('Blissey', ['Splash'])], [mon('Chansey', ['Splash'])]);
	turn(b, 'switch 2', 'move 1');
	ok(b.p1.pokemon.find(p => p.baseSpecies.baseSpecies === 'Ichirin Kumoi').species.name === 'Ichirin Kumoi-Unzan', 'Summon Nyuudou: Ichirin Kumoi-Unzan after switching out');
}
{
	// Echo: immune to sound, and echoes it back.
	const b = battle([mon('Kyouko Kasodani', ['Splash'], { ability: 'Echo' })], [mon('Blissey', ['Hyper Voice'])]);
	const from = b.log.length;
	turn(b, 'move 1', 'move 1');
	const log = b.log.slice(from).join('\n');
	ok(/-immune\|p1a: Kyouko Kasodani\|\[from\] ability: Echo/.test(log), 'Echo: immune to Hyper Voice');
	ok(/\|move\|p1a: Kyouko Kasodani\|Hyper Voice/.test(log), 'Echo: and uses it back');
}
{
	// Scarlet Sisters: 1.5x Attack and Sp. Atk, on both sisters and legal.
	const b = battle([mon('Remilia Scarlet', ['Splash'], { ability: 'Scarlet Sisters' })], [mon('Blissey', ['Splash'])]);
	const remilia = b.p1.active[0];
	ok(remilia.getStat('atk') === Math.floor(remilia.storedStats.atk * 1.5) && remilia.getStat('spa') === Math.floor(remilia.storedStats.spa * 1.5),
		`Scarlet Sisters: Remilia's Attack and Sp. Atk are 1.5x (${remilia.getStat('atk')}/${remilia.storedStats.atk}, ${remilia.getStat('spa')}/${remilia.storedStats.spa})`);
	ok(remilia.getStat('def') === remilia.storedStats.def && remilia.getStat('spd') === remilia.storedStats.spd, 'Scarlet Sisters: Defense and Sp. Def untouched');
	const hit = (ability, move) => {
		const t = battle([mon('Remilia Scarlet', [move], { ability })], [mon('Blissey', ['Splash'])]);
		turn(t, 'move 1', 'move 1');
		return t.p2.active[0].maxhp - t.p2.active[0].hp;
	};
	for (const move of ['Dark Pulse', 'Crunch']) {
		const strong = hit('Scarlet Sisters', move), plain = hit('Vampirism', move);
		ok(strong > plain * 1.3, `Scarlet Sisters: ${move} hits harder (${strong} vs ${plain})`);
	}
	for (const id of ['remiliascarlet', 'flandrescarlet']) {
		ok(Object.values(dex.species.get(id).abilities).includes('Scarlet Sisters'), `${id} has Scarlet Sisters`);
		const set = setFor(id, { ability: 'Scarlet Sisters' });
		ok(!problems('gen9rptouhou', [set]).length, `${id} with Scarlet Sisters legal in RP Touhou (${problems('gen9rptouhou', [set])})`);
	}
}
{
	// Bloodlust: +1 Speed on every entry (the old Intrepid Sword), never removed, Knock Off unboosted, theirs only.
	const b = battle([mon('Remilia Scarlet', ['Splash'], { item: 'Bloodlust' }), mon('Blissey', ['Splash'])], [mon('Blissey', ['Knock Off'])]);
	const remilia = b.p1.pokemon.find(p => p.species.id === 'remiliascarlet');
	ok(remilia.boosts.spe === 1, `Bloodlust: Remilia enters at +1 Speed (${remilia.boosts.spe})`);
	const before = remilia.hp;
	turn(b, 'move 1', 'move 1');
	ok(remilia.item === 'bloodlust', 'Bloodlust: Knock Off does not remove it');
	const knocked = before - remilia.hp;
	turn(b, 'switch 2', 'move 1');
	turn(b, 'switch 2', 'move 1');
	ok(remilia.isActive && remilia.boosts.spe === 1, `Bloodlust: +1 again on coming back in (${remilia.boosts.spe})`);
	// Knock Off's power against it, beside the same hit into a held Leftovers.
	const lefties = battle([mon('Remilia Scarlet', ['Splash'], { item: 'Leftovers' })], [mon('Blissey', ['Knock Off'])]);
	const from = lefties.p1.active[0].hp;
	turn(lefties, 'move 1', 'move 1');
	const boosted = from - lefties.p1.active[0].hp;
	ok(knocked < boosted / 1.3, `Bloodlust: Knock Off gains no power from it (${knocked} vs ${boosted} into Leftovers)`);
	const other = battle([mon('Cirno', ['Splash'], { item: 'Bloodlust' })], [mon('Blissey', ['Splash'])]);
	ok(other.p1.active[0].boosts.spe === 0, 'Bloodlust: nothing for anyone else');
	for (const id of ['remiliascarlet', 'flandrescarlet']) {
		const set = setFor(id, { item: 'Bloodlust' });
		ok(!problems('gen9rptouhou', [set]).length, `${id} with Bloodlust legal in RP Touhou (${problems('gen9rptouhou', [set])})`);
	}
	const tb = new (require('../src/teambuilder').TeamBuilder)();
	ok(tb.ourItems(tb.context('gen9rptouhou'), dex.species.get('Flandre Scarlet')).includes('Bloodlust'), 'the bot knows Bloodlust is theirs');
}
{
	// Fate's Call: Remilia's own. 120 Dark special, through Protect (left standing) and past evasion.
	const fc = dex.moves.get("Fate's Call");
	ok(fc.exists && fc.basePower === 120 && fc.type === 'Dark' && fc.category === 'Special' && fc.accuracy === true && !fc.flags.protect && fc.num < 0, "Fate's Call: 120 power Dark special, never misses");
	const b = battle([mon('Remilia Scarlet', ["Fate's Call", 'Splash'])], [mon('Blissey', ['Protect', 'Double Team'])]);
	turn(b, 'move 1', 'move 1');
	const blissey = b.p2.active[0];
	ok(blissey.hp < blissey.maxhp && b.log.some(l => /\|-singleturn\|p2a: Blissey\|Protect/.test(l)) && !b.log.some(l => /\|-activate\|p2a: Blissey\|move: Protect/.test(l)),
		"Fate's Call: hits through a Protect that went up first, without breaking it");
	turn(b, 'move 2', 'move 2');
	turn(b, 'move 2', 'move 2');
	turn(b, 'move 2', 'move 2');
	ok(blissey.boosts.evasion >= 3, 'Double Team up (+3 evasion)');
	let hits = 0;
	for (let i = 0; i < 6; i++) {
		const hp = blissey.hp;
		turn(b, 'move 1', 'move 2');
		if (blissey.hp < hp || blissey.fainted) hits++;
		if (blissey.fainted || b.ended) break;
	}
	ok(hits >= 1 && b.log.every(l => !/\|-miss\|p1a: Remilia/.test(l)), `Fate's Call: never misses through evasion (${hits} hits)`);
	const learners = dex.species.all().filter(s => (dex.species.getLearnsetData(s.id).learnset || {}).fatescall).map(s => s.id);
	ok(learners.every(id => ['remiliascarlet', 'samantha'].includes(id)) && learners.includes('remiliascarlet'), `Fate's Call: Remilia's alone (${learners})`);
	const tb = new (require('../src/teambuilder').TeamBuilder)();
	let carried = 0, seen = 0;
	for (let seed = 1; seed <= 40 && seen < 6; seed++) {
		const set = Teams.unpack(tb.build('gen9rptouhou', seed)).find(s => dex.species.get(s.species).id === 'remiliascarlet');
		if (!set) continue;
		seen++;
		if (set.moves.some(m => dex.moves.get(m).id === 'fatescall')) carried++;
	}
	ok(!seen || carried > 0, `the bot's Remilia brings Fate's Call (${carried} of ${seen})`);
}
{
	// Forbidden Barrage: Flandre's signature, raised to match Fate's Call.
	const fb = dex.moves.get('Forbidden Barrage');
	ok(fb.basePower === 120 && fb.accuracy === true && fb.pp === 8 && fb.type === 'Dark' && fb.category === 'Special' && fb.target === 'allAdjacentFoes' && fb.flags.bullet,
		'Forbidden Barrage: 120 power, never misses, 8 PP, still a Dark spread bullet');
	const b = battle([mon('Flandre Scarlet', ['Forbidden Barrage'])], [mon('Blissey', ['Double Team'])]);
	const blissey = b.p2.active[0];
	let hits = 0;
	for (let i = 0; i < 4 && !b.ended; i++) {
		const hp = blissey.hp;
		turn(b, 'move 1', 'move 1');
		if (blissey.hp < hp || blissey.fainted) hits++;
	}
	ok(blissey.boosts.evasion >= 2 || blissey.fainted, 'Double Team went up');
	ok(hits >= 2 && !b.log.some(l => /\|-miss\|p1a: Flandre/.test(l)), `Forbidden Barrage: never misses through evasion (${hits} hits)`);
	const learners = dex.species.all().filter(s => (dex.species.getLearnsetData(s.id).learnset || {}).forbiddenbarrage).map(s => s.id);
	ok(learners.includes('flandrescarlet') && learners.every(id => ['flandrescarlet', 'samantha'].includes(id)), `Forbidden Barrage: Flandre's alone (${learners})`);
}
{
	// Every one of the mod's moves is a character's own (the owner, 21 Oct 2026): only its owners
	// learn it (plus Samantha, Mew and Smeargle, who learn everything), and none is a shared move.
	const owners = {
		dreamseal: ['reimuhakurei'], silverdagger: ['sakuyaizayoi'], forbiddenbarrage: ['flandrescarlet'], shikigamirush: ['yukariyakumo'],
		lunaticbullet: ['reiseninaba', 'seiran'], superscope3d: ['nitorikawashiro'], cloudfist: ['ichirinkumoi', 'ichirinkumoiunzan'],
		bodyswap: ['hecatia', 'hecatiaearth', 'hecatiamoon'], sculptedarmor: ['keikihaniyasushin'], missile: ['vivit'],
		wickedenergy: ['kasenibaraki'], fatescall: ['remiliascarlet'],
	};
	for (const move of touhou.MOVE_IDS) {
		const learners = dex.species.all().filter(s => (dex.species.getLearnsetData(s.id).learnset || {})[move]).map(s => s.id).filter(id => !['samantha', 'mew', 'smeargle'].includes(id));
		ok(learners.length && (!owners[move] || learners.every(id => owners[move].includes(id))), `${move}: only its owners learn it (${learners})`);
		ok(!dex.moves.get(move).velvetShared, `${move}: not a shared move, so the builder files it as a signature`);
	}
	const learns = (id, move) => !problems('gen9rptouhou', [{ ...setFor(id), moves: [move] }]).length;
	ok(!learns('metagross', 'Missile') && !learns('regice', 'Sculpted Armor') && !learns('remiliascarlet', 'Cloud Fist'), 'no regular Pokemon or other Boneka keeps one');
}
{
	// Full movepools (touhou.js UNIVERSAL, TYPE_TMS, THEMATIC; the owner, 21 Oct 2026).
	const learnsAll = (id, moves) => problems('gen9rptouhou', [{ ...setFor(id), moves }]);
	for (const id of ALL.filter(id => !dex.species.get(id).battleOnly)) {
		const p = learnsAll(id, ['Toxic', 'Protect', 'Tera Blast', 'Hidden Power Fire']);
		ok(!p.length, `${id} learns Toxic, Protect, Tera Blast and Hidden Power (${p})`);
		const q = learnsAll(id, ['Substitute', 'Return', 'Rest', 'Sleep Talk']);
		ok(!q.length, `${id} learns Substitute, Return, Rest and Sleep Talk (${q})`);
		const size = Object.keys(dex.species.getLearnsetData(id).learnset).length;
		ok(size >= 70, `${id}: a standard-sized movepool (${size} moves)`);
	}
	ok(!learnsAll('rumia', ['Pursuit', 'Knock Off', 'Foul Play', 'Taunt']).length, 'a Dark type gets the Dark kit, Pursuit (a past move) included');
	ok(!learnsAll('remiliascarlet', ['Nasty Plot', 'Swords Dance', 'Shadow Strike', 'Carrion Feast']).length, 'the Scarlets have their set-up, and Shadow Strike is legal now');
	ok(!learnsAll('patchouliknowledge', ['Psyshock', 'Calm Mind', 'Future Sight', 'Trick Room']).length, 'Patchouli has the Psychic kit');
	ok(learnsAll('patchouliknowledge', ['Swords Dance']).length, 'and not Swords Dance (33 Attack: no physical kit)');
	// The table itself: real moves, legal in RP Touhou, nobody's signature.
	global.window = global.window || {};
	require('../client/js/velvet-signatures.js');
	const signatures = new Set(window.VelvetSignatureMoves.lists.flat());
	const ours = new Set(dex.moves.all().filter(m => m.num < 0 && !m.velvetShared).map(m => m.id));
	const tables = [...touhou.UNIVERSAL.filter(m => m !== 'confide'), ...Object.values(touhou.TYPE_TMS).flatMap(k => [...k.status, ...k.physical, ...k.special]),
		...Object.values(touhou.THEMATIC).flat()];
	// The tables still name a few of the mod's moves; the learnsets hook keeps those with their owners.
	for (const id of new Set(tables.filter(m => !touhou.MOVE_IDS.includes(m)))) {
		const m = dex.moves.get(id);
		ok(m.exists && m.id === id && !m.isZ && !m.isMax && (!m.isNonstandard || m.isNonstandard === 'Past'), `${id}: a real, legal move`);
		// Except Lucario's Aura Resonance, which the owner gave every Touhou Pokemon (28 Oct 2026).
		if (id !== 'auraresonance') ok(!signatures.has(id) && !ours.has(id), `${id}: nobody's signature`);
	}
	ok(touhou.SPECIES.every(id => touhou.THEMATIC[id] && touhou.THEMATIC[id].length >= 4), 'every character has its own thematic moves');
}
{
	// PP that shows as a whole number: 8 PP flat, not 8 * 8/5 = 12.8 (the "PP glitch").
	for (const m of dex.moves.all().filter(m => m.num < 0)) {
		const max = m.noPPBoosts ? m.pp : m.pp * 8 / 5;
		ok(Number.isInteger(max), `${m.name}: max PP ${max} is a whole number`);
	}
	const b = battle([mon('Remilia Scarlet', ["Fate's Call"]), mon('Patchouli Knowledge', ['Psychic'], { ability: 'Anemic' })], [mon('Blissey', ['Splash'])]);
	const slot = b.p1.active[0].moveSlots[0];
	ok(slot.pp === 8 && slot.maxpp === 8, `Fate's Call: 8/8 PP in battle (${slot.pp}/${slot.maxpp})`);
	turn(b, 'move 1', 'move 1');
	ok(slot.pp === 7, 'and 7/8 after one use');
	turn(b, 'switch 2', 'move 1');
	turn(b, 'move 1', 'move 1');
	const psychic = b.p1.active[0].moveSlots[0];
	ok(psychic.pp === psychic.maxpp - 2 && b.log.some(l => /\|-activate\|p1a: Patchouli Knowledge\|ability: Anemic/.test(l)), `Anemic: 2 PP a special hit, and said so (${psychic.pp}/${psychic.maxpp})`);
	// Recollection names the moves it borrows, for the client's PP count.
	const r = battle([mon('Satori Komeiji', ['Psychic'], { ability: 'Recollection' })], [mon('Garchomp', ['Earthquake', 'Swords Dance'])]);
	ok(r.log.some(l => /\|-activate\|p1a: Satori Komeiji\|ability: Recollection\|Earthquake, Swords Dance\|\[of\] p2a: Garchomp/.test(l)), 'Recollection: names the borrowed moves');
	ok(r.p1.active[0].moveSlots.filter(m => m.maxpp === 5).length === 2, 'and they have 5 PP each');
}
{
	// Junko can use Hyperspace Fury.
	const b = battle([mon('Junko', ['Hyperspace Fury'], { ability: 'Mold Breaker' })], [mon('Blissey', ['Splash'])]);
	turn(b, 'move 1', 'move 1');
	ok(b.p2.active[0].hp < b.p2.active[0].maxhp, 'Hyperspace Fury works for Junko');
}

// ---- Random Touhou teams play whole battles without the engine throwing.
function rngFrom(seed) {
	let s = seed >>> 0 || 1;
	return k => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return Math.floor((s / 0x100000000) * k); };
}
const ITEMS = ['Leftovers', 'Life Orb', 'Choice Scarf', 'Sitrus Berry', 'Booster Energy', 'Summer Backdoor', 'Jeweled Pagoda', 'Water Stone', 'Moon Stone', 'Heavy-Duty Boots', 'Draco Plate', ''];
const PICKABLE = ALL.filter(id => !dex.species.get(id).battleOnly);
function randomTeam(rng) {
	const team = [];
	while (team.length < 6) {
		const s = dex.species.get(PICKABLE[rng(PICKABLE.length)]);
		if (team.some(t => t.species === s.name)) continue;
		const pool = Object.keys(dex.species.getLearnsetData(s.id).learnset || {});
		const moves = [];
		while (moves.length < Math.min(4, pool.length)) { const m = pool[rng(pool.length)]; if (!moves.includes(m)) moves.push(m); }
		const abilities = Object.values(s.abilities);
		team.push({
			name: s.name, species: s.name, ability: abilities[rng(abilities.length)], item: s.requiredItem || ITEMS[rng(ITEMS.length)],
			moves, nature: 'Hardy', evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 }, level: 100, teraType: s.types[0],
		});
	}
	return team;
}
function randomChoice(req, rng, doubles) {
	if (req.wait) return null;
	if (req.teamPreview) return 'default';
	const bench = () => req.side.pokemon.map((p, i) => [p, i + 1]).filter(([p]) => !p.active && !/ fnt$/.test(p.condition));
	if (req.forceSwitch) {
		const free = bench();
		return req.forceSwitch.map(f => (f && free.length ? `switch ${free.splice(rng(free.length), 1)[0][1]}` : 'pass')).join(', ');
	}
	const free = bench();
	return req.active.map((a, k) => {
		if (req.side.pokemon[k] && / fnt$/.test(req.side.pokemon[k].condition)) return 'pass';
		if (!a.trapped && free.length && rng(8) === 0) return `switch ${free.splice(rng(free.length), 1)[0][1]}`;
		const moves = a.moves.map((m, i) => [m, i + 1]).filter(([m]) => !m.disabled);
		if (!moves.length) return 'move 1';
		const [m, i] = moves[rng(moves.length)];
		let c = `move ${i}`;
		if (doubles && ['normal', 'any', 'adjacentFoe'].includes(m.target)) c += ` ${1 + rng(2)}`;
		if (a.canTerastallize && rng(6) === 0) c += ' terastallize';
		return c;
	}).join(', ');
}
function play(formatid, seed) {
	const rng = rngFrom(seed * 7919);
	const doubles = formatid.includes('doubles');
	const b = new Battle({ formatid, seed: [seed, seed + 1, seed + 2, seed + 3] });
	b.setPlayer('p1', { team: Teams.pack(randomTeam(rng)) });
	b.setPlayer('p2', { team: Teams.pack(randomTeam(rng)) });
	for (let step = 0; step < 2000 && !b.ended; step++) {
		for (const side of b.sides) {
			const req = side.activeRequest;
			if (!req || side.isChoiceDone()) continue;
			const choice = randomChoice(req, rng, doubles);
			if (!choice) continue;
			if (!b.choose(side.id, choice)) b.choose(side.id, 'default');
		}
		if (b.turn > 300) b.tie();
	}
	return b;
}
{
	let games = 0;
	let turns = 0;
	for (let seed = 1; seed <= 30; seed++) {
		const b = play('gen9rpcustomgame', seed);
		ok(b.ended, `Custom Game ${seed} finished (turn ${b.turn})`);
		ok(!b.log.some(l => l.startsWith('|bigerror|')), `Custom Game ${seed}: no engine error in the log`);
		games++; turns += b.turn;
	}
	for (let seed = 101; seed <= 106; seed++) {
		const b = play('gen9rpbattledoubles', seed);
		ok(b.ended, `RP Battle (Doubles) ${seed} finished (turn ${b.turn})`);
		ok(!b.log.some(l => l.startsWith('|bigerror|')), `RP Battle (Doubles) ${seed}: no engine error in the log`);
		games++; turns += b.turn;
	}
	console.log(`  ${games} random Touhou battles, ${turns} turns, no throw`);
}

{
	// The main cast's signatures (touhou.js SIGNATURES; the owner, 21 Oct 2026).
	global.window = global.window || {};
	require('../client/js/velvet-signatures.js');
	const table = window.VelvetSignatureMoves;
	const tableOf = id => table.lists[table.bySpecies[id]] || [];
	ok(Object.keys(touhou.SIGNATURES).length >= 30, `30+ main-cast signatures (${Object.keys(touhou.SIGNATURES).length})`);
	for (const [id, owner] of Object.entries(touhou.SIGNATURES)) {
		const m = dex.moves.get(id);
		ok(m.exists && m.num <= -261, `${id}: exists, numbered from -261`);
		const total = m.basePower * (m.multihit || 1);
		ok(m.category === 'Status' || (total >= 80 && (total <= 130 || id === 'killingdoll')), `${id}: 80 to 130 power, or a status move (${total})`);
		ok(m.accuracy === true || m.accuracy === 100 || (id === 'killingdoll' && m.accuracy === 99), `${id}: 100% accurate or never misses`);
		ok(m.pp === 8 && m.noPPBoosts && !m.recoil && !m.self && !m.flags.recharge && !m.flags.charge && !m.mindBlownRecoil, `${id}: 8 PP, no drawback`);
		ok(m.priority === 0 || id === 'sakuyasworld', `${id}: no priority (Sakuya's time stop excepted)`);
		ok(/'s signature move\.$/.test(m.desc) && m.shortDesc, `${id}: descriptions name its owner`);
		const learners = dex.species.all().filter(s => (dex.species.getLearnsetData(s.id).learnset || {})[id]).map(s => s.id).filter(x => !['samantha', 'mew', 'smeargle'].includes(x));
		ok(learners.length === 1 && learners[0] === owner && dex.species.getLearnsetData(owner).learnset[id].includes('9L1'), `${id}: ${owner}'s alone, at 9L1 (${learners})`);
		ok(!touhou.TMS[id], `${id}: not a machine`);
		ok(tableOf(owner).includes(id), `${id}: in the client's signature table for ${owner}`);
	}
	ok(dex.species.getLearnsetData('reimuhakurei').learnset.dreamseal, 'Reimu keeps Dream Seal');
	const dmg = b => b.p2.active[0].maxhp - b.p2.active[0].hp;
	const once = (mine, theirs, seed) => { const x = battle(mine, theirs, seed); turn(x, 'move 1', 'move 1'); return x; };
	// Sakuya's World: first, even against a faster foe; both knife moves slice.
	let b = once([mon('Sakuya Izayoi', ["Sakuya's World"])], [mon('Regieleki', ['Thunderbolt'])]);
	ok(/Sakuya/.test(b.log.find(l => /^\|move\|/.test(l))), "Sakuya's World: moves before a faster Regieleki");
	ok(dex.moves.get("Sakuya's World").flags.slicing && dex.moves.get('Killing Doll').flags.slicing, 'both of her knife moves are slicing');
	// Killing Doll: up to 20 hits, each one checking accuracy, so a miss ends it early.
	const counts = [];
	for (let seed = 1; seed <= 30; seed++) {
		b = once([mon('Sakuya Izayoi', ['Killing Doll'])], [mon('Dondozo', ['Splash'], { evs: { hp: 252, def: 252 } })], [seed, 7, 3, 4]);
		const line = b.log.find(l => /^\|-hitcount\|/.test(l));
		counts.push(line ? +line.split('|')[3] : 0);
	}
	ok(counts.every(c => c >= 1 && c <= 20) && counts.includes(20), `Killing Doll: 1 to 20 hits, all 20 possible (${counts})`);
	ok(counts.some(c => c < 20), `Killing Doll: stops at a miss (${counts})`);
	// Maid's Trick is Sharpness too: a slicing move does 1.5x.
	const slice = ability => dmg(once([mon('Sakuya Izayoi', ['Night Slash'], { ability })], [mon('Blissey', ['Splash'])]));
	const sharp = slice("Maid's Trick"), plain = slice('Insomnia');
	ok(sharp > plain * 1.4 && sharp < plain * 1.6, `Maid's Trick: slicing moves 1.5x (${sharp} vs ${plain})`);
	// Transistor (unnerfs.js): 1.5x Electric, from Nitori, now Water/Electric.
	const zap = ability => dmg(once([mon('Nitori Kawashiro', ['Thunderbolt'], { ability })], [mon('Blissey', ['Splash'])]));
	const tr = zap('Transistor'), sw = zap('Swift Swim');
	ok(dex.species.get('Nitori Kawashiro').types.join() === 'Water,Electric' && tr > sw * 1.4 && tr < sw * 1.6, `Transistor: 1.5x Electric (${tr} vs ${sw})`);
	// Gale Wings (unnerfs.js): Generation 6, +1 priority at any HP.
	b = battle([mon('Talonflame', ['Brave Bird'], { ability: 'Gale Wings' })], [mon('Regieleki', ['Splash'])]);
	b.p1.active[0].sethp(Math.floor(b.p1.active[0].maxhp / 2));
	turn(b, 'move 1', 'move 1');
	ok(/Talonflame/.test(b.log.find(l => /^\|move\|/.test(l))), 'Gale Wings: Brave Bird first at half HP');
	// Rainbow Wind Chime: the most damaging colour.
	const chime = foe => once([mon('Hong Meiling', ['Rainbow Wind Chime'])], [mon(foe, ['Splash'])]);
	ok(chime('Gyarados').log.some(l => /-supereffective/.test(l)), 'Rainbow Wind Chime: super effective on Gyarados');
	ok(dmg(chime('Gengar')) > 0, 'Rainbow Wind Chime: no Fighting into a Ghost (Dragon lands on Gengar)');
	ok(chime('Blissey').log.some(l => /-supereffective/.test(l)), 'Rainbow Wind Chime: Fighting on Blissey');
	// Fantasy Seal: hits a Ghost, and seals its boosts away.
	b = battle([mon('Reimu Hakurei', ['Fantasy Seal'])], [mon('Gengar', ['Nasty Plot'], { evs: { spe: 252 } })]);
	turn(b, 'move 1', 'move 1');
	ok(dmg(b) > 0 && !b.p2.active[0].boosts.spa, 'Fantasy Seal: hits a Ghost and clears its Nasty Plot');
	// Expanded Onbashira: Stealth Rock. Missing Power: through Protect.
	b = once([mon('Kanako Yasaka', ['Expanded Onbashira'])], [mon('Blissey', ['Splash'])]);
	ok(b.p2.sideConditions.stealthrock, 'Expanded Onbashira: Stealth Rock on the target side');
	b = once([mon('Suika Ibuki', ['Missing Power'])], [mon('Blissey', ['Protect'], { evs: { spe: 252 } })]);
	ok(dmg(b) > 0, 'Missing Power: breaks through Protect');
	// The healers: Hourai Elixir, Phoenix Rebirth, Resurrection Butterfly.
	b = battle([mon('Eirin Yagokoro', ['Hourai Elixir'])], [mon('Blissey', ['Seismic Toss'], { evs: { spe: 252 } })]);
	turn(b, 'move 1', 'move 1');
	ok(b.p1.active[0].hp === b.p1.active[0].maxhp, `Hourai Elixir: heals (${b.p1.active[0].hp}/${b.p1.active[0].maxhp})`);
	b = battle([mon('Fujiwara no Mokou', ['Phoenix Rebirth'])], [mon('Toxapex', ['Toxic'])]);
	turn(b, 'move 1', 'move 1');
	turn(b, 'move 1', 'move 1');
	ok(b.log.some(l => /^\|-curestatus\|p1a: Fujiwara no Mokou\|tox/.test(l)) && b.log.some(l => /^\|-heal\|p1a: Fujiwara no Mokou/.test(l)), 'Phoenix Rebirth: cures and heals the user');
	// Change Air Brave: inverse - super effective on a Fighting type.
	b = once([mon('Seija Kijin', ['Change Air Brave'])], [mon('Machamp', ['Splash'])]);
	ok(b.log.some(l => /-supereffective/.test(l)), 'Change Air Brave: super effective on Machamp');
	// Pure Light of the Palm: hits a Ghost. Undefined UFO: neutral on a Dark resist.
	ok(dmg(once([mon('Junko', ['Pure Light of the Palm'])], [mon('Gengar', ['Splash'])])) > 0, 'Pure Light of the Palm: hits a Ghost');
	b = once([mon('Nue Houjuu', ['Undefined UFO'])], [mon('Hydreigon', ['Splash'])]);
	ok(dmg(b) > 0 && !b.log.some(l => /-resisted|-supereffective/.test(l)), 'Undefined UFO: typeless, neutral on Hydreigon');
	// Elekiter Dragon Palace: hits a Ground type.
	ok(dmg(once([mon('Iku Nagae', ['Elekiter Dragon Palace'])], [mon('Garchomp', ['Splash'])])) > 0, 'Elekiter Dragon Palace: hits Garchomp');
	// Terrible Souvenir: disables the last move.
	b = battle([mon('Satori Komeiji', ['Terrible Souvenir'])], [mon('Blissey', ['Calm Mind', 'Protect'])]);
	turn(b, 'move 1', 'move 1');
	turn(b, 'move 1', 'move 1');
	ok(b.p2.active[0].volatiles.disable, 'Terrible Souvenir: disables what the target used');
	// Artful Sacrifice (Puppet Summon): a free substitute after the hit, never a second one.
	b = battle([mon('Alice Margatroid', ['Artful Sacrifice'])], [mon('Blissey', ['Splash'])]);
	turn(b, 'move 1', 'move 1');
	const alice = b.p1.active[0];
	ok(alice.volatiles.substitute && alice.hp === alice.maxhp && alice.volatiles.substitute.hp === Math.floor(alice.maxhp / 4), 'Artful Sacrifice: a full substitute at no HP cost');
	alice.volatiles.substitute.hp = 1;
	turn(b, 'move 1', 'move 1');
	ok(alice.volatiles.substitute.hp === 1, 'Artful Sacrifice: keeps the doll she has, no refill');
	ok(/TYPE_CHOOSERS/.test(fs.readFileSync(path.join(ROOT, 'src', 'ai.js'), 'utf8')), "the bot's estimate knows the type-choosing signatures");
}
console.log(`touhou: ${n} checks passed`);
