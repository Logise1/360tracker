const Cesium = window.Cesium;

function makeGlowSprite(inner, outer, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return canvas;
}

function gravityTowardEarth(particle, dt) {
    const dir = Cesium.Cartesian3.normalize(particle.position, new Cesium.Cartesian3());
    Cesium.Cartesian3.multiplyByScalar(dir, -4.5 * dt, dir);
    Cesium.Cartesian3.add(particle.velocity, dir, particle.velocity);
}

function sparkleDrag(particle, dt) {
    Cesium.Cartesian3.multiplyByScalar(particle.velocity, Math.max(0, 1 - 0.35 * dt), particle.velocity);
    const dir = Cesium.Cartesian3.normalize(particle.position, new Cesium.Cartesian3());
    Cesium.Cartesian3.multiplyByScalar(dir, -1.2 * dt, dir);
    Cesium.Cartesian3.add(particle.velocity, dir, particle.velocity);
}

export function createFlightEffects(viewer) {
    const snowImage = makeGlowSprite('rgba(255,255,255,0.95)', 'rgba(210,230,255,0.45)', 32);
    const sparkImage = makeGlowSprite('rgba(255,240,180,1)', 'rgba(255,170,40,0.55)', 32);
    const giftImage = makeGlowSprite('rgba(255,80,80,0.95)', 'rgba(255,210,80,0.4)', 24);

    const snow = viewer.scene.primitives.add(new Cesium.ParticleSystem({
        image: snowImage,
        startColor: Cesium.Color.WHITE.withAlpha(0.9),
        endColor: Cesium.Color.WHITE.withAlpha(0.0),
        startScale: 1.0,
        endScale: 0.15,
        minimumParticleLife: 3.5,
        maximumParticleLife: 7.0,
        minimumSpeed: 1.5,
        maximumSpeed: 5.5,
        imageSize: new Cesium.Cartesian2(1.4, 1.4),
        emissionRate: 10,
        emitter: new Cesium.SphereEmitter(22.0),
        lifetime: 16.0,
        loop: true,
        sizeInMeters: true,
        updateCallback: gravityTowardEarth
    }));

    const sparkles = viewer.scene.primitives.add(new Cesium.ParticleSystem({
        image: sparkImage,
        startColor: Cesium.Color.fromCssColorString('#ffe082').withAlpha(0.95),
        endColor: Cesium.Color.fromCssColorString('#ff6f00').withAlpha(0.0),
        startScale: 1.2,
        endScale: 0.05,
        minimumParticleLife: 1.2,
        maximumParticleLife: 2.8,
        minimumSpeed: 2.0,
        maximumSpeed: 8.0,
        imageSize: new Cesium.Cartesian2(0.9, 0.9),
        emissionRate: 6,
        emitter: new Cesium.SphereEmitter(4.5),
        lifetime: 16.0,
        loop: true,
        sizeInMeters: true,
        updateCallback: sparkleDrag
    }));

    const gifts = viewer.scene.primitives.add(new Cesium.ParticleSystem({
        image: giftImage,
        startColor: Cesium.Color.fromCssColorString('#ff5252').withAlpha(0.9),
        endColor: Cesium.Color.fromCssColorString('#ffd54f').withAlpha(0.0),
        startScale: 1.4,
        endScale: 0.2,
        minimumParticleLife: 2.0,
        maximumParticleLife: 4.5,
        minimumSpeed: 0.8,
        maximumSpeed: 3.2,
        imageSize: new Cesium.Cartesian2(1.1, 1.1),
        emissionRate: 2,
        emitter: new Cesium.SphereEmitter(3.0),
        lifetime: 16.0,
        loop: true,
        sizeInMeters: true,
        updateCallback: gravityTowardEarth
    }));

    const scratchBehind = new Cesium.Cartesian3();
    const scratchGifts = new Cesium.Cartesian3();
    const scratchUp = new Cesium.Cartesian3();
    const scratchForward = new Cesium.Cartesian3();

    function update(santaPos, santaVel, visitBlend = 0) {
        if (!santaPos) return;

        const visit = Math.max(0, Math.min(1, visitBlend || 0));
        const parked = visit >= 0.92;
        snow.emissionRate = parked ? 0 : 8 * (1 - visit * 0.5);
        sparkles.emissionRate = parked ? 0 : 5 * (1 - visit * 0.4);
        gifts.emissionRate = parked ? 0 : 2;

        snow.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
            santaPos,
            Cesium.Ellipsoid.WGS84,
            snow.modelMatrix
        );

        if (santaVel && Cesium.Cartesian3.magnitudeSquared(santaVel) > 0.01) {
            Cesium.Cartesian3.normalize(santaVel, scratchForward);
        } else {
            const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(santaPos, scratchUp);
            Cesium.Cartesian3.cross(Cesium.Cartesian3.UNIT_Z, up, scratchForward);
            if (Cesium.Cartesian3.magnitudeSquared(scratchForward) < 1e-8) {
                Cesium.Cartesian3.clone(Cesium.Cartesian3.UNIT_X, scratchForward);
            } else {
                Cesium.Cartesian3.normalize(scratchForward, scratchForward);
            }
        }

        Cesium.Cartesian3.add(
            santaPos,
            Cesium.Cartesian3.multiplyByScalar(scratchForward, -16.0, scratchBehind),
            scratchBehind
        );
        sparkles.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
            scratchBehind,
            Cesium.Ellipsoid.WGS84,
            sparkles.modelMatrix
        );

        Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(santaPos, scratchUp);
        Cesium.Cartesian3.add(
            santaPos,
            Cesium.Cartesian3.multiplyByScalar(scratchForward, -8.0, scratchGifts),
            scratchGifts
        );
        Cesium.Cartesian3.add(
            scratchGifts,
            Cesium.Cartesian3.multiplyByScalar(scratchUp, -3.0, scratchUp),
            scratchGifts
        );
        gifts.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
            scratchGifts,
            Cesium.Ellipsoid.WGS84,
            gifts.modelMatrix
        );
    }

    function setVisible(visible) {
        snow.show = visible;
        sparkles.show = visible;
        gifts.show = visible;
    }

    function setCountdownWeather(on) {
        if (on) {
            snow.emissionRate = 28;
            sparkles.emissionRate = 6;
            gifts.emissionRate = 0;
            gifts.show = false;
            snow.emitter = new Cesium.SphereEmitter(48.0);
        }
    }

    return { update, setVisible, setCountdownWeather };
}
