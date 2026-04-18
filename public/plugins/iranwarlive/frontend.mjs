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
}, R = L("bomb", [
	["circle", {
		cx: "11",
		cy: "13",
		r: "9",
		key: "hd149"
	}],
	["path", {
		d: "M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95",
		key: "jp4j1b"
	}],
	["path", {
		d: "m22 2-1.5 1.5",
		key: "ay92ug"
	}]
]), z = L("plane", [["path", {
	d: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
	key: "1v9wt8"
}]]), B = L("rocket", [
	["path", {
		d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
		key: "qeys4"
	}],
	["path", {
		d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09",
		key: "u4xsad"
	}],
	["path", {
		d: "M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z",
		key: "676m9"
	}],
	["path", {
		d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05",
		key: "92ym6u"
	}]
]), V = L("shield-alert", [
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
]), H = L("target", [
	["circle", {
		cx: "12",
		cy: "12",
		r: "10",
		key: "1mglay"
	}],
	["circle", {
		cx: "12",
		cy: "12",
		r: "6",
		key: "1vlfrh"
	}],
	["circle", {
		cx: "12",
		cy: "12",
		r: "2",
		key: "1c9p78"
	}]
]), { WorldPlugin: U, PluginManifest: W, createSvgIconUrl: G, DEFAULT_ICON_SIZE: K } = globalThis.__WWV_HOST__.WWVPluginSDK, q = class {
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
		return this.iconUrls[a] || (this.iconUrls[a] = G(i, { color: n })), {
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
};
//#endregion
//#region src/index.ts
function J(e) {
	switch (e.toLowerCase()) {
		case "missile strike": return B;
		case "air strike": return z;
		case "ground combat": return H;
		case "artillery": return R;
		default: return V;
	}
}
var Y = class extends q {
	constructor(...e) {
		super(...e), this.id = "iranwarlive", this.name = "Iran War Live", this.description = "Live OSINT tracking — Data sourced from IranWarLive.com (Not for Life-Safety)", this.icon = V, this.category = "conflict", this.version = "1.0.2", this.defaultLayerColor = "#ef4444", this.clusterDistance = 40;
	}
	getSeverityValue(e) {
		return e.properties.casualties || 0;
	}
	getSeverityColor(e) {
		return "#ef4444";
	}
	getSeveritySize(e) {
		return 16;
	}
	getEntityIcon(e) {
		return J(e.properties.type || "Unknown");
	}
	async fetch(e) {
		try {
			let e = typeof globalThis < "u" && globalThis.__WWV_ENGINE_URL__, t = e ? e.replace(/\/stream$/, "").replace(/^ws/, "http") : "http://localhost:5001", n = await globalThis.fetch(`${t}/data/iranwarlive`);
			if (!n.ok) throw Error(`IranWarLive Backend returned ${n.status}`);
			let r = await n.json();
			return !r.items || !Array.isArray(r.items) ? [] : r.items.map((e) => {
				let t = e._osint_meta?.coordinates?.lat || 0, n = e._osint_meta?.coordinates?.lng || 0, r = new Date(e.timestamp), i = Math.max(0, Math.round((Date.now() - r.getTime()) / (1e3 * 60 * 60)));
				return {
					id: e.event_id,
					pluginId: "iranwarlive",
					latitude: t,
					longitude: n,
					timestamp: r,
					label: e.type + (e.location ? ` in ${e.location}` : ""),
					properties: {
						hours_ago: i,
						type: e.type,
						confidence: e.confidence,
						location: e.location,
						summary: e.event_summary,
						casualties: e._osint_meta?.casualties || 0,
						source_url: e.source_url,
						preview_image: e.preview_image,
						preview_video: e.preview_video
					}
				};
			});
		} catch (e) {
			return console.error("[IranWarLivePlugin] Fetch error from microservice backend:", e), [];
		}
	}
	getServerConfig() {
		return {
			apiBasePath: "/api/iranwarlive",
			pollingIntervalMs: 0,
			historyEnabled: !0
		};
	}
	getFilterDefinitions() {
		return [
			{
				id: "type",
				label: "Strike Type",
				type: "select",
				propertyKey: "type",
				options: [{
					value: "Missile Strike",
					label: "Missile Strike"
				}, {
					value: "Air Strike",
					label: "Air Strike"
				}]
			},
			{
				id: "confidence",
				label: "Intelligence Confidence",
				type: "select",
				propertyKey: "confidence",
				options: [{
					value: "News Wire",
					label: "News Wire"
				}, {
					value: "State Actor",
					label: "State Defense Press"
				}]
			},
			{
				id: "hours_ago",
				label: "Max Hours Ago",
				type: "range",
				propertyKey: "hours_ago",
				range: {
					min: 0,
					max: 168,
					step: 1
				}
			}
		];
	}
	getLegend() {
		return [{
			label: "Kinetic Event",
			color: "#ef4444"
		}];
	}
};
//#endregion
export { Y as IranWarLivePlugin };
