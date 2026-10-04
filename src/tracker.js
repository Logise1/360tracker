const Cesium = window.Cesium;

export class SantaTracker {
    constructor(viewer, routeData, positionProperty) {
        this.viewer = viewer;
        this.routeData = routeData;
        this.positionProperty = positionProperty;
    }

    getVelocityAtTime(time) {
        const delta = 0.5;
        const t1 = Cesium.JulianDate.addSeconds(time, -delta, new Cesium.JulianDate());
        const t2 = Cesium.JulianDate.addSeconds(time, delta, new Cesium.JulianDate());

        const p1 = this.positionProperty.getValue(t1);
        const p2 = this.positionProperty.getValue(t2);

        if (!p1 || !p2) return null;

        const diff = Cesium.Cartesian3.subtract(p2, p1, new Cesium.Cartesian3());
        return Cesium.Cartesian3.divideByScalar(diff, delta * 2.0, new Cesium.Cartesian3());
    }

    setVisitMode() {}
}
