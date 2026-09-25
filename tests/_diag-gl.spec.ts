import { expect, test } from '@playwright/test';

/**
 * TEMPORARY diagnostic. A globe assertion fails on firefox only in CI, and the
 * hypothesis is that the runner's firefox has no usable GL context (Cesium cannot
 * render, so camera.flyTo never animates). This reports what the browser actually
 * has, so the cause is evidence rather than inference. Remove once resolved.
 */
test('diag: gl capability', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'diagnostic targets the firefox job');
    const info = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl2 = canvas.getContext('webgl2');
        const gl1 = canvas.getContext('webgl');
        const gl = gl2 ?? gl1;
        let renderer = 'none';
        if (gl) {
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'masked';
        }
        return { webgl2: !!gl2, webgl1: !!gl1, renderer, ua: navigator.userAgent.slice(0, 80) };
    });
    console.log('DIAG_GL ' + JSON.stringify(info));
    expect(info.ua).toContain('Firefox');
});
