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
}), L = (e, t) => {
	let n = y(({ className: n, ...r }, i) => d(I, {
		ref: i,
		iconNode: t,
		className: O(`lucide-${k(j(e))}`, `lucide-${e}`, n),
		...r
	}));
	return n.displayName = j(e), n;
}, R = L("clock", [["circle", {
	cx: "12",
	cy: "12",
	r: "10",
	key: "1mglay"
}], ["path", {
	d: "M12 6v6l4 2",
	key: "mmk7yg"
}]]), z = L("ship", [
	["path", {
		d: "M12 10.189V14",
		key: "1p8cqu"
	}],
	["path", {
		d: "M12 2v3",
		key: "qbqxhf"
	}],
	["path", {
		d: "M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6",
		key: "qpkstq"
	}],
	["path", {
		d: "M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76",
		key: "7tigtc"
	}],
	["path", {
		d: "M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
		key: "1924j5"
	}]
]), { WorldPlugin: B, PluginManifest: V, createSvgIconUrl: H, DEFAULT_ICON_SIZE: U } = globalThis.__WWV_HOST__.WWVPluginSDK, W = globalThis.__WWV_HOST__.useStore, G = globalThis.__WWV_HOST__.pluginManager, K = globalThis.__WWV_HOST__.jsxRuntime, q = K.jsx, J = K.jsxs;
K.Fragment;
//#endregion
//#region src/MaritimeSettings.tsx
var Y = ({ pluginId: e }) => {
	let t = {
		trailDuration: "1h",
		...W((t) => t.dataConfig.pluginSettings[e]) || {}
	}, n = W((e) => e.updatePluginSettings), r = async (t) => {
		n(e, { trailDuration: t });
		let r = G.getPlugin(e);
		r && r.enabled && await G.fetchForPlugin(e, r.context.timeRange);
	};
	return /* @__PURE__ */ J("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			gap: "var(--space-md)"
		},
		children: [
			/* @__PURE__ */ J("div", {
				style: {
					fontSize: 11,
					color: "var(--text-muted)",
					marginBottom: "var(--space-xs)",
					display: "flex",
					alignItems: "center",
					gap: 4
				},
				children: [/* @__PURE__ */ q(R, { size: 12 }), " Trail History Duration"]
			}),
			/* @__PURE__ */ J("select", {
				value: t.trailDuration,
				onChange: (e) => r(e.target.value),
				style: {
					background: "var(--bg-secondary)",
					color: "var(--text-primary)",
					border: "1px solid var(--border-subtle)",
					borderRadius: "var(--radius-sm)",
					padding: "6px var(--space-sm)",
					fontSize: 12,
					outline: "none",
					cursor: "pointer"
				},
				children: [
					/* @__PURE__ */ q("option", {
						value: "0h",
						children: "Off (0 hours)"
					}),
					/* @__PURE__ */ q("option", {
						value: "1h",
						children: "1 Hour"
					}),
					/* @__PURE__ */ q("option", {
						value: "6h",
						children: "6 Hours"
					}),
					/* @__PURE__ */ q("option", {
						value: "12h",
						children: "12 Hours"
					}),
					/* @__PURE__ */ q("option", {
						value: "24h",
						children: "24 Hours"
					})
				]
			}),
			/* @__PURE__ */ q("div", {
				style: {
					fontSize: 10,
					color: "var(--text-secondary)",
					lineHeight: 1.4
				},
				children: "Longer trails require more memory and take longer to load. Setting affects visible trails behind vessels."
			})
		]
	});
}, X = {
	cargo: "#f59e0b",
	tanker: "#ef4444",
	passenger: "#3b82f6",
	fishing: "#22d3ee",
	military: "#a78bfa",
	sailing: "#4ade80",
	tug: "#f97316",
	other: "#94a3b8"
};
function Z(e) {
	let t = e.toLowerCase();
	for (let [e, n] of Object.entries(X)) if (t.includes(e)) return n;
	return X.other;
}
var Q = class {
	constructor() {
		this.id = "maritime", this.name = "Maritime", this.description = "Vessel tracking via AIS feeds", this.icon = z, this.category = "maritime", this.version = "1.0.0", this.context = null, this.iconUrls = {};
	}
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	mapPayloadToEntities(e, t) {
		let n = new Map(t?.map((e) => [e.id, e]) || []), r = [];
		if (Array.isArray(e)) r = e;
		else if (e && typeof e == "object") r = Object.values(e);
		else return [];
		return r.map((e) => {
			let t = `maritime-${e.mmsi || e.id}`, r = n.get(t), i = e.history || e.properties && e.properties.history || r?.properties.history || [];
			if (e.last_updated || e.ts) {
				let t = e.last_updated || e.ts;
				t > (i.length > 0 ? i[i.length - 1].ts : 0) && (e.lat ?? e.latitude) !== void 0 && (e.lon ?? e.longitude) !== void 0 && i.push({
					lat: e.lat ?? e.latitude,
					lon: e.lon ?? e.longitude,
					ts: t
				});
			}
			return i.length > 61 && i.splice(0, i.length - 61), {
				id: t,
				pluginId: "maritime",
				latitude: e.lat ?? e.latitude,
				longitude: e.lon ?? e.longitude,
				heading: e.hdg === 511 ? void 0 : e.hdg ?? e.heading,
				speed: e.spd === void 0 ? e.speed === void 0 ? void 0 : e.speed * .514444 : e.spd * .514444,
				timestamp: e.last_updated ? /* @__PURE__ */ new Date(e.last_updated * 1e3) : new Date(e.timestamp || Date.now()),
				label: e.name ?? e.label,
				properties: {
					mmsi: e.mmsi,
					vesselName: e.name,
					vesselType: e.type || e.properties && e.properties.vesselType || "other",
					speed_knots: e.spd ?? e.speed,
					heading: e.hdg ?? e.heading,
					history: i
				}
			};
		});
	}
	async fetch(e) {
		try {
			let e = "1h";
			if (this.context) {
				let t = this.context.getPluginSettings(this.id);
				t && t.trailDuration && (e = t.trailDuration);
			}
			e === "0h" && (e = "");
			let t = e ? `?lookback=${e}` : "", n = "https://dataengine.worldwideview.dev";
			typeof globalThis < "u" && globalThis.__WWV_ENGINE_URL__ ? n = globalThis.__WWV_ENGINE_URL__.replace(/\/stream$/, "").replace(/^ws/, "http") : typeof process < "u" && process.env && process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL && (n = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, "").replace(/^ws/, "http"));
			let r = await fetch(`${n}/data/maritime${t}`);
			if (!r.ok) throw Error(`Maritime API returned ${r.status}`);
			let i = await r.json();
			return this.mapPayloadToEntities(i.items);
		} catch (e) {
			return console.error("[MaritimePlugin] Fetch error:", e), [];
		}
	}
	mapWebsocketPayload(e, t) {
		return this.mapPayloadToEntities(e, t);
	}
	getPollingInterval() {
		return 0;
	}
	getServerConfig() {
		return {
			apiBasePath: "/api/maritime",
			pollingIntervalMs: 0,
			historyEnabled: !0
		};
	}
	getLayerConfig() {
		return {
			color: "#f59e0b",
			clusterEnabled: !0,
			clusterDistance: 50
		};
	}
	getSettingsComponent() {
		return Y;
	}
	renderEntity(e) {
		let t = Z(e.properties.vesselType || "other");
		return this.iconUrls[t] || (this.iconUrls[t] = H(z, { color: t })), {
			type: "billboard",
			iconUrl: this.iconUrls[t],
			color: t,
			rotation: e.heading,
			labelText: e.label || void 0,
			labelFont: "11px JetBrains Mono, monospace",
			distanceDisplayCondition: {
				near: 0,
				far: 1e6
			},
			trailOptions: {
				width: 2,
				color: t,
				opacityFade: !0
			}
		};
	}
	getSelectionBehavior(e) {
		return !e.speed || e.speed < .1 ? null : {
			showTrail: !0,
			trailDurationSec: 3600,
			trailStepSec: 60,
			trailColor: Z(e.properties.vesselType || "other"),
			flyToOffsetMultiplier: 3,
			flyToBaseDistance: 15e3
		};
	}
	getFilterDefinitions() {
		return [{
			id: "vessel_type",
			label: "Vessel Type",
			type: "select",
			propertyKey: "vesselType",
			options: [
				{
					value: "cargo",
					label: "Cargo"
				},
				{
					value: "tanker",
					label: "Tanker"
				},
				{
					value: "passenger",
					label: "Passenger"
				},
				{
					value: "fishing",
					label: "Fishing"
				},
				{
					value: "military",
					label: "Military"
				},
				{
					value: "sailing",
					label: "Sailing"
				},
				{
					value: "tug",
					label: "Tug"
				},
				{
					value: "other",
					label: "Other"
				}
			]
		}, {
			id: "speed",
			label: "Speed (knots)",
			type: "range",
			propertyKey: "speed_knots",
			range: {
				min: 0,
				max: 30,
				step: 1
			}
		}];
	}
	getLegend() {
		return [
			{
				label: "Cargo",
				color: X.cargo,
				filterId: "vessel_type",
				filterValue: "cargo"
			},
			{
				label: "Tanker",
				color: X.tanker,
				filterId: "vessel_type",
				filterValue: "tanker"
			},
			{
				label: "Passenger",
				color: X.passenger,
				filterId: "vessel_type",
				filterValue: "passenger"
			},
			{
				label: "Fishing",
				color: X.fishing,
				filterId: "vessel_type",
				filterValue: "fishing"
			},
			{
				label: "Military",
				color: X.military,
				filterId: "vessel_type",
				filterValue: "military"
			},
			{
				label: "Sailing",
				color: X.sailing,
				filterId: "vessel_type",
				filterValue: "sailing"
			},
			{
				label: "Tug",
				color: X.tug,
				filterId: "vessel_type",
				filterValue: "tug"
			},
			{
				label: "Other",
				color: X.other,
				filterId: "vessel_type",
				filterValue: "other"
			}
		];
	}
};
//#endregion
export { Q as MaritimePlugin };
