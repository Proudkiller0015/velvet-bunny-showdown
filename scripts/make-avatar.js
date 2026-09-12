'use strict';
/**
 * Turn a piece of artwork into a Showdown avatar.
 *
 *   node scripts/make-avatar.js <source image> <name>
 *   node scripts/make-avatar.js ~/art/milim.png milim     -> avatars/milim.png
 *
 * Showdown draws avatars at 80x80 with smoothing off, so that is exactly what
 * the file has to be - hand it something larger and the browser shrinks it with
 * nearest-neighbour, which is the worst of both worlds. Always the whole figure,
 * never a crop: it matches Showdown's own trainer sprites and the rest of ours.
 *
 * Two things make the difference between a readable avatar and a smear.
 *
 * The artwork these come from is pixel-*styled* art rendered large rather than
 * real pixel art blown up - there is no native grid to land on, which the script
 * checks and reports. So nearest-neighbour is wrong: at fifteen to one it throws
 * away nine pixels in ten and takes the face with them. Repeated halving with
 * averaging feeds every pixel into the next step instead, and a light unsharp
 * pass afterwards puts back the edge that averaging costs.
 *
 * Rendering happens in headless Chrome because canvas is the one image pipeline
 * already on this machine; there is no image library in the dependencies and an
 * avatar every few weeks does not justify adding one.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SIZE = 80;

// How much of the artwork's substance to keep inside the frame, by weight.
//
// The transparent border is not the only thing worth trimming. A sprite wreathed
// in flame, or with an aura, or a long thin tail, has a bounding box far larger
// than the figure in it - fitting all of that into 80 pixels leaves the character
// itself occupying half the frame and unreadable. Sparse outer wisps carry almost
// no weight, so dropping the last percent and a half of it takes the tendrils and
// leaves the body. Raise it towards 1 to keep everything.
const KEEP = Number(process.env.AVATAR_KEEP || 0.985);
const SHARPEN = Number(process.env.AVATAR_SHARPEN || 0.55);

// Averaging a red box with white lettering gives pink. That is arithmetically
// right and visually wrong: what should survive is the impression of a saturated
// mark, not its average. A modest push on saturation after the fact puts the red
// back without touching the greys.
const SATURATE = Number(process.env.AVATAR_SATURATE || 1.18);

const [, , sourceArg, nameArg] = process.argv;
if (!sourceArg || !nameArg) {
	console.error('usage: node scripts/make-avatar.js <source image> <name>');
	console.error('   eg: node scripts/make-avatar.js art/milim.png milim');
	process.exit(1);
}

const source = path.resolve(sourceArg.replace(/^~(?=[\\/])/, os.homedir()));
if (!fs.existsSync(source)) {
	console.error(`no such file: ${source}`);
	process.exit(1);
}
// The name becomes a URL on a public directory and a value people type into
// /avatar, so keep it to something that survives both.
const name = String(nameArg).toLowerCase().replace(/\.png$/, '');
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
	console.error(`"${nameArg}" will not do as a name - use letters, digits and hyphens.`);
	process.exit(1);
}

function findChrome() {
	const candidates = [
		process.env.CHROME,
		'C:/Program Files/Google/Chrome/Application/chrome.exe',
		'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/usr/bin/google-chrome',
		'/usr/bin/chromium',
	].filter(p => p);
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
}

const chrome = findChrome();
if (!chrome) {
	console.error('Could not find Chrome. Set CHROME to its path and try again.');
	process.exit(1);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-'));
const pageFile = path.join(work, 'render.html');
fs.copyFileSync(source, path.join(work, 'source.png'));

fs.writeFileSync(pageFile, `<!doctype html>
<meta charset="utf-8">
<title>avatar</title>
<div id="OUT">pending</div>
<script>
const SIZE = ${SIZE};
const SHARPEN = ${SHARPEN};
const KEEP = ${KEEP};
const SATURATE = ${SATURATE};
const img = new Image();
img.onload = () => {
	const w = img.width, h = img.height;
	const src = document.createElement('canvas');
	src.width = w; src.height = h;
	const sctx = src.getContext('2d');
	sctx.drawImage(img, 0, 0);
	const data = sctx.getImageData(0, 0, w, h).data;
	const alphaAt = (x, y) => data[(y * w + x) * 4 + 3];

	// Trim the transparent border; the margin is not part of the artwork.
	let minX = w, minY = h, maxX = -1, maxY = -1;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (alphaAt(x, y) > 8) {
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
	}
	if (maxX < 0) { document.getElementById('OUT').textContent = 'RESULT:' + JSON.stringify({ error: 'the image is entirely transparent' }); return; }
	const loose = { w: maxX - minX + 1, h: maxY - minY + 1 };

	// Pull the edges in over whatever carries almost none of the artwork's weight.
	// Rows and columns are weighted by opacity, so a solid arm holds its ground and
	// a scatter of embers does not.
	if (KEEP < 1) {
		const colWeight = new Float64Array(w), rowWeight = new Float64Array(h);
		let total = 0;
		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				const alpha = alphaAt(x, y);
				if (!alpha) continue;
				colWeight[x] += alpha; rowWeight[y] += alpha; total += alpha;
			}
		}
		const budget = total * (1 - KEEP) / 2;   // the same allowance at each edge
		const eat = (from, to, step, weight) => {
			let spent = 0, edge = from;
			for (let i = from; i !== to; i += step) {
				if (spent + weight[i] > budget) break;
				spent += weight[i];
				edge = i + step;
			}
			return edge;
		};
		const nx0 = eat(minX, maxX, 1, colWeight);
		const nx1 = eat(maxX, minX, -1, colWeight);
		const ny0 = eat(minY, maxY, 1, rowWeight);
		const ny1 = eat(maxY, minY, -1, rowWeight);
		// Never let it collapse to nothing on a very diffuse image.
		if (nx1 - nx0 > loose.w * 0.4 && ny1 - ny0 > loose.h * 0.4) {
			minX = nx0; maxX = nx1; minY = ny0; maxY = ny1;
		}
	}
	const cw = maxX - minX + 1, ch = maxY - minY + 1;

	// Is this real pixel art that was blown up? If every run of identical pixels
	// shared a factor it would be, and landing on that grid would be lossless.
	const at = (x, y) => { const i = (y * w + x) * 4; return data[i] + ',' + data[i+1] + ',' + data[i+2] + ',' + data[i+3]; };
	const runs = [];
	for (let y = minY; y <= maxY; y += 3) {
		let start = minX, prev = at(minX, y);
		for (let x = minX + 1; x <= maxX; x++) {
			const cur = at(x, y);
			if (cur !== prev) { runs.push(x - start); start = x; prev = cur; }
		}
	}
	const gcd = (a, b) => b ? gcd(b, a % b) : a;
	const solid = runs.filter(r => r >= 3);
	const nativeGrid = solid.length ? solid.reduce((g, r) => gcd(g, r), 0) : 1;

	// sRGB is not a linear measure of light, so averaging its numbers is not
	// averaging light: mid grey is about a fifth of the brightness its 128 implies.
	// Shrinking in sRGB therefore drags saturated colour towards mud - a red box
	// with white lettering on it comes out an even pink rather than a red mark.
	// Converting to linear light, averaging there, and converting back is the
	// difference between the Supreme box reading as red and reading as washed out.
	const TO_LINEAR = new Float32Array(256);
	for (let i = 0; i < 256; i++) {
		const v = i / 255;
		TO_LINEAR[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
	}
	const toSrgb = v => {
		const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
		return Math.max(0, Math.min(255, Math.round(c * 255)));
	};

	function shrink(sx, sy, sw, sh, dw, dh) {
		const region = sctx.getImageData(sx, sy, sw, sh).data;
		const out = document.createElement('canvas');
		out.width = dw; out.height = dh;
		const ox = out.getContext('2d');
		const dest = ox.createImageData(dw, dh);
		const dst = dest.data;
		for (let dy = 0; dy < dh; dy++) {
			const y0 = Math.floor(dy * sh / dh), y1 = Math.max(y0 + 1, Math.floor((dy + 1) * sh / dh));
			for (let dx = 0; dx < dw; dx++) {
				const x0 = Math.floor(dx * sw / dw), x1 = Math.max(x0 + 1, Math.floor((dx + 1) * sw / dw));
				let r = 0, g = 0, b = 0, a = 0, n = 0;
				for (let y = y0; y < y1; y++) {
					for (let x = x0; x < x1; x++) {
						const i = (y * sw + x) * 4;
						// Weighted by alpha, or a transparent pixel's colour - often
						// black - would be averaged in and darken every soft edge.
						const alpha = region[i + 3] / 255;
						r += TO_LINEAR[region[i]] * alpha;
						g += TO_LINEAR[region[i + 1]] * alpha;
						b += TO_LINEAR[region[i + 2]] * alpha;
						a += alpha;
						n++;
					}
				}
				const o = (dy * dw + dx) * 4;
				if (a > 0) {
					dst[o] = toSrgb(r / a);
					dst[o + 1] = toSrgb(g / a);
					dst[o + 2] = toSrgb(b / a);
				}
				dst[o + 3] = Math.round(a / n * 255);
			}
		}
		ox.putImageData(dest, 0, 0);
		return out;
	}

	const scale = Math.min(SIZE / cw, SIZE / ch);
	const dw = Math.max(1, Math.round(cw * scale));
	const dh = Math.max(1, Math.round(ch * scale));
	const small = shrink(minX, minY, cw, ch, dw, dh);

	const canvas = document.createElement('canvas');
	canvas.width = SIZE; canvas.height = SIZE;
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(small, Math.floor((SIZE - dw) / 2), Math.floor((SIZE - dh) / 2));

	// Unsharp mask: averaging softens edges and a little of it comes back.
	const before = ctx.getImageData(0, 0, SIZE, SIZE);
	const after = ctx.createImageData(SIZE, SIZE);
	const px = before.data, dst = after.data;
	const idx = (x, y) => (y * SIZE + x) * 4;
	for (let y = 0; y < SIZE; y++) {
		for (let x = 0; x < SIZE; x++) {
			const i = idx(x, y);
			for (let ch2 = 0; ch2 < 3; ch2++) {
				let blur = 0, n = 0;
				for (let dy = -1; dy <= 1; dy++) {
					for (let dx = -1; dx <= 1; dx++) {
						const nx2 = x + dx, ny2 = y + dy;
						if (nx2 < 0 || ny2 < 0 || nx2 >= SIZE || ny2 >= SIZE) continue;
						blur += px[idx(nx2, ny2) + ch2]; n++;
					}
				}
				blur /= n;
				dst[i + ch2] = Math.max(0, Math.min(255, px[i + ch2] + (px[i + ch2] - blur) * SHARPEN));
			}
			// Push colour away from its own grey, leaving anything already grey alone.
			if (SATURATE !== 1) {
				const grey = dst[i] * 0.299 + dst[i + 1] * 0.587 + dst[i + 2] * 0.114;
				for (let ch2 = 0; ch2 < 3; ch2++) {
					dst[i + ch2] = Math.max(0, Math.min(255, grey + (dst[i + ch2] - grey) * SATURATE));
				}
			}
			dst[i + 3] = px[i + 3];
		}
	}
	ctx.putImageData(after, 0, 0);

	document.getElementById('OUT').textContent = 'RESULT:' + JSON.stringify({
		source: w + 'x' + h,
		trimmed: cw + 'x' + ch,
		loose: loose.w + 'x' + loose.h,
		fitted: dw + 'x' + dh,
		reduction: (Math.max(cw, ch) / SIZE).toFixed(1) + ':1',
		nativeGrid,
		png: canvas.toDataURL('image/png'),
	});
};
img.onerror = () => { document.getElementById('OUT').textContent = 'RESULT:' + JSON.stringify({ error: 'the browser could not read that image' }); };
img.src = 'source.png';
</script>
`);

let dom;
try {
	dom = execFileSync(chrome, [
		'--headless=new', '--disable-gpu', '--allow-file-access-from-files',
		'--virtual-time-budget=15000',
		'--dump-dom', 'file:///' + pageFile.replace(/\\/g, '/'),
	], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
	console.error(`Chrome could not render it: ${e.message}`);
	process.exit(1);
}

const match = /RESULT:(\{[\s\S]*?\})</.exec(dom);
if (!match) {
	console.error('Chrome rendered nothing usable. Is the source a readable PNG?');
	process.exit(1);
}
const result = JSON.parse(match[1]);
if (result.error) {
	console.error(result.error);
	process.exit(1);
}

const dest = path.join(__dirname, '..', 'avatars', `${name}.png`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, Buffer.from(result.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { /* temp dir, leave it */ }

console.log(`${path.basename(source)}  ${result.source}`);
console.log(`  trimmed   ${result.trimmed}` +
	(result.loose !== result.trimmed ? `   (${result.loose} before the sparse edges came off)` : ''));
console.log(`  fitted    ${result.fitted} inside ${SIZE}x${SIZE}   (${result.reduction})`);
console.log(result.nativeGrid > 1
	? `  note      the artwork has a native ${result.nativeGrid}px grid`
	: `  note      no native pixel grid, so it is averaged rather than nearest-neighboured`);
console.log(`  wrote     avatars/${name}.png  (${fs.statSync(dest).size} bytes)`);
console.log('');
console.log(`Next: grant it in scripts/setup-config.js, eg  someuserid: ['${name}.png'],`);
