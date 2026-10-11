'use strict';
/**
 * What Game Freak owes the box-art and Uber legendaries (the owner, 10 Oct 2026: "grant
 * all Uber legendary/box art legendary the stuff gamefreak owe them... and some of the
 * new moves that make sense, like carrion on yveltal").
 *
 * Mostly the recovery each one obviously should have had, then the shared moves of
 * ours that fit its type and job. Nothing is taken away. The creation trio's are in
 * creation-trio.js; Makuro, Raishin and Chimai already have wide movepools of ours.
 * A form that reads its base form's learnset (Zygarde-10%, the Origin forms) gets the
 * base form's grant; Kyurem-Black and -White have learnsets of their own, so they are
 * listed. Handed out by buildBuffs (balance-patch-1.js), after the pre-evolution pass.
 */
exports.GRANTS = {
	mewtwo: ['hypnowhirl'],
	lugia: ['undertow'],
	hooh: ['morningsun'],
	kyogre: ['recover', 'undertow'],
	groudon: ['shoreup', 'craghammer'],
	rayquaza: ['roost'],
	reshiram: ['calmmind'],
	zekrom: ['voltaiclance'],
	kyurem: ['rimecleaver'],
	kyuremblack: ['rimecleaver', 'chillingmist'],
	kyuremwhite: ['chillingmist'],
	xerneas: ['moonlight', 'penance'],
	yveltal: ['carrionfeast'],
	zygarde: ['shoreup', 'craghammer'],
	marshadow: ['shufflejab'],
	eternatus: ['oxidize'],
	chienpao: ['rimecleaver', 'carrionfeast'],
	koraidon: ['shufflejab'],
	terapagos: ['slackoff'],
};

/**
 * Learn every machine move Mew does (the owner, 11 Oct 2026: "give all tms to arceus
 * like mew"): every move Mew's learnset has as a TM in any generation, plus the moves
 * of ours Mew gets like machines. Read off Mew's learnset when the dex loads, so the
 * list follows Mew. Arceus' type forms use Arceus' learnset, so they get it too.
 * Handed out by applyBuffs (buffs.js).
 */
exports.LIKE_MEW = ['arceus'];
