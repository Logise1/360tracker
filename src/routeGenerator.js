const Cesium = window.Cesium;

function slerp(p0, p1, t) {
    let dot = p0.x * p1.x + p0.y * p1.y + p0.z * p1.z;
    dot = Math.max(-1.0, Math.min(1.0, dot));

    const theta = Math.acos(dot);
    if (Math.abs(theta) < 1e-6) {
        return {
            x: p0.x * (1 - t) + p1.x * t,
            y: p0.y * (1 - t) + p1.y * t,
            z: p0.z * (1 - t) + p1.z * t
        };
    }

    const sinTheta = Math.sin(theta);
    const a = Math.sin((1 - t) * theta) / sinTheta;
    const b = Math.sin(t * theta) / sinTheta;

    return {
        x: a * p0.x + b * p1.x,
        y: a * p0.y + b * p1.y,
        z: a * p0.z + b * p1.z
    };
}

function smoothstep(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
}

/** 1 = parked over the city, 0 = high cruise */
export function visitBlendFromFrac(frac) {
    if (frac <= 0.14) return 1;
    if (frac < 0.28) return 1 - smoothstep((frac - 0.14) / 0.14);
    if (frac <= 0.72) return 0;
    if (frac < 0.86) return smoothstep((frac - 0.72) / 0.14);
    return 1;
}

export function getFlightPhase(routeData, currentMs) {
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

    const curr = routeData[idx];
    const next = routeData[idx + 1] || curr;
    const span = Math.max(1, next.arrival - curr.arrival);
    const frac = Math.max(0, Math.min(1, (currentMs - curr.arrival) / span));

    return {
        idx,
        curr,
        next,
        frac,
        visitBlend: visitBlendFromFrac(frac)
    };
}

function altitudeForFrac(frac, cruiseAltitude, visitAltitude) {
    const b = visitBlendFromFrac(frac);
    return visitAltitude + (cruiseAltitude - visitAltitude) * (1 - b);
}

export function buildSantaFlightPath(routeData, cruiseAltitude = 12000, visitAltitude = 160) {
    const positionProperty = new Cesium.SampledPositionProperty();
    positionProperty.setInterpolationOptions({
        interpolationDegree: 1,
        interpolationAlgorithm: Cesium.LinearApproximation
    });

    const WGS84 = Cesium.Ellipsoid.WGS84;

    for (let i = 0; i < routeData.length - 1; i++) {
        const curr = routeData[i];
        const next = routeData[i + 1];

        const tStart = curr.arrival;
        const tEnd = next.arrival;
        const duration = (tEnd - tStart) / 1000;

        if (duration <= 0) continue;

        const carto0 = Cesium.Cartographic.fromDegrees(curr.location_coords.lng, curr.location_coords.lat, 0);
        const carto1 = Cesium.Cartographic.fromDegrees(next.location_coords.lng, next.location_coords.lat, 0);

        const v0 = WGS84.cartographicToCartesian(carto0);
        const v1 = WGS84.cartographicToCartesian(carto1);

        const len0 = Cesium.Cartesian3.magnitude(v0);
        const len1 = Cesium.Cartesian3.magnitude(v1);

        const u0 = { x: v0.x / len0, y: v0.y / len0, z: v0.z / len0 };
        const u1 = { x: v1.x / len1, y: v1.y / len1, z: v1.z / len1 };

        const steps = Math.max(12, Math.min(40, Math.floor(duration / 8)));

        for (let s = 0; s <= steps; s++) {
            if (i > 0 && s === 0) continue;

            const frac = s / steps;
            const julianDate = Cesium.JulianDate.fromDate(new Date(tStart + frac * (tEnd - tStart)));

            let interpUnit;
            if (frac <= 0.14) {
                interpUnit = u0;
            } else if (frac >= 0.86) {
                interpUnit = u1;
            } else {
                interpUnit = slerp(u0, u1, smoothstep((frac - 0.14) / 0.72));
            }

            const scaled = new Cesium.Cartesian3(
                interpUnit.x * 6378137,
                interpUnit.y * 6378137,
                interpUnit.z * 6378137
            );
            const carto = WGS84.cartesianToCartographic(scaled);
            if (carto) {
                carto.height = altitudeForFrac(frac, cruiseAltitude, visitAltitude);
                positionProperty.addSample(julianDate, WGS84.cartographicToCartesian(carto));
            }
        }
    }

    return positionProperty;
}
