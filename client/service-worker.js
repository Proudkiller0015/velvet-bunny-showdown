/**
 * The smallest service worker that still makes this installable.
 *
 * Android will not offer "Install app" without one, and an installed client is
 * the whole point on a phone: extensions do not exist there, so a browser tab
 * is otherwise all anyone gets.
 *
 * It deliberately caches nothing. Everything here either comes from Showdown's
 * CDN, which does its own caching, or is stamped with a build id and must be
 * allowed to change the moment it is deployed - a cache would put us straight
 * back to the day browsers kept serving yesterday's client. The fetch handler
 * exists because the installability check requires one, and it does the one
 * useful thing it can: says something legible when the network is gone.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
	if (event.request.mode !== 'navigate') return;
	event.respondWith(
		fetch(event.request).catch(() => new Response(
			'<!DOCTYPE html><meta charset="utf-8" /><title>Offline</title>' +
			'<p style="font:16px/1.5 system-ui;padding:2em">You are offline. ' +
			'Velvet Bunny needs a connection - it is a battle server, after all.</p>',
			{ headers: { 'Content-Type': 'text/html; charset=utf-8' } }
		))
	);
});
