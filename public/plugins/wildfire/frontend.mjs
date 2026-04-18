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
})("flame", [["path", {
	d: "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4",
	key: "1slcih"
}]]);
//#endregion
//#region src/index.ts
function c(e) {
	return e < 10 ? "#fbbf24" : e < 50 ? "#f97316" : e < 100 ? "#ef4444" : "#dc2626";
}
function l(e) {
	return e < 10 ? 5 : e < 50 ? 7 : e < 100 ? 9 : 12;
}
function u(e) {
	return e < 10 ? "low" : e < 50 ? "moderate" : e < 100 ? "high" : "extreme";
}
var d = class {
	constructor() {
		this.id = "wildfire", this.name = "Wildfire", this.description = "Active fire detection via NASA FIRMS (VIIRS)", this.icon = s, this.category = "natural-disaster", this.version = "1.0.0", this.context = null, this.iconUrls = {};
	}
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	async fetch(e) {
		try {
			let e = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, "").replace(/^ws/, "http") : "https://dataengine.worldwideview.dev", t = await globalThis.fetch(`${e}/data/wildfires`);
			if (!t.ok) throw Error(`Wildfire API returned ${t.status}`);
			let n = await t.json();
			return !n.items || !Array.isArray(n.items) ? [] : n.items.map((e) => ({
				id: `wildfire-${e.latitude.toFixed(4)}-${e.longitude.toFixed(4)}-${e.acq_date}-${e.tier || 3}`,
				pluginId: "wildfire",
				latitude: e.latitude,
				longitude: e.longitude,
				timestamp: /* @__PURE__ */ new Date(`${e.acq_date}T${e.acq_time.padStart(4, "0").slice(0, 2)}:${e.acq_time.padStart(4, "0").slice(2)}:00Z`),
				label: `FRP: ${e.frp}`,
				properties: {
					frp: e.frp,
					frp_band: u(e.frp),
					confidence: e.confidence,
					satellite: e.satellite,
					acq_date: e.acq_date,
					acq_time: e.acq_time,
					bright_ti4: e.bright_ti4,
					bright_ti5: e.bright_ti5,
					tier: e.tier
				}
			}));
		} catch (e) {
			return console.error("[WildfirePlugin] Fetch error:", e), [];
		}
	}
	getPollingInterval() {
		return 0;
	}
	getServerConfig() {
		return {
			apiBasePath: "/api/wildfires",
			pollingIntervalMs: 0,
			historyEnabled: !0
		};
	}
	getLayerConfig() {
		return {
			color: "#ef4444",
			clusterEnabled: !0,
			clusterDistance: 30
		};
	}
	renderEntity(e) {
		let t = e.properties.frp || 0, n = c(t), r = e.properties.tier || 3, i;
		return r === 1 ? i = {
			near: 35e5,
			far: Infinity
		} : r === 2 ? i = {
			near: 1e6,
			far: 35e5
		} : r === 3 && (i = {
			near: 0,
			far: 1e6
		}), this.iconUrls[n] || (this.iconUrls[n] = globalThis.__WWV_HOST__.WWVPluginSDK.createSvgIconUrl(s, { color: n })), {
			type: "billboard",
			iconUrl: this.iconUrls[n],
			color: n,
			iconScale: l(t) / 10 * (r === 1 ? 2 : r === 2 ? 1.5 : 1),
			distanceDisplayCondition: i
		};
	}
	getFilterDefinitions() {
		return [
			{
				id: "frp",
				label: "Fire Radiative Power (MW)",
				type: "range",
				propertyKey: "frp",
				range: {
					min: 0,
					max: 500,
					step: 10
				}
			},
			{
				id: "frp_band",
				label: "Intensity Category",
				type: "select",
				propertyKey: "frp_band",
				options: [
					{
						value: "low",
						label: "FRP < 10 (Low)"
					},
					{
						value: "moderate",
						label: "FRP 10 - 50 (Moderate)"
					},
					{
						value: "high",
						label: "FRP 50 - 100 (High)"
					},
					{
						value: "extreme",
						label: "FRP > 100 (Extreme)"
					}
				]
			},
			{
				id: "confidence",
				label: "Confidence",
				type: "select",
				propertyKey: "confidence",
				options: [
					{
						value: "low",
						label: "Low"
					},
					{
						value: "nominal",
						label: "Nominal"
					},
					{
						value: "high",
						label: "High"
					}
				]
			},
			{
				id: "satellite",
				label: "Satellite",
				type: "select",
				propertyKey: "satellite",
				options: [
					{
						value: "N",
						label: "Suomi NPP"
					},
					{
						value: "1",
						label: "NOAA-20"
					},
					{
						value: "2",
						label: "NOAA-21"
					}
				]
			}
		];
	}
	getLegend() {
		return [
			{
				label: "FRP < 10 (Low)",
				color: "#fbbf24",
				filterId: "frp_band",
				filterValue: "low"
			},
			{
				label: "FRP 10 - 50 (Moderate)",
				color: "#f97316",
				filterId: "frp_band",
				filterValue: "moderate"
			},
			{
				label: "FRP 50 - 100 (High)",
				color: "#ef4444",
				filterId: "frp_band",
				filterValue: "high"
			},
			{
				label: "FRP > 100 (Extreme)",
				color: "#dc2626",
				filterId: "frp_band",
				filterValue: "extreme"
			}
		];
	}
};
//#endregion
export { d as WildfirePlugin };
