const SIZE = 1024;

function makeFace() {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
}

function fillRound(ctx, x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
}

function wallpaper(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, SIZE);
    g.addColorStop(0, '#f3e6d4');
    g.addColorStop(0.55, '#ead4b8');
    g.addColorStop(1, '#c9a27a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.strokeStyle = 'rgba(140, 70, 48, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 48; y < SIZE - 210; y += 72) {
        for (let x = 36 + ((y / 72) % 2) * 36; x < SIZE; x += 72) {
            ctx.beginPath();
            ctx.ellipse(x, y, 8, 12, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    ctx.fillStyle = '#5a2a22';
    ctx.fillRect(0, SIZE - 228, SIZE, 228);
    const panel = ctx.createLinearGradient(0, SIZE - 220, 0, SIZE);
    panel.addColorStop(0, '#8a4a32');
    panel.addColorStop(0.12, '#6d3826');
    panel.addColorStop(1, '#3a1c14');
    ctx.fillStyle = panel;
    ctx.fillRect(0, SIZE - 220, SIZE, 220);

    ctx.fillStyle = '#d4a017';
    ctx.fillRect(0, SIZE - 228, SIZE, 10);
    ctx.fillStyle = '#f0d48a';
    ctx.fillRect(0, SIZE - 226, SIZE, 3);

    ctx.strokeStyle = 'rgba(20, 8, 4, 0.45)';
    ctx.lineWidth = 3;
    for (let x = 18; x < SIZE; x += 124) {
        roundRect(ctx, x, SIZE - 200, 108, 168, 8);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(212, 160, 80, 0.18)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x + 10, SIZE - 188, 88, 144, 5);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(20, 8, 4, 0.45)';
        ctx.lineWidth = 3;
    }
}

function garland(ctx, y, t) {
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(20, y);
    for (let x = 20; x < SIZE - 20; x += 36) {
        ctx.quadraticCurveTo(x + 18, y + 28, x + 36, y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 8;
    ctx.stroke();

    const cols = ['#c62828', '#ffd54f', '#2e7d32', '#1565c0', '#fff8e1', '#e91e63'];
    for (let i = 0; i < 26; i++) {
        const x = 36 + i * 38;
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath();
        ctx.arc(x, y + 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.arc(x - 2, y + 8, 2.4, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = 0; i < 8; i++) {
        const x = 80 + i * 120;
        ctx.fillStyle = '#b71c1c';
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.quadraticCurveTo(x - 16, y + 18, x, y + 28);
        ctx.quadraticCurveTo(x + 16, y + 18, x, y - 6);
        ctx.fill();
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath();
        ctx.arc(x, y - 4, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function fireplace(ctx, t) {
    fillRound(ctx, 210, 300, 604, 560, 22, '#2a1810');
    fillRound(ctx, 232, 322, 560, 516, 16, '#6d4c41');

    ctx.fillStyle = '#8d6e63';
    for (let y = 340; y < 800; y += 26) {
        const odd = Math.floor(y / 26) % 2;
        for (let x = 250 + odd * 22; x < 760; x += 44) {
            ctx.fillStyle = odd ? '#7a5648' : '#957060';
            roundRect(ctx, x, y, 38, 22, 3);
            ctx.fill();
        }
    }

    fillRound(ctx, 300, 430, 424, 28, 4, '#4e342e');
    fillRound(ctx, 288, 408, 448, 26, 6, '#5d4037');
    fillRound(ctx, 270, 382, 484, 32, 8, '#3e2723');
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(270, 378, 484, 6);

    ctx.fillStyle = '#1a0e0a';
    roundRect(ctx, 348, 470, 328, 300, 8);
    ctx.fill();

    const flicker = 0.72 + 0.28 * Math.sin(t * 11);
    const flicker2 = 0.72 + 0.28 * Math.sin(t * 14 + 1.2);
    const fire = ctx.createRadialGradient(512, 740, 10, 512, 700, 180);
    fire.addColorStop(0, `rgba(255, 248, 200, ${0.95 * flicker})`);
    fire.addColorStop(0.25, `rgba(255, 193, 7, ${0.85 * flicker2})`);
    fire.addColorStop(0.6, `rgba(255, 87, 34, ${0.7 * flicker})`);
    fire.addColorStop(1, 'rgba(120, 20, 0, 0)');
    ctx.fillStyle = fire;
    ctx.beginPath();
    ctx.moveTo(370, 760);
    ctx.quadraticCurveTo(512, 480 + flicker * 40, 654, 760);
    ctx.fill();

    ctx.fillStyle = '#4e342e';
    roundRect(ctx, 392, 730, 70, 28, 8);
    ctx.fill();
    roundRect(ctx, 478, 738, 80, 24, 8);
    ctx.fill();
    roundRect(ctx, 572, 726, 64, 32, 8);
    ctx.fill();

    ctx.fillStyle = '#fff8e1';
    ctx.globalAlpha = 0.35 + 0.25 * flicker;
    ctx.beginPath();
    ctx.arc(512, 640, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const socks = [
        ['#c62828', 330],
        ['#1b5e20', 430],
        ['#1565c0', 530],
        ['#f9a825', 630]
    ];
    socks.forEach(([c, x], i) => {
        ctx.save();
        ctx.translate(x, 386);
        ctx.fillStyle = '#f0d48a';
        ctx.fillRect(-8, 0, 56, 10);
        ctx.fillStyle = c;
        roundRect(ctx, 0, 8, 42, 72, 10);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 8, 42, 14);
        ctx.fillStyle = '#f0d48a';
        ctx.fillRect(28, 64, 22, 16);
        ctx.restore();
    });

    ctx.fillStyle = '#3e2723';
    ctx.fillRect(360, 348, 22, 34);
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(371, 346, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.arc(371, 346, 11, 0, Math.PI * 2);
    ctx.fill();

    candle(ctx, 300, 368, t, 0);
    candle(ctx, 724, 368, t, 1.6);
}

function candle(ctx, x, y, t, seed) {
    ctx.fillStyle = '#f5e6c8';
    ctx.fillRect(x - 6, y, 12, 36);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(x - 9, y + 34, 18, 6);
    const f = 0.65 + 0.35 * Math.abs(Math.sin(t * 8 + seed));
    ctx.fillStyle = `rgba(255, 200, 60, ${0.4 + f * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y - 10, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 248, 200, ${f})`;
    ctx.beginPath();
    ctx.ellipse(x, y - 8, 4, 9, 0, 0, Math.PI * 2);
    ctx.fill();
}

function tree(ctx, t) {
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(486, 800, 52, 118);
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(470, 790, 84, 18);

    const layers = [
        [512, 220, 70, '#0f3d24'],
        [512, 330, 115, '#14532d'],
        [512, 460, 165, '#166534'],
        [512, 600, 210, '#15803d'],
        [512, 740, 250, '#16a34a']
    ];
    layers.forEach(([x, y, r, col]) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.92);
        ctx.lineTo(x + r, y + r * 0.48);
        ctx.lineTo(x - r, y + r * 0.48);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,220,0.07)';
        ctx.beginPath();
        ctx.moveTo(x - r * 0.15, y - r * 0.7);
        ctx.lineTo(x + r * 0.2, y + r * 0.2);
        ctx.lineTo(x - r * 0.55, y + r * 0.2);
        ctx.fill();
    });

    ctx.fillStyle = '#ffd54f';
    ctx.shadowColor = 'rgba(255, 213, 79, 0.85)';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.moveTo(512, 96);
    for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * ((Math.PI * 2) / 5);
        const a2 = a + Math.PI / 5;
        ctx.lineTo(512 + Math.cos(a) * 46, 138 + Math.sin(a) * 46);
        ctx.lineTo(512 + Math.cos(a2) * 18, 138 + Math.sin(a2) * 18);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    const baubles = ['#ef4444', '#fbbf24', '#60a5fa', '#f8fafc', '#c084fc', '#fb7185'];
    for (let i = 0; i < 28; i++) {
        const tw = 0.55 + 0.45 * Math.abs(Math.sin(t * 3.1 + i));
        const x = 390 + (i * 47) % 240;
        const y = 250 + (i * 37) % 500;
        ctx.fillStyle = baubles[i % baubles.length];
        ctx.beginPath();
        ctx.arc(x, y, 9 + tw * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.4})`;
        ctx.beginPath();
        ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = 0; i < 36; i++) {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 4 + i * 0.8));
        ctx.fillStyle = `rgba(255, 236, 160, ${0.35 + tw * 0.65})`;
        ctx.beginPath();
        ctx.arc(400 + (i * 29) % 230, 240 + (i * 51) % 520, 2.5 + tw * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = '#7b1113';
    ctx.beginPath();
    ctx.ellipse(512, 910, 160, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 5;
    ctx.stroke();
}

function giftBox(ctx, x, y, w, h, body, ribbon) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + 6, y + h - 4, w, 10);
    fillRound(ctx, x, y, w, h, 7, body);
    ctx.fillStyle = ribbon;
    ctx.fillRect(x + w * 0.42, y, w * 0.16, h);
    ctx.fillRect(x, y + h * 0.36, w, h * 0.16);
    ctx.strokeStyle = ribbon;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x + w * 0.38, y + 2, 12, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w * 0.62, y + 2, 12, Math.PI, 0);
    ctx.stroke();
}

function gifts(ctx, extra = 0) {
    giftBox(ctx, 40 + extra, 820, 108, 86, '#dc2626', '#fbbf24');
    giftBox(ctx, 160 + extra, 848, 84, 60, '#1d4ed8', '#f8fafc');
    giftBox(ctx, 70 + extra, 880, 58, 44, '#b45309', '#fff');
    giftBox(ctx, 680 - extra, 808, 118, 94, '#15803d', '#fbbf24');
    giftBox(ctx, 810 - extra, 840, 78, 58, '#7e22ce', '#fde68a');
    giftBox(ctx, 760 - extra, 888, 52, 40, '#e11d48', '#fff');
}

function milkAndCookies(ctx, x, y) {
    ctx.fillStyle = '#f5f0e6';
    ctx.beginPath();
    ctx.ellipse(x, y, 70, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a1887f';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#efebe9';
    ctx.fillRect(x - 16, y - 52, 28, 48);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 12, y - 46, 20, 36);
    ctx.fillStyle = '#d4a017';
    ctx.beginPath();
    ctx.arc(x + 28, y - 10, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 46, y - 6, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6d4c41';
    ctx.beginPath();
    ctx.arc(x + 24, y - 12, 2, 0, Math.PI * 2);
    ctx.arc(x + 32, y - 8, 2, 0, Math.PI * 2);
    ctx.arc(x + 44, y - 4, 1.8, 0, Math.PI * 2);
    ctx.fill();
}

function nutcracker(ctx, x, y) {
    ctx.fillStyle = '#c62828';
    ctx.fillRect(x, y, 36, 70);
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y + 70, 16, 36);
    ctx.fillRect(x + 20, y + 70, 16, 36);
    ctx.fillStyle = '#f5d0c8';
    ctx.fillRect(x + 4, y - 34, 28, 34);
    ctx.fillStyle = '#111';
    ctx.fillRect(x + 8, y - 22, 6, 6);
    ctx.fillRect(x + 22, y - 22, 6, 6);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 10, y - 8, 16, 6);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(x - 4, y - 42, 44, 12);
    ctx.fillRect(x + 10, y - 58, 16, 18);
}

function formatEta(ms) {
    if (ms < 800) return 'NOW';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (v) => String(v).padStart(2, '0');
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}

function ellipsize(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
    return `${s}…`;
}

function routeSchedule(ctx, x, y, w, h, schedule, t) {
    const rows = schedule || [];
    fillRound(ctx, x - 6, y - 6, w + 12, h + 12, 14, '#3e2723');
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 7;
    roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 14);
    ctx.stroke();
    fillRound(ctx, x, y, w, h, 10, '#1b3a28');
    const slate = ctx.createLinearGradient(x, y, x + w, y + h);
    slate.addColorStop(0, '#1f4d32');
    slate.addColorStop(1, '#13281c');
    ctx.fillStyle = slate;
    roundRect(ctx, x + 8, y + 8, w - 16, h - 16, 8);
    ctx.fill();

    ctx.fillStyle = '#e8d5b0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 28px "Playfair Display", serif';
    ctx.globalAlpha = 0.94;
    ctx.fillText("Tonight's Route", x + w / 2, y + 34);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(232, 213, 176, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 22, y + 52);
    ctx.lineTo(x + w - 22, y + 52);
    ctx.stroke();

    const list = rows.slice(0, 8);
    const top = y + 64;
    const rowH = (h - 84) / Math.max(1, list.length);

    list.forEach((row, i) => {
        const ry = top + i * rowH;
        if (row.current) {
            ctx.fillStyle = 'rgba(232, 213, 176, 0.14)';
            roundRect(ctx, x + 12, ry, w - 24, rowH - 5, 8);
            ctx.fill();
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = row.current ? '#f4e4c1' : '#e8efe8';
        ctx.font = row.current
            ? '700 16px "Source Sans 3", sans-serif'
            : '600 15px "Source Sans 3", sans-serif';
        const label = row.city;
        ctx.fillText(ellipsize(ctx, label, w - 108), x + 22, ry + rowH * 0.38);
        ctx.fillStyle = row.current ? 'rgba(244, 228, 193, 0.7)' : 'rgba(255,255,255,0.42)';
        ctx.font = '400 11px "Source Sans 3", sans-serif';
        ctx.fillText(ellipsize(ctx, row.region || '', w - 108), x + 22, ry + rowH * 0.68);
        ctx.textAlign = 'right';
        ctx.fillStyle = row.current ? '#f4e4c1' : '#b7d4c0';
        ctx.font = row.current
            ? '700 14px "Source Sans 3", sans-serif'
            : '600 13px "Source Sans 3", sans-serif';
        ctx.fillText(row.current ? 'NOW' : formatEta(row.etaMs), x + w - 22, ry + rowH * 0.5);
    });
}

function pictureFrame(ctx, x, y, w, h) {
    fillRound(ctx, x, y, w, h, 6, '#c9a227');
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#6d4c41');
    g.addColorStop(1, '#b71c1c');
    ctx.fillStyle = g;
    ctx.fillRect(x + 12, y + 12, w - 24, h - 24);
}

function cityWindow(ctx, t, ox, oy, winW, winH, cityCanvas, cropShift) {
    fillRound(ctx, ox - 18, oy - 18, winW + 36, winH + 56, 18, '#3e2723');
    ctx.fillStyle = '#d4a017';
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 8;
    roundRect(ctx, ox - 18, oy - 18, winW + 36, winH + 36, 18);
    ctx.stroke();

    ctx.save();
    roundRect(ctx, ox, oy, winW, winH, 6);
    ctx.clip();

    if (cityCanvas && cityCanvas.width > 8) {
        const src = Math.min(cityCanvas.width, cityCanvas.height);
        const inset = src * 0.08;
        const sx = Math.max(0, (cityCanvas.width - src) / 2 + cropShift * src * 0.12 + inset);
        const sy = Math.max(0, (cityCanvas.height - src) / 2 + inset * 0.4);
        ctx.drawImage(cityCanvas, sx, sy, src - inset * 2, src - inset * 1.2, ox, oy, winW, winH);
        ctx.fillStyle = 'rgba(18, 28, 48, 0.18)';
        ctx.fillRect(ox, oy, winW, winH);
    } else {
        const sky = ctx.createLinearGradient(ox, oy, ox, oy + winH);
        sky.addColorStop(0, '#0b1220');
        sky.addColorStop(0.55, '#1e3a5f');
        sky.addColorStop(1, '#2a1a28');
        ctx.fillStyle = sky;
        ctx.fillRect(ox, oy, winW, winH);
    }

    for (let i = 0; i < 28; i++) {
        const x = ox + ((i * 97) % winW);
        const y = oy + ((i * 53) % winH);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
    }

    const frost = ctx.createLinearGradient(ox, oy, ox, oy + 70);
    frost.addColorStop(0, 'rgba(230, 244, 255, 0.28)');
    frost.addColorStop(1, 'rgba(230, 244, 255, 0)');
    ctx.fillStyle = frost;
    ctx.fillRect(ox, oy, winW, 80);
    ctx.restore();

    ctx.strokeStyle = '#4e342e';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(ox + winW / 2, oy);
    ctx.lineTo(ox + winW / 2, oy + winH);
    ctx.moveTo(ox, oy + winH * 0.38);
    ctx.lineTo(ox + winW, oy + winH * 0.38);
    ctx.stroke();
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#5d4037';
    ctx.fillRect(ox - 22, oy + winH + 8, winW + 44, 22);
    ctx.fillStyle = '#efebe9';
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 14; i++) {
        ctx.fillRect(ox + 8 + i * (winW / 13), oy + winH - 6, 18, 16);
    }
    ctx.globalAlpha = 1;

    drawCurtain(ctx, ox - 6, oy - 6, 42, winH + 24, 1);
    drawCurtain(ctx, ox + winW - 36, oy - 6, 42, winH + 24, -1);

    ctx.fillStyle = '#7b1113';
    ctx.fillRect(ox - 10, oy - 28, winW + 20, 18);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(ox - 10, oy - 12, winW + 20, 4);
}

function drawCurtain(ctx, x, y, w, h, dir) {
    ctx.fillStyle = '#7b1113';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    for (let i = 0; i <= 5; i++) {
        const py = y + (h * i) / 5;
        ctx.lineTo(x + w * 0.5 + dir * Math.sin(i) * 10, py);
    }
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 215, 106, 0.15)';
    ctx.fillRect(dir > 0 ? x : x + w - 10, y, 10, h);
}

function titleBanner(ctx, t) {
    fillRound(ctx, 140, 42, 744, 88, 16, 'rgba(8, 14, 22, 0.82)');
    ctx.strokeStyle = 'rgba(212, 175, 108, 0.75)';
    ctx.lineWidth = 2;
    roundRect(ctx, 140, 42, 744, 88, 16);
    ctx.stroke();
    ctx.fillStyle = '#f4e4c1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 42px "Playfair Display", serif';
    ctx.globalAlpha = 0.92 + 0.08 * Math.sin(t * 1.4);
    ctx.fillText('Delivering presents', SIZE / 2, 86);
    ctx.globalAlpha = 1;
}

function ceiling(ctx, t) {
    const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 30, SIZE / 2, SIZE / 2, 720);
    g.addColorStop(0, '#6d4c41');
    g.addColorStop(0.45, '#4e342e');
    g.addColorStop(1, '#1a0e0a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.fillStyle = '#3e2723';
    for (let x = 40; x < SIZE; x += 160) {
        ctx.fillRect(x, 0, 28, SIZE);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(x + 28, 0, 7, SIZE);
        ctx.fillStyle = '#3e2723';
    }

    const glow = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.2));
    ctx.fillStyle = `rgba(255, 220, 140, ${0.12 + glow * 0.12})`;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, 220, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.globalAlpha = 0.5 + glow * 0.5;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x = SIZE / 2 + Math.cos(a) * 70;
        const y = SIZE / 2 + Math.sin(a) * 70;
        ctx.strokeStyle = '#d4a017';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(SIZE / 2, SIZE / 2);
        ctx.lineTo(x, y);
        ctx.stroke();
        const tw = 0.5 + 0.5 * Math.abs(Math.sin(t * 3 + i));
        ctx.fillStyle = `rgba(255, 236, 170, ${0.45 + tw * 0.55})`;
        ctx.beginPath();
        ctx.arc(x, y, 8 + tw * 4, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = 0; i < 20; i++) {
        const x = 80 + (i * 47) % 860;
        const y = 70 + ((i * 79) % 860);
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * 2.8 + i * 0.6));
        ctx.fillStyle = `rgba(255, 230, 140, ${0.2 + tw * 0.7})`;
        ctx.beginPath();
        ctx.arc(x, y, 5 + tw * 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function woodFloor(ctx) {
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const plankH = 36;
    for (let y = 0; y < SIZE; y += plankH) {
        const odd = Math.floor(y / plankH) % 2;
        ctx.fillStyle = odd ? '#8d6e63' : '#6d4c41';
        ctx.fillRect(0, y, SIZE, plankH - 2);
        ctx.strokeStyle = 'rgba(30, 14, 8, 0.4)';
        ctx.beginPath();
        ctx.moveTo(0, y + plankH - 2);
        ctx.lineTo(SIZE, y + plankH - 2);
        ctx.stroke();
        const shift = odd ? 90 : 0;
        for (let x = shift; x < SIZE; x += 180) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + plankH - 2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 220, 180, 0.06)';
            ctx.beginPath();
            ctx.moveTo(x + 12, y + 6);
            ctx.lineTo(x + 150, y + 6);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(30, 14, 8, 0.4)';
        }
    }
}

function rug(ctx) {
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.fillStyle = '#6b0f14';
    ctx.beginPath();
    ctx.ellipse(0, 0, 360, 230, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.strokeStyle = '#1b4d2e';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0, 320, 198, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.ellipse(0, 0, 250, 150, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f0d48a';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.fillStyle = '#7b1113';
    ctx.beginPath();
    ctx.ellipse(0, 0, 120, 72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
}

function bookshelf(ctx, x) {
    fillRound(ctx, x, 240, 210, 520, 10, '#3e2723');
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x + 12, 256, 186, 488);
    const colors = ['#6d1b1b', '#1b4d2e', '#1a365d', '#7c2d12', '#4a1d6a', '#37474f'];
    for (let row = 0; row < 5; row++) {
        const y = 268 + row * 94;
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(x + 12, y + 74, 186, 12);
        for (let b = 0; b < 7; b++) {
            ctx.fillStyle = colors[(row + b) % colors.length];
            ctx.fillRect(x + 20 + b * 24, y + 8, 20, 64);
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(x + 20 + b * 24, y + 8, 4, 64);
        }
    }
}

export function createInteriorRoom() {
    const faces = [0, 1, 2, 3, 4, 5].map(() => makeFace());

    function draw(timeSec, cityCanvas, schedule) {
        const t = timeSec || 0;

        const front = faces[0].getContext('2d');
        wallpaper(front);
        garland(front, 168, t);
        fireplace(front, t);
        routeSchedule(front, 12, 186, 268, 560, schedule, t);
        gifts(front);
        milkAndCookies(front, 360, 800);
        nutcracker(front, 820, 720);
        titleBanner(front, t);

        const right = faces[1].getContext('2d');
        wallpaper(right);
        garland(right, 168, t + 0.8);
        cityWindow(right, t, 280, 178, 560, 470, cityCanvas, 1);
        bookshelf(right, 40);
        gifts(right, 20);
        pictureFrame(right, 860, 250, 110, 140);

        const back = faces[2].getContext('2d');
        wallpaper(back);
        garland(back, 150, t + 0.4);
        tree(back, t);
        gifts(back, -10);
        routeSchedule(back, 36, 200, 250, 540, schedule, t);
        pictureFrame(back, 830, 270, 110, 140);

        const left = faces[3].getContext('2d');
        wallpaper(left);
        garland(left, 168, t + 1.3);
        cityWindow(left, t, 180, 178, 560, 470, cityCanvas, -1);
        gifts(left, 40);
        milkAndCookies(left, 820, 800);
        nutcracker(left, 70, 720);

        const top = faces[4].getContext('2d');
        ceiling(top, t);

        const bottom = faces[5].getContext('2d');
        woodFloor(bottom);
        rug(bottom);
    }

    draw(0, null, []);
    return { faces, draw };
}
