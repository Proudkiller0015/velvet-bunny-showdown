/**
 * Two things the client gets wrong on a phone.
 *
 * Below 700px it switches to a layout built for one panel at a time: the room
 * list becomes a 280px drawer sitting to the *left* of the room, and the page
 * is made that much wider than the screen so you can swipe between them. The
 * design is sound. What is wrong is where it starts - scrolled all the way
 * left, on the drawer - so the first thing a phone shows is a list of rooms
 * with the actual client hanging off the right edge. Every visitor's first
 * impression is of something broken.
 *
 * So: land on the room, with the drawer one swipe away, which is what the
 * client itself does every other time it changes rooms.
 *
 * The second thing is upstream's beta notice, which offers "Back to the old
 * client" - a button that does nothing useful here, since this *is* the client,
 * and which takes up a third of a phone screen to say so. It is hidden in
 * velvet-mobile.css; the news underneath it is ours and stays.
 */
(function () {
	'use strict';

	function showRoom() {
		try {
			if (!window.PSView || !PSView.narrowMode) return;
			PSView.scrollToRoom();
		} catch (e) {
			// The client is still starting up; the next attempt will catch it.
		}
	}

	// Three attempts, because the layout is only decided once the client has
	// worked out its panels, and that happens after the window's load event on a
	// slow connection. They cost nothing: scrollToRoom does nothing when the
	// room is already in view.
	function nudge() {
		showRoom();
		setTimeout(showRoom, 250);
		setTimeout(showRoom, 1200);
	}

	if (document.readyState === 'complete') nudge();
	else window.addEventListener('load', nudge);

	// Rotating a phone re-decides the layout, and lands on the drawer again.
	var timer = null;
	window.addEventListener('resize', function () {
		clearTimeout(timer);
		timer = setTimeout(showRoom, 200);
	});
})();
