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
})("plane", [["path", {
	d: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
	key: "1v9wt8"
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
	return e === null || e <= 0 ? "grounded" : e < 3e3 ? "low" : e < 8e3 ? "mid" : e < 12e3 ? "high" : "extreme";
}
var u = class extends c {
	constructor(...e) {
		super(...e), this.id = "aviation", this.name = "Aviation", this.description = "Real-time aircraft tracking via OpenSky Network", this.icon = s, this.version = "1.0.8";
	}
	getAltitudeColor(e) {
		return e === null || e <= 0 ? "#4ade80" : e < 3e3 ? "#22d3ee" : e < 8e3 ? "#3b82f6" : e < 12e3 ? "#a78bfa" : "#f472b6";
	}
	mapPayloadToEntities(e) {
		let t = [];
		if (Array.isArray(e)) t = e;
		else if (e && typeof e == "object") t = Object.values(e);
		else return [];
		return t.map((e) => {
			let t = e.ts || e.time_position || e.last_contact || e.last_updated;
			return {
				id: `aviation-${e.icao24}`,
				pluginId: "aviation",
				latitude: e.lat,
				longitude: e.lon,
				altitude: (e.alt || 0) * 10,
				heading: e.hdg || void 0,
				speed: e.spd || void 0,
				timestamp: new Date(t ? t * 1e3 : Date.now()),
				label: e.callsign || e.icao24,
				properties: {
					icao24: e.icao24,
					callsign: e.callsign,
					origin_country: e.origin_country,
					altitude_m: e.alt,
					altitude_band: l(e.alt || 0),
					velocity_ms: e.spd,
					heading: e.hdg,
					vertical_rate: e.vertical_rate,
					on_ground: e.on_ground,
					squawk: e.squawk
				}
			};
		});
	}
	async fetch(e) {
		try {
			let e = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, "").replace(/^ws/, "http") : "http://localhost:5001", t;
			if (this.context.isPlaybackMode()) {
				let n = this.context.getCurrentTime().getTime();
				t = await fetch(`${e}/data/aviation?time=${n}`);
			} else t = await fetch(`${e}/data/aviation?lookback=15m`);
			if (!t.ok) throw Error(`Data Engine API returned ${t.status}`);
			let n = await t.json();
			return this.mapPayloadToEntities(n.items);
		} catch (e) {
			return console.error("[AviationPlugin] Fetch error:", e), this.context?.onError && this.context.onError(e), [];
		}
	}
	mapWebsocketPayload(e) {
		return this.mapPayloadToEntities(e);
	}
	getServerConfig() {
		return {
			apiBasePath: "/api/aviation",
			pollingIntervalMs: 5e3,
			requiresAuth: !0,
			historyEnabled: !0,
			availabilityEnabled: !0
		};
	}
	getLegend() {
		return [
			{
				label: "0 m (Grounded)",
				color: "#4ade80",
				filterId: "altitude_band",
				filterValue: "grounded"
			},
			{
				label: "< 3,000 m",
				color: "#22d3ee",
				filterId: "altitude_band",
				filterValue: "low"
			},
			{
				label: "3,000 - 8,000 m",
				color: "#3b82f6",
				filterId: "altitude_band",
				filterValue: "mid"
			},
			{
				label: "8,000 - 12,000 m",
				color: "#a78bfa",
				filterId: "altitude_band",
				filterValue: "high"
			},
			{
				label: "> 12,000 m",
				color: "#f472b6",
				filterId: "altitude_band",
				filterValue: "extreme"
			}
		];
	}
	getFilterDefinitions() {
		return [
			{
				id: "origin_country",
				label: "Country",
				type: "select",
				propertyKey: "origin_country",
				options: [
					{
						value: "United States",
						label: "United States"
					},
					{
						value: "China",
						label: "China"
					},
					{
						value: "United Kingdom",
						label: "United Kingdom"
					},
					{
						value: "Germany",
						label: "Germany"
					},
					{
						value: "France",
						label: "France"
					},
					{
						value: "Japan",
						label: "Japan"
					},
					{
						value: "Australia",
						label: "Australia"
					},
					{
						value: "Canada",
						label: "Canada"
					},
					{
						value: "India",
						label: "India"
					},
					{
						value: "Brazil",
						label: "Brazil"
					},
					{
						value: "Russia",
						label: "Russia"
					},
					{
						value: "Turkey",
						label: "Turkey"
					},
					{
						value: "South Korea",
						label: "South Korea"
					},
					{
						value: "Indonesia",
						label: "Indonesia"
					},
					{
						value: "Mexico",
						label: "Mexico"
					}
				]
			},
			{
				id: "altitude",
				label: "Altitude (m)",
				type: "range",
				propertyKey: "altitude_m",
				range: {
					min: 0,
					max: 15e3,
					step: 500
				}
			},
			{
				id: "altitude_band",
				label: "Altitude Category",
				type: "select",
				propertyKey: "altitude_band",
				options: [
					{
						value: "grounded",
						label: "0 m (Grounded)"
					},
					{
						value: "low",
						label: "< 3,000 m"
					},
					{
						value: "mid",
						label: "3,000 - 8,000 m"
					},
					{
						value: "high",
						label: "8,000 - 12,000 m"
					},
					{
						value: "extreme",
						label: "> 12,000 m"
					}
				]
			},
			{
				id: "on_ground",
				label: "On Ground",
				type: "boolean",
				propertyKey: "on_ground"
			},
			{
				id: "callsign",
				label: "Callsign",
				type: "text",
				propertyKey: "callsign"
			}
		];
	}
};
//#endregion
export { u as AviationPlugin };
