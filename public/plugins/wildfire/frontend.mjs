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
})("flame", [["path", {
	d: "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4",
	key: "1slcih"
}]]), { WorldPlugin: R, PluginManifest: z, createSvgIconUrl: B, DEFAULT_ICON_SIZE: V } = globalThis.__WWV_HOST__.WWVPluginSDK;
//#endregion
//#region src/index.ts
function H(e) {
	return e < 10 ? "#fbbf24" : e < 50 ? "#f97316" : e < 100 ? "#ef4444" : "#dc2626";
}
function U(e) {
	return e < 10 ? 5 : e < 50 ? 7 : e < 100 ? 9 : 12;
}
function W(e) {
	return e < 10 ? "low" : e < 50 ? "moderate" : e < 100 ? "high" : "extreme";
}
var G = class {
	constructor() {
		this.id = "wildfire", this.name = "Wildfire", this.description = "Active fire detection via NASA FIRMS (VIIRS)", this.icon = L, this.category = "natural-disaster", this.version = "1.0.0", this.context = null, this.iconUrls = {};
	}
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	async fetch(e) {
		try {
			let e = "https://dataengine.worldwideview.dev";
			typeof globalThis < "u" && globalThis.__WWV_ENGINE_URL__ ? e = globalThis.__WWV_ENGINE_URL__.replace(/\/stream$/, "").replace(/^ws/, "http") : typeof process < "u" && process.env && process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL && (e = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, "").replace(/^ws/, "http"));
			let t = await globalThis.fetch(`${e}/data/wildfires`);
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
					frp_band: W(e.frp),
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
		let t = e.properties.frp || 0, n = H(t), r = e.properties.tier || 3, i;
		return r === 1 ? i = {
			near: 35e5,
			far: Infinity
		} : r === 2 ? i = {
			near: 1e6,
			far: 35e5
		} : r === 3 && (i = {
			near: 0,
			far: 1e6
		}), this.iconUrls[n] || (this.iconUrls[n] = B(L, { color: n })), {
			type: "billboard",
			iconUrl: this.iconUrls[n],
			color: n,
			iconScale: U(t) / 10 * (r === 1 ? 2 : r === 2 ? 1.5 : 1),
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
export { G as WildfirePlugin };
