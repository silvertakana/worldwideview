var { useState: e, useEffect: t, useRef: n, useMemo: r, useCallback: i, useContext: a, useReducer: o, useLayoutEffect: s, StrictMode: c, Suspense: l, createContext: u, createElement: d, cloneElement: f, isValidElement: p, Fragment: m, Children: h, Component: g, PureComponent: _, createRef: v, forwardRef: y, memo: b, lazy: x, startTransition: S, useTransition: C, useDeferredValue: w, useId: T, useSyncExternalStore: E, useInsertionEffect: D } = globalThis.__WWV_HOST__.React, O = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), k = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), A = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, j = y(({ color: e = "currentColor", size: t = 24, strokeWidth: n = 2, absoluteStrokeWidth: r, className: i = "", children: a, iconNode: o, ...s }, c) => d("svg", {
	ref: c,
	...A,
	width: t,
	height: t,
	stroke: e,
	strokeWidth: r ? Number(n) * 24 / Number(t) : n,
	className: k("lucide", i),
	...s
}, [...o.map(([e, t]) => d(e, t)), ...Array.isArray(a) ? a : [a]])), M = ((e, t) => {
	let n = y(({ className: n, ...r }, i) => d(j, {
		ref: i,
		iconNode: t,
		className: k(`lucide-${O(e)}`, n),
		...r
	}));
	return n.displayName = `${e}`, n;
})("SunMoon", [
	["path", {
		d: "M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4",
		key: "1fu5g2"
	}],
	["path", {
		d: "M12 2v2",
		key: "tus03m"
	}],
	["path", {
		d: "M12 20v2",
		key: "1lh1kg"
	}],
	["path", {
		d: "m4.9 4.9 1.4 1.4",
		key: "b9915j"
	}],
	["path", {
		d: "m17.7 17.7 1.4 1.4",
		key: "qc3ed3"
	}],
	["path", {
		d: "M2 12h2",
		key: "1t8f8n"
	}],
	["path", {
		d: "M20 12h2",
		key: "1q8mjw"
	}],
	["path", {
		d: "m6.3 17.7-1.4 1.4",
		key: "5gca6"
	}],
	["path", {
		d: "m19.1 4.9-1.4 1.4",
		key: "wpu9u6"
	}]
]), N = class {
	constructor() {
		this.id = "daynight", this.name = "Day / Night", this.description = "Real-time day/night terminator with sunlit and shadow regions.", this.icon = M, this.category = "custom", this.version = "1.0.0";
	}
	async initialize(e) {}
	destroy() {}
	async fetch(e) {
		return [{
			id: "daynight-scene",
			pluginId: this.id,
			latitude: 0,
			longitude: 0,
			timestamp: /* @__PURE__ */ new Date(),
			properties: {
				sceneModifier: !0,
				enableLighting: !0
			}
		}];
	}
	getPollingInterval() {
		return 0;
	}
	getLayerConfig() {
		return {
			color: "#fbbf24",
			clusterEnabled: !1,
			clusterDistance: 0
		};
	}
	renderEntity(e) {
		return {
			type: "point",
			color: "transparent",
			size: 0
		};
	}
};
//#endregion
export { N as DayNightPlugin };
