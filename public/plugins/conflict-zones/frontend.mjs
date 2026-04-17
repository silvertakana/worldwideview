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
})("crosshair", [
	["circle", {
		cx: "12",
		cy: "12",
		r: "10",
		key: "1mglay"
	}],
	["line", {
		x1: "22",
		x2: "18",
		y1: "12",
		y2: "12",
		key: "l9bcsi"
	}],
	["line", {
		x1: "6",
		x2: "2",
		y1: "12",
		y2: "12",
		key: "13hhkx"
	}],
	["line", {
		x1: "12",
		x2: "12",
		y1: "6",
		y2: "2",
		key: "10w3f3"
	}],
	["line", {
		x1: "12",
		x2: "12",
		y1: "22",
		y2: "18",
		key: "15g9kq"
	}]
]), c = [
	{
		id: "ukraine-russia",
		name: "Eastern Ukraine / Russian Border",
		lat: 48.0196,
		lon: 37.8028,
		subtext: "High-intensity conventional warfare",
		description: "Active frontline spanning eastern and southern Ukraine, including drone and missile exchanges.",
		escalationScore: 5,
		escalationTrend: "escalating",
		status: "Active Full-Scale Conflict",
		whyItMatters: "Global geopolitical stability, NATO involvement, grain and energy market impacts.",
		radiusKm: 600
	},
	{
		id: "gaza-israel",
		name: "Gaza Strip & Israel",
		lat: 31.5,
		lon: 34.466667,
		subtext: "Urban warfare and regional tension",
		description: "Intense urban warfare in Gaza with frequent missile exchanges and multi-front regional escalations.",
		escalationScore: 5,
		escalationTrend: "stable",
		status: "Active Conflict",
		whyItMatters: "Humanitarian crisis, Red Sea shipping impacts, broader Middle East regional war risks.",
		radiusKm: 150
	},
	{
		id: "red-sea-houthi",
		name: "Red Sea & Bab al-Mandab",
		lat: 13.5135,
		lon: 43.1491,
		subtext: "Maritime security threat",
		description: "Houthi drone and missile attacks on commercial shipping in the Red Sea and Gulf of Aden.",
		escalationScore: 4,
		escalationTrend: "stable",
		status: "Targeted Strikes",
		whyItMatters: "Disruption of ~12% of global trade relying on the Suez Canal.",
		radiusKm: 400
	},
	{
		id: "taiwan-strait",
		name: "Taiwan Strait",
		lat: 24.5126,
		lon: 119.9304,
		subtext: "Geopolitical flashpoint",
		description: "High Chinese military drills, ADIZ incursions, and naval presence surrounding Taiwan.",
		escalationScore: 3,
		escalationTrend: "escalating",
		status: "Tension / Gray Zone",
		whyItMatters: "Semiconductor supply chain, US-China relations, Indo-Pacific security.",
		radiusKm: 300
	},
	{
		id: "sudan-civil-war",
		name: "Sudan",
		lat: 15.5007,
		lon: 32.5599,
		subtext: "Civil War",
		description: "Widespread fighting between the SAF and RSF causing massive displacement.",
		escalationScore: 5,
		escalationTrend: "escalating",
		status: "Active Conflict",
		whyItMatters: "Severe humanitarian crisis and destabilization of the Horn of Africa.",
		radiusKm: 700
	},
	{
		id: "myanmar-civil-war",
		name: "Myanmar",
		lat: 21.9162,
		lon: 95.956,
		subtext: "Civil War",
		description: "Intensified civil war between the military junta and various ethnic armed organizations.",
		escalationScore: 4,
		escalationTrend: "stable",
		status: "Active Conflict",
		whyItMatters: "Regional stability in Southeast Asia, refugee crisis.",
		radiusKm: 500
	},
	{
		id: "korean-dmz",
		name: "Korean DMZ",
		lat: 38.3308,
		lon: 127.2406,
		subtext: "Militarized boundary",
		description: "Heightened tension with North Korean artillery drills, drone incursions, and rhetoric.",
		escalationScore: 3,
		escalationTrend: "escalating",
		status: "High Tension",
		whyItMatters: "Nuclear risk, East Asia security, US alliance.",
		radiusKm: 150
	}
];
//#endregion
//#region src/index.tsx
function l(e) {
	return e >= 5 ? "#991b1b" : e >= 4 ? "#ef4444" : e >= 3 ? "#f97316" : "#fbbf24";
}
function u(e, t) {
	let n = e?.cesiumElement;
	n && !n._wwvEntity && (n._wwvEntity = t);
}
function d(e) {
	return {
		id: e.id,
		pluginId: "conflict-zones",
		latitude: e.lat,
		longitude: e.lon,
		altitude: 0,
		timestamp: /* @__PURE__ */ new Date(),
		properties: {
			name: e.name,
			description: e.description,
			type: e.subtext || "N/A",
			status: e.status,
			escalationScore: e.escalationScore,
			escalationTrend: e.escalationTrend,
			whyItMatters: e.whyItMatters,
			radiusKm: e.radiusKm
		}
	};
}
var f = ({ enabled: e }) => e ? /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(globalThis.__WWV_HOST__.jsxRuntime.Fragment, { children: c.map((e) => {
	let t = globalThis.__WWV_HOST__.Cesium.Cartesian3.fromDegrees(e.lon, e.lat), n = l(e.escalationScore), r = globalThis.__WWV_HOST__.Cesium.Color.fromCssColorString(n).withAlpha(.25), i = globalThis.__WWV_HOST__.Cesium.Color.fromCssColorString(n).withAlpha(.8), a = e.radiusKm * 1e3, o = d(e);
	return /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(globalThis.__WWV_HOST__.Resium.Entity, {
		position: t,
		name: e.name,
		ref: (e) => u(e, o),
		children: /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(globalThis.__WWV_HOST__.Resium.EllipseGraphics, {
			semiMajorAxis: a,
			semiMinorAxis: a,
			material: r,
			outline: !0,
			outlineColor: i,
			outlineWidth: 3,
			height: 0
		})
	}, e.id);
}) }) : null, p = class {
	constructor() {
		this.id = "conflict-zones", this.name = "Conflict Zones", this.description = "Active conflict zones and geopolitical hotspots worldwide.", this.icon = s, this.category = "conflict", this.version = "1.0.0", this.iconUrls = {};
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
		let t = l(e.properties.escalationScore || 3);
		return this.iconUrls[t] || (this.iconUrls[t] = globalThis.__WWV_HOST__.WWVPluginSDK.createSvgIconUrl(s, { color: t })), {
			type: "billboard",
			iconUrl: this.iconUrls[t],
			color: t
		};
	}
	getFilterDefinitions() {
		return [{
			id: "severity",
			label: "Severity",
			type: "select",
			propertyKey: "escalationScore",
			options: [
				{
					value: "5",
					label: "Critical"
				},
				{
					value: "4",
					label: "High Tension"
				},
				{
					value: "3",
					label: "Elevated"
				},
				{
					value: "2",
					label: "Watchlist"
				}
			]
		}, {
			id: "trend",
			label: "Trend",
			type: "select",
			propertyKey: "escalationTrend",
			options: [
				{
					value: "escalating",
					label: "Escalating"
				},
				{
					value: "stable",
					label: "Stable"
				},
				{
					value: "de-escalating",
					label: "De-escalating"
				}
			]
		}];
	}
	getGlobeComponent() {
		return f;
	}
};
//#endregion
export { p as ConflictZonesPlugin };
