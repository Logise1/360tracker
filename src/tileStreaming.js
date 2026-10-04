const Cesium = window.Cesium;

const TILE_SERVERS = [
    'services.arcgisonline.com:443',
    'server.arcgisonline.com:443',
    'basemaps.arcgis.com:443',
    'tile.openstreetmap.org:443',
    'assets.cesium.com:443',
    'api.cesium.com:443',
    'assets.ion.cesium.com:443',
    'api.ion.cesium.com:443'
];

// Load pass (nadir) asks for dense ground tiles. Cube/minimap pass uses a
// much higher SSE so the 6 cameras do not cancel that work.
export const LOAD_SSE = 1.15;
export const RENDER_SSE = 3.2;
const REQUESTS = 160;
const PER_SERVER = 24;

function setServerRequestCaps(perServer) {
    TILE_SERVERS.forEach((key) => {
        Cesium.RequestScheduler.requestsByServer[key] = perServer;
    });
}

export function configureTileStreaming() {
    Cesium.RequestScheduler.maximumRequests = REQUESTS;
    Cesium.RequestScheduler.maximumRequestsPerServer = PER_SERVER;
    Cesium.RequestScheduler.throttleRequests = true;
    setServerRequestCaps(PER_SERVER);
}

export function beginTileLoadPass(globe) {
    if (globe) globe.maximumScreenSpaceError = LOAD_SSE;
}

export function beginCubeRenderPass(globe) {
    if (globe) globe.maximumScreenSpaceError = RENDER_SSE;
}

export function configureGlobeStreaming(globe, scene) {
    globe.tileCacheSize = 4096;
    globe.loadingDescendantLimit = 0;
    globe.skipLevelOfDetail = false;
    globe.immediatelyLoadDesiredLevelOfDetail = false;
    globe.loadSiblings = true;
    globe.preloadAncestors = true;
    globe.preloadSiblings = true;
    globe.maximumScreenSpaceError = LOAD_SSE;
    globe.enableLighting = false;
    globe.showGroundAtmosphere = false;
    globe.depthTestAgainstTerrain = false;
    globe.showWaterEffect = false;
    globe.cartographicLimitRectangle = Cesium.Rectangle.MAX_VALUE;
    if (scene.fog) {
        scene.fog.enabled = false;
    }
}

export function stabilizeImageryLayer(layer) {
    if (!layer) return;
    layer.minificationFilter = Cesium.TextureMinificationFilter.LINEAR;
    layer.magnificationFilter = Cesium.TextureMagnificationFilter.LINEAR;
    layer.maximumTerrainLevel = 18;
}
