//#region ../../node_modules/.pnpm/lucide-react@0.468.0_react@19.2.3/node_modules/lucide-react/dist/esm/shared/src/utils.js
var e = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), t = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), n = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, r = globalThis.__WWV_HOST__.React.forwardRef(({ color: e = "currentColor", size: r = 24, strokeWidth: i = 2, absoluteStrokeWidth: a, className: o = "", children: s, iconNode: c, ...l }, u) => globalThis.__WWV_HOST__.React.createElement("svg", {
	ref: u,
	...n,
	width: r,
	height: r,
	stroke: e,
	strokeWidth: a ? Number(i) * 24 / Number(r) : i,
	className: t("lucide", o),
	...l
}, [...c.map(([e, t]) => globalThis.__WWV_HOST__.React.createElement(e, t)), ...Array.isArray(s) ? s : [s]])), i = ((n, i) => {
	let a = globalThis.__WWV_HOST__.React.forwardRef(({ className: a, ...o }, s) => globalThis.__WWV_HOST__.React.createElement(r, {
		ref: s,
		iconNode: i,
		className: t(`lucide-${e(n)}`, a),
		...o
	}));
	return a.displayName = `${n}`, a;
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
]), a = class {
	constructor() {
		this.id = "daynight", this.name = "Day / Night", this.description = "Real-time day/night terminator with sunlit and shadow regions.", this.icon = i, this.category = "custom", this.version = "1.0.0";
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
export { a as DayNightPlugin };
