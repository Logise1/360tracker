const Cesium = window.Cesium;

function hash01(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return (h >>> 0) / 4294967296;
}

function rand(i, seed) {
    const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

const COLORS = ['#8b3a3a', '#2d4a38', '#5c4033', '#8a5a32', '#3d5a73', '#4a3a5c', '#6b2e2e', '#3e4a4f'];
const COUNT = 40;

export function createHouseVillage(viewer) {
    const bodies = [];
    const roofs = [];

    for (let i = 0; i < COUNT; i++) {
        bodies.push(viewer.entities.add({
            show: false,
            box: {
                dimensions: new Cesium.Cartesian3(9, 8, 6),
                material: Cesium.Color.fromCssColorString('#c62828'),
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        }));
        roofs.push(viewer.entities.add({
            show: false,
            box: {
                dimensions: new Cesium.Cartesian3(10.5, 9.2, 2.2),
                material: Cesium.Color.fromCssColorString('#eceff1'),
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        }));
    }

    let lastKey = '';

    function update(lat, lng, visible, cityKey) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        if (key !== lastKey) {
            lastKey = key;
            const seed = hash01(cityKey || key);
            const cosLat = Math.cos(Cesium.Math.toRadians(lat));
            for (let i = 0; i < COUNT; i++) {
                const u = rand(i, seed);
                const v = rand(i + 90, seed);
                const spread = 40 + u * 280;
                const ang = v * Math.PI * 2;
                const x = Math.cos(ang) * spread * (0.55 + rand(i + 3, seed) * 0.7);
                const y = Math.sin(ang) * spread * (0.55 + rand(i + 7, seed) * 0.7);
                const w = 7 + rand(i + 11, seed) * 8;
                const d = 6 + rand(i + 13, seed) * 7;
                const h = 5 + rand(i + 17, seed) * 9;
                const dLat = y / 110540;
                const dLng = x / (111320 * Math.max(0.2, cosLat));
                const color = COLORS[Math.floor(rand(i + 21, seed) * COLORS.length)];

                bodies[i].position = Cesium.Cartesian3.fromDegrees(lng + dLng, lat + dLat, h * 0.5);
                bodies[i].box.dimensions = new Cesium.Cartesian3(w, d, h);
                bodies[i].box.material = Cesium.Color.fromCssColorString(color);
                roofs[i].position = Cesium.Cartesian3.fromDegrees(lng + dLng, lat + dLat, h + 1.0);
                roofs[i].box.dimensions = new Cesium.Cartesian3(w + 1.6, d + 1.6, 2.0);
            }
        }

        for (let i = 0; i < COUNT; i++) {
            bodies[i].show = visible;
            roofs[i].show = visible;
        }
    }

    return { update };
}
