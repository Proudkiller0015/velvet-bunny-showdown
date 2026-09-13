/**
 * Teams and preferences, without the iframe that never answers.
 *
 * The client keeps teams and settings in localStorage on Showdown's own domain,
 * so they follow you between servers. A client served from anywhere else
 * reaches them through a hidden `crossdomain.php` iframe on that domain - and
 * Showdown answers that only for hosts they route, which does not include ours.
 * The iframe comes back empty, nothing ever posts back, and the client waits on
 * it for the rest of the session: no teams, no settings, and everything that
 * queues behind them stuck with it.
 *
 * So this client keeps them the way any other website would: in this site's own
 * localStorage. Every read and write in the client already goes there - the
 * cross-domain path is a *detour*, not the mechanism - so all that is needed is
 * to skip the detour and tell the client its data has arrived.
 *
 * This has to clean up rather than prevent, because storage.js calls
 * `Storage.initialize()` on its own last line: by the time any script of ours
 * can run, the iframe is already in the page.
 *
 * The one real cost: teams built here stay here. They are not the teams you
 * have on play.pokemonshowdown.com, and the import/export box is how you move
 * one across. That is the honest trade for a client that works at all.
 */
(function () {
	'use strict';

	if (typeof Storage === 'undefined' || !Storage.initPrefs) return;

	/** The same thing the client does when it is served by Showdown themselves. */
	function loadLocally() {
		// Remove the iframe rather than leave it: it is a request to another
		// origin that can only ever fail, on every single page load.
		var frames = document.querySelectorAll('iframe[src*="crossdomain.php"]');
		for (var i = 0; i < frames.length; i++) frames[i].remove();

		if (!Storage.teams) Storage.loadTeams();
		Config.server = Config.server || Config.defaultserver;

		// Load-trackers: everything waiting on prefs or teams is queued until
		// these fire, which is why an iframe that never answers leaves the client
		// half-started. Firing twice is harmless - they only run once.
		Storage.whenPrefsLoaded.load();
		if (!window.nodewebkit) Storage.whenTeamsLoaded.load();
	}

	// For the call that already happened, at the end of storage.js.
	loadLocally();

	// And for any later one - a reconnect, or a client that calls it twice.
	Storage.initPrefs = function () {
		Storage.loadTeams();
		loadLocally();
	};
})();
