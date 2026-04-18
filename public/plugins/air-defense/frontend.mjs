var { useState: e, useEffect: t, useRef: n, useMemo: r, useCallback: i, useContext: a, useReducer: o, useLayoutEffect: s, StrictMode: c, Suspense: l, createContext: u, createElement: d, cloneElement: f, isValidElement: p, Fragment: m, Children: h, Component: ee, PureComponent: te, createRef: g, forwardRef: _, memo: ne, lazy: re, startTransition: v, useTransition: y, useDeferredValue: ie, useId: ae, useSyncExternalStore: oe, useInsertionEffect: se } = globalThis.__WWV_HOST__.React, b = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), x = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), S = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, n) => n ? n.toUpperCase() : t.toLowerCase()), C = (e) => {
	let t = S(e);
	return t.charAt(0).toUpperCase() + t.slice(1);
}, w = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, T = (e) => {
	for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
	return !1;
}, E = u({}), D = () => a(E), O = _(({ color: e, size: t, strokeWidth: n, absoluteStrokeWidth: r, className: i = "", children: a, iconNode: o, ...s }, c) => {
	let { size: l = 24, strokeWidth: u = 2, absoluteStrokeWidth: f = !1, color: p = "currentColor", className: m = "" } = D() ?? {}, h = r ?? f ? Number(n ?? u) * 24 / Number(t ?? l) : n ?? u;
	return d("svg", {
		ref: c,
		...w,
		width: t ?? l ?? w.width,
		height: t ?? l ?? w.height,
		stroke: e ?? p,
		strokeWidth: h,
		className: b("lucide", m, i),
		...!a && !T(s) && { "aria-hidden": "true" },
		...s
	}, [...o.map(([e, t]) => d(e, t)), ...Array.isArray(a) ? a : [a]]);
}), k = ((e, t) => {
	let n = _(({ className: n, ...r }, i) => d(O, {
		ref: i,
		iconNode: t,
		className: b(`lucide-${x(C(e))}`, `lucide-${e}`, n),
		...r
	}));
	return n.displayName = C(e), n;
})("shield-alert", [
	["path", {
		d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
		key: "oel41y"
	}],
	["path", {
		d: "M12 8v4",
		key: "1got3b"
	}],
	["path", {
		d: "M12 16h.01",
		key: "1drbdi"
	}]
]), { Viewer: ce, Entity: A, Cartesian3: j, Cartesian2: M, Color: N, CallbackProperty: P, DistanceDisplayCondition: F, NearFarScalar: I, HeightReference: L, Resource: R, Rectangle: z, PolygonHierarchy: B, ClassificationType: V, ArcType: H, Math: U, JulianDate: W, TimeInterval: G, TimeIntervalCollection: le, SampledPositionProperty: ue, GeoJsonDataSource: de, PinBuilder: fe } = globalThis.__WWV_HOST__.Cesium, { Entity: K, PointGraphics: pe, BillboardGraphics: me, CustomDataSource: he, Camera: ge, PolygonGraphics: q, PolylineGraphics: _e, EllipseGraphics: ve, LabelGraphics: ye, ModelGraphics: be, PathGraphics: xe, BoxGraphics: Se, GeoJsonDataSource: Ce, ScreenSpaceEventHandler: we, ScreenSpaceEvent: Te } = globalThis.__WWV_HOST__.Resium, J = [
	{
		id: "taiwan-adiz",
		name: "Taiwan ADIZ",
		country: "Taiwan",
		type: "ADIZ",
		status: "Active monitoring",
		centerLat: 23.5,
		centerLon: 121,
		polygon: [
			[117.5, 21],
			[117.5, 29],
			[123, 29],
			[124.5, 24.5],
			[124.5, 21],
			[117.5, 21]
		]
	},
	{
		id: "china-adiz",
		name: "East China Sea ADIZ",
		country: "China",
		type: "ADIZ",
		status: "Claimed active",
		centerLat: 29.5,
		centerLon: 125,
		polygon: [
			[121, 33],
			[125, 33],
			[128, 30],
			[125, 25],
			[121, 26],
			[121, 33]
		]
	},
	{
		id: "kadiz",
		name: "KADIZ (South Korea)",
		country: "South Korea",
		type: "ADIZ",
		status: "Active monitoring",
		centerLat: 36,
		centerLon: 128,
		polygon: [
			[123, 33],
			[123, 37],
			[125, 39],
			[131, 39],
			[132, 36],
			[128, 32],
			[123, 33]
		]
	},
	{
		id: "jadiz",
		name: "JADIZ (Japan)",
		country: "Japan",
		type: "ADIZ",
		status: "Active monitoring",
		centerLat: 35,
		centerLon: 138,
		polygon: [
			[122, 23],
			[122, 30],
			[131, 39],
			[138, 46],
			[146, 46],
			[146, 25],
			[134, 25],
			[122, 23]
		]
	},
	{
		id: "us-adiz-alaska",
		name: "US ADIZ (Alaska)",
		country: "USA",
		type: "ADIZ",
		status: "Active monitoring",
		centerLat: 64,
		centerLon: -150,
		polygon: [
			[-130, 54],
			[-145, 54],
			[-165, 50],
			[-175, 55],
			[-170, 70],
			[-140, 70],
			[-130, 54]
		]
	}
], Y = globalThis.__WWV_HOST__.jsxRuntime, X = Y.jsx;
Y.jsxs;
var Z = Y.Fragment, Q = ({ enabled: e }) => e ? /* @__PURE__ */ X(Z, { children: J.map((e) => {
	let t = j.fromDegreesArray(e.polygon.flatMap((e) => [e[0], e[1]])), n = e.type === "ADIZ", r = N.fromCssColorString(n ? "#ef4444" : "#fb923c").withAlpha(.2), i = N.fromCssColorString(n ? "#ef4444" : "#fb923c");
	return /* @__PURE__ */ X(K, {
		name: e.name,
		description: `
                            <table class="cesium-infoBox-defaultTable">
                                <tbody>
                                    <tr><th>Country</th><td>${e.country}</td></tr>
                                    <tr><th>Type</th><td>${e.type}</td></tr>
                                    <tr><th>Status</th><td>${e.status}</td></tr>
                                </tbody>
                            </table>
                        `,
		children: /* @__PURE__ */ X(q, {
			hierarchy: t,
			material: r,
			outline: !0,
			outlineColor: i,
			outlineWidth: 2,
			height: 0
		})
	}, e.id);
}) }) : null, $ = class {
	constructor() {
		this.id = "air-defense", this.name = "Air Defense Zones", this.description = "Known ADIZ boundaries, no-fly zones, and restricted airspace.", this.icon = k, this.category = "conflict", this.version = "1.0.0";
	}
	async initialize(e) {}
	destroy() {}
	async fetch(e) {
		return [];
	}
	getPollingInterval() {
		return 0;
	}
	getLayerConfig() {
		return {
			color: "#ef4444",
			clusterEnabled: !1,
			clusterDistance: 0
		};
	}
	renderEntity(e) {
		return {
			type: "point",
			color: "#ef4444"
		};
	}
	getGlobeComponent() {
		return Q;
	}
};
//#endregion
export { $ as AirDefensePlugin };
