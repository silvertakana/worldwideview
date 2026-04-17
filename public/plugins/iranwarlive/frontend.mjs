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
}, [...l.map(([e, t]) => globalThis.__WWV_HOST__.React.createElement(e, t)), ...Array.isArray(c) ? c : [c]])), s = (n, i) => {
	let a = globalThis.__WWV_HOST__.React.forwardRef(({ className: a, ...s }, c) => globalThis.__WWV_HOST__.React.createElement(o, {
		ref: c,
		iconNode: i,
		className: e(`lucide-${t(r(n))}`, `lucide-${n}`, a),
		...s
	}));
	return a.displayName = r(n), a;
}, c = s("bomb", [
	["circle", {
		cx: "11",
		cy: "13",
		r: "9",
		key: "hd149"
	}],
	["path", {
		d: "M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95",
		key: "jp4j1b"
	}],
	["path", {
		d: "m22 2-1.5 1.5",
		key: "ay92ug"
	}]
]), l = s("plane", [["path", {
	d: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
	key: "1v9wt8"
}]]), u = s("rocket", [
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
]), d = s("shield-alert", [
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
]), f = s("target", [
	["circle", {
		cx: "12",
		cy: "12",
		r: "10",
		key: "1mglay"
	}],
	["circle", {
		cx: "12",
		cy: "12",
		r: "6",
		key: "1vlfrh"
	}],
	["circle", {
		cx: "12",
		cy: "12",
		r: "2",
		key: "1c9p78"
	}]
]), p = class {
	context = null;
	iconUrls = {};
	defaultLayerColor = "#ef4444";
	clusterDistance = 40;
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	getEntityIcon(e) {
		return this.icon;
	}
	getPollingInterval() {
		return 0;
	}
	getLayerConfig() {
		return {
			color: this.defaultLayerColor,
			clusterEnabled: !0,
			clusterDistance: this.clusterDistance
		};
	}
	renderEntity(e) {
		let t = this.getSeverityValue(e), n = this.getSeverityColor(t), r = this.getSeveritySize(t), i = this.getEntityIcon(e), a = `${i?.displayName || i?.name || "default"}-${n}`;
		return this.iconUrls[a] || (this.iconUrls[a] = globalThis.__WWV_HOST__.WWVPluginSDK.createSvgIconUrl(i, { color: n })), {
			type: "billboard",
			iconUrl: this.iconUrls[a],
			color: n,
			size: r,
			outlineColor: "#000000",
			outlineWidth: 1,
			labelText: e.label || void 0,
			labelFont: "11px JetBrains Mono, monospace"
		};
	}
};
//#endregion
//#region src/index.ts
function m(e) {
	switch (e.toLowerCase()) {
		case "missile strike": return u;
		case "air strike": return l;
		case "ground combat": return f;
		case "artillery": return c;
		default: return d;
	}
}
var h = class extends p {
	constructor(...e) {
		super(...e), this.id = "iranwarlive", this.name = "Iran War Live", this.description = "Live OSINT tracking — Data sourced from IranWarLive.com (Not for Life-Safety)", this.icon = d, this.category = "conflict", this.version = "1.0.2", this.defaultLayerColor = "#ef4444", this.clusterDistance = 40;
	}
	getSeverityValue(e) {
		return e.properties.casualties || 0;
	}
	getSeverityColor(e) {
		return "#ef4444";
	}
	getSeveritySize(e) {
		return 16;
	}
	getEntityIcon(e) {
		return m(e.properties.type || "Unknown");
	}
	async fetch(e) {
		try {
			let e = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, "").replace(/^ws/, "http") : "http://localhost:5001", t = await globalThis.fetch(`${e}/data/iranwarlive`);
			if (!t.ok) throw Error(`IranWarLive Backend returned ${t.status}`);
			let n = await t.json();
			return !n.items || !Array.isArray(n.items) ? [] : n.items.map((e) => {
				let t = e._osint_meta?.coordinates?.lat || 0, n = e._osint_meta?.coordinates?.lng || 0, r = new Date(e.timestamp), i = Math.max(0, Math.round((Date.now() - r.getTime()) / (1e3 * 60 * 60)));
				return {
					id: e.event_id,
					pluginId: "iranwarlive",
					latitude: t,
					longitude: n,
					timestamp: r,
					label: e.type + (e.location ? ` in ${e.location}` : ""),
					properties: {
						hours_ago: i,
						type: e.type,
						confidence: e.confidence,
						location: e.location,
						summary: e.event_summary,
						casualties: e._osint_meta?.casualties || 0,
						source_url: e.source_url,
						preview_image: e.preview_image,
						preview_video: e.preview_video
					}
				};
			});
		} catch (e) {
			return console.error("[IranWarLivePlugin] Fetch error from microservice backend:", e), [];
		}
	}
	getServerConfig() {
		return {
			apiBasePath: "/api/iranwarlive",
			pollingIntervalMs: 0,
			historyEnabled: !0
		};
	}
	getFilterDefinitions() {
		return [
			{
				id: "type",
				label: "Strike Type",
				type: "select",
				propertyKey: "type",
				options: [{
					value: "Missile Strike",
					label: "Missile Strike"
				}, {
					value: "Air Strike",
					label: "Air Strike"
				}]
			},
			{
				id: "confidence",
				label: "Intelligence Confidence",
				type: "select",
				propertyKey: "confidence",
				options: [{
					value: "News Wire",
					label: "News Wire"
				}, {
					value: "State Actor",
					label: "State Defense Press"
				}]
			},
			{
				id: "hours_ago",
				label: "Max Hours Ago",
				type: "range",
				propertyKey: "hours_ago",
				range: {
					min: 0,
					max: 168,
					step: 1
				}
			}
		];
	}
	getLegend() {
		return [{
			label: "Kinetic Event",
			color: "#ef4444"
		}];
	}
};
//#endregion
export { h as IranWarLivePlugin };
