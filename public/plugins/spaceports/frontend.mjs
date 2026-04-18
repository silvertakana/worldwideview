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
})("rocket", [
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
]), { WorldPlugin: R, PluginManifest: z, createSvgIconUrl: B, DEFAULT_ICON_SIZE: V } = globalThis.__WWV_HOST__.WWVPluginSDK;
//#endregion
//#region ../wwv-lib-facilities/src/index.ts
function H(e) {
	switch (e.type) {
		case "Point": {
			let [t, n, r] = e.coordinates;
			return {
				lat: n,
				lon: t,
				...r === void 0 ? {} : { alt: r }
			};
		}
		case "MultiPoint":
		case "LineString": {
			let t = e.coordinates[0];
			return {
				lat: t[1],
				lon: t[0]
			};
		}
		case "Polygon":
		case "MultiLineString": {
			let t = e.coordinates[0];
			return {
				lat: t[0][1],
				lon: t[0][0]
			};
		}
		case "MultiPolygon": {
			let t = e.coordinates[0];
			return {
				lat: t[0][0][1],
				lon: t[0][0][0]
			};
		}
		default: return {
			lat: 0,
			lon: 0
		};
	}
}
function U(e, t, n) {
	let r = H(e.geometry);
	return {
		id: `${t}-${e.id ?? n}`,
		pluginId: t,
		latitude: r.lat,
		longitude: r.lon,
		altitude: r.alt,
		timestamp: /* @__PURE__ */ new Date(),
		label: e.properties.name ?? void 0,
		properties: {
			...e.properties,
			_geometryType: e.geometry.type
		}
	};
}
var W = class {
	context = null;
	iconUrls = {};
	defaultLayerColor = "#3b82f6";
	clusterDistance = 50;
	maxEntities = 5e3;
	iconScale = 1;
	geojsonData = null;
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	async fetch(e) {
		return !this.geojsonData || !this.geojsonData.features ? [] : this.geojsonData.features.map((e, t) => U(e, this.id, t));
	}
	getPollingInterval() {
		return 0;
	}
	getLayerConfig() {
		return {
			color: this.defaultLayerColor,
			clusterEnabled: !0,
			clusterDistance: this.clusterDistance,
			maxEntities: this.maxEntities
		};
	}
	getEntityColor(e) {
		return this.defaultLayerColor;
	}
	getEntityIcon(e) {
		return this.icon;
	}
	renderEntity(e) {
		let t = this.getEntityColor(e), n = this.getEntityIcon(e), r = `${n?.displayName || n?.name || "default"}-${t}`;
		return this.iconUrls[r] || (this.iconUrls[r] = B(n, { color: t })), {
			type: "billboard",
			iconUrl: this.iconUrls[r],
			color: t,
			iconScale: this.iconScale
		};
	}
}, G = class extends W {
	constructor(...e) {
		super(...e), this.id = "spaceports", this.geojsonData = geojsonData, this.name = "Spaceports", this.description = "Space launch sites worldwide from OSM", this.icon = L, this.category = "space", this.version = "1.0.2", this.defaultLayerColor = "#7c3aed", this.maxEntities = 1e3;
	}
};
//#endregion
export { G as SpaceportsPlugin };
