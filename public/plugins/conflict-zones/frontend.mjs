var { useState: e, useEffect: t, useRef: n, useMemo: r, useCallback: i, useContext: a, useReducer: o, useLayoutEffect: s, StrictMode: c, Suspense: l, createContext: u, createElement: d, cloneElement: f, isValidElement: p, Fragment: m, Children: h, Component: ee, PureComponent: te, createRef: ne, forwardRef: g, memo: re, lazy: ie, startTransition: ae, useTransition: oe, useDeferredValue: se, useId: ce, useSyncExternalStore: le, useInsertionEffect: ue } = globalThis.__WWV_HOST__.React, _ = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), v = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), y = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, n) => n ? n.toUpperCase() : t.toLowerCase()), b = (e) => {
	let t = y(e);
	return t.charAt(0).toUpperCase() + t.slice(1);
}, x = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, S = (e) => {
	for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
	return !1;
}, C = u({}), w = () => a(C), T = g(({ color: e, size: t, strokeWidth: n, absoluteStrokeWidth: r, className: i = "", children: a, iconNode: o, ...s }, c) => {
	let { size: l = 24, strokeWidth: u = 2, absoluteStrokeWidth: f = !1, color: p = "currentColor", className: m = "" } = w() ?? {}, h = r ?? f ? Number(n ?? u) * 24 / Number(t ?? l) : n ?? u;
	return d("svg", {
		ref: c,
		...x,
		width: t ?? l ?? x.width,
		height: t ?? l ?? x.height,
		stroke: e ?? p,
		strokeWidth: h,
		className: _("lucide", m, i),
		...!a && !S(s) && { "aria-hidden": "true" },
		...s
	}, [...o.map(([e, t]) => d(e, t)), ...Array.isArray(a) ? a : [a]]);
}), E = ((e, t) => {
	let n = g(({ className: n, ...r }, i) => d(T, {
		ref: i,
		iconNode: t,
		className: _(`lucide-${v(b(e))}`, `lucide-${e}`, n),
		...r
	}));
	return n.displayName = b(e), n;
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
]), { Viewer: de, Entity: fe, Cartesian3: D, Cartesian2: pe, Color: O, CallbackProperty: k, DistanceDisplayCondition: A, NearFarScalar: j, HeightReference: M, Resource: N, Rectangle: P, PolygonHierarchy: F, ClassificationType: I, ArcType: L, Math: R, JulianDate: z, TimeInterval: B, TimeIntervalCollection: me, SampledPositionProperty: he, GeoJsonDataSource: ge, PinBuilder: _e } = globalThis.__WWV_HOST__.Cesium, { Entity: V, PointGraphics: ve, BillboardGraphics: ye, CustomDataSource: be, Camera: xe, PolygonGraphics: Se, PolylineGraphics: Ce, EllipseGraphics: H, LabelGraphics: we, ModelGraphics: Te, PathGraphics: Ee, BoxGraphics: De, GeoJsonDataSource: Oe, ScreenSpaceEventHandler: ke, ScreenSpaceEvent: Ae } = globalThis.__WWV_HOST__.Resium, { WorldPlugin: U, PluginManifest: je, createSvgIconUrl: W, DEFAULT_ICON_SIZE: Me } = globalThis.__WWV_HOST__.WWVPluginSDK, G = [
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
], K = globalThis.__WWV_HOST__.jsxRuntime, q = K.jsx;
K.jsxs;
var J = K.Fragment;
//#endregion
//#region src/index.tsx
function Y(e) {
	return e >= 5 ? "#991b1b" : e >= 4 ? "#ef4444" : e >= 3 ? "#f97316" : "#fbbf24";
}
function X(e, t) {
	let n = e?.cesiumElement;
	n && !n._wwvEntity && (n._wwvEntity = t);
}
function Z(e) {
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
var Q = ({ enabled: e }) => e ? /* @__PURE__ */ q(J, { children: G.map((e) => {
	let t = D.fromDegrees(e.lon, e.lat), n = Y(e.escalationScore), r = O.fromCssColorString(n).withAlpha(.25), i = O.fromCssColorString(n).withAlpha(.8), a = e.radiusKm * 1e3, o = Z(e);
	return /* @__PURE__ */ q(V, {
		position: t,
		name: e.name,
		ref: (e) => X(e, o),
		children: /* @__PURE__ */ q(H, {
			semiMajorAxis: a,
			semiMinorAxis: a,
			material: r,
			outline: !0,
			outlineColor: i,
			outlineWidth: 3,
			height: 0
		})
	}, e.id);
}) }) : null, $ = class {
	constructor() {
		this.id = "conflict-zones", this.name = "Conflict Zones", this.description = "Active conflict zones and geopolitical hotspots worldwide.", this.icon = E, this.category = "conflict", this.version = "1.0.0", this.iconUrls = {};
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
		let t = Y(e.properties.escalationScore || 3);
		return this.iconUrls[t] || (this.iconUrls[t] = W(E, { color: t })), {
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
		return Q;
	}
};
//#endregion
export { $ as ConflictZonesPlugin };
