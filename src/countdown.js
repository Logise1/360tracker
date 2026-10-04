import { surfaceHeightMeters } from './terrainFollow.js';

const Cesium = window.Cesium;

/** Inland East Antarctica — ice sheet, fully snowed. Near Vostok. */
export const COUNTDOWN_VILLAGE = {
    lat: -78.464,
    lng: 106.834
};

export function isCountdownMode() {
    const q = new URLSearchParams(window.location.search);
    const mode = (q.get('mode') || q.get('view') || '').toLowerCase();
    if (mode === 'countdown' || mode === 'count' || mode === 'wait') return true;
    const flag = q.get('countdown');
    return flag === '' || flag === '1' || flag === 'true' || flag === 'yes';
}

/** Next 24 Dec 10:00 GMT (rolls to next year after that instant). */
export function nextTakeoffMs(now = Date.now()) {
    const year = new Date(now).getUTCFullYear();
    let target = Date.UTC(year, 11, 24, 10, 0, 0);
    if (now >= target) target = Date.UTC(year + 1, 11, 24, 10, 0, 0);
    return target;
}

export function splitCountdown(ms) {
    const clamped = Math.max(0, ms);
    const totalSec = Math.floor(clamped / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return { days, hours, minutes, seconds, live: clamped < 800 };
}

export function getCountdownPose(scene, nowMs) {
    const { lat, lng } = COUNTDOWN_VILLAGE;
    const t = nowMs / 1000;
    const period = 108;
    const ang = (t / period) * Math.PI * 2;
    const radius = 175;
    const lon = Cesium.Math.toRadians(lng);
    const lata = Cesium.Math.toRadians(lat);
    const ground = surfaceHeightMeters(scene, lon, lata);
    const agl = 54 + Math.sin(t * 0.17) * 8;
    const h = (Number.isFinite(ground) ? ground : 3488) + agl;

    const origin = Cesium.Cartesian3.fromDegrees(lng, lat, h);
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
    const local = new Cesium.Cartesian3(Math.cos(ang) * radius, Math.sin(ang) * radius, 0);
    const pos = Cesium.Matrix4.multiplyByPoint(enu, local, new Cesium.Cartesian3());
    const tangent = new Cesium.Cartesian3(-Math.sin(ang), Math.cos(ang), 0);
    const vel = Cesium.Matrix4.multiplyByPointAsVector(enu, tangent, new Cesium.Cartesian3());
    return { pos, vel, lat, lng };
}
