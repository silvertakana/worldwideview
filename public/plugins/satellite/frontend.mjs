//#region ../../node_modules/.pnpm/lucide-react@0.576.0_react@19.2.3/node_modules/lucide-react/dist/esm/shared/src/utils/mergeClasses.js
var e = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), t = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), n = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, n) => n ? n.toUpperCase() : t.toLowerCase()), r = (e) => {
	let t = n(e);
	return t.charAt(0).toUpperCase() + t.slice(1);
}, i = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, a = (e) => {
	for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
	return !1;
}, o = globalThis.__WWV_HOST__.React.forwardRef(({ color: t = "currentColor", size: n = 24, strokeWidth: r = 2, absoluteStrokeWidth: o, className: s = "", children: c, iconNode: l, ...u }, d) => globalThis.__WWV_HOST__.React.createElement("svg", {
	ref: d,
	...i,
	width: n,
	height: n,
	stroke: t,
	strokeWidth: o ? Number(r) * 24 / Number(n) : r,
	className: e("lucide", s),
	...!c && !a(u) && { "aria-hidden": "true" },
	...u
}, [...l.map(([e, t]) => globalThis.__WWV_HOST__.React.createElement(e, t)), ...Array.isArray(c) ? c : [c]])), s = ((n, i) => {
	let a = globalThis.__WWV_HOST__.React.forwardRef(({ className: a, ...s }, c) => globalThis.__WWV_HOST__.React.createElement(o, {
		ref: c,
		iconNode: i,
		className: e(`lucide-${t(r(n))}`, `lucide-${n}`, a),
		...s
	}));
	return a.displayName = r(n), a;
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
]), c = {
	stations: "#00fff7",
	visual: "#f0abfc",
	weather: "#a78bfa",
	"gps-ops": "#22c55e",
	resource: "#f97316",
	starlink: "#ffffff",
	military: "#3b82f6"
};
function l(e) {
	return c[e] ?? "#94a3b8";
}
var u = class {
	constructor() {
		this.id = "satellite", this.name = "Satellites", this.description = "Real-time satellite tracking (ISS, GPS, weather, military)", this.icon = s, this.category = "infrastructure", this.version = "1.0.0", this.context = null, this.iconUrls = {};
	}
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	async fetch(e) {
		try {
			let e = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, "").replace(/^ws/, "http") : "http://localhost:5001", t = await globalThis.fetch(`${e}/data/satellite`);
			if (!t.ok) throw Error(`Satellite API returned ${t.status}`);
			let n = await t.json(), r = n.satellites || n.items || [];
			return !r || !Array.isArray(r) ? [] : r.map((e) => ({
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
		} catch (e) {
			return console.error("[SatellitePlugin] Fetch error:", e), [];
		}
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
		let t = e.properties.group || "", n = t === "stations", r = l(t);
		return this.iconUrls[r] || (this.iconUrls[r] = globalThis.__WWV_HOST__.WWVPluginSDK.createSvgIconUrl(s, { color: r })), {
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
				color: l("stations"),
				filterId: "group",
				filterValue: "stations"
			},
			{
				label: "Brightest Satellites",
				color: l("visual"),
				filterId: "group",
				filterValue: "visual"
			},
			{
				label: "Weather",
				color: l("weather"),
				filterId: "group",
				filterValue: "weather"
			},
			{
				label: "GPS",
				color: l("gps-ops"),
				filterId: "group",
				filterValue: "gps-ops"
			},
			{
				label: "Earth Observation",
				color: l("resource"),
				filterId: "group",
				filterValue: "resource"
			},
			{
				label: "Starlink",
				color: l("starlink"),
				filterId: "group",
				filterValue: "starlink"
			},
			{
				label: "Military",
				color: l("military"),
				filterId: "group",
				filterValue: "military"
			},
			{
				label: "Other",
				color: l("other"),
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
export { u as SatellitePlugin };
