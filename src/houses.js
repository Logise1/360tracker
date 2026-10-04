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
const SNOW_COLORS = ['#8b1e1e', '#6b2222', '#3d4f3a', '#5c4033', '#2f3d4a', '#7a3030', '#4a5560'];

export function createHouseVillage(viewer, options = {}) {
    const snow = options.snow === true;
    const COUNT = snow ? 52 : 40;
    const TREE_COUNT = snow ? 34 : 0;
    const palette = snow ? SNOW_COLORS : COLORS;
    const bodies = [];
    const roofs = [];
    const trees = [];
    const extras = [];

    for (let i = 0; i < COUNT; i++) {
        bodies.push(viewer.entities.add({
            show: false,
            box: {
                dimensions: new Cesium.Cartesian3(9, 8, 6),
                material: Cesium.Color.fromCssColorString('#c62828'),
                heightReference: snow
                    ? Cesium.HeightReference.NONE
                    : Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        }));
        roofs.push(viewer.entities.add({
            show: false,
            box: {
                dimensions: new Cesium.Cartesian3(10.5, 9.2, 2.2),
                material: Cesium.Color.fromCssColorString(snow ? '#f4f7fb' : '#eceff1'),
                heightReference: snow
                    ? Cesium.HeightReference.NONE
                    : Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        }));
    }

    for (let i = 0; i < TREE_COUNT; i++) {
        trees.push(viewer.entities.add({
            show: false,
            cylinder: {
                length: 11,
                topRadius: 0.15,
                bottomRadius: 3.6,
                material: Cesium.Color.fromCssColorString('#1b4332'),
                heightReference: snow
                    ? Cesium.HeightReference.NONE
                    : Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        }));
    }

    if (snow) {
        extras.push(viewer.entities.add({
            show: false,
            polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray([-62.534, -64.844, -62.532, -64.844, -62.533, -64.842]),
                material: Cesium.Color.fromCssColorString('#c4b089'),
                height: 1,
                outline: false
            }
        }));
        extras.push(viewer.entities.add({
            show: false,
            box: {
                dimensions: new Cesium.Cartesian3(22, 16, 11),
                material: Cesium.Color.fromCssColorString('#7a1f1f'),
                heightReference: Cesium.HeightReference.NONE
            }
        }));
        extras.push(viewer.entities.add({
            show: false,
            box: {
                dimensions: new Cesium.Cartesian3(24.5, 18.2, 3.2),
                material: Cesium.Color.fromCssColorString('#f7f9fc'),
                heightReference: Cesium.HeightReference.NONE
            }
        }));
    }

    let lastKey = '';

    function update(lat, lng, visible, cityKey, groundHeight) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const ground = snow && Number.isFinite(groundHeight) ? groundHeight : 0;
        const key = `${lat.toFixed(4)},${lng.toFixed(4)},${Math.round(ground)}`;
        if (key !== lastKey) {
            lastKey = key;
            const seed = hash01(cityKey || key);
            const cosLat = Math.cos(Cesium.Math.toRadians(lat));
            const metersToLng = 111320 * Math.max(0.08, Math.abs(cosLat));
            for (let i = 0; i < COUNT; i++) {
                const u = rand(i, seed);
                const v = rand(i + 90, seed);
                const spread = snow ? 22 + u * 95 : 40 + u * 280;
                const ang = v * Math.PI * 2;
                const x = Math.cos(ang) * spread * (0.55 + rand(i + 3, seed) * 0.7);
                const y = Math.sin(ang) * spread * (0.55 + rand(i + 7, seed) * 0.7);
                const w = 7 + rand(i + 11, seed) * 8;
                const d = 6 + rand(i + 13, seed) * 7;
                const h = 5 + rand(i + 17, seed) * 9;
                const dLat = y / 110540;
                const dLng = x / metersToLng;
                const color = palette[Math.floor(rand(i + 21, seed) * palette.length)];

                bodies[i].position = Cesium.Cartesian3.fromDegrees(
                    lng + dLng,
                    lat + dLat,
                    ground + h * 0.5
                );
                bodies[i].box.dimensions = new Cesium.Cartesian3(w, d, h);
                bodies[i].box.material = Cesium.Color.fromCssColorString(color);
                roofs[i].position = Cesium.Cartesian3.fromDegrees(
                    lng + dLng,
                    lat + dLat,
                    ground + h + 1.0
                );
                roofs[i].box.dimensions = new Cesium.Cartesian3(w + 1.6, d + 1.6, 2.0);
            }
            for (let i = 0; i < TREE_COUNT; i++) {
                const u = rand(i + 200, seed);
                const v = rand(i + 280, seed);
                const spread = 16 + u * 110;
                const ang = v * Math.PI * 2;
                const x = Math.cos(ang) * spread;
                const y = Math.sin(ang) * spread;
                const len = 8 + rand(i + 310, seed) * 8;
                trees[i].position = Cesium.Cartesian3.fromDegrees(
                    lng + x / metersToLng,
                    lat + y / 110540,
                    ground + len * 0.5
                );
                trees[i].cylinder.length = len;
                trees[i].cylinder.bottomRadius = 2.4 + rand(i + 340, seed) * 2.2;
            }
            if (snow && extras.length >= 3) {
                const ring = [];
                for (let k = 0; k < 8; k++) {
                    const a = (k / 8) * Math.PI * 2;
                    ring.push(lng + (Math.cos(a) * 18) / metersToLng);
                    ring.push(lat + (Math.sin(a) * 18) / 110540);
                }
                extras[0].polygon.hierarchy = new Cesium.PolygonHierarchy(
                    Cesium.Cartesian3.fromDegreesArray(ring)
                );
                extras[0].polygon.height = ground + 0.35;
                extras[1].position = Cesium.Cartesian3.fromDegrees(lng, lat, ground + 6);
                extras[2].position = Cesium.Cartesian3.fromDegrees(lng, lat, ground + 12.2);
            }
        }

        for (let i = 0; i < COUNT; i++) {
            bodies[i].show = visible;
            roofs[i].show = visible;
        }
        for (let i = 0; i < TREE_COUNT; i++) trees[i].show = visible;
        for (let i = 0; i < extras.length; i++) extras[i].show = visible;
    }

    return { update };
}
