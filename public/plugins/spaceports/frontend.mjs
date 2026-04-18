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
		super(...e), this.id = "spaceports", this.name = "Spaceports", this.description = "Space launch sites worldwide from OSM", this.icon = s, this.category = "space", this.version = "1.0.2", this.defaultLayerColor = "#7c3aed", this.maxEntities = 1e3;
	}
};
//#endregion
export { l as SpaceportsPlugin };
