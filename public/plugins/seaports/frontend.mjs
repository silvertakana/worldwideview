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
})("anchor", [
	["path", {
		d: "M12 6v16",
		key: "nqf5sj"
	}],
	["path", {
		d: "m19 13 2-1a9 9 0 0 1-18 0l2 1",
		key: "y7qv08"
	}],
	["path", {
		d: "M9 11h6",
		key: "1fldmi"
	}],
	["circle", {
		cx: "12",
		cy: "4",
		r: "2",
		key: "muu5ef"
	}]
]), c = class {
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
		super(...e), this.id = "seaports", this.name = "Seaports", this.description = "Harbours and seaports worldwide from OSM", this.icon = s, this.category = "maritime", this.version = "1.0.1", this.defaultLayerColor = "#0ea5e9";
	}
};
//#endregion
export { l as SeaportsPlugin };
