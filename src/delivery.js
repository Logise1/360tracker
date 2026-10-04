export const ROOFTOP_MS = 2600;
export const EXIT_MS = 1800;

export function updateDeliveryStage(stage, stageT0, now, frac, visitBlend) {
    const vb = Math.max(0, Math.min(1, visitBlend || 0));
    const landing = frac >= 0.70;
    const parkedStart = frac <= 0.14;
    const parkedEnd = frac >= 0.86;
    const cruise = frac > 0.34 && frac < 0.70;

    if (stage === 'exit' && now - stageT0 >= EXIT_MS) {
        return { stage: 'flight', stageT0: now };
    }

    if (cruise && stage !== 'exit') {
        return { stage: 'flight', stageT0: now };
    }

    if (stage === 'flight') {
        if (vb >= 0.88 && (parkedStart || parkedEnd)) {
            return { stage: 'interior', stageT0: now };
        }
        if (landing && vb >= 0.80) {
            return { stage: 'rooftops', stageT0: now };
        }
    }

    if (stage === 'rooftops' && now - stageT0 >= ROOFTOP_MS) {
        return { stage: 'interior', stageT0: now };
    }

    if (stage === 'interior' && frac < 0.32 && vb < 0.88) {
        return { stage: 'exit', stageT0: now };
    }

    return { stage, stageT0 };
}

export function getDeliveryCinematic(stage, now, stageT0, frac, visitBlend) {
    const vb = Math.max(0, Math.min(1, visitBlend || 0));
    const exitT = Math.max(0, Math.min(1, (now - stageT0) / EXIT_MS));

    if (stage === 'rooftops') {
        return {
            mode: 'rooftops',
            fade: 0,
            showHud: true,
            showHouses: true,
            interior: false,
            approach: 1,
            rooftop: 1,
            exitBlend: 0,
            hideSanta: true
        };
    }

    if (stage === 'interior') {
        return {
            mode: 'interior',
            fade: 0,
            showHud: false,
            showHouses: true,
            interior: true,
            approach: 0,
            rooftop: 0,
            exitBlend: 0,
            hideSanta: true
        };
    }

    if (stage === 'exit') {
        const t = exitT * exitT * (3 - 2 * exitT);
        return {
            mode: 'exit',
            fade: 0,
            showHud: t > 0.48,
            showHouses: t < 0.78,
            interior: false,
            approach: Math.max(0, 1 - t * 1.35),
            rooftop: 0,
            exitBlend: t,
            hideSanta: t < 0.36
        };
    }

    if (frac >= 0.70 && vb < 0.88) {
        const approach = Math.min(1, Math.max(0, (vb - 0.12) / 0.68));
        return {
            mode: 'approach',
            fade: 0,
            showHud: true,
            showHouses: true,
            interior: false,
            approach,
            rooftop: 0,
            exitBlend: 0,
            hideSanta: approach > 0.5
        };
    }

    return {
        mode: 'flight',
        fade: 0,
        showHud: true,
        showHouses: false,
        interior: false,
        approach: 0,
        rooftop: 0,
        exitBlend: 0,
        hideSanta: false
    };
}
