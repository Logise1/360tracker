const Cesium = window.Cesium;
import { buildSantaFlightPath, getFlightPhase } from './routeGenerator.js';
import { SantaTracker } from './tracker.js';
import { Cubemap360Pipeline } from './cubemap360.js';
import { LeftLookHud, getFlightInfo, getUpcomingSchedule } from './hud.js';
import { configureTileStreaming, configureGlobeStreaming, stabilizeImageryLayer } from './tileStreaming.js';
import { createFlightEffects } from './effects.js';
import { getDeliveryCinematic, updateDeliveryStage } from './delivery.js';
import { createHouseVillage } from './houses.js';
import { playMerryChristmas, unlockVoice, playArriving, playTakeoff, speakLater } from './voice.js';
import {
    isCountdownMode,
    COUNTDOWN_VILLAGE,
    nextTakeoffMs,
    splitCountdown,
    getCountdownPose
} from './countdown.js';

const cesiumContainer = document.getElementById('cesiumContainer');
const output360 = document.getElementById('output360');

async function initApp() {
    if (!window.Cesium) {
        console.error('Cesium or Leaflet failed to load from CDN');
        return;
    }
    configureTileStreaming();

    output360.width = 3840;
    output360.height = 2160;

    // 1. Initialize Cesium with optimized multi-pass rendering
    // 1536 is enough for 3840 360; 1920x6 at 60fps is what was saturating the GPU
    const FACE_RESOLUTION = 1536;

    cesiumContainer.style.width = `${FACE_RESOLUTION}px`;
    cesiumContainer.style.height = `${FACE_RESOLUTION}px`;

    const viewer = new Cesium.Viewer(cesiumContainer, {
        useDefaultRenderLoop: false,
        useBrowserRecommendedResolution: false,
        resolutionScale: 1.0,
        msaaSamples: 1,
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        selectionIndicator: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        sceneModePicker: false,
        fullscreenButton: false,
        skyAtmosphere: false,
        requestRenderMode: false,
        contextOptions: {
            webgl: {
                alpha: false,
                antialias: true,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance'
            }
        }
    });

    // Remove any default low-res layer to prevent z-fighting / overlay seams
    viewer.imageryLayers.removeAll();

    // Add clean, high-resolution global satellite imagery (ArcGIS World Imagery)
    try {
        const esriProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
            { enablePickFeatures: false }
        );
        const imageryLayer = viewer.imageryLayers.addImageryProvider(esriProvider);
        stabilizeImageryLayer(imageryLayer);
        const countdownLook = isCountdownMode();
        imageryLayer.brightness = countdownLook ? 1.62 : 1.35;
        imageryLayer.contrast = countdownLook ? 1.02 : 1.08;
        imageryLayer.gamma = countdownLook ? 0.72 : 0.85;
    } catch (err) {
        console.warn('Fallback to OpenStreetMap provider:', err);
        const osmProvider = new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/'
        });
        viewer.imageryLayers.addImageryProvider(osmProvider);
        stabilizeImageryLayer(viewer.imageryLayers.get(0));
        viewer.imageryLayers.get(0).brightness = isCountdownMode() ? 1.62 : 1.35;
        viewer.imageryLayers.get(0).gamma = isCountdownMode() ? 0.72 : 0.85;
    }

    // Globe settings for uniform 360 illumination and seamless tiles
    const globe = viewer.scene.globe;
    globe.baseColor = Cesium.Color.fromCssColorString(isCountdownMode() ? '#d8e4ee' : '#6a7a72');
    configureGlobeStreaming(globe, viewer.scene);
    try {
        if (Cesium.CesiumTerrainProvider.fromIonAssetId) {
            viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
                requestVertexNormals: false,
                requestWaterMask: false
            });
        } else {
            viewer.terrainProvider = await Cesium.createWorldTerrainAsync({
                requestVertexNormals: false,
                requestWaterMask: false
            });
        }
    } catch (err) {
        console.warn('World terrain unavailable, trying createWorldTerrainAsync:', err);
        try {
            viewer.terrainProvider = await Cesium.createWorldTerrainAsync({
                requestVertexNormals: false
            });
        } catch (err2) {
            console.warn('No terrain mesh, using ellipsoid:', err2);
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        }
    }
    if (typeof viewer.scene.verticalExaggeration === 'number') {
        viewer.scene.verticalExaggeration = 1.85;
    } else if (globe.terrainExaggeration !== undefined) {
        globe.terrainExaggeration = 1.85;
    }
    globe.enableLighting = false;
    if (viewer.scene.light && viewer.scene.light.intensity !== undefined) {
        viewer.scene.light.intensity = 3.5;
    }
    viewer.scene.highDynamicRange = false;
    viewer.scene.logarithmicDepthBuffer = false;
    if (viewer.scene.postProcessStages && viewer.scene.postProcessStages.fxaa) {
        viewer.scene.postProcessStages.fxaa.enabled = false;
    }
    viewer.resolutionScale = 1.0;
    viewer.useBrowserRecommendedResolution = false;
    if (viewer.creditDisplay && viewer.creditDisplay.container) {
        viewer.creditDisplay.container.style.display = 'none';
    }
    if (viewer.bottomContainer) viewer.bottomContainer.style.display = 'none';

    if (isCountdownMode()) {
        document.title = 'Santa Tracking Countdown';
        const houses = createHouseVillage(viewer, { snow: true });
        const effects = createFlightEffects(viewer);
        effects.setCountdownWeather(true);
        const hud = new LeftLookHud(1280);
        const pipeline = new Cubemap360Pipeline(viewer, output360, {
            faceResolution: FACE_RESOLUTION,
            hudCanvas: hud.canvas
        });
        const village = COUNTDOWN_VILLAGE;
        houses.update(village.lat, village.lng, true, 'antarctica-vostok');

        const FRAME_MS = 1000 / 30;
        let lastFrameAt = 0;
        const cine = {
            fade: 0,
            showHud: true,
            showMinimap: false,
            interior: false,
            approach: 0,
            rooftop: 0,
            hideSanta: true,
            showHouses: true
        };

        function render(now) {
            requestAnimationFrame(render);
            if (now - lastFrameAt < FRAME_MS - 1) return;
            lastFrameAt = now;

            const wall = Date.now();
            viewer.clock.currentTime = Cesium.JulianDate.now();
            const pose = getCountdownPose(viewer.scene, wall);
            houses.update(village.lat, village.lng, true, 'antarctica-vostok');
            effects.update(pose.pos, pose.vel, 0);
            effects.setVisible(true);
            hud.drawCountdown(splitCountdown(nextTakeoffMs(wall) - wall));
            pipeline.renderFrame(
                pose.pos,
                pose.vel,
                0,
                cine,
                village.lat,
                village.lng,
                [],
                village.lat,
                village.lng,
                'Antarctica'
            );
        }

        requestAnimationFrame(render);
        return;
    }

    // 2. Load Route Data
    let routeData;
    try {
        const resp = await fetch('./route.json');
        routeData = await resp.json();
    } catch (e) {
        console.error('Error loading route.json:', e);
        return;
    }

    const routeStartMs = routeData[0].arrival;
    const routeEndMs = routeData[routeData.length - 1].arrival;
    const routeDurationMs = routeEndMs - routeStartMs;

    // 3. Build Smooth Flight Path & Santa 3D Entity
    const positionProperty = buildSantaFlightPath(routeData, 12000);
    const tracker = new SantaTracker(viewer, routeData, positionProperty);
    const effects = createFlightEffects(viewer);
    const houses = createHouseVillage(viewer);
    const hoho = document.getElementById('hohoho');
    if (hoho) hoho.volume = 1;
    function playHoho() {
        if (!hoho) return;
        try {
            hoho.currentTime = 0;
        } catch (e) {}
        hoho.volume = 1;
        const p = hoho.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    }
    window.addEventListener('pointerdown', () => {
        unlockVoice();
        if (!hoho) return;
        hoho.play().then(() => hoho.pause()).catch(() => {});
    }, { once: true });

    let deliveryStage = 'flight';
    let deliveryStageT0 = performance.now();

    // 4. Initialize 360 Cubemap Pipeline (3840x2160)
    const hud = new LeftLookHud(1280);
    const pipeline = new Cubemap360Pipeline(viewer, output360, {
        faceResolution: FACE_RESOLUTION,
        hudCanvas: hud.canvas
    });

    /**
     * Maps the real-world current system time (Date.now()) continuously
     * into Santa's 25-hour global flight route.
     */
    function getRealtimeFlightDate() {
        const now = Date.now();
        const elapsed = ((now - routeStartMs) % routeDurationMs + routeDurationMs) % routeDurationMs;
        const currentFlightMs = routeStartMs + elapsed;
        return Cesium.JulianDate.fromDate(new Date(currentFlightMs));
    }

    // 5. 30 FPS — YouTube 360 live is 30; 60 with 6 cube faces melted the laptop
    const FRAME_MS = 1000 / 30;
    let lastFrameAt = 0;
    function render(now) {
        requestAnimationFrame(render);
        if (now - lastFrameAt < FRAME_MS - 1) return;
        lastFrameAt = now;

        const currentTime = getRealtimeFlightDate();
        viewer.clock.currentTime = currentTime;
        viewer.clock.tick();

        const santaPos = positionProperty.getValue(currentTime);
        const santaVel = tracker.getVelocityAtTime(currentTime);

        if (santaPos) {
            const flightMs = Cesium.JulianDate.toDate(currentTime).getTime();
            const phase = getFlightPhase(routeData, flightMs);
            const info = getFlightInfo(routeData, flightMs);
            info.visitBlend = phase.visitBlend;
            info.frac = phase.frac;
            const nowMs = performance.now();
            const nextStage = updateDeliveryStage(
                deliveryStage,
                deliveryStageT0,
                nowMs,
                phase.frac,
                phase.visitBlend
            );
            if (nextStage.stage !== deliveryStage) {
                const greetCity = phase.frac >= 0.5 ? info.toCity : info.fromCity;
                if (nextStage.stage === 'rooftops') {
                    playArriving(greetCity);
                }
                if (nextStage.stage === 'interior') {
                    playMerryChristmas(greetCity);
                    speakLater('Delivering presents!', 2200);
                    setTimeout(playHoho, 4800);
                }
                if (nextStage.stage === 'exit') {
                    playHoho();
                    playTakeoff();
                    speakLater(`Next stop, ${info.toCity}!`, 1600);
                }
                deliveryStage = nextStage.stage;
                deliveryStageT0 = nextStage.stageT0;
            }
            const cinematic = getDeliveryCinematic(
                deliveryStage,
                nowMs,
                deliveryStageT0,
                phase.frac,
                phase.visitBlend
            );
            tracker.setVisitMode(cinematic.hideSanta);
            effects.update(santaPos, santaVel, phase.visitBlend);
            if (cinematic.showHud) {
                hud.draw(info);
            }
            const atDest = phase.frac >= 0.5;
            const houseLat = atDest ? info.toLat : info.fromLat;
            const houseLng = atDest ? info.toLng : info.fromLng;
            const houseKey = atDest
                ? `${info.toCity}|${info.toRegion}`
                : `${info.fromCity}|${info.fromRegion}`;
            houses.update(
                houseLat,
                houseLng,
                cinematic.showHouses,
                houseKey
            );
            effects.setVisible(!cinematic.interior);
            pipeline.renderFrame(
                santaPos,
                santaVel,
                phase.visitBlend,
                cinematic,
                houseLat,
                houseLng,
                getUpcomingSchedule(routeData, flightMs, phase.frac, 8),
                info.toLat,
                info.toLng,
                info.toCity
            );
        }

    }

    // Pre-render warming
    const initialTime = getRealtimeFlightDate();
    viewer.clock.currentTime = initialTime;
    const initialPos = positionProperty.getValue(initialTime);
    if (initialPos) {
        viewer.camera.setView({
            destination: initialPos,
            orientation: {
                direction: Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(initialPos, new Cesium.Cartesian3()),
                up: Cesium.Cartesian3.UNIT_Z
            }
        });
        viewer.scene.render();
    }

    requestAnimationFrame(render);
}

window.addEventListener('DOMContentLoaded', initApp);
