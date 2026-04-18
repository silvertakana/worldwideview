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
})("plane-takeoff", [["path", {
	d: "M2 22h20",
	key: "272qi7"
}], ["path", {
	d: "M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z",
	key: "fkigj9"
}]]), c = class {
	context = null;
	iconUrls = {};
	defaultLayerColor = "#3b82f6";
	clusterDistance = 50;
	maxEntities = 5e3;
	iconScale = 1;
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	async fetch(e) {
		return [];
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
		return this.iconUrls[r] || (this.iconUrls[r] = globalThis.__WWV_HOST__.WWVPluginSDK.createSvgIconUrl(n, { color: t })), {
			type: "billboard",
			iconUrl: this.iconUrls[r],
			color: t,
			iconScale: this.iconScale
		};
	}
}, l = class extends c {
	constructor(...e) {
		super(...e), this.id = "airports", this.name = "Airports", this.description = "Airports and aerodromes worldwide from OSM", this.icon = s, this.category = "aviation", this.version = "1.0.1", this.defaultLayerColor = "#3b82f6", this.iconScale = .5;
	}
	async fetch(e) {
		try {
			let e = await fetch("https://cdn.jsdelivr.net/npm/@worldwideview/wwv-plugin-airports@latest/data/airports.geojson");
			if (!e.ok) throw Error("Failed to load geojson");
			let t = await e.json();
			return !t || !t.features ? [] : t.features.map((e, t) => {
				let n = e.geometry?.coordinates, r = n?.[1] ?? 0, i = n?.[0] ?? 0;
				return {
					id: `airports-${e.id || t}`,
					pluginId: this.id,
					latitude: r,
					longitude: i,
					altitude: 0,
					timestamp: /* @__PURE__ */ new Date(),
					label: e.properties?.name || "Unknown Airport",
					properties: e.properties || {}
				};
			});
		} catch (e) {
			return console.error("AirportsPlugin bundle fetch error:", e), [];
		}
	}
};
//#endregion
export { l as AirportsPlugin };
