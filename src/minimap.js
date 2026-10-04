const L = window.L;

const TILE_SIZE = 256;
const MAX_CACHE = 96;
const TILE_URL =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

function roundRectPath(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
}

function wrapTile(v, n) {
    return ((v % n) + n) % n;
}

function wrapDeltaLng(fromLng, toLng) {
    let d = toLng - fromLng;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}

function project(lat, lng, zoom) {
    return L.CRS.EPSG3857.latLngToPoint(L.latLng(lat, lng), zoom);
}

export function createMinimap(size = 640) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cache = new Map();

    function tileImage(z, x, y) {
        const key = `${z}/${x}/${y}`;
        if (cache.has(key)) {
            const entry = cache.get(key);
            cache.delete(key);
            cache.set(key, entry);
            return entry;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
        cache.set(key, img);
        if (cache.size > MAX_CACHE) {
            const first = cache.keys().next().value;
            cache.delete(first);
        }
        return img;
    }

    function destPoint(santaLat, santaLng, destLat, destLng, zoom) {
        const santa = project(santaLat, santaLng, zoom);
        const dest = project(destLat, destLng, zoom);
        const world = TILE_SIZE * 2 ** zoom;
        const dLng = wrapDeltaLng(santaLng, destLng);
        if (dLng > 0 && dest.x < santa.x) dest.x += world;
        if (dLng < 0 && dest.x > santa.x) dest.x -= world;
        return { santa, dest };
    }

    function chooseView(santaLat, santaLng, destLat, destLng) {
        const pad = 96;
        if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
            const p = project(santaLat, santaLng, 7);
            return { zoom: 7, originX: p.x - size / 2, originY: p.y - size / 2, santa: p, dest: null };
        }

        const dist = Math.hypot(destLat - santaLat, wrapDeltaLng(santaLng, destLng));
        if (dist < 0.08) {
            const p = project(santaLat, santaLng, 8);
            return { zoom: 8, originX: p.x - size / 2, originY: p.y - size / 2, santa: p, dest: p };
        }

        let zoom = 8;
        let pts = destPoint(santaLat, santaLng, destLat, destLng, zoom);
        while (zoom > 2) {
            const w = Math.abs(pts.dest.x - pts.santa.x) + pad * 2;
            const h = Math.abs(pts.dest.y - pts.santa.y) + pad * 2;
            if (w <= size && h <= size) break;
            zoom -= 1;
            pts = destPoint(santaLat, santaLng, destLat, destLng, zoom);
        }

        const minX = Math.min(pts.santa.x, pts.dest.x);
        const maxX = Math.max(pts.santa.x, pts.dest.x);
        const minY = Math.min(pts.santa.y, pts.dest.y);
        const maxY = Math.max(pts.santa.y, pts.dest.y);
        return {
            zoom,
            originX: (minX + maxX) / 2 - size / 2,
            originY: (minY + maxY) / 2 - size / 2,
            santa: pts.santa,
            dest: pts.dest
        };
    }

    function update(lat, lng, destLat, destLng, destName) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const view = chooseView(lat, lng, destLat, destLng);
        const { zoom, originX, originY, santa, dest } = view;
        const n = 2 ** zoom;

        ctx.clearRect(0, 0, size, size);

        const strokeW = 6;
        const margin = 8;
        const radius = 22;
        const clipPad = margin + strokeW;
        const clipR = Math.max(8, radius - strokeW * 0.5);
        const pathPad = margin + strokeW / 2;
        const pathR = radius;

        ctx.save();
        roundRectPath(ctx, clipPad, clipPad, size - clipPad * 2, size - clipPad * 2, clipR);
        ctx.clip();
        ctx.fillStyle = '#1a2420';
        ctx.fillRect(clipPad, clipPad, size - clipPad * 2, size - clipPad * 2);

        const minTx = Math.floor(originX / TILE_SIZE);
        const minTy = Math.floor(originY / TILE_SIZE);
        const maxTx = Math.floor((originX + size) / TILE_SIZE);
        const maxTy = Math.floor((originY + size) / TILE_SIZE);

        for (let ty = minTy; ty <= maxTy; ty++) {
            if (ty < 0 || ty >= n) continue;
            for (let tx = minTx; tx <= maxTx; tx++) {
                const wrappedX = wrapTile(tx, n);
                const img = tileImage(zoom, wrappedX, ty);
                if (!img.complete || img.naturalWidth === 0) continue;
                const dx = Math.round(tx * TILE_SIZE - originX);
                const dy = Math.round(ty * TILE_SIZE - originY);
                ctx.drawImage(img, dx, dy, TILE_SIZE, TILE_SIZE);
            }
        }

        if (dest) {
            const x0 = santa.x - originX;
            const y0 = santa.y - originY;
            const x1 = dest.x - originX;
            const y1 = dest.y - originY;

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(6, 10, 16, 0.75)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
            ctx.strokeStyle = '#d4af6c';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([11, 8]);
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            ctx.beginPath();
            ctx.arc(x1, y1, 11, 0, Math.PI * 2);
            ctx.fillStyle = '#d4af6c';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#0c1218';
            ctx.stroke();

            if (destName) {
                ctx.font = '600 18px "Source Sans 3", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                const labelY = y1 < 70 ? y1 + 34 : y1 - 16;
                const tw = Math.min(ctx.measureText(destName).width, size - 24);
                ctx.fillStyle = 'rgba(6, 10, 16, 0.78)';
                ctx.fillRect(x1 - tw / 2 - 10, labelY - 20, tw + 20, 26);
                ctx.fillStyle = '#f4e4c1';
                ctx.fillText(destName, x1, labelY, size - 24);
            }
        }

        ctx.font = '700 13px "Source Sans 3", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(6, 10, 16, 0.72)';
        ctx.fillRect(size / 2 - 78, 18, 156, 28);
        ctx.fillStyle = 'rgba(212, 175, 108, 0.95)';
        ctx.fillText('FLIGHT PATH', size / 2, 38);

        const cx = santa.x - originX;
        const cy = santa.y - originY;
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220, 38, 38, 0.22)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#e8e4dc';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#c9a227';
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.lineWidth = strokeW;
        ctx.strokeStyle = 'rgba(212, 175, 108, 0.9)';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        roundRectPath(ctx, pathPad, pathPad, size - pathPad * 2, size - pathPad * 2, pathR);
        ctx.stroke();
        ctx.restore();
    }

    return { canvas, update };
}
