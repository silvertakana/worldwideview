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
})("shield-alert", [
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
]), c = [
	{
		id: "taiwan-adiz",
		name: "Taiwan ADIZ",
		country: "Taiwan",
		type: "ADIZ",
		status: "Active monitoring",
		centerLat: 23.5,
		centerLon: 121,
		polygon: [
			[117.5, 21],
			[117.5, 29],
			[123, 29],
			[124.5, 24.5],
			[124.5, 21],
			[117.5, 21]
		]
	},
	{
		id: "china-adiz",
		name: "East China Sea ADIZ",
		country: "China",
		type: "ADIZ",
		status: "Claimed active",
		centerLat: 29.5,
		centerLon: 125,
		polygon: [
			[121, 33],
			[125, 33],
			[128, 30],
			[125, 25],
			[121, 26],
			[121, 33]
		]
	},
	{
		id: "kadiz",
		name: "KADIZ (South Korea)",
		country: "South Korea",
		type: "ADIZ",
		status: "Active monitoring",
		centerLat: 36,
		centerLon: 128,
		polygon: [
			[123, 33],
			[123, 37],
			[125, 39],
			[131, 39],
			[132, 36],
			[128, 32],
			[123, 33]
		]
	},
	{
		id: "jadiz",
		name: "JADIZ (Japan)",
		country: "Japan",
		type: "ADIZ",
		status: "Active monitoring",
		centerLat: 35,
		centerLon: 138,
		polygon: [
			[122, 23],
			[122, 30],
			[131, 39],
			[138, 46],
			[146, 46],
			[146, 25],
			[134, 25],
			[122, 23]
		]
	},
	{
		id: "us-adiz-alaska",
		name: "US ADIZ (Alaska)",
		country: "USA",
		type: "ADIZ",
		status: "Active monitoring",
		centerLat: 64,
		centerLon: -150,
		polygon: [
			[-130, 54],
			[-145, 54],
			[-165, 50],
			[-175, 55],
			[-170, 70],
			[-140, 70],
			[-130, 54]
		]
	}
], l = ({ enabled: e }) => e ? /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(globalThis.__WWV_HOST__.jsxRuntime.Fragment, { children: c.map((e) => {
	let t = globalThis.__WWV_HOST__.Cesium.Cartesian3.fromDegreesArray(e.polygon.flatMap((e) => [e[0], e[1]])), n = e.type === "ADIZ", r = globalThis.__WWV_HOST__.Cesium.Color.fromCssColorString(n ? "#ef4444" : "#fb923c").withAlpha(.2), i = globalThis.__WWV_HOST__.Cesium.Color.fromCssColorString(n ? "#ef4444" : "#fb923c");
	return /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(globalThis.__WWV_HOST__.Resium.Entity, {
		name: e.name,
		description: `
                            <table class="cesium-infoBox-defaultTable">
                                <tbody>
                                    <tr><th>Country</th><td>${e.country}</td></tr>
                                    <tr><th>Type</th><td>${e.type}</td></tr>
                                    <tr><th>Status</th><td>${e.status}</td></tr>
                                </tbody>
                            </table>
                        `,
		children: /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(globalThis.__WWV_HOST__.Resium.PolygonGraphics, {
			hierarchy: t,
			material: r,
			outline: !0,
			outlineColor: i,
			outlineWidth: 2,
			height: 0
		})
	}, e.id);
}) }) : null, u = class {
	constructor() {
		this.id = "air-defense", this.name = "Air Defense Zones", this.description = "Known ADIZ boundaries, no-fly zones, and restricted airspace.", this.icon = s, this.category = "conflict", this.version = "1.0.0";
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
			color: "#ef4444",
			clusterEnabled: !1,
			clusterDistance: 0
		};
	}
	renderEntity(e) {
		return {
			type: "point",
			color: "#ef4444"
		};
	}
	getGlobeComponent() {
		return l;
	}
};
//#endregion
export { u as AirDefensePlugin };
