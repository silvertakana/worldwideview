var { useState: e, useEffect: t, useRef: n, useMemo: r, useCallback: i, useContext: a, useReducer: o, useLayoutEffect: s, StrictMode: c, Suspense: l, createContext: u, createElement: d, cloneElement: f, isValidElement: p, Fragment: m, Children: h, Component: g, PureComponent: _, createRef: v, forwardRef: y, memo: b, lazy: x, startTransition: S, useTransition: C, useDeferredValue: w, useId: T, useSyncExternalStore: E, useInsertionEffect: D } = globalThis.__WWV_HOST__.React, O = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), k = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), A = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, n) => n ? n.toUpperCase() : t.toLowerCase()), j = (e) => {
	let t = A(e);
	return t.charAt(0).toUpperCase() + t.slice(1);
}, M = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, N = (e) => {
	for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
	return !1;
}, P = u({}), F = () => a(P), I = y(({ color: e, size: t, strokeWidth: n, absoluteStrokeWidth: r, className: i = "", children: a, iconNode: o, ...s }, c) => {
	let { size: l = 24, strokeWidth: u = 2, absoluteStrokeWidth: f = !1, color: p = "currentColor", className: m = "" } = F() ?? {}, h = r ?? f ? Number(n ?? u) * 24 / Number(t ?? l) : n ?? u;
	return d("svg", {
		ref: c,
		...M,
		width: t ?? l ?? M.width,
		height: t ?? l ?? M.height,
		stroke: e ?? p,
		strokeWidth: h,
		className: O("lucide", m, i),
		...!a && !N(s) && { "aria-hidden": "true" },
		...s
	}, [...o.map(([e, t]) => d(e, t)), ...Array.isArray(a) ? a : [a]]);
}), L = ((e, t) => {
	let n = y(({ className: n, ...r }, i) => d(I, {
		ref: i,
		iconNode: t,
		className: O(`lucide-${k(j(e))}`, `lucide-${e}`, n),
		...r
	}));
	return n.displayName = j(e), n;
})("satellite", [
	["path", {
		d: "m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5",
		key: "dzhfyz"
	}],
	["path", {
		d: "M16.5 7.5 19 5",
		key: "1ltcjm"
	}],
	["path", {
		d: "m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5",
		key: "nfoymv"
	}],
	["path", {
		d: "M9 21a6 6 0 0 0-6-6",
		key: "1iajcf"
	}],
	["path", {
		d: "M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z",
		key: "nv9zqy"
	}]
]), { WorldPlugin: R, PluginManifest: z, createSvgIconUrl: B, DEFAULT_ICON_SIZE: V } = globalThis.__WWV_HOST__.WWVPluginSDK, H = {
	stations: "#00fff7",
	visual: "#f0abfc",
	weather: "#a78bfa",
	"gps-ops": "#22c55e",
	resource: "#f97316",
	starlink: "#ffffff",
	military: "#3b82f6"
};
function U(e) {
	return H[e] ?? "#94a3b8";
}
var W = class {
	constructor() {
		this.id = "satellite", this.name = "Satellites", this.description = "Real-time satellite tracking (ISS, GPS, weather, military)", this.icon = L, this.category = "infrastructure", this.version = "1.0.0", this.context = null, this.iconUrls = {};
	}
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	mapPayloadToEntities(e) {
		let t = [];
		return Array.isArray(e) ? t = e : e && Array.isArray(e.satellites) ? t = e.satellites : e && Array.isArray(e.items) ? t = e.items : e && typeof e == "object" && (t = Object.values(e)), !t || !Array.isArray(t) ? [] : t.map((e) => ({
			id: `satellite-${e.noradId}`,
			pluginId: "satellite",
			latitude: e.latitude,
			longitude: e.longitude,
			altitude: e.altitude * 1e3,
			heading: e.heading,
			speed: e.speed,
			timestamp: /* @__PURE__ */ new Date(),
			label: e.name,
			properties: {
				noradId: e.noradId,
				name: e.name,
				group: e.group,
				country: e.country,
				objectType: e.objectType,
				altitudeKm: e.altitude,
				period: e.period
			}
		}));
	}
	async fetch(e) {
		let t = "https://dataengine.worldwideview.dev";
		try {
			let e = typeof globalThis < "u" && globalThis.__WWV_ENGINE_URL__;
			t = e ? e.replace(/\/stream$/, "").replace(/^ws/, "http") : "https://dataengine.worldwideview.dev", console.log(`[SatellitePlugin] Fetching data from: ${t}/data/satellite`);
			let n = await globalThis.fetch(`${t}/data/satellite`);
			if (!n.ok) throw Error(`Satellite API returned ${n.status}`);
			let r = await n.json();
			return this.mapPayloadToEntities(r);
		} catch (e) {
			return console.error("[SatellitePlugin] Extremely Fatal Fetch Error ->", e.message), console.error(`[SatellitePlugin] Engine URL attempted: ${t}/data/satellite`), this.context && this.context.onError && this.context.onError(e), [];
		}
	}
	mapWebsocketPayload(e) {
		return this.mapPayloadToEntities(e);
	}
	getPollingInterval() {
		return 0;
	}
	getLayerConfig() {
		return {
			color: "#00fff7",
			clusterEnabled: !1,
			clusterDistance: 0,
			maxEntities: 1e3
		};
	}
	renderEntity(e) {
		let t = e.properties.group || "", n = t === "stations", r = U(t);
		return this.iconUrls[r] || (this.iconUrls[r] = B(L, { color: r })), {
			type: "billboard",
			iconUrl: this.iconUrls[r],
			color: r,
			size: n ? 12 : 6,
			outlineColor: "#000000",
			outlineWidth: 1,
			labelText: n ? e.label : void 0,
			labelFont: "12px sans-serif",
			disableManualHorizonCulling: !0,
			disableDepthTestDistance: 0
		};
	}
	getSelectionBehavior(e) {
		return {
			showTrail: !0,
			trailDurationSec: 300,
			trailStepSec: 10,
			trailColor: "#00fff7",
			flyToOffsetMultiplier: 4,
			flyToBaseDistance: 2e6
		};
	}
	getFilterDefinitions() {
		return [{
			id: "group",
			label: "Satellite Group",
			type: "select",
			propertyKey: "group",
			options: [
				{
					value: "stations",
					label: "Space Stations"
				},
				{
					value: "visual",
					label: "Brightest Satellites"
				},
				{
					value: "weather",
					label: "Weather"
				},
				{
					value: "gps-ops",
					label: "GPS"
				},
				{
					value: "resource",
					label: "Earth Observation"
				}
			]
		}];
	}
	getLegend() {
		return [
			{
				label: "Space Stations",
				color: U("stations"),
				filterId: "group",
				filterValue: "stations"
			},
			{
				label: "Brightest Satellites",
				color: U("visual"),
				filterId: "group",
				filterValue: "visual"
			},
			{
				label: "Weather",
				color: U("weather"),
				filterId: "group",
				filterValue: "weather"
			},
			{
				label: "GPS",
				color: U("gps-ops"),
				filterId: "group",
				filterValue: "gps-ops"
			},
			{
				label: "Earth Observation",
				color: U("resource"),
				filterId: "group",
				filterValue: "resource"
			},
			{
				label: "Starlink",
				color: U("starlink"),
				filterId: "group",
				filterValue: "starlink"
			},
			{
				label: "Military",
				color: U("military"),
				filterId: "group",
				filterValue: "military"
			},
			{
				label: "Other",
				color: U("other"),
				filterId: "group",
				filterValue: "other"
			}
		];
	}
	getServerConfig() {
		return {
			apiBasePath: "/api/satellite",
			pollingIntervalMs: 0,
			historyEnabled: !0
		};
	}
};
//#endregion
export { W as SatellitePlugin };
