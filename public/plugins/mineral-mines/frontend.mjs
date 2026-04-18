var { useState: e, useEffect: t, useRef: n, useMemo: r, useCallback: i, useContext: a, useReducer: o, useLayoutEffect: s, StrictMode: c, Suspense: l, createContext: u, createElement: d, cloneElement: f, isValidElement: p, Fragment: m, Children: h, Component: g, PureComponent: _, createRef: v, forwardRef: y, memo: b, lazy: x, startTransition: ee, useTransition: te, useDeferredValue: ne, useId: re, useSyncExternalStore: ie, useInsertionEffect: S } = globalThis.__WWV_HOST__.React, C = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), w = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), T = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, n) => n ? n.toUpperCase() : t.toLowerCase()), E = (e) => {
	let t = T(e);
	return t.charAt(0).toUpperCase() + t.slice(1);
}, D = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, O = (e) => {
	for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
	return !1;
}, k = u({}), A = () => a(k), j = y(({ color: e, size: t, strokeWidth: n, absoluteStrokeWidth: r, className: i = "", children: a, iconNode: o, ...s }, c) => {
	let { size: l = 24, strokeWidth: u = 2, absoluteStrokeWidth: f = !1, color: p = "currentColor", className: m = "" } = A() ?? {}, h = r ?? f ? Number(n ?? u) * 24 / Number(t ?? l) : n ?? u;
	return d("svg", {
		ref: c,
		...D,
		width: t ?? l ?? D.width,
		height: t ?? l ?? D.height,
		stroke: e ?? p,
		strokeWidth: h,
		className: C("lucide", m, i),
		...!a && !O(s) && { "aria-hidden": "true" },
		...s
	}, [...o.map(([e, t]) => d(e, t)), ...Array.isArray(a) ? a : [a]]);
}), M = ((e, t) => {
	let n = y(({ className: n, ...r }, i) => d(j, {
		ref: i,
		iconNode: t,
		className: C(`lucide-${w(E(e))}`, `lucide-${e}`, n),
		...r
	}));
	return n.displayName = E(e), n;
})("pickaxe", [
	["path", {
		d: "m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999",
		key: "1lw9ds"
	}],
	["path", {
		d: "M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024",
		key: "ffj4ej"
	}],
	["path", {
		d: "M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069",
		key: "8tj4zw"
	}],
	["path", {
		d: "M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z",
		key: "hh6h97"
	}]
]), { Viewer: N, Entity: P, Cartesian3: F, Cartesian2: I, Color: L, CallbackProperty: R, DistanceDisplayCondition: z, NearFarScalar: B, HeightReference: V, Resource: H, Rectangle: U, PolygonHierarchy: W, ClassificationType: G, ArcType: K, Math: q, JulianDate: J, TimeInterval: ae, TimeIntervalCollection: oe, SampledPositionProperty: se, GeoJsonDataSource: Y, PinBuilder: X } = globalThis.__WWV_HOST__.Cesium, { WorldPlugin: ce, PluginManifest: le, createSvgIconUrl: Z, DEFAULT_ICON_SIZE: ue } = globalThis.__WWV_HOST__.WWVPluginSDK, Q = ({ viewer: e, enabled: r }) => {
	let i = n(null);
	return t(() => {
		if (!e || !r) {
			e && i.current && (e.dataSources.remove(i.current), i.current = null);
			return;
		}
		let t = !1;
		async function n() {
			if (e) try {
				let n = new Y("mineral-mines");
				if (await n.load("/data/mineral_mines.geojson", {
					markerSymbol: "minepost",
					markerColor: L.fromCssColorString("#d97706"),
					markerSize: 24,
					clampToGround: !0
				}), t) return;
				n.clustering.enabled = !0, n.clustering.pixelRange = 40, n.clustering.minimumClusterSize = 3, n.clustering.clusterEvent.addEventListener((e, t) => {
					t.label.show = !0, t.label.text = e.length.toLocaleString(), t.label.font = "bold 14px sans-serif", t.label.fillColor = L.WHITE, t.label.outlineColor = L.BLACK, t.label.outlineWidth = 2, t.label.style = (void 0).FILL_AND_OUTLINE, t.label.verticalOrigin = (void 0).CENTER, t.label.horizontalOrigin = (void 0).CENTER, t.billboard.show = !0, t.billboard.id = t.label.id, t.billboard.verticalOrigin = (void 0).CENTER;
					let n = new X();
					t.billboard.image = n.fromColor(L.fromCssColorString("#d97706").withAlpha(.8), 48).toDataURL();
				}), e.dataSources.add(n), i.current = n;
			} catch (e) {
				console.error("[MineralMinesPlugin] Failed to load data", e);
			}
		}
		return n(), () => {
			t = !0, e && i.current && (e.dataSources.remove(i.current), i.current = null);
		};
	}, [e, r]), null;
}, $ = class {
	constructor() {
		this.id = "mineral-mines", this.name = "Mineral Mines", this.description = "Global mining sites and quarries from OpenStreetMap.", this.icon = M, this.category = "economic", this.version = "1.0.0";
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
			color: "#d97706",
			clusterEnabled: !0,
			clusterDistance: 50,
			maxEntities: 5e4
		};
	}
	renderEntity(e) {
		return this.iconUrl ||= Z(M, { color: "#d97706" }), {
			type: "billboard",
			iconUrl: this.iconUrl,
			color: "#d97706"
		};
	}
	getGlobeComponent() {
		return Q;
	}
};
//#endregion
export { $ as MineralMinesPlugin };
