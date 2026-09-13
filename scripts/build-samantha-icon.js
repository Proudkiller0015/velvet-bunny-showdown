'use strict';
/**
 * Build Samantha's teambuilder icon.
 *
 *   node scripts/build-samantha-icon.js <source image>
 *
 * Showdown's icons are 40x30 cells cut from one big sheet. At that size a
 * full-length figure is about twenty pixels wide and reads as a smudge, which is
 * why the game's own icons are framed on the creature rather than on the whole
 * pose. So this crops to her head and shoulders and fills the cell with that.
 *
 * Scaled in linear light for the same reason as everything else here: sRGB
 * averaging pulls saturated colour towards grey, and there is very little of her
 * that is not saturated colour.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const W = 40, H = 30;

const [, , source] = process.argv;
if (!source) {
	console.error('usage: node scripts/build-samantha-icon.js <source image>');
	process.exit(1);
}

function findChrome() {
	for (const c of [
		process.env.CHROME,
		'C:/Program Files/Google/Chrome/Application/chrome.exe',
		'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/usr/bin/google-chrome',
	].filter(Boolean)) if (fs.existsSync(c)) return c;
	return null;
}
const chrome = findChrome();
if (!chrome) { console.error('Could not find Chrome. Set CHROME.'); process.exit(1); }

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-'));
fs.copyFileSync(path.resolve(source), path.join(work, 'source.png'));

fs.writeFileSync(path.join(work, 'render.html'), `<!doctype html>
<meta charset="utf-8"><title>icon</title><div id="OUT">pending</div>
<script>
const W = ${W}, H = ${H};
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

	// The artwork may be on black rather than transparent.
	for (let i = 0; i < src.length; i += 4) {
		if (src[i] < 24 && src[i + 1] < 24 && src[i + 2] < 24) src[i + 3] = 0;
	}

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
	const fullW = maxX - minX + 1, fullH = maxY - minY + 1;

	// Find her head: the widest run of solid pixels in the top third is the hair,
	// and the face sits in the middle of it. Framing on that beats framing on the
	// bounding box, which is dominated by a scythe she is only holding.
	let headX = Math.round((minX + maxX) / 2), headY = minY, best = 0;
	for (let y = minY; y < minY + Math.round(fullH * 0.45); y += 2) {
		let count = 0, sum = 0;
		for (let x = minX; x <= maxX; x++) {
			if (src[(y * w + x) * 4 + 3] > 8) { count++; sum += x; }
		}
		if (count > best) { best = count; headX = Math.round(sum / count); headY = y; }
	}

	// A window in the artwork's proportions, tall enough to hold head and
	// shoulders, then fitted to the cell without stretching.
	const cropH = Math.round(fullH * 0.34);
	const cropW = Math.round(cropH * (W / H));
	const sx = Math.max(0, Math.min(w - cropW, headX - Math.round(cropW / 2)));
	const sy = Math.max(0, Math.min(h - cropH, headY - Math.round(cropH * 0.40)));

	const out = document.createElement('canvas');
	out.width = W; out.height = H;
	const octx = out.getContext('2d');
	const dest = octx.createImageData(W, H);
	const dst = dest.data;
	for (let dy = 0; dy < H; dy++) {
		const y0 = sy + Math.floor(dy * cropH / H), y1 = Math.max(y0 + 1, sy + Math.floor((dy + 1) * cropH / H));
		for (let dx = 0; dx < W; dx++) {
			const x0 = sx + Math.floor(dx * cropW / W), x1 = Math.max(x0 + 1, sx + Math.floor((dx + 1) * cropW / W));
			let r = 0, g = 0, b = 0, a = 0, n = 0;
			for (let y = y0; y < y1 && y < h; y++) {
				for (let x = x0; x < x1 && x < w; x++) {
					const i = (y * w + x) * 4;
					const alpha = src[i + 3] / 255;
					r += TO_LINEAR[src[i]] * alpha;
					g += TO_LINEAR[src[i + 1]] * alpha;
					b += TO_LINEAR[src[i + 2]] * alpha;
					a += alpha; n++;
				}
			}
			const o = (dy * W + dx) * 4;
			if (a > 0) { dst[o] = toSrgb(r / a); dst[o + 1] = toSrgb(g / a); dst[o + 2] = toSrgb(b / a); }
			dst[o + 3] = Math.round(a / Math.max(1, n) * 255);
		}
	}
	octx.putImageData(dest, 0, 0);

	// A little sharpening, as the averaging softens edges this small badly.
	const before = octx.getImageData(0, 0, W, H);
	const after = octx.createImageData(W, H);
	const px = before.data, od = after.data;
	const idx = (x, y) => (y * W + x) * 4;
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const i = idx(x, y);
			for (let ch = 0; ch < 3; ch++) {
				let blur = 0, n = 0;
				for (let dy = -1; dy <= 1; dy++) {
					for (let dx = -1; dx <= 1; dx++) {
						const nx = x + dx, ny = y + dy;
						if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
						blur += px[idx(nx, ny) + ch]; n++;
					}
				}
				blur /= n;
				od[i + ch] = Math.max(0, Math.min(255, px[i + ch] + (px[i + ch] - blur) * 0.9));
			}
			od[i + 3] = px[i + 3];
		}
	}
	octx.putImageData(after, 0, 0);

	document.getElementById('OUT').textContent = 'RESULT:' + JSON.stringify({
		artwork: fullW + 'x' + fullH,
		window: cropW + 'x' + cropH + ' at ' + sx + ',' + sy,
		png: out.toDataURL('image/png'),
	});
};
img.onerror = () => { document.getElementById('OUT').textContent = 'RESULT:{"error":"load"}'; };
img.src = 'source.png';
</script>
`);

let dom;
try {
	dom = execFileSync(chrome, [
		'--headless=new', '--disable-gpu', '--allow-file-access-from-files',
		'--virtual-time-budget=15000', '--dump-dom',
		'file:///' + path.join(work, 'render.html').replace(/\\/g, '/'),
	], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
	console.error('Chrome failed: ' + e.message);
	process.exit(1);
}
const match = /RESULT:(\{[\s\S]*?\})</.exec(dom);
if (!match) { console.error('nothing rendered'); process.exit(1); }
const result = JSON.parse(match[1]);
if (result.error) { console.error('could not read the source'); process.exit(1); }

const dest = path.join(__dirname, '..', 'client', 'sprites', 'samantha-icon.png');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, Buffer.from(result.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
console.log(`artwork ${result.artwork}, framed on ${result.window}`);
console.log(`wrote client/sprites/samantha-icon.png (${W}x${H}, ${fs.statSync(dest).size} bytes)`);
try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { /* temp */ }
