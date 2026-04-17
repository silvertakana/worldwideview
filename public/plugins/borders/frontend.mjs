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
})("map", [
	["path", {
		d: "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",
		key: "169xi5"
	}],
	["path", {
		d: "M15 5.764v15",
		key: "1pn4in"
	}],
	["path", {
		d: "M9 3.236v15",
		key: "1uimfh"
	}]
]), c = class {
	constructor() {
		this.id = "borders", this.name = "Borders & Labels", this.description = "Displays political borders and country labels on the map.", this.icon = s, this.category = "custom", this.version = "1.0.0";
	}
	async initialize(e) {}
	destroy() {}
	async fetch(e) {
		return [];
	}
	getPollingInterval() {
		return 9999999;
	}
	getLayerConfig() {
		return {
			color: "#00ffff",
			clusterEnabled: !1,
			clusterDistance: 0,
			maxEntities: 0
		};
	}
	renderEntity(e) {
		return { type: "point" };
	}
};
//#endregion
export { c as BordersPlugin };
