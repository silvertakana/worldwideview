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
})("shield", [["path", {
	d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
	key: "oel41y"
}]]), c = class {
	category = "aviation";
	context = null;
	defaultLayerColor = "#3b82f6";
	defaultTrailColor = "#00fff7";
	iconUrl = "/plane-icon.svg";
	modelUrl = "/airplane/scene.gltf";
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	getPollingInterval() {
		return 0;
	}
	getLayerConfig() {
		return {
			color: this.defaultLayerColor,
			clusterEnabled: !0,
			clusterDistance: 40,
			maxEntities: 5e3
		};
	}
	renderEntity(e) {
		let t = e.properties.altitude_m, n = !e.properties.on_ground;
		return {
			type: "model",
			iconUrl: this.iconUrl,
			size: n ? 8 : 5,
			modelUrl: this.modelUrl,
			modelScale: 2.56,
			modelMinPixelSize: 16,
			modelHeadingOffset: 180,
			color: this.getAltitudeColor(t),
			rotation: e.heading,
			labelText: e.label || void 0,
			labelFont: "11px JetBrains Mono, monospace"
		};
	}
	getSelectionBehavior(e) {
		return e.properties.on_ground ? null : {
			showTrail: !0,
			trailDurationSec: 60,
			trailStepSec: 5,
			trailColor: this.defaultTrailColor,
			flyToOffsetMultiplier: 3,
			flyToBaseDistance: 3e4
		};
	}
};
//#endregion
//#region src/index.ts
function l(e) {
	return e * .3048;
}
var u = class extends c {
	constructor(...e) {
		super(...e), this.id = "military-aviation", this.name = "Military Aviation", this.description = "Real-time military aircraft tracking via adsb.lol", this.icon = s, this.version = "1.0.4", this.defaultLayerColor = "#ff6f00", this.defaultTrailColor = "#ffea00", this.iconUrl = "/military-plane-icon.svg";
	}
	getAltitudeColor(e) {
		let t = e === null ? null : e / .3048;
		return t === null || t <= 0 ? "#39ff14" : t < 1e4 ? "#ff6f00" : t < 25e3 ? "#ff1744" : t < 4e4 ? "#ff4081" : "#ffea00";
	}
	mapPayloadToEntities(e) {
		let t = [];
		if (Array.isArray(e)) t = e;
		else if (e && typeof e == "object") t = Object.values(e);
		else return [];
		return t.filter((e) => e.lat != null && e.lon != null).map((e) => {
			let t = typeof e.alt_baro == "number" ? e.alt_baro : null, n = t === null ? null : l(t), r = e.alt_baro === "ground";
			return {
				id: `military-aviation-${e.hex}`,
				pluginId: "military-aviation",
				latitude: e.lat,
				longitude: e.lon,
				altitude: n === null ? 0 : n * 10,
				heading: e.track ?? void 0,
				speed: e.gs ?? void 0,
				timestamp: /* @__PURE__ */ new Date(),
				label: e.flight?.trim() || e.r || e.hex,
				properties: {
					hex: e.hex,
					callsign: e.flight?.trim() || null,
					registration: e.r || null,
					aircraft_type: e.t || null,
					altitude_ft: t,
					altitude_m: n,
					ground_speed_kts: e.gs ?? null,
					heading: e.track ?? null,
					squawk: e.squawk || null,
					on_ground: r,
					category: e.category || null,
					emergency: e.emergency || null,
					history: e.history || []
				}
			};
		});
	}
	async fetch(e) {
		try {
			let e = "http://localhost:5001";
			typeof process < "u" && process.env && process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL ? e = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, "").replace(/^ws/, "http") : globalThis.__WWV_HOST__?.NEXT_PUBLIC_WS_ENGINE_URL && (e = globalThis.__WWV_HOST__.NEXT_PUBLIC_WS_ENGINE_URL.replace(/\/stream$/, "").replace(/^ws/, "http"));
			let t = await globalThis.fetch(`${e}/data/military-aviation`);
			if (!t.ok) throw Error(`Military API returned ${t.status}`);
			let n = await t.json(), r = n.ac || n.items;
			return this.mapPayloadToEntities(r);
		} catch (e) {
			return console.error("[MilitaryPlugin] Fetch error:", e), this.context?.onError && this.context.onError(e), [];
		}
	}
	mapWebsocketPayload(e) {
		return this.mapPayloadToEntities(e);
	}
	getServerConfig() {
		return {
			apiBasePath: "/api/military-aviation",
			pollingIntervalMs: 0,
			historyEnabled: !0
		};
	}
	getFilterDefinitions() {
		return [
			{
				id: "aircraft_type",
				label: "Aircraft Type",
				type: "text",
				propertyKey: "aircraft_type"
			},
			{
				id: "callsign",
				label: "Callsign",
				type: "text",
				propertyKey: "callsign"
			},
			{
				id: "registration",
				label: "Registration",
				type: "text",
				propertyKey: "registration"
			},
			{
				id: "altitude",
				label: "Altitude (ft)",
				type: "range",
				propertyKey: "altitude_ft",
				range: {
					min: 0,
					max: 6e4,
					step: 1e3
				}
			},
			{
				id: "on_ground",
				label: "On Ground",
				type: "boolean",
				propertyKey: "on_ground"
			}
		];
	}
	getLegend() {
		return [
			{
				label: "0 ft (Surface)",
				color: "#39ff14"
			},
			{
				label: "< 10,000 ft",
				color: "#ff6f00"
			},
			{
				label: "10,000 - 25,000 ft",
				color: "#ff1744"
			},
			{
				label: "25,000 - 40,000 ft",
				color: "#ff4081"
			},
			{
				label: "> 40,000 ft",
				color: "#ffea00"
			}
		];
	}
};
//#endregion
export { u as MilitaryPlugin };
