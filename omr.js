// OMR Module - bubble detection for the 50-item answer sheet (OpenCV.js)
//
// Sheet layout this reader expects (see 50-Item Shade Answer Sheet):
//   5 blocks side by side, each block = 10 rows x 5 options (A-E)
//   Block 1 = items 1-10, block 2 = 11-20, ... block 5 = 41-50
//
// How it works:
//   1. Downscale the photo (max 2000 px) and flatten uneven lighting.
//   2. Find every circle-shaped outline (filled or empty) -> bubble centres.
//   3. Estimate the sheet tilt from neighbouring bubbles and work in a
//      "straightened" coordinate frame (no image warping needed).
//   4. Group bubbles into 5 blocks -> 10 rows -> 5 options. Any bubble the
//      detector missed is filled in from the grid position.
//   5. Measure how dark the inside of each bubble is and pick the darkest.
//
// Answers returned: 'A'-'E', null (blank) or 'MULTI' (more than one shaded).

const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';
const OPTIONS = ['A', 'B', 'C', 'D', 'E'];
const BLOCKS = 5;
const ROWS = 10;
const MAX_SIDE = 2000;

let cv = null;
let cvReady = false;
let lastDebugCanvas = null;
let lastInfo = null;

// ---------------------------------------------------------------------------
// OpenCV loading
// ---------------------------------------------------------------------------
export async function loadOpenCV() {
    if (cvReady) return true;

    if (!(window.cv && window.cv.Mat)) {
        if (!document.querySelector('script[data-opencv]')) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = OPENCV_URL;
                script.async = true;
                script.dataset.opencv = '1';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load OpenCV.js. Check your internet connection.'));
                document.head.appendChild(script);
            });
        }
    }

    // OpenCV.js finishes initialising a moment after the script loads
    await new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
            if (window.cv && window.cv.Mat) resolve();
            else if (Date.now() - start > 60000) reject(new Error('OpenCV.js loading timeout'));
            else setTimeout(tick, 100);
        };
        tick();
    });

    cv = window.cv;
    cvReady = true;
    return true;
}

export function isOpenCVReady() {
    return cvReady;
}

// ---------------------------------------------------------------------------
// Public API used by ui.js
// ---------------------------------------------------------------------------

// Returns an array of 50 answers ('A'-'E' | null | 'MULTI').
// Throws an Error with a readable message if the sheet can't be found.
export function detectBubblesAdvanced(imageElement, threshold = 128) {
    if (!cvReady || !cv || !cv.Mat) {
        throw new Error('OpenCV.js not loaded. Please wait for it to finish loading or refresh the page.');
    }

    // Downscale big phone photos (4000x3000 is slow and unnecessary)
    const natW = imageElement.naturalWidth || imageElement.width;
    const natH = imageElement.naturalHeight || imageElement.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(natW, natH));
    const W = Math.round(natW * scale);
    const H = Math.round(natH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imageElement, 0, 0, W, H);
    const rgba = ctx.getImageData(0, 0, W, H).data;

    let result;
    try {
        result = analyzeSheet(cv, rgba, W, H, { threshold });
    } catch (err) {
        lastDebugCanvas = canvas; // still show the photo we tried to read
        lastInfo = null;
        throw err;
    }

    lastInfo = result.info;
    lastDebugCanvas = drawDebug(canvas, result);
    return result.answers;
}

// Canvas showing what the reader saw (green = shaded, red = multiple shaded,
// grey = empty, orange outline = bubble estimated from grid). Null if unavailable.
export function getLastDebugCanvas() {
    return lastDebugCanvas;
}

export function getLastInfo() {
    return lastInfo;
}

// Kept for compatibility
export function cleanupOpenCV(...mats) {
    mats.forEach(mat => {
        if (mat && mat.delete) mat.delete();
    });
}

// ---------------------------------------------------------------------------
// Core analysis (pure: takes RGBA pixels, no DOM access -> easy to test)
// ---------------------------------------------------------------------------
export function analyzeSheet(cvx, rgba, W, H, opts = {}) {
    const sens = Math.min(1, Math.max(0, (opts.threshold ?? 128) / 255));

    const src = new cvx.Mat(H, W, cvx.CV_8UC4);
    src.data.set(rgba);
    const gray = new cvx.Mat();
    const bg = new cvx.Mat();
    const norm = new cvx.Mat();
    const ink = new cvx.Mat();
    const contours = new cvx.MatVector();
    const hierarchy = new cvx.Mat();
    let kernel = null;

    try {
        // --- 1. Flatten lighting: divide by a "paper only" background estimate
        cvx.cvtColor(src, gray, cvx.COLOR_RGBA2GRAY);
        cvx.GaussianBlur(gray, gray, new cvx.Size(3, 3), 0);
        const k = oddInt(Math.max(W, H) / 35);
        kernel = cvx.getStructuringElement(cvx.MORPH_RECT, new cvx.Size(k, k));
        cvx.morphologyEx(gray, bg, cvx.MORPH_CLOSE, kernel);
        cvx.blur(bg, bg, new cvx.Size(k, k));
        cvx.divide(gray, bg, norm, 255);

        // --- 2. Ink mask + circle-shaped contours.
        // Try a few darkness thresholds: blurry photos merge neighbouring rings
        // at high thresholds, faint pencil rings vanish at low ones.
        const minSide = Math.max(6, Math.max(W, H) * 0.004);
        let cands = [];
        // First try a LOCAL threshold (copes with faint rings on the dim/glary
        // side of a photo), then fall back to fixed darkness levels.
        const adaptBlock = oddInt(Math.max(W, H) / 50);
        for (const th of [0, 170, 140, 110]) {
            if (th === 0) {
                cvx.adaptiveThreshold(gray, ink, 255, cvx.ADAPTIVE_THRESH_GAUSSIAN_C,
                    cvx.THRESH_BINARY_INV, adaptBlock, 6);
            } else {
                cvx.threshold(norm, ink, th, 255, cvx.THRESH_BINARY_INV);
            }
            cvx.findContours(ink, contours, hierarchy, cvx.RETR_EXTERNAL, cvx.CHAIN_APPROX_SIMPLE);
            let found = [];
            for (let i = 0; i < contours.size(); i++) {
                const cnt = contours.get(i);
                const r = cvx.boundingRect(cnt);
                const area = cvx.contourArea(cnt);
                const perim = cvx.arcLength(cnt, true);
                cnt.delete();
                if (r.width < minSide || r.height < minSide) continue;
                const aspect = r.width / r.height;
                if (aspect < 0.75 || aspect > 1.33) continue;
                const fill = area / (r.width * r.height);
                if (fill < 0.6 || fill > 0.9) continue;
                const circ = perim > 0 ? (4 * Math.PI * area) / (perim * perim) : 0;
                if (circ < 0.75) continue;
                found.push({ x: r.x + r.width / 2, y: r.y + r.height / 2, d: (r.width + r.height) / 2 });
            }
            // Keep only the dominant size (drops stray letters, stains, etc.)
            if (found.length) {
                const md = median(found.map(c => c.d));
                found = found.filter(c => c.d > md * 0.75 && c.d < md * 1.3);
            }
            if (found.length > cands.length) cands = found;
            if (cands.length >= 240) break;
        }
        // ink mask at the standard threshold (used for the upside-down test below)
        cvx.threshold(norm, ink, 170, 255, cvx.THRESH_BINARY_INV);

        if (cands.length < 100) {
            throw new Error(
                `Could only find ${cands.length} bubbles (expected 250). ` +
                'Make the sheet fill most of the photo, keep it flat, in focus and well lit, and avoid glare.'
            );
        }
        const diam = median(cands.map(c => c.d));
        const radius = diam / 2;

        // --- 3. Tilt: angle of the line joining each bubble to its nearest neighbour
        let sumC = 0, sumS = 0;
        const nnDist = [];
        for (let i = 0; i < cands.length; i++) {
            let best = Infinity, bx = 0, by = 0;
            for (let j = 0; j < cands.length; j++) {
                if (i === j) continue;
                const dx = cands[j].x - cands[i].x;
                const dy = cands[j].y - cands[i].y;
                const dist = dx * dx + dy * dy;
                if (dist < best) { best = dist; bx = dx; by = dy; }
            }
            const a = Math.atan2(by, bx);
            sumC += Math.cos(2 * a);
            sumS += Math.sin(2 * a);
            nnDist.push(Math.sqrt(best));
        }
        let theta = Math.atan2(sumS, sumC) / 2;   // option axis direction, (-90deg, 90deg]
        const pitch = median(nnDist);             // distance between A and B bubbles

        // Shear: how far the "vertical" bubble-to-bubble direction leans from
        // perpendicular to the option axis (perspective makes this non-zero).
        let shear = 0;
        {
            const ux = Math.cos(theta), uy = Math.sin(theta);
            const nx = -uy, ny = ux;
            const leans = [];
            for (let i = 0; i < cands.length; i++) {
                let best = Infinity, lean = null;
                for (let j = 0; j < cands.length; j++) {
                    if (i === j) continue;
                    const dx = cands[j].x - cands[i].x, dy = cands[j].y - cands[i].y;
                    let a = dx * ux + dy * uy, b = dx * nx + dy * ny;
                    if (b < 0) { a = -a; b = -b; }
                    if (b < Math.abs(a) * 1.5 || b > pitch * 2.2) continue; // must be a "row below" neighbour
                    const dist = a * a + b * b;
                    if (dist < best) { best = dist; lean = a / b; }
                }
                if (lean !== null) leans.push(lean);
            }
            if (leans.length > 20) shear = median(leans);
        }

        // frame: fx runs along the options, fy down the rows; shear removed from fx
        const toFrame = (x, y, t) => {
            const a = x * Math.cos(t) + y * Math.sin(t);
            const b = -x * Math.sin(t) + y * Math.cos(t);
            return { x: a - shear * b, y: b };
        };
        const fromFrame = (fx, fy, t) => {
            const a = fx + shear * fy, b = fy;
            return { x: a * Math.cos(t) - b * Math.sin(t), y: a * Math.sin(t) + b * Math.cos(t) };
        };

        // --- 4. Upright or upside-down? The heading text/lines sit ABOVE the grid.
        // Only paper pixels count (so a dark table beyond the sheet edge is ignored).
        const inkData = ink.data;
        const grayData = gray.data;
        const paperLevel = median(cands.map(c => bg.data[Math.round(c.y) * W + Math.round(c.x)]));
        const paperMask = new cvx.Mat();
        cvx.threshold(gray, paperMask, paperLevel * 0.7, 255, cvx.THRESH_BINARY);
        cvx.blur(paperMask, paperMask, new cvx.Size(oddInt(diam * 2), oddInt(diam * 2)));
        const maskData = paperMask.data;
        const inkDensity = (t, x0, x1, y0, y1) => {
            const step = Math.max(2, radius / 2);
            let on = 0, total = 0;
            for (let fy = y0; fy <= y1; fy += step) {
                for (let fx = x0; fx <= x1; fx += step) {
                    const q = fromFrame(fx, fy, t);
                    const px = Math.round(q.x), py = Math.round(q.y);
                    if (px < 0 || px >= W || py < 0 || py >= H) continue;
                    if (maskData[py * W + px] < 200) continue;   // not on the paper
                    total++;
                    if (inkData[py * W + px]) on++;
                }
            }
            return total ? on / total : 0;
        };
        {
            const pts0 = cands.map(c => toFrame(c.x, c.y, theta));
            const xmin = Math.min(...pts0.map(p => p.x)), xmax = Math.max(...pts0.map(p => p.x));
            const ymin = Math.min(...pts0.map(p => p.y)), ymax = Math.max(...pts0.map(p => p.y));
            const gh = ymax - ymin;
            const above = inkDensity(theta, xmin, xmax, ymin - 0.28 * gh, ymin - 0.05 * gh);
            const below = inkDensity(theta, xmin, xmax, ymax + 0.09 * gh, ymax + 0.28 * gh);
            if (below > above) theta += Math.PI;
        }
        paperMask.delete();
        const flipped = theta > Math.PI / 2 + 1e-9;

        const pts = cands.map(c => {
            const f = toFrame(c.x, c.y, theta);
            return { fx: f.x, fy: f.y, x: c.x, y: c.y };
        });

        // --- 5. Group into blocks (columns of the sheet)
        pts.sort((a, b) => a.fx - b.fx);
        const gaps = [];
        for (let i = 1; i < pts.length; i++) gaps.push({ i, g: pts[i].fx - pts[i - 1].fx });
        const cuts = gaps.sort((a, b) => b.g - a.g).slice(0, BLOCKS - 1);
        if (cuts[BLOCKS - 2].g < pitch * 1.7) {
            throw new Error(
                `Could not find the ${BLOCKS} answer columns. ` +
                'Make sure the whole answer grid is visible and in focus.'
            );
        }
        const cutIdx = cuts.map(c => c.i).sort((a, b) => a - b);
        const blocks = [];
        let startIdx = 0;
        for (const ci of [...cutIdx, pts.length]) {
            blocks.push(pts.slice(startIdx, ci));
            startIdx = ci;
        }

        // --- 6. Rows and options inside each block
        const bubbles = [];
        for (let b = 0; b < BLOCKS; b++) {
            const bp = blocks[b];

            // options: index each bubble by its x position, then least-squares fit x = x0 + pitchB * opt
            const xLeft = percentile(bp.map(p => p.fx), 0.05);
            bp.forEach(p => { p.opt = Math.min(4, Math.max(0, Math.round((p.fx - xLeft) / pitch))); });
            const fit = linearFit(bp.map(p => p.opt), bp.map(p => p.fx));

            // rows: cluster by y
            bp.sort((a, c) => a.fy - c.fy);
            const rows = [];
            let row = [bp[0]];
            for (let i = 1; i < bp.length; i++) {
                if (bp[i].fy - bp[i - 1].fy > pitch * 0.66) { rows.push(row); row = []; }
                row.push(bp[i]);
            }
            rows.push(row);
            if (rows.length !== ROWS) {
                throw new Error(
                    `Found ${rows.length} rows in column ${b + 1} (expected ${ROWS}). ` +
                    'Photograph only ONE answer sheet, with the whole grid in view.'
                );
            }

            rows.forEach((rw, r) => {
                const rowY = median(rw.map(p => p.fy));
                for (let o = 0; o < 5; o++) {
                    const hit = rw.find(p => p.opt === o);
                    let x, y, predicted = false;
                    if (hit) {
                        x = hit.x; y = hit.y;
                    } else {
                        const pos = fromFrame(fit.a + fit.b * o, rowY, theta);
                        x = pos.x; y = pos.y; predicted = true;
                    }
                    bubbles.push({ item: b * ROWS + r, opt: o, x, y, predicted });
                }
            });
        }

        // --- 7. Measure darkness inside each bubble (centre area only, avoids the ring)
        const normData = norm.data;
        const sampleR = radius * 0.6;
        for (const bub of bubbles) {
            bub.dark = meanDarkness(normData, W, H, bub.x, bub.y, sampleR);
        }

        const base = median(bubbles.map(b => b.dark));       // typical empty bubble (with its printed letter)
        // Slider: 0 = very sensitive ... 255 = strict
        const cutoff = base + 0.06 + 0.32 * sens;

        const answers = new Array(BLOCKS * ROWS).fill(null);
        for (let item = 0; item < BLOCKS * ROWS; item++) {
            const row = bubbles.filter(b => b.item === item).sort((a, c) => a.opt - c.opt);
            const marked = row.filter(b => b.dark > cutoff).sort((a, c) => c.dark - a.dark);
            row.forEach(b => { b.state = 'empty'; });
            if (marked.length === 0) {
                answers[item] = null;
            } else if (marked.length === 1 || marked[1].dark < marked[0].dark * 0.6) {
                answers[item] = OPTIONS[marked[0].opt];
                marked[0].state = 'marked';
            } else {
                answers[item] = 'MULTI';
                marked.forEach(b => { b.state = 'multi'; });
            }
        }

        return {
            answers,
            bubbles,
            radius,
            info: {
                detected: cands.length,
                predicted: bubbles.filter(b => b.predicted).length,
                rotationDeg: +(theta * 180 / Math.PI).toFixed(1),
                shear: +shear.toFixed(3),
                upsideDown: flipped,
                baseDarkness: +base.toFixed(3),
                cutoff: +cutoff.toFixed(3)
            }
        };
    } finally {
        src.delete(); gray.delete(); bg.delete(); norm.delete(); ink.delete();
        contours.delete(); hierarchy.delete();
        if (kernel) kernel.delete();
    }
}

// ---------------------------------------------------------------------------
// Debug overlay
// ---------------------------------------------------------------------------
function drawDebug(photoCanvas, result) {
    const out = document.createElement('canvas');
    out.width = photoCanvas.width;
    out.height = photoCanvas.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(photoCanvas, 0, 0);

    const r = result.radius;
    ctx.lineWidth = Math.max(2, r * 0.25);
    ctx.font = `bold ${Math.round(r * 1.1)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const b of result.bubbles) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 0.95, 0, Math.PI * 2);
        if (b.state === 'marked') ctx.strokeStyle = '#16a34a';
        else if (b.state === 'multi') ctx.strokeStyle = '#dc2626';
        else ctx.strokeStyle = b.predicted ? '#f59e0b' : 'rgba(100,116,139,0.55)';
        ctx.stroke();

        // item number next to the first option of each row
        if (b.opt === 0) {
            ctx.fillStyle = '#2563eb';
            ctx.fillText(String(b.item + 1), b.x - r * 1.6, b.y);
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function oddInt(n) {
    let v = Math.max(3, Math.round(n));
    if (v % 2 === 0) v++;
    return v;
}

function median(arr) {
    return percentile(arr, 0.5);
}

function percentile(arr, p) {
    const s = [...arr].sort((a, b) => a - b);
    if (!s.length) return 0;
    const idx = (s.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

function linearFit(xs, ys) {
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        den += (xs[i] - mx) * (xs[i] - mx);
    }
    const b = den ? num / den : 0;
    return { a: my - b * mx, b };
}

// 0 = paper white, 1 = solid black (average inside a small disc)
function meanDarkness(data, W, H, cx, cy, r) {
    let sum = 0, n = 0;
    const r2 = r * r;
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r2) { sum += data[y * W + x]; n++; }
        }
    }
    return n ? 1 - sum / (255 * n) : 0;
}
