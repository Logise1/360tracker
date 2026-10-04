import { createInteriorRoom } from './interior360.js';
import { beginTileLoadPass, beginCubeRenderPass } from './tileStreaming.js';
import { liftAboveTerrain, heightClearance, surfaceHeightMeters } from './terrainFollow.js';

const Cesium = window.Cesium;

const VS_QUAD = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
    v_uv = (a_pos + 1.0) * 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FS_SEAMLESS_EQUIRECTANGULAR = `
precision highp float;

uniform sampler2D u_front;
uniform sampler2D u_right;
uniform sampler2D u_back;
uniform sampler2D u_left;
uniform sampler2D u_top;
uniform sampler2D u_bottom;
uniform float u_fade;

varying vec2 v_uv;

#define PI 3.14159265358979323846

vec4 cubeFace(vec3 dir) {
    vec3 a = abs(dir);
    vec2 uv;

    if (a.z >= a.x && a.z >= a.y) {
        if (dir.z < 0.0) {
            uv = vec2(dir.x / -dir.z, dir.y / -dir.z) * 0.5 + 0.5;
            return texture2D(u_front, vec2(uv.x, 1.0 - uv.y));
        }
        uv = vec2(-dir.x / dir.z, dir.y / dir.z) * 0.5 + 0.5;
        return texture2D(u_back, vec2(uv.x, 1.0 - uv.y));
    }
    if (a.x >= a.y && a.x >= a.z) {
        if (dir.x > 0.0) {
            uv = vec2(dir.z / dir.x, dir.y / dir.x) * 0.5 + 0.5;
            return texture2D(u_right, vec2(uv.x, 1.0 - uv.y));
        }
        uv = vec2(-dir.z / -dir.x, dir.y / -dir.x) * 0.5 + 0.5;
        return texture2D(u_left, vec2(uv.x, 1.0 - uv.y));
    }
    if (dir.y > 0.0) {
        uv = vec2(dir.x / dir.y, dir.z / dir.y) * 0.5 + 0.5;
        return texture2D(u_top, vec2(uv.x, 1.0 - uv.y));
    }
    uv = vec2(dir.x / -dir.y, -dir.z / -dir.y) * 0.5 + 0.5;
    return texture2D(u_bottom, vec2(uv.x, 1.0 - uv.y));
}

void main() {
    float lon = (v_uv.x - 0.5) * 2.0 * PI;
    float lat = (v_uv.y - 0.5) * PI;
    float cosLat = cos(lat);
    vec3 dir = normalize(vec3(
        sin(lon) * cosLat,
        sin(lat),
        -cos(lon) * cosLat
    ));

    gl_FragColor = mix(cubeFace(dir), vec4(0.0, 0.0, 0.0, 1.0), u_fade);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('Shader compile error: ' + info);
    }
    return shader;
}

function createProgram(gl, vsSource, fsSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error('Program link error: ' + info);
    }
    return program;
}

export class Cubemap360Pipeline {
    constructor(viewer, outputCanvas, options = {}) {
        this.viewer = viewer;
        this.outputCanvas = outputCanvas;
        this.faceResolution = options.faceResolution || 1536;
        this.hudCanvas = options.hudCanvas || null;
        this.minimapCanvas = options.minimapCanvas || null;
        this.globeMapCanvas = document.createElement('canvas');
        this.globeMapCanvas.width = 768;
        this.globeMapCanvas.height = 768;
        this.globeMapCtx = this.globeMapCanvas.getContext('2d', { alpha: false });

        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.width = this.faceResolution;
        this.compositeCanvas.height = this.faceResolution;
        this.compositeCtx = this.compositeCanvas.getContext('2d', { alpha: false });
        this.interior = createInteriorRoom();
        this.cityViewCanvas = document.createElement('canvas');
        this.cityViewCanvas.width = 1024;
        this.cityViewCanvas.height = 1024;
        this.cityViewCtx = this.cityViewCanvas.getContext('2d', { alpha: false });
        this._cityFrame = 0;
        this._cityLockKey = '';
        this._cityEye = null;
        this._cityLook = null;
        this._cityUp = null;
        this._cityAlong = null;
        this._cityRefreshCount = 0;
        this._cityCapturedAt = 0;
        this._bank = 0;
        this._prevFwd = null;
        this._frame = 0;
        this._terrainPersist = { floor: null, lastSurface: null };
        this._cityTerrainPersist = { floor: null, lastSurface: null };

        this.initWebGL();
    }

    initWebGL() {
        const gl = this.outputCanvas.getContext('webgl', {
            antialias: false,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance'
        });
        if (!gl) {
            throw new Error('WebGL not supported on output canvas');
        }
        this.gl = gl;

        this.program = createProgram(gl, VS_QUAD, FS_SEAMLESS_EQUIRECTANGULAR);

        // Quad buffer
        const quadVerts = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1
        ]);
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

        // 6 2D Textures
        this.textureNames = ['u_front', 'u_right', 'u_back', 'u_left', 'u_top', 'u_bottom'];
        this.textures = [];

        this.textureNames.forEach((name, i) => {
            const tex = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                this.faceResolution,
                this.faceResolution,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                null
            );

            this.textures.push(tex);
        });

        gl.useProgram(this.program);
        this.textureNames.forEach((name, i) => {
            const loc = gl.getUniformLocation(this.program, name);
            gl.uniform1i(loc, i);
        });
        this.fadeLoc = gl.getUniformLocation(this.program, 'u_fade');
        gl.uniform1f(this.fadeLoc, 0);
    }

    _uploadCanvasFace(i, canvas) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    }

    _drawEquirect(fade) {
        const gl = this.gl;
        gl.viewport(0, 0, this.outputCanvas.width, this.outputCanvas.height);
        gl.useProgram(this.program);
        gl.uniform1f(this.fadeLoc, Math.max(0, Math.min(1, fade || 0)));
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        const aPos = gl.getAttribLocation(this.program, 'a_pos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    _lockWindowPose(lat, lng) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        if (key === this._cityLockKey && this._cityEye) {
            const surface = surfaceHeightMeters(
                this.viewer.scene,
                Cesium.Math.toRadians(lng),
                Cesium.Math.toRadians(lat)
            );
            if (Number.isFinite(surface)) {
                const eyeH = surface + 28;
                const carto = Cesium.Cartographic.fromDegrees(lng, lat, eyeH);
                this._cityEye = Cesium.Ellipsoid.WGS84.cartographicToCartesian(carto);
                this._cityTerrainPersist.floor = eyeH;
            }
            return true;
        }

        const surface = surfaceHeightMeters(this.viewer.scene, Cesium.Math.toRadians(lng), Cesium.Math.toRadians(lat));
        const eyeH = (Number.isFinite(surface) ? surface : (this._cityTerrainPersist.floor || 0)) + 28;
        if (Number.isFinite(surface)) this._cityTerrainPersist.floor = eyeH;
        const eyeCarto = Cesium.Cartographic.fromDegrees(lng, lat, eyeH);
        const eye = Cesium.Ellipsoid.WGS84.cartographicToCartesian(eyeCarto);
        const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(eye, new Cesium.Cartesian3());
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(eye);
        const east = Cesium.Matrix4.getColumn(enu, 0, new Cesium.Cartesian3());
        const north = Cesium.Matrix4.getColumn(enu, 1, new Cesium.Cartesian3());
        Cesium.Cartesian3.normalize(east, east);
        Cesium.Cartesian3.normalize(north, north);

        const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453);
        const heading = (seed - Math.floor(seed)) * Math.PI * 2;
        const along = Cesium.Cartesian3.add(
            Cesium.Cartesian3.multiplyByScalar(east, Math.cos(heading), new Cesium.Cartesian3()),
            Cesium.Cartesian3.multiplyByScalar(north, Math.sin(heading), new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );
        Cesium.Cartesian3.normalize(along, along);

        const pitch = Cesium.Math.toRadians(24);
        const look = Cesium.Cartesian3.subtract(
            Cesium.Cartesian3.multiplyByScalar(along, Math.cos(pitch), new Cesium.Cartesian3()),
            Cesium.Cartesian3.multiplyByScalar(up, Math.sin(pitch), new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );
        Cesium.Cartesian3.normalize(look, look);

        this._cityLockKey = key;
        this._cityEye = eye;
        this._cityLook = look;
        this._cityUp = up;
        this._cityAlong = along;
        this._cityRefreshCount = 0;
        this._cityCapturedAt = 0;
        return true;
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

    _projectToMap(cartesian, size) {
        const scene = this.viewer.scene;
        const canvas = this.viewer.canvas;
        let p = null;
        if (Cesium.SceneTransforms.worldToWindowCoordinates) {
            p = Cesium.SceneTransforms.worldToWindowCoordinates(scene, cartesian);
        } else if (Cesium.SceneTransforms.wgs84ToWindowCoordinates) {
            p = Cesium.SceneTransforms.wgs84ToWindowCoordinates(scene, cartesian);
        }
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
        const w = canvas.clientWidth || canvas.width || 1;
        const h = canvas.clientHeight || canvas.height || 1;
        return {
            x: (p.x / w) * size,
            y: (p.y / h) * size
        };
    }

    _frameSantaAndDest(santaPos, destLat, destLng) {
        const camera = this.viewer.scene.camera;
        const carto = Cesium.Cartographic.fromCartesian(santaPos);
        const groundCarto = Cesium.Cartographic.clone(carto);
        groundCarto.height = 0;
        const ground = Cesium.Ellipsoid.WGS84.cartographicToCartesian(groundCarto);
        const hasDest = Number.isFinite(destLat) && Number.isFinite(destLng);
        const destC = hasDest
            ? Cesium.Cartesian3.fromDegrees(destLng, destLat, 0)
            : ground;

        const bs = Cesium.BoundingSphere.fromPoints([ground, destC]);
        const dist = Cesium.Cartesian3.distance(ground, destC);
        const radius = Math.max(bs.radius, dist * 0.5, 25000);
        const heading = Cesium.Math.toRadians(18);
        const pitch = Cesium.Math.toRadians(-74);
        const range = Math.max(radius * 5.2, 140000);

        camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        camera.frustum.fov = Cesium.Math.toRadians(50);
        camera.frustum.aspectRatio = 1.0;
        camera.viewBoundingSphere(
            new Cesium.BoundingSphere(bs.center, radius),
            new Cesium.HeadingPitchRange(heading, pitch, range)
        );
    }

    _captureGlobeMinimap(santaPos, destLat, destLng, destName, visitBlend, approach) {
        const viewer = this.viewer;
        const camera = viewer.scene.camera;
        const carto = Cesium.Cartographic.fromCartesian(santaPos);
        if (!carto || !Number.isFinite(carto.latitude)) return;

        this._frameSantaAndDest(santaPos, destLat, destLng);
        viewer.scene.render();
        viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

        const groundCarto = Cesium.Cartographic.clone(carto);
        groundCarto.height = 0;
        const startC = Cesium.Ellipsoid.WGS84.cartographicToCartesian(groundCarto);
        const endC = Number.isFinite(destLat) && Number.isFinite(destLng)
            ? Cesium.Cartesian3.fromDegrees(destLng, destLat, 0)
            : null;

        const ctx = this.globeMapCtx;
        const S = this.globeMapCanvas.width;
        const r = 26;
        ctx.clearRect(0, 0, S, S);
        ctx.save();
        this._roundRect(ctx, 8, 8, S - 16, S - 16, r);
        ctx.clip();
        ctx.drawImage(viewer.canvas, 0, 0, S, S);

        const vg = ctx.createRadialGradient(S / 2, S * 0.42, S * 0.12, S / 2, S / 2, S * 0.7);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(4, 8, 14, 0.08)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, S, S);

        const p0 = this._projectToMap(startC, S);
        const p1 = endC ? this._projectToMap(endC, S) : null;

        if (p0 && p1) {
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(6, 10, 16, 0.65)';
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.strokeStyle = '#d4af6c';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([12, 9]);
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (p1) {
            ctx.beginPath();
            ctx.arc(p1.x, p1.y, 9, 0, Math.PI * 2);
            ctx.fillStyle = '#d4af6c';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#0c1218';
            ctx.stroke();
            if (destName) {
                ctx.font = '22px "Lobster", cursive';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                const labelY = p1.y < 80 ? p1.y + 38 : p1.y - 18;
                const tw = Math.min(ctx.measureText(destName).width, S - 40);
                ctx.fillStyle = 'rgba(6, 10, 16, 0.78)';
                ctx.fillRect(p1.x - tw / 2 - 10, labelY - 24, tw + 20, 30);
                ctx.fillStyle = '#ffd76a';
                ctx.fillText(destName, p1.x, labelY, S - 40);
            }
        }

        if (p0) {
            ctx.beginPath();
            ctx.arc(p0.x, p0.y, 16, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(232, 228, 220, 0.2)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p0.x, p0.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#f2eee6';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#c9a227';
            ctx.stroke();
            ctx.font = '20px "Lobster", cursive';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = 'rgba(6, 10, 16, 0.75)';
            const slw = ctx.measureText('Santa').width;
            ctx.fillRect(p0.x - slw / 2 - 8, p0.y + 12, slw + 16, 26);
            ctx.fillStyle = '#ffd76a';
            ctx.fillText('Santa', p0.x, p0.y + 14);
        }

        ctx.font = '22px "Lobster", cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(6, 10, 16, 0.72)';
        ctx.fillRect(S / 2 - 90, 20, 180, 34);
        ctx.fillStyle = '#ffd76a';
        ctx.fillText('Flight Path', S / 2, 46);
        ctx.restore();

        ctx.save();
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(212, 175, 108, 0.9)';
        ctx.lineJoin = 'round';
        this._roundRect(ctx, 11, 11, S - 22, S - 22, r);
        ctx.stroke();
        ctx.restore();
        viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }

    _rotateAround(vec, axis, angle, result) {
        const q = Cesium.Quaternion.fromAxisAngle(axis, angle, new Cesium.Quaternion());
        const m = Cesium.Matrix3.fromQuaternion(q, new Cesium.Matrix3());
        return Cesium.Matrix3.multiplyByVector(m, vec, result || new Cesium.Cartesian3());
    }

    _captureCityView(lat, lng) {
        if (!this._lockWindowPose(lat, lng)) return;

        const viewer = this.viewer;
        const camera = viewer.scene.camera;
        const now = performance.now();

        const alreadySharp = this._cityRefreshCount >= 3 && (now - this._cityCapturedAt) < 120000;
        if (alreadySharp) return;
        if (this._cityRefreshCount > 0 && now - this._cityCapturedAt < 900) return;

        camera.frustum.fov = Cesium.Math.toRadians(72);
        camera.frustum.aspectRatio = 1.0;
        camera.setView({
            destination: this._cityEye,
            orientation: {
                direction: this._cityLook,
                up: this._cityUp
            }
        });
        viewer.scene.render();
        this.cityViewCtx.drawImage(viewer.canvas, 0, 0, 1024, 1024);
        this._cityCapturedAt = now;
        this._cityRefreshCount += 1;
    }

    renderFrame(santaPos, santaVelocity, visitBlend = 0, cinematic = null, houseLat, houseLng, schedule, destLat, destLng, destName) {
        const gl = this.gl;
        const viewer = this.viewer;
        const camera = viewer.scene.camera;
        const res = this.faceResolution;
        const container = this.viewer.container;
        const cine = cinematic || {
            fade: 0,
            showHud: true,
            interior: false,
            approach: 0
        };

        if (cine.interior) {
            this._captureCityView(houseLat, houseLng);
            this.interior.draw(performance.now() / 1000, this.cityViewCanvas, schedule);
            this.interior.faces.forEach((canvas, i) => this._uploadCanvasFace(i, canvas));
            this._drawEquirect(cine.fade);
            return;
        }

        // Only resize when the drawing buffer actually drifted
        if (container.clientWidth !== res || container.clientHeight !== res) {
            container.style.width = `${res}px`;
            container.style.height = `${res}px`;
            viewer.resize();
        }

        if (viewer.canvas.width !== res || viewer.canvas.height !== res) {
            viewer.canvas.width = res;
            viewer.canvas.height = res;
        }

        // Forward: flight direction
        let forward = new Cesium.Cartesian3();
        if (santaVelocity && Cesium.Cartesian3.magnitudeSquared(santaVelocity) > 0.01) {
            Cesium.Cartesian3.normalize(santaVelocity, forward);
            this._lastForward = Cesium.Cartesian3.clone(forward, this._lastForward || new Cesium.Cartesian3());
        } else if (this._lastForward) {
            Cesium.Cartesian3.clone(this._lastForward, forward);
        } else {
            const normal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(santaPos, new Cesium.Cartesian3());
            Cesium.Cartesian3.cross(Cesium.Cartesian3.UNIT_Z, normal, forward);
            Cesium.Cartesian3.normalize(forward, forward);
        }

        const surfaceUp = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(santaPos, new Cesium.Cartesian3());

        // Keep look direction level with the horizon — never pitch down while descending
        const fwdUp = Cesium.Cartesian3.dot(forward, surfaceUp);
        Cesium.Cartesian3.subtract(
            forward,
            Cesium.Cartesian3.multiplyByScalar(surfaceUp, fwdUp, new Cesium.Cartesian3()),
            forward
        );
        if (Cesium.Cartesian3.magnitudeSquared(forward) > 0.01) {
            Cesium.Cartesian3.normalize(forward, forward);
            this._lastForward = Cesium.Cartesian3.clone(forward, this._lastForward || new Cesium.Cartesian3());
        } else if (this._lastForward) {
            Cesium.Cartesian3.clone(this._lastForward, forward);
        }

        const approach = Math.max(0, Math.min(1, cine.approach || 0));
        const rooftop = Math.max(0, Math.min(1, cine.rooftop || 0));
        const exitBlend = Math.max(0, Math.min(1, cine.exitBlend || 0));
        const roofH = rooftop > 0.5 ? 14 : 16;
        const camPos = new Cesium.Cartesian3();
        const carto = Cesium.Cartographic.fromCartesian(santaPos);
        carto.height = carto.height * (1 - approach) + roofH * approach;
        const lowPos = Cesium.Ellipsoid.WGS84.cartographicToCartesian(carto);
        const upAmt = 2.4;
        const aheadAmt = 3.5 * (1 - approach * 0.4);
        Cesium.Cartesian3.add(
            lowPos,
            Cesium.Cartesian3.multiplyByScalar(surfaceUp, upAmt, new Cesium.Cartesian3()),
            camPos
        );
        Cesium.Cartesian3.add(
            camPos,
            Cesium.Cartesian3.multiplyByScalar(forward, aheadAmt, new Cesium.Cartesian3()),
            camPos
        );

        let up = Cesium.Cartesian3.clone(surfaceUp);
        let right = Cesium.Cartesian3.cross(forward, up, new Cesium.Cartesian3());
        Cesium.Cartesian3.normalize(right, right);
        Cesium.Cartesian3.cross(right, forward, up);
        Cesium.Cartesian3.normalize(up, up);

        this._bank = 0;

        if (exitBlend > 0.001) {
            this._lockWindowPose(houseLat, houseLng);
            if (this._cityEye && this._cityLook && this._cityUp) {
                const inside = Cesium.Cartesian3.subtract(
                    this._cityEye,
                    Cesium.Cartesian3.multiplyByScalar(this._cityLook, 3.5, new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                );
                const through = Cesium.Cartesian3.add(
                    this._cityEye,
                    Cesium.Cartesian3.multiplyByScalar(this._cityLook, 28, new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                );
                const chase = Cesium.Cartesian3.clone(camPos);
                let from;
                let to;
                let u;
                if (exitBlend < 0.42) {
                    from = inside;
                    to = through;
                    u = exitBlend / 0.42;
                } else {
                    from = through;
                    to = chase;
                    u = (exitBlend - 0.42) / 0.58;
                }
                u = u * u * (3 - 2 * u);
                Cesium.Cartesian3.lerp(from, to, u, camPos);
                const mixedFwd = Cesium.Cartesian3.lerp(
                    this._cityLook,
                    forward,
                    exitBlend,
                    new Cesium.Cartesian3()
                );
                Cesium.Cartesian3.normalize(mixedFwd, forward);
                const mixedUp = Cesium.Cartesian3.lerp(
                    this._cityUp,
                    up,
                    exitBlend,
                    new Cesium.Cartesian3()
                );
                Cesium.Cartesian3.normalize(mixedUp, up);
                right = Cesium.Cartesian3.cross(forward, up, right);
                Cesium.Cartesian3.normalize(right, right);
                Cesium.Cartesian3.cross(right, forward, up);
                Cesium.Cartesian3.normalize(up, up);
            }
        }

        if (cine.skipTerrainLift !== true) {
            const lifted = liftAboveTerrain(
                viewer.scene,
                camPos,
                heightClearance(approach, rooftop),
                this._terrainPersist,
                forward
            );
            Cesium.Cartesian3.clone(lifted, camPos);
        }

        const levelDot = Cesium.Cartesian3.dot(forward, surfaceUp);
        Cesium.Cartesian3.subtract(
            forward,
            Cesium.Cartesian3.multiplyByScalar(surfaceUp, levelDot, new Cesium.Cartesian3()),
            forward
        );
        if (Cesium.Cartesian3.magnitudeSquared(forward) > 0.01) {
            Cesium.Cartesian3.normalize(forward, forward);
        }
        right = Cesium.Cartesian3.cross(forward, surfaceUp, right);
        Cesium.Cartesian3.normalize(right, right);
        Cesium.Cartesian3.cross(right, forward, up);
        Cesium.Cartesian3.normalize(up, up);

        const minusUp = Cesium.Cartesian3.negate(up, new Cesium.Cartesian3());
        const minusRight = Cesium.Cartesian3.negate(right, new Cesium.Cartesian3());
        const minusForward = Cesium.Cartesian3.negate(forward, new Cesium.Cartesian3());

        camera.frustum.fov = Cesium.Math.PI_OVER_TWO;
        camera.frustum.aspectRatio = 1.0;

        // Dense ground tiles from one nadir camera; cube faces must not change LOD
        const globe = viewer.scene.globe;
        const warmupLift = rooftop > 0.5 || approach > 0.15 ? 90 : 2800;
        const warmupPos = Cesium.Cartesian3.add(
            santaPos,
            Cesium.Cartesian3.multiplyByScalar(surfaceUp, warmupLift, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );
        const wuCarto = Cesium.Cartographic.fromCartesian(warmupPos);
        if (wuCarto) {
            const wuGround = surfaceHeightMeters(viewer.scene, wuCarto.longitude, wuCarto.latitude);
            const wuMin = (wuGround == null ? (this._terrainPersist.floor || 0) : wuGround) + (rooftop > 0.5 ? 80 : 450);
            if (wuCarto.height < wuMin) {
                wuCarto.height = wuMin;
                Cesium.Ellipsoid.WGS84.cartographicToCartesian(wuCarto, warmupPos);
            }
        }
        this._frame += 1;
        beginTileLoadPass(globe);
        if ((this._frame & 1) === 1) {
            camera.frustum.fov = Cesium.Math.toRadians(110);
            camera.setView({
                destination: warmupPos,
                orientation: {
                    direction: Cesium.Cartesian3.negate(surfaceUp, new Cesium.Cartesian3()),
                    up: forward
                }
            });
            viewer.scene.render();
            camera.frustum.fov = Cesium.Math.PI_OVER_TWO;
        }

        beginCubeRenderPass(globe);
        if (cine.showHud && cine.showMinimap !== false && (this._frame & 1) === 0) {
            this._captureGlobeMinimap(
                santaPos,
                destLat,
                destLng,
                destName,
                visitBlend,
                cine.approach || 0
            );
            camera.frustum.fov = Cesium.Math.PI_OVER_TWO;
            camera.frustum.aspectRatio = 1.0;
        }

        // End on nadir so the globe keeps ground tiles between frames
        const cameras = [
            { dir: forward,      upVec: up },
            { dir: right,        upVec: up },
            { dir: minusForward, upVec: up },
            { dir: minusRight,   upVec: up },
            { dir: up,           upVec: minusForward },
            { dir: minusUp,      upVec: forward }
        ];

        // Render each face and copy to corresponding 2D texture
        for (let i = 0; i < 6; i++) {
            const cam = cameras[i];
            camera.setView({
                destination: camPos,
                orientation: {
                    direction: cam.dir,
                    up: cam.upVec
                }
            });

            viewer.scene.render();

            let source = viewer.canvas;
            if (i === 3 && cine.showHud && (this.hudCanvas || this.globeMapCanvas)) {
                const ctx = this.compositeCtx;
                ctx.clearRect(0, 0, res, res);
                ctx.drawImage(viewer.canvas, 0, 0, res, res);

                const pad = Math.round(res * 0.035);
                const showMap = cine.showMinimap !== false && this.globeMapCanvas;
                if (showMap && this.hudCanvas) {
                    const gap = Math.round(res * 0.025);
                    const panel = Math.round((res - pad * 2 - gap) / 2);
                    const y = Math.round((res - panel) / 2);
                    ctx.drawImage(this.hudCanvas, pad, y, panel, panel);
                    ctx.drawImage(this.globeMapCanvas, pad + panel + gap, y, panel, panel);
                } else if (this.hudCanvas) {
                    const panel = Math.round(res * 0.72);
                    const x = Math.round((res - panel) / 2);
                    const y = Math.round((res - panel) / 2);
                    ctx.drawImage(this.hudCanvas, x, y, panel, panel);
                }
                source = this.compositeCanvas;
            }

            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                source
            );
        }

        this._drawEquirect(cine.fade);
    }
}
