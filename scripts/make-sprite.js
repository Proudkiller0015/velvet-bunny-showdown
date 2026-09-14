'use strict';
/**
 * Turn a piece of artwork into a sprite this server serves.
 *
 *   node scripts/make-sprite.js <source> <name> <height> [flip]
 *   node scripts/make-sprite.js art/nuzleaf.png nuzleaf-sold 96
 *   node scripts/make-sprite.js art/nuzleaf.png nuzleaf-sold-back 104 flip
 *
 * Writes client/sprites/<name>.png, which the client asks for by URL - see
 * installSprites(), installIcon() and installItemIcon() in
 * client/js/velvet-data.js, all three of which point a species or an item at
 * this folder instead of at Showdown's CDN.
 *
 * This is the generalisation of build-samantha-sprites.js, which did the same
 * job for one Pokemon with the two file names written into it. Everything that
 * matters is the same, and it matters for the same reasons:
 *
 * **Scaled in linear light.** sRGB values are not brightness - averaging two of
 * them the way they are stored drags saturated colour towards grey, which on
 * artwork that is mostly saturated colour is the difference between a sprite and
 * a smudge.
 *
 * **Box-averaged, not nearest-neighbour.** These are pixel-*styled* pictures
 * rendered large rather than real pixel art blown up, so there is no native grid
 * to land on; at ten to one, nearest-neighbour throws away ninety-nine pixels in
 * a hundred and usually takes an eye with them.
 *
 * **Background keyed by flood fill from the edges, not by colour.** Artwork
 * arrives on white as often as on transparency, and a rule as simple as "white
 * is background" eats the whites inside the picture - the eyes, the sign, the
 * price tag. Filling inwards from the border only removes what is connected to
 * the outside, which is what "background" actually means.
 *
 * Rendered through headless Chrome because canvas is the one image pipeline on
 * this machine; there is no image library in the dependencies and a sprite every
 * few weeks does not justify adding one.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [, , sourceArg, nameArg, heightArg, flipArg] = process.argv;
if (!sourceArg || !nameArg || !heightArg) {
	console.error('usage: node scripts/make-sprite.js <source> <name> <height> [flip]');
	console.error('   eg: node scripts/make-sprite.js art/nuzleaf.png nuzleaf-sold 96');
	process.exit(1);
}
const height = Number(heightArg);
const flip = flipArg === 'flip';

// How far from the border colour a pixel may be and still count as background.
// Generous, because these are lossy PNGs of flat colour: the "white" around the
// figure is a cloud of near-whites.
const TOLERANCE = Number(process.env.SPRITE_KEY || 40);

function findChrome() {
	for (const candidate of [
		process.env.CHROME,
		'C:/Program Files/Google/Chrome/Application/chrome.exe',
		'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/usr/bin/google-chrome',
	].filter(Boolean)) if (fs.existsSync(candidate)) return candidate;
	return null;
}
const chrome = findChrome();
if (!chrome) { console.error('Could not find Chrome. Set CHROME.'); process.exit(1); }

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sprite-'));
fs.copyFileSync(path.resolve(sourceArg), path.join(work, 'in.png'));

fs.writeFileSync(path.join(work, 'render.html'), `<!doctype html>
<meta charset="utf-8"><title>s</title><div id="OUT">pending</div>
<script>
const TARGET_H = ${height};
const FLIP = ${flip};
const TOLERANCE = ${TOLERANCE};

const TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
	const v = i / 255;
	TO_LINEAR[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
const toSrgb = v => {
	const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
	return Math.max(0, Math.min(255, Math.round(c * 255)));
};

const img = new Image();
img.onload = () => {
	const w = img.width, h = img.height;
	const c = document.createElement('canvas');
	c.width = w; c.height = h;
	const ctx = c.getContext('2d');
	ctx.drawImage(img, 0, 0);
	const src = ctx.getImageData(0, 0, w, h).data;

	// The border colour, taken as the median of the four corners so one stray
	// pixel cannot decide what the background is.
	const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => {
		const i = (y * w + x) * 4;
		return [src[i], src[i + 1], src[i + 2], src[i + 3]];
	});
	const key = [0, 1, 2, 3].map(ch => {
		const vals = corners.map(v => v[ch]).sort((a, b) => a - b);
		return Math.round((vals[1] + vals[2]) / 2);
	});
	const keyed = key[3] > 8;   // a transparent border needs no keying at all

	// Flood fill inwards. Only what touches the edge is background; the same
	// colour enclosed by the figure is part of the picture.
	const bg = new Uint8Array(w * h);
	const stack = [];
	const near = i =>
		Math.abs(src[i] - key[0]) <= TOLERANCE &&
		Math.abs(src[i + 1] - key[1]) <= TOLERANCE &&
		Math.abs(src[i + 2] - key[2]) <= TOLERANCE;
	const push = (x, y) => {
		if (x < 0 || y < 0 || x >= w || y >= h) return;
		const p = y * w + x;
		if (bg[p]) return;
		const i = p * 4;
		if (src[i + 3] <= 8 || (keyed && near(i))) { bg[p] = 1; stack.push(x, y); }
	};
	for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
	for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
	while (stack.length) {
		const y = stack.pop(), x = stack.pop();
		push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
	}
	for (let p = 0; p < w * h; p++) if (bg[p]) src[p * 4 + 3] = 0;

	// What is left is the picture; crop to it.
	let minX = w, minY = h, maxX = -1, maxY = -1;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (src[(y * w + x) * 4 + 3] > 8) {
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
	}
	if (maxX < 0) { document.getElementById('OUT').textContent = 'RESULT:{"error":"nothing left after keying"}'; return; }

	const cw = maxX - minX + 1, ch = maxY - minY + 1;
	const dh = Math.max(1, TARGET_H);
	const dw = Math.max(1, Math.round(cw * (dh / ch)));

	const outC = document.createElement('canvas');
	outC.width = dw; outC.height = dh;
	const octx = outC.getContext('2d');
	const dest = octx.createImageData(dw, dh);
	const dst = dest.data;
	for (let dy = 0; dy < dh; dy++) {
		const sy0 = minY + Math.floor(dy * ch / dh);
		const sy1 = Math.max(sy0 + 1, minY + Math.floor((dy + 1) * ch / dh));
		for (let dx = 0; dx < dw; dx++) {
			// Mirrored by reading the source backwards rather than by flipping the
			// canvas afterwards, which would resample everything a second time.
			const rx = FLIP ? dw - 1 - dx : dx;
			const sx0 = minX + Math.floor(rx * cw / dw);
			const sx1 = Math.max(sx0 + 1, minX + Math.floor((rx + 1) * cw / dw));
			let r = 0, g = 0, b = 0, a = 0, n = 0;
			for (let y = sy0; y < sy1; y++) {
				for (let x = sx0; x < sx1; x++) {
					const i = (y * w + x) * 4;
					const alpha = src[i + 3] / 255;
					r += TO_LINEAR[src[i]] * alpha;
					g += TO_LINEAR[src[i + 1]] * alpha;
					b += TO_LINEAR[src[i + 2]] * alpha;
					a += alpha; n++;
				}
			}
			const o = (dy * dw + dx) * 4;
			if (a > 0) { dst[o] = toSrgb(r / a); dst[o + 1] = toSrgb(g / a); dst[o + 2] = toSrgb(b / a); }
			dst[o + 3] = Math.round(a / n * 255);
		}
	}
	octx.putImageData(dest, 0, 0);
	document.getElementById('OUT').textContent = 'RESULT:' + JSON.stringify({
		w: dw, h: dh, source: w + 'x' + h, kept: cw + 'x' + ch, keyed: keyed,
		png: outC.toDataURL('image/png'),
	});
};
img.onerror = () => { document.getElementById('OUT').textContent = 'RESULT:{"error":"could not read the source"}'; };
img.src = 'in.png';
</script>
`);

let dom;
try {
	dom = execFileSync(chrome, [
		'--headless=new', '--disable-gpu', '--allow-file-access-from-files',
		'--virtual-time-budget=20000', '--dump-dom',
		'file:///' + path.join(work, 'render.html').replace(/\\/g, '/'),
	], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
	console.error('Chrome failed: ' + e.message);
	process.exit(1);
}

const match = /RESULT:(\{[\s\S]*?\})</.exec(dom);
if (!match) { console.error('nothing rendered'); process.exit(1); }
const result = JSON.parse(match[1]);
if (result.error) { console.error(result.error); process.exit(1); }

const dest = path.join(__dirname, '..', 'client', 'sprites');
fs.mkdirSync(dest, { recursive: true });
const out = path.join(dest, nameArg + '.png');
fs.writeFileSync(out, Buffer.from(result.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
console.log(`${nameArg}.png  ${result.w}x${result.h}  from ${result.source} (kept ${result.kept}${result.keyed ? ', background keyed' : ''})  ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { /* temp */ }
