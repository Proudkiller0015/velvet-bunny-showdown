'use strict';
/**
 * Nuzleaf-SOLD's sprites.
 *
 *   node scripts/make-nuzleaf-sold.js
 *
 * Two problems with the first attempt, both from the same mistake: the art was
 * cropped to its own edges and served at whatever size that came out, 86x96.
 * Every sprite Showdown draws is a **96x96 canvas with the Pokemon standing in
 * a particular place inside it**, and everything that draws one - the battle
 * scene, the little list icon, the teambuilder's set box - assumes exactly
 * that. A tightly cropped image is therefore too big, sits too low, and is
 * wrong in a different way in each of the three places. The teambuilder is
 * simply where it showed first.
 *
 * So the front is composed into a real 96x96 canvas, standing where the real
 * Nuzleaf stands: its drawing occupies x 27-69, y 20-75, measured from
 * gen5/nuzleaf.png rather than guessed, and ours is scaled to the same height
 * and stood on the same floor.
 *
 * The back is Nuzleaf's own back sprite with the rope added at the neck, which
 * is what you would actually see from behind - the sign hangs on the far side.
 * The first version was the front mirrored, which shows you its face from
 * behind and was never going to be right.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'client', 'sprites');
const SOURCE = path.join(ROOT, '..', 'reference', 'sprite-sources', 'nuzleaf-sold.png');
const CDN = 'https://play.pokemonshowdown.com/sprites/';

/**
 * Where Nuzleaf stands inside its own canvas, measured from the real sprite.
 *
 * Written down rather than read at build time only because it is the shape of
 * the whole file; re-measure with any image and these are the four numbers that
 * come out. Feet at 75, head at 20, centred on 48.
 */
const FLOOR = 76;      // one below its lowest pixel, so ours stands on the same line
const HEIGHT = 58;     // a shade taller than Nuzleaf's 56: it is holding a sign up
const CENTRE = 48;

/**
 * The rope, on the back view.
 *
 * `y` was chosen by drawing it at six heights and looking at them. The row
 * widths are no help here: Nuzleaf from behind is mostly head, and the step in
 * width that looks like a neck is the point where its *arms* flare out, three
 * rows below the top of a head that goes on for another ten. Drawn there it is
 * a headband. 47 is the line where the head actually meets the shoulders.
 *
 * The span is read off the sprite rather than written down - the widest run of
 * Pokemon on that row, pulled in at both ends so the rope passes behind the
 * arms instead of across them.
 */
const ROPE = {
	y: 47,
	inset: 6,
	light: '#96683f',
	dark: '#4a3423',
};

function chrome() {
	const found = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
		'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
		'/usr/bin/google-chrome'].find(fs.existsSync);
	if (!found) { console.error('Could not find Chrome. Set CHROME.'); process.exit(1); }
	return found;
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nuzleaf-'));
fs.copyFileSync(SOURCE, path.join(work, 'art.png'));
for (const [file, url] of [['back.png', 'gen5-back/nuzleaf.png'], ['front.png', 'gen5/nuzleaf.png']]) {
	execFileSync('curl', ['-sS', '-o', path.join(work, file), CDN + url]);
}

fs.writeFileSync(path.join(work, 'render.html'), `<!doctype html>
<meta charset="utf-8"><title>n</title><div id="OUT">pending</div>
<script>
var FLOOR = ${FLOOR}, HEIGHT = ${HEIGHT}, CENTRE = ${CENTRE};
var ROPE = ${JSON.stringify(ROPE)};
var out = {};

var TO_LINEAR = new Float32Array(256);
for (var i = 0; i < 256; i++) {
	var v = i / 255;
	TO_LINEAR[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function toSrgb(v) {
	var c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
	return Math.max(0, Math.min(255, Math.round(c * 255)));
}

function load(file) {
	return new Promise(function (resolve, reject) {
		var img = new Image();
		img.onload = function () { resolve(img); };
		img.onerror = function () { reject(new Error('could not read ' + file)); };
		img.src = file;
	});
}

function pixels(img) {
	var c = document.createElement('canvas');
	c.width = img.width; c.height = img.height;
	var ctx = c.getContext('2d');
	ctx.drawImage(img, 0, 0);
	return { w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data };
}

/** Background out (flood fill from the edges), then the bounding box. */
function trim(src) {
	var w = src.w, h = src.h, d = src.data;
	var corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(function (p) {
		var i = (p[1] * w + p[0]) * 4;
		return [d[i], d[i + 1], d[i + 2], d[i + 3]];
	});
	var key = [0, 1, 2, 3].map(function (ch) {
		var vals = corners.map(function (v) { return v[ch]; }).sort(function (a, b) { return a - b; });
		return Math.round((vals[1] + vals[2]) / 2);
	});
	var keyed = key[3] > 8;
	var bg = new Uint8Array(w * h), stack = [];
	function near(i) {
		return Math.abs(d[i] - key[0]) <= 40 && Math.abs(d[i + 1] - key[1]) <= 40 && Math.abs(d[i + 2] - key[2]) <= 40;
	}
	function push(x, y) {
		if (x < 0 || y < 0 || x >= w || y >= h) return;
		var p = y * w + x;
		if (bg[p]) return;
		var i = p * 4;
		if (d[i + 3] <= 8 || (keyed && near(i))) { bg[p] = 1; stack.push(x, y); }
	}
	for (var x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
	for (var y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
	while (stack.length) {
		var yy = stack.pop(), xx = stack.pop();
		push(xx + 1, yy); push(xx - 1, yy); push(xx, yy + 1); push(xx, yy - 1);
	}
	for (var p = 0; p < w * h; p++) if (bg[p]) d[p * 4 + 3] = 0;

	var minX = w, minY = h, maxX = -1, maxY = -1;
	for (var y2 = 0; y2 < h; y2++) {
		for (var x2 = 0; x2 < w; x2++) {
			if (d[(y2 * w + x2) * 4 + 3] > 8) {
				if (x2 < minX) minX = x2; if (x2 > maxX) maxX = x2;
				if (y2 < minY) minY = y2; if (y2 > maxY) maxY = y2;
			}
		}
	}
	return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Box-average the source region down, in linear light, into a 96x96 canvas. */
function stand(src, box, dw, dh, dx, dy) {
	var canvas = document.createElement('canvas');
	canvas.width = 96; canvas.height = 96;
	var ctx = canvas.getContext('2d');
	var dest = ctx.createImageData(dw, dh);
	var dst = dest.data;
	for (var y = 0; y < dh; y++) {
		var sy0 = box.y + Math.floor(y * box.h / dh);
		var sy1 = Math.max(sy0 + 1, box.y + Math.floor((y + 1) * box.h / dh));
		for (var x = 0; x < dw; x++) {
			var sx0 = box.x + Math.floor(x * box.w / dw);
			var sx1 = Math.max(sx0 + 1, box.x + Math.floor((x + 1) * box.w / dw));
			var r = 0, g = 0, b = 0, a = 0, n = 0;
			for (var sy = sy0; sy < sy1; sy++) {
				for (var sx = sx0; sx < sx1; sx++) {
					var i = (sy * src.w + sx) * 4;
					var alpha = src.data[i + 3] / 255;
					r += TO_LINEAR[src.data[i]] * alpha;
					g += TO_LINEAR[src.data[i + 1]] * alpha;
					b += TO_LINEAR[src.data[i + 2]] * alpha;
					a += alpha; n++;
				}
			}
			var o = (y * dw + x) * 4;
			if (a > 0) { dst[o] = toSrgb(r / a); dst[o + 1] = toSrgb(g / a); dst[o + 2] = toSrgb(b / a); }
			dst[o + 3] = Math.round(a / n * 255);
		}
	}
	var tmp = document.createElement('canvas');
	tmp.width = dw; tmp.height = dh;
	tmp.getContext('2d').putImageData(dest, 0, 0);
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(tmp, dx, dy);
	return canvas;
}

/**
 * The rope, drawn across the neck and over both shoulders.
 *
 * Two pixels tall: a dark line with a lighter one on top of it, which at this
 * size is what reads as a cord rather than a smudge. The ends turn downwards
 * where the rope passes over the shoulder and out of sight.
 */
function addRope(img) {
	var canvas = document.createElement('canvas');
	canvas.width = 96; canvas.height = 96;
	var ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(img, 0, 0);

	var y = ROPE.y;
	// Only where the Pokemon actually is, so the rope never hangs in mid-air.
	var row = ctx.getImageData(0, y, 96, 3).data;
	function solid(x, dy) { return row[((dy * 96) + x) * 4 + 3] > 8; }

	var first = -1, last = -1;
	for (var x = 0; x < 96; x++) if (solid(x, 0)) { if (first < 0) first = x; last = x; }
	var from = first + ROPE.inset, to = last - ROPE.inset;

	ctx.fillStyle = ROPE.dark;
	for (var x2 = from; x2 <= to; x2++) if (solid(x2, 1)) ctx.fillRect(x2, y + 1, 1, 1);
	ctx.fillStyle = ROPE.light;
	for (var x3 = from; x3 <= to; x3++) if (solid(x3, 0)) ctx.fillRect(x3, y, 1, 1);

	// And a pixel at each end turning towards the front, where the sign hangs.
	ctx.fillStyle = ROPE.dark;
	ctx.fillRect(from - 1, y + 1, 1, 1);
	ctx.fillRect(to + 1, y + 1, 1, 1);
	return canvas;
}

Promise.all([load('art.png'), load('back.png'), load('front.png')]).then(function (images) {
	var art = pixels(images[0]);
	var box = trim(art);
	var height = HEIGHT;
	var width = Math.max(1, Math.round(box.w * (height / box.h)));
	var front = stand(art, box, width, height, Math.round(CENTRE - width / 2), FLOOR - height);
	out.front = { png: front.toDataURL('image/png'), size: width + 'x' + height };

	var back = addRope(images[1]);
	out.back = { png: back.toDataURL('image/png'), size: '96x96' };

	// The list icon, cut from the finished front so the two always agree.
	var iconBox = { x: 0, y: 0, w: 96, h: 96 };
	var iconSrc = pixels(front);
	var tight = trim(iconSrc);
	var icon = document.createElement('canvas');
	icon.width = 40; icon.height = 30;
	var ictx = icon.getContext('2d');
	ictx.imageSmoothingEnabled = false;
	var scale = Math.min(40 / tight.w, 30 / tight.h);
	var iw = Math.round(tight.w * scale), ih = Math.round(tight.h * scale);
	ictx.drawImage(front, tight.x, tight.y, tight.w, tight.h,
		Math.round((40 - iw) / 2), Math.round((30 - ih) / 2), iw, ih);
	out.icon = { png: icon.toDataURL('image/png'), size: '40x30' };

	document.getElementById('OUT').textContent = 'RESULT:' + JSON.stringify(out);
}).catch(function (e) {
	document.getElementById('OUT').textContent = 'RESULT:' + JSON.stringify({ error: String(e && e.message || e) });
});
</script>
`);

let dom;
try {
	dom = execFileSync(chrome(), [
		'--headless=new', '--disable-gpu', '--allow-file-access-from-files',
		'--virtual-time-budget=25000', '--dump-dom',
		'file:///' + path.join(work, 'render.html').split(path.sep).join('/'),
	], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
	console.error('Chrome failed: ' + e.message);
	process.exit(1);
}

const match = /RESULT:(\{[\s\S]*?\})</.exec(dom);
if (!match) { console.error('nothing rendered'); process.exit(1); }
const result = JSON.parse(match[1]);
if (result.error) { console.error(result.error); process.exit(1); }

const names = { front: 'nuzleaf-sold.png', back: 'nuzleaf-sold-back.png', icon: 'nuzleaf-sold-icon.png' };
for (const [which, data] of Object.entries(result)) {
	const file = path.join(OUT, names[which]);
	fs.writeFileSync(file, Buffer.from(data.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
	console.log(`${names[which].padEnd(24)} ${data.size.padEnd(8)} ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
}
console.log(`standing where Nuzleaf stands: feet at ${FLOOR - 1}, ${HEIGHT} tall, centred on ${CENTRE}`);
try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { /* temp */ }
