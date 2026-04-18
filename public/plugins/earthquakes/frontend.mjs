var { useState: e, useEffect: t, useRef: n, useMemo: r, useCallback: i, useContext: a, useReducer: o, useLayoutEffect: s, StrictMode: c, Suspense: l, createContext: u, createElement: d, cloneElement: f, isValidElement: p, Fragment: m, Children: h, Component: g, PureComponent: _, createRef: v, forwardRef: y, memo: b, lazy: x, startTransition: S, useTransition: C, useDeferredValue: w, useId: T, useSyncExternalStore: E, useInsertionEffect: D } = globalThis.__WWV_HOST__.React, O = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, k = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), A = ((e, t) => {
	let n = y(({ color: n = "currentColor", size: r = 24, strokeWidth: i = 2, absoluteStrokeWidth: a, className: o = "", children: s, ...c }, l) => d("svg", {
		ref: l,
		...O,
		width: r,
		height: r,
		stroke: n,
		strokeWidth: a ? Number(i) * 24 / Number(r) : i,
		className: [
			"lucide",
			`lucide-${k(e)}`,
			o
		].join(" "),
		...c
	}, [...t.map(([e, t]) => d(e, t)), ...Array.isArray(s) ? s : [s]]));
	return n.displayName = `${e}`, n;
})("Activity", [["path", {
	d: "M22 12h-4l-3 9L9 3l-3 9H2",
	key: "d5dnw9"
}]]), { WorldPlugin: j, PluginManifest: M, createSvgIconUrl: N, DEFAULT_ICON_SIZE: P } = globalThis.__WWV_HOST__.WWVPluginSDK, F = class {
	context = null;
	iconUrls = {};
	defaultLayerColor = "#ef4444";
	clusterDistance = 40;
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	getEntityIcon(e) {
		return this.icon;
	}
	getPollingInterval() {
		return 0;
	}
	getLayerConfig() {
		return {
			color: this.defaultLayerColor,
			clusterEnabled: !0,
			clusterDistance: this.clusterDistance
		};
	}
	renderEntity(e) {
		let t = this.getSeverityValue(e), n = this.getSeverityColor(t), r = this.getSeveritySize(t), i = this.getEntityIcon(e), a = `${i?.displayName || i?.name || "default"}-${n}`;
		return this.iconUrls[a] || (this.iconUrls[a] = N(i, { color: n })), {
			type: "billboard",
			iconUrl: this.iconUrls[a],
			color: n,
			size: r,
			outlineColor: "#000000",
			outlineWidth: 1,
			labelText: e.label || void 0,
			labelFont: "11px JetBrains Mono, monospace"
		};
	}
}, I = class extends F {
	constructor(...e) {
		super(...e), this.id = "earthquakes", this.name = "Earthquakes", this.description = "Recent seismic activity from USGS", this.icon = A, this.category = "natural-disaster", this.version = "1.1.0", this.defaultLayerColor = "#f97316";
	}
	getSeverityValue(e) {
		return Number(e.properties.magnitude ?? 0) || 0;
	}
	getSeverityColor(e) {
		return e < 5 ? "#fcd34d" : e < 6 ? "#f97316" : e < 7 ? "#ef4444" : "#7f1d1d";
	}
	getSeveritySize(e) {
		return e < 5 ? 5 : e < 6 ? 8 : e < 7 ? 12 : 16;
	}
	async fetch(e) {
		try {
			let e = await globalThis.fetch("/api/earthquake");
			if (!e.ok) return this.context?.onError(/* @__PURE__ */ Error(`Earthquakes API returned ${e.status}`)), [];
			let t = await e.json();
			return (Array.isArray(t?.features) ? t.features : []).flatMap((e) => {
				let t = e?.geometry?.coordinates, n = e?.properties?.time;
				if (!Array.isArray(t) || t.length < 2 || !Number.isFinite(t[0]) || !Number.isFinite(t[1]) || !Number.isFinite(n)) return [];
				let r = Number(e?.properties?.mag ?? 0) || 0;
				return [{
					id: `${this.id}-${e.id}`,
					pluginId: this.id,
					latitude: t[1],
					longitude: t[0],
					altitude: 0,
					timestamp: new Date(n),
					label: `M${e?.properties?.mag ?? "?"}`,
					properties: {
						magnitude: r,
						depth: Number(e?.geometry?.coordinates?.[2] ?? 0) || 0,
						place: e?.properties?.place ?? null,
						url: e?.properties?.url ?? null,
						updated: e?.properties?.updated ?? null,
						status: e?.properties?.status ?? null,
						tsunami: e?.properties?.tsunami ?? null,
						sig: e?.properties?.sig ?? null,
						magType: e?.properties?.magType ?? null
					}
				}];
			});
		} catch (e) {
			let t = e instanceof Error ? e : /* @__PURE__ */ Error("Failed to fetch earthquakes");
			return this.context?.onError(t), [];
		}
	}
	getPollingInterval() {
		return 12e4;
	}
	getServerConfig() {
		return {
			apiBasePath: "/api/earthquake",
			pollingIntervalMs: 12e4,
			historyEnabled: !1
		};
	}
	getLayerConfig() {
		return {
			color: "#ef4444",
			clusterEnabled: !0,
			clusterDistance: 40,
			maxEntities: 2e3
		};
	}
	renderEntity(e) {
		let t = this.getSeverityValue(e);
		return {
			type: "point",
			color: this.getSeverityColor(t),
			size: this.getSeveritySize(t),
			outlineColor: "#000000",
			outlineWidth: 1,
			labelText: e.label
		};
	}
	getLegend() {
		return [
			{
				label: "M < 5.0",
				color: "#fcd34d",
				filterId: "magnitude",
				filterValue: "0"
			},
			{
				label: "M 5.0 - 5.9",
				color: "#f97316",
				filterId: "magnitude",
				filterValue: "5.0"
			},
			{
				label: "M 6.0 - 6.9",
				color: "#ef4444",
				filterId: "magnitude",
				filterValue: "6.0"
			},
			{
				label: "M ≥ 7.0",
				color: "#7f1d1d",
				filterId: "magnitude",
				filterValue: "7.0"
			}
		];
	}
	getFilterDefinitions() {
		return [{
			id: "magnitude",
			label: "Magnitude",
			type: "range",
			propertyKey: "magnitude",
			range: {
				min: 0,
				max: 10,
				step: .1
			}
		}, {
			id: "depth",
			label: "Depth (km)",
			type: "range",
			propertyKey: "depth",
			range: {
				min: 0,
				max: 800,
				step: 10
			}
		}];
	}
};
//#endregion
export { I as EarthquakesPlugin };
