'use strict';
/**
 * The trained brain: search weights produced by self-play on a real machine.
 *
 * Training happens on a PC, not on the server. The host this runs on has 512MB
 * and a disk that is wiped on every restart, so learning *there* would be both
 * cramped and forgotten. Instead `npm run train` plays the bot against itself
 * locally, tunes the weights against actual results, and writes data/brain.json;
 * committing and deploying that file is what makes the server smarter.
 *
 * With no brain.json present the search falls back to its hand-set defaults, so
 * a fresh checkout still plays - just untrained.
 */

const fs = require('fs');
const path = require('path');

const BRAIN_PATH = process.env.PS_BRAIN || path.join(__dirname, '..', 'data', 'brain.json');

const EMPTY = {
	weights: null,          // null means "use the search defaults"
	trained: false,
	games: 0,
	generation: 0,
	winRateVsBaseline: null,
	updatedAt: null,
};

let cached = null;

function loadBrain(file = BRAIN_PATH) {
	if (cached && cached.__file === file) return cached;
	let brain = { ...EMPTY };
	try {
		const raw = fs.readFileSync(file, 'utf8');
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && parsed.weights) {
			brain = { ...EMPTY, ...parsed, trained: true };
		}
	} catch (e) {
		// No brain yet, or it is unreadable: the defaults are a fine starting point.
	}
	brain.__file = file;
	cached = brain;
	return brain;
}

function saveBrain(brain, file = BRAIN_PATH) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const out = { ...brain, updatedAt: new Date().toISOString() };
	delete out.__file;
	fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
	cached = null;
	return out;
}

/** A one-line summary for the boot log, so a deploy says what brain it has. */
function describeBrain(brain = loadBrain()) {
	if (!brain.trained) return 'brain: untrained (search using default weights)';
	const rate = brain.winRateVsBaseline === null ? '?' : `${Math.round(brain.winRateVsBaseline)}%`;
	return `brain: generation ${brain.generation}, ${brain.games} self-play games, ${rate} vs baseline`;
}

module.exports = { loadBrain, saveBrain, describeBrain, BRAIN_PATH };
