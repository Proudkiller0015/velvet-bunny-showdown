'use strict';
/**
 * Build Samantha's battle sprites.
 *
 *   node scripts/build-samantha-sprites.js <front source> <back source>
 *
 * The front comes from the standalone artwork rather than the animation sheet:
 * the sheet's frames overlap, so cutting one out brings pieces of its
 * neighbours' scythes with it, and the first frame has the sheet's own caption
 * sitting across it. The back has no standalone version, so it is cut from the
 * sheet - the back row's frames are far enough apart to come away clean.
 *
 * Scaled in linear light, like the avatars, because sRGB averaging drags
 * saturated colour towards grey and she is mostly saturated colour.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FRONT_HEIGHT = Number(process.env.SPRITE_FRONT_HEIGHT || 140);
const BACK_HEIGHT = Number(process.env.SPRITE_BACK_HEIGHT || 116);

const [, , frontSrc, backSrc] = process.argv;
if (!frontSrc || !backSrc) {
	console.error('usage: node scripts/build-samantha-sprites.js <front.png> <back.png>');
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

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sprite-'));
fs.copyFileSync(path.resolve(frontSrc), path.join(work, 'front.png'));
fs.copyFileSync(path.resolve(backSrc), path.join(work, 'back.png'));

fs.writeFileSync(path.join(work, 'render.html'), `<!doctype html>
<meta charset="utf-8"><title>s</title><div id="OUT">pending</div>
<script>
const JOBS = [['front.png', ${FRONT_HEIGHT}], ['back.png', ${BACK_HEIGHT}]];
const out = {};
let done = 0;

const TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
	const v = i / 255;
	TO_LINEAR[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
const toSrgb = v => {
	const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
	return Math.max(0, Math.min(255, Math.round(c * 255)));
};

function handle(file, targetH) {
	const img = new Image();
	img.onload = () => {
		const w = img.width, h = img.height;
		const c = document.createElement('canvas');
		c.width = w; c.height = h;
		const ctx = c.getContext('2d');
		ctx.drawImage(img, 0, 0);
		const src = ctx.getImageData(0, 0, w, h).data;

		// Black background, where there is one, becomes transparency.
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
		const cw = maxX - minX + 1, ch = maxY - minY + 1;
		const scale = targetH / ch;
		const dw = Math.max(1, Math.round(cw * scale));
		const dh = Math.max(1, Math.round(ch * scale));

		const outC = document.createElement('canvas');
		outC.width = dw; outC.height = dh;
		const octx = outC.getContext('2d');
		const dest = octx.createImageData(dw, dh);
		const dst = dest.data;
		for (let dy = 0; dy < dh; dy++) {
			const sy0 = minY + Math.floor(dy * ch / dh), sy1 = Math.max(sy0 + 1, minY + Math.floor((dy + 1) * ch / dh));
			for (let dx = 0; dx < dw; dx++) {
				const sx0 = minX + Math.floor(dx * cw / dw), sx1 = Math.max(sx0 + 1, minX + Math.floor((dx + 1) * cw / dw));
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
		out[file] = { size: dw + 'x' + dh, png: outC.toDataURL('image/png') };
		if (++done === JOBS.length) document.getElementById('OUT').textContent = 'RESULT:' + JSON.stringify(out);
	};
	img.onerror = () => { document.getElementById('OUT').textContent = 'RESULT:{"error":"' + file + '"}'; };
	img.src = file;
}
// One at a time: two images loading together under a virtual time budget has
// repeatedly finished the page before the second decoded.
handle(JOBS[0][0], JOBS[0][1]);
setTimeout(() => handle(JOBS[1][0], JOBS[1][1]), 1500);
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
if (result.error) { console.error('could not read ' + result.error); process.exit(1); }

const dest = path.join(__dirname, '..', 'client', 'sprites');
fs.mkdirSync(dest, { recursive: true });
const names = { 'front.png': 'samantha.png', 'back.png': 'samantha-back.png' };
for (const [file, data] of Object.entries(result)) {
	const out = path.join(dest, names[file]);
	fs.writeFileSync(out, Buffer.from(data.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
	console.log(`${names[file].padEnd(20)} ${data.size.padEnd(9)} ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
}
try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { /* temp */ }
