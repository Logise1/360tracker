const Cesium = window.Cesium;

const scratchHi = new Cesium.Cartographic();
const scratchRayStart = new Cesium.Cartesian3();
const scratchNormal = new Cesium.Cartesian3();
const scratchDir = new Cesium.Cartesian3();
const scratchHitCarto = new Cesium.Cartographic();
const scratchCarto = new Cesium.Cartographic();
const scratchOffset = new Cesium.Cartesian3();
const scratchSample = new Cesium.Cartesian3();

function applyExaggeration(scene, height) {
    const exag = Number.isFinite(scene.verticalExaggeration) ? scene.verticalExaggeration : 1;
    const rel = Number.isFinite(scene.verticalExaggerationRelativeHeight)
        ? scene.verticalExaggerationRelativeHeight
        : 0;
    if (Cesium.VerticalExaggeration && typeof Cesium.VerticalExaggeration.getHeight === 'function') {
        return Cesium.VerticalExaggeration.getHeight(height, exag, rel);
    }
    return rel + (height - rel) * exag;
}

/** Height of the drawn globe (meters above ellipsoid), or null if unknown. */
export function surfaceHeightMeters(scene, longitude, latitude) {
    const globe = scene.globe;
    scratchCarto.longitude = longitude;
    scratchCarto.latitude = latitude;
    scratchCarto.height = 0;
    const raw = globe.getHeight(scratchCarto);
    const fromTiles = Number.isFinite(raw) ? applyExaggeration(scene, raw) : null;

    scratchHi.longitude = longitude;
    scratchHi.latitude = latitude;
    scratchHi.height = 90000;
    Cesium.Ellipsoid.WGS84.cartographicToCartesian(scratchHi, scratchRayStart);
    Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(scratchRayStart, scratchNormal);
    Cesium.Cartesian3.negate(scratchNormal, scratchDir);
    let fromPick = null;
    try {
        const hit = globe.pick(new Cesium.Ray(scratchRayStart, scratchDir), scene);
        if (hit) {
            const hc = Cesium.Ellipsoid.WGS84.cartesianToCartographic(hit, scratchHitCarto);
            if (hc && Number.isFinite(hc.height)) fromPick = hc.height;
        }
    } catch (e) {
        fromPick = null;
    }

    if (fromTiles != null) {
        return fromPick != null ? Math.max(fromTiles, fromPick) : fromTiles;
    }
    // Ellipsoid pick (~0) is not real terrain — only trust a clear mountain hit
    if (fromPick != null && fromPick > 80) return fromPick;
    return null;
}

function maxSurfaceUnder(scene, positions) {
    let maxH = null;
    for (let i = 0; i < positions.length; i++) {
        const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(positions[i], scratchCarto);
        if (!carto) continue;
        const h = surfaceHeightMeters(scene, carto.longitude, carto.latitude);
        if (h == null) continue;
        maxH = maxH == null ? h : Math.max(maxH, h);
    }
    return maxH;
}

/**
 * Keep a world position above loaded terrain. Snaps up instantly, eases down
 * so missing tiles do not drop the camera through the mesh.
 */
export function liftAboveTerrain(scene, cartesian, clearance, persist, probeDir) {
    if (!cartesian || !scene) return cartesian;
    const probes = [cartesian];
    if (probeDir && Cesium.Cartesian3.magnitudeSquared(probeDir) > 0.01) {
        const distances = [50, 140, 320];
        for (let i = 0; i < distances.length; i++) {
            probes.push(
                Cesium.Cartesian3.add(
                    cartesian,
                    Cesium.Cartesian3.multiplyByScalar(probeDir, distances[i], scratchOffset),
                    new Cesium.Cartesian3()
                )
            );
        }
        const right = Cesium.Cartesian3.cross(
            probeDir,
            Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(cartesian, scratchNormal),
            scratchOffset
        );
        if (Cesium.Cartesian3.magnitudeSquared(right) > 0.01) {
            Cesium.Cartesian3.normalize(right, right);
            probes.push(
                Cesium.Cartesian3.add(
                    cartesian,
                    Cesium.Cartesian3.multiplyByScalar(right, 80, scratchOffset),
                    scratchSample
                )
            );
        }
    }

    const surface = maxSurfaceUnder(scene, probes);
    if (surface == null) {
        if (Number.isFinite(persist.floor) && persist.floor > 0) {
            const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian, scratchCarto);
            if (carto && carto.height < persist.floor) {
                carto.height = persist.floor;
                return Cesium.Ellipsoid.WGS84.cartographicToCartesian(carto);
            }
        }
        return cartesian;
    }

    persist.lastSurface = surface;
    const needed = surface + clearance;
    if (!Number.isFinite(persist.floor) || needed > persist.floor) {
        persist.floor = needed;
    } else {
        persist.floor += (needed - persist.floor) * 0.2;
    }

    const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian, scratchCarto);
    if (!carto) return cartesian;
    if (carto.height < persist.floor) {
        carto.height = persist.floor;
        return Cesium.Ellipsoid.WGS84.cartographicToCartesian(carto);
    }
    return cartesian;
}

export function heightClearance(approach, rooftop) {
    if (rooftop > 0.5) return 22;
    if (approach > 0.2) return 36;
    return 95;
}
