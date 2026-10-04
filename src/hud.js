const TOTAL_GIFTS = 7850000000;

function formatGifts(n) {
    return n.toLocaleString('en-US');
}

function formatRemaining(ms) {
    if (ms < 800) return 'Now';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (v) => String(v).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}

export function getFlightInfo(routeData, currentMs) {
    let idx = 0;
    for (let i = 0; i < routeData.length - 1; i++) {
        if (currentMs >= routeData[i].arrival && currentMs <= routeData[i + 1].arrival) {
            idx = i;
            break;
        }
        if (currentMs > routeData[routeData.length - 1].arrival) {
            idx = routeData.length - 2;
        }
    }

    const fromStop = routeData[idx];
    const toStop = routeData[idx + 1] || fromStop;
    const legTotal = Math.max(1, toStop.arrival - fromStop.arrival);
    const legElapsed = Math.max(0, Math.min(legTotal, currentMs - fromStop.arrival));
    const globalProgress = (idx + legElapsed / legTotal) / (routeData.length - 1);
    const gifts = Math.floor(TOTAL_GIFTS * Math.pow(Math.min(1, Math.max(0, globalProgress)), 0.95));

    return {
        fromCity: fromStop.city || 'Unknown',
        fromRegion: fromStop.region || '',
        toCity: toStop.city || 'Unknown',
        toRegion: toStop.region || '',
        fromLat: fromStop.location_coords?.lat,
        fromLng: fromStop.location_coords?.lng,
        toLat: toStop.location_coords?.lat,
        toLng: toStop.location_coords?.lng,
        gifts,
        remainingMs: Math.max(0, toStop.arrival - currentMs),
        stopNumber: idx + 1,
        totalStops: routeData.length,
        routeIdx: idx
    };
}

export function getUpcomingSchedule(routeData, currentMs, frac, count = 8) {
    if (!routeData || routeData.length < 2) return [];
    let idx = 0;
    for (let i = 0; i < routeData.length - 1; i++) {
        if (currentMs >= routeData[i].arrival && currentMs <= routeData[i + 1].arrival) {
            idx = i;
            break;
        }
        if (currentMs > routeData[routeData.length - 1].arrival) {
            idx = routeData.length - 2;
        }
    }
    const here = frac >= 0.5 ? Math.min(idx + 1, routeData.length - 1) : idx;
    const startMs = routeData[0].arrival;
    const endMs = routeData[routeData.length - 1].arrival;
    const span = Math.max(1, endMs - startMs);
    const rows = [];
    for (let i = 0; i < count; i++) {
        const stopIdx = (here + i) % routeData.length;
        const stop = routeData[stopIdx];
        let eta = stop.arrival - currentMs;
        if (i === 0) {
            eta = 0;
        } else if (eta < 0) {
            eta += span;
        }
        rows.push({
            city: stop.city || 'Unknown',
            region: stop.region || '',
            etaMs: Math.max(0, eta),
            current: i === 0,
            stopNumber: stopIdx + 1
        });
    }
    return rows;
}

export class LeftLookHud {
    constructor(size = 640) {
        this.size = size;
        this.canvas = document.createElement('canvas');
        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx = this.canvas.getContext('2d');
        this.fontReady = false;
        this._loadFont();
    }

    async _loadFont() {
        try {
            await document.fonts.load('48px "Lobster"');
            await document.fonts.ready;
            this.fontReady = true;
        } catch (e) {
            this.fontReady = true;
        }
    }

    _fitText(ctx, text, maxWidth, startSize, family) {
        let size = startSize;
        const face = family || '"Lobster", cursive';
        ctx.font = `${size}px ${face}`;
        while (size > 11 && ctx.measureText(text).width > maxWidth) {
            size -= 1;
            ctx.font = `${size}px ${face}`;
        }
        return size;
    }

    draw(info) {
        const ctx = this.ctx;
        const S = this.size;
        const k = S / 640;
        const pad = Math.round(S * 0.05);
        const x = pad;
        const y = pad;
        const w = S - pad * 2;
        const h = S - pad * 2;
        const r = Math.round(22 * k);

        ctx.clearRect(0, 0, S, S);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.save();
        this._roundRect(ctx, x, y, w, h, r);
        const bg = ctx.createLinearGradient(x, y, x, y + h);
        bg.addColorStop(0, 'rgba(8, 14, 22, 0.92)');
        bg.addColorStop(1, 'rgba(6, 10, 16, 0.94)');
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.lineWidth = Math.max(2, Math.round(2.5 * k));
        ctx.strokeStyle = 'rgba(212, 175, 108, 0.85)';
        ctx.stroke();
        ctx.restore();

        const inset = Math.round(22 * k);
        const ix = x + inset;
        const iy = y + inset;
        const iw = w - inset * 2;
        const ih = h - inset * 2;

        ctx.save();
        this._roundRect(ctx, ix, iy, iw, ih, Math.max(8, r - 10));
        ctx.clip();

        const pulse = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 420));
        ctx.fillStyle = `rgba(220, 38, 38, ${0.75 + pulse * 0.25})`;
        ctx.beginPath();
        ctx.arc(ix + 14 * k, iy + 18 * k, 6 * k, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = `${Math.round(16 * k)}px "Lobster", cursive`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('LIVE', ix + 28 * k, iy + 18 * k);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(212, 175, 108, 0.85)';
        ctx.font = `${Math.round(16 * k)}px "Lobster", cursive`;
        ctx.fillText(
            `${info.stopNumber} / ${info.totalStops}`,
            ix + iw - 4 * k,
            iy + 18 * k
        );

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#ffd76a';
        ctx.font = `${Math.round(36 * k)}px "Lobster", cursive`;
        ctx.fillText('Santa Tracker', ix + iw / 2, iy + 58 * k);

        ctx.fillStyle = 'rgba(255, 215, 106, 0.7)';
        ctx.font = `${Math.round(15 * k)}px "Lobster", cursive`;
        ctx.fillText('Christmas Eve  ·  World Tour', ix + iw / 2, iy + 78 * k);

        ctx.strokeStyle = 'rgba(212, 175, 108, 0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ix + 8 * k, iy + 90 * k);
        ctx.lineTo(ix + iw - 8 * k, iy + 90 * k);
        ctx.stroke();

        const prog = Math.max(0, Math.min(1, (info.stopNumber - 1) / Math.max(1, info.totalStops - 1)));
        const barY = iy + 102 * k;
        const barH = Math.round(4 * k);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        this._roundRect(ctx, ix + 8 * k, barY, iw - 16 * k, barH, 2);
        ctx.fill();
        ctx.fillStyle = '#c9a227';
        this._roundRect(ctx, ix + 8 * k, barY, (iw - 16 * k) * prog, barH, 2);
        ctx.fill();

        const visiting = (info.visitBlend || 0) > 0.35;
        const landing = visiting && (info.frac || 0) >= 0.76;
        const rows = landing
            ? [
                ['Landing In', info.toCity, info.toRegion],
                ['Coming From', info.fromCity, info.fromRegion]
            ]
            : visiting
                ? [
                    ['Delivering In', info.fromCity, info.fromRegion],
                    ['Next Stop', info.toCity, info.toRegion]
                ]
                : [
                    ['Coming From', info.fromCity, info.fromRegion],
                    ['Heading To', info.toCity, info.toRegion]
                ];
        rows.push(['Gifts Delivered', formatGifts(info.gifts), '']);
        const stopWhere = [info.toCity, info.toRegion].filter(Boolean).join(' · ');
        rows.push(['Arrives In', formatRemaining(info.remainingMs), stopWhere]);

        const rowsTop = iy + 122 * k;
        const rowsBottom = iy + ih - 8 * k;
        const rowH = (rowsBottom - rowsTop) / 4;
        const bx = ix + 4 * k;
        const bw = iw - 8 * k;

        rows.forEach((row, i) => {
            this._block(ctx, bx, rowsTop + i * rowH, bw, rowH, row[0], row[1], row[2], k);
        });
        ctx.restore();
    }

    _block(ctx, x, y, width, height, label, value, sub, k = 1) {
        const cx = x + width / 2;
        const hasSub = Boolean(sub);
        const labelSize = Math.max(10, Math.min(12 * k, height * 0.16));
        const valueSize = Math.max(15, Math.min(28 * k, height * (hasSub ? 0.32 : 0.4)));
        const subSize = Math.max(10, Math.min(13 * k, height * 0.16));

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(255, 215, 106, 0.82)';
        ctx.font = `${Math.round(labelSize)}px "Lobster", cursive`;
        ctx.fillText(label, cx, y + labelSize + 4 * k, width);

        ctx.fillStyle = '#ffffff';
        const vs = this._fitText(ctx, value, width - 10, Math.round(valueSize), '"Lobster", cursive');
        ctx.font = `${vs}px "Lobster", cursive`;
        ctx.fillText(value, cx, y + height * 0.55, width);

        if (hasSub) {
            ctx.fillStyle = 'rgba(255, 230, 180, 0.75)';
            const ss = this._fitText(ctx, sub, width - 10, Math.round(subSize), '"Lobster", cursive');
            ctx.font = `${ss}px "Lobster", cursive`;
            ctx.fillText(sub, cx, y + height - 8 * k, width);
        }
    }

    _roundRect(ctx, x, y, w, h, r) {
        const rad = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rad, y);
        ctx.arcTo(x + w, y, x + w, y + h, rad);
        ctx.arcTo(x + w, y + h, x, y + h, rad);
        ctx.arcTo(x, y + h, x, y, rad);
        ctx.arcTo(x, y, x + w, y, rad);
        ctx.closePath();
    }
}
