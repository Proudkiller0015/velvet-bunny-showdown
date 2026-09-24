'use strict';
/**
 * The replay store's memory cache stays bounded by bytes as well as count,
 * and the blob shas are trimmed with it (24 Sep 2026). No network: without a
 * token the store keeps replays in memory and in its spool only.
 *
 *   node test/replay-cache.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const spool = fs.mkdtempSync(path.join(os.tmpdir(), 'velvet-replay-test-'));
process.env.REPLAY_SPOOL = spool;
process.env.REPLAY_CACHE_MB = '0.1';      // ~100KB
process.env.REPLAY_CACHE = '200';

const { ReplayStore } = require('../src/replay-store');

try {
	const store = new ReplayStore();
	store.token = '';
	for (let i = 0; i < 60; i++) {
		store.remember({ id: `r${i}`, log: 'x'.repeat(5000) });
		store.shas.set(`r${i}`, `sha${i}`);
	}
	assert.ok(store.cacheBytes <= 0.1 * 1048576, `cache holds ${store.cacheBytes} bytes`);
	assert.ok(store.cache.size < 60 && store.cache.size > 10, `cache holds ${store.cache.size} replays`);
	assert.ok(store.cache.has('r59'), 'the newest replay is kept');
	assert.ok(!store.cache.has('r0'), 'the oldest replay is evicted');
	assert.ok(!store.shas.has('r0'), 'its sha goes with it');
	assert.strictEqual(store.sizes.size, store.cache.size);

	// Evicted from memory is not lost: the spool still serves it.
	store.get('r0').then(replay => {
		assert.ok(replay && replay.id === 'r0', 'an evicted replay comes back from the spool');
		assert.ok(store.cacheBytes <= 0.1 * 1048576);
		console.log('replay cache: all passed');
		fs.rmSync(spool, { recursive: true, force: true });
	}).catch(e => {
		console.log(`FAIL ${e.message}`);
		fs.rmSync(spool, { recursive: true, force: true });
		process.exit(1);
	});
} catch (e) {
	console.log(`FAIL ${e.message}`);
	fs.rmSync(spool, { recursive: true, force: true });
	process.exit(1);
}
