import { n as e } from "./analytics-xEdo9Jrc.js";
//#region ../../node_modules/.pnpm/lucide-react@0.576.0_react@19.2.3/node_modules/lucide-react/dist/esm/shared/src/utils/mergeClasses.js
var t = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), n = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), r = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, n) => n ? n.toUpperCase() : t.toLowerCase()), i = (e) => {
	let t = r(e);
	return t.charAt(0).toUpperCase() + t.slice(1);
}, a = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, o = (e) => {
	for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
	return !1;
}, s = globalThis.__WWV_HOST__.React.forwardRef(({ color: e = "currentColor", size: n = 24, strokeWidth: r = 2, absoluteStrokeWidth: i, className: s = "", children: c, iconNode: l, ...u }, d) => globalThis.__WWV_HOST__.React.createElement("svg", {
	ref: d,
	...a,
	width: n,
	height: n,
	stroke: e,
	strokeWidth: i ? Number(r) * 24 / Number(n) : r,
	className: t("lucide", s),
	...!c && !o(u) && { "aria-hidden": "true" },
	...u
}, [...l.map(([e, t]) => globalThis.__WWV_HOST__.React.createElement(e, t)), ...Array.isArray(c) ? c : [c]])), c = (e, r) => {
	let a = globalThis.__WWV_HOST__.React.forwardRef(({ className: a, ...o }, c) => globalThis.__WWV_HOST__.React.createElement(s, {
		ref: c,
		iconNode: r,
		className: t(`lucide-${n(i(e))}`, `lucide-${e}`, a),
		...o
	}));
	return a.displayName = i(e), a;
}, l = c("clock", [["circle", {
	cx: "12",
	cy: "12",
	r: "10",
	key: "1mglay"
}], ["path", {
	d: "M12 6v6l4 2",
	key: "mmk7yg"
}]]), u = c("ship", [
	["path", {
		d: "M12 10.189V14",
		key: "1p8cqu"
	}],
	["path", {
		d: "M12 2v3",
		key: "qbqxhf"
	}],
	["path", {
		d: "M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6",
		key: "qpkstq"
	}],
	["path", {
		d: "M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76",
		key: "7tigtc"
	}],
	["path", {
		d: "M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
		key: "1924j5"
	}]
]), d = (e) => {
	let t, n = /* @__PURE__ */ new Set(), r = (e, r) => {
		let i = typeof e == "function" ? e(t) : e;
		if (!Object.is(i, t)) {
			let e = t;
			t = r ?? (typeof i != "object" || !i) ? i : Object.assign({}, t, i), n.forEach((n) => n(t, e));
		}
	}, i = () => t, a = {
		setState: r,
		getState: i,
		getInitialState: () => o,
		subscribe: (e) => (n.add(e), () => n.delete(e))
	}, o = t = e(r, i, a);
	return a;
}, ee = ((e) => e ? d(e) : d), f = (e) => e;
function te(e, t = f) {
	let n = globalThis.__WWV_HOST__.React.useSyncExternalStore(e.subscribe, globalThis.__WWV_HOST__.React.useCallback(() => t(e.getState()), [e, t]), globalThis.__WWV_HOST__.React.useCallback(() => t(e.getInitialState()), [e, t]));
	return globalThis.__WWV_HOST__.React.useDebugValue(n), n;
}
var p = (e) => {
	let t = ee(e), n = (e) => te(t, e);
	return Object.assign(n, t), n;
}, m = ((e) => e ? p(e) : p), h = (e) => ({
	cameraLat: 20,
	cameraLon: 0,
	cameraAlt: 2e7,
	cameraHeading: 0,
	cameraPitch: -90,
	cameraRoll: 0,
	isAnimating: !1,
	fps: 0,
	setCameraPosition: (t, n, r, i = 0, a = -90, o = 0) => e({
		cameraLat: t,
		cameraLon: n,
		cameraAlt: r,
		cameraHeading: i,
		cameraPitch: a,
		cameraRoll: o
	}),
	setAnimating: (t) => e({ isAnimating: t }),
	setFps: (t) => e({ fps: t })
}), g = (e) => ({
	layers: {},
	toggleLayer: (t) => e((e) => ({ layers: {
		...e.layers,
		[t]: {
			...e.layers[t],
			enabled: !e.layers[t]?.enabled
		}
	} })),
	setLayerEnabled: (t, n) => e((e) => ({ layers: {
		...e.layers,
		[t]: {
			...e.layers[t],
			enabled: n
		}
	} })),
	setEntityCount: (t, n) => e((e) => ({ layers: {
		...e.layers,
		[t]: {
			...e.layers[t],
			entityCount: n
		}
	} })),
	setLayerLoading: (t, n) => e((e) => ({ layers: {
		...e.layers,
		[t]: {
			...e.layers[t],
			loading: n
		}
	} })),
	initLayer: (t, n = !1) => e((e) => ({ layers: {
		...e.layers,
		[t]: e.layers[t] || {
			enabled: n,
			entityCount: 0,
			loading: !1
		}
	} }))
});
//#endregion
//#region ../../src/core/state/timelineSlice.ts
function _(e) {
	let t = /* @__PURE__ */ new Date();
	return {
		start: new Date(t.getTime() - {
			"1h": 36e5,
			"6h": 216e5,
			"24h": 864e5,
			"48h": 1728e5,
			"7d": 6048e5
		}[e]),
		end: t
	};
}
var v = (e) => ({
	currentTime: /* @__PURE__ */ new Date(),
	timeWindow: "24h",
	timeRange: _("24h"),
	isPlaying: !1,
	playbackSpeed: 1,
	isPlaybackMode: !1,
	playbackTime: Date.now(),
	timelineAvailability: {},
	setCurrentTime: (t) => e({ currentTime: t }),
	setTimeWindow: (t) => e({
		timeWindow: t,
		timeRange: _(t)
	}),
	setTimeRange: (t) => e({ timeRange: t }),
	setPlaying: (t) => e({ isPlaying: t }),
	setPlaybackSpeed: (t) => e({ playbackSpeed: t }),
	setPlaybackMode: (t) => e({ isPlaybackMode: t }),
	setPlaybackTime: (t) => e({ playbackTime: t }),
	setTimelineAvailability: (t, n) => e((e) => ({ timelineAvailability: {
		...e.timelineAvailability,
		[t]: n
	} }))
}), y = (e) => ({
	leftSidebarOpen: !0,
	rightSidebarOpen: !1,
	configPanelOpen: !0,
	filterPanelOpen: !1,
	selectedEntity: null,
	hoveredEntity: null,
	hoveredScreenPosition: null,
	lockedEntityId: null,
	floatingStreams: [],
	activeConfigTab: "filters",
	highlightLayerId: null,
	openMobilePanel: null,
	mobileRightPanelGlow: !1,
	feedbackDialogOpen: !1,
	toggleLeftSidebar: () => e((e) => ({ leftSidebarOpen: !e.leftSidebarOpen })),
	toggleRightSidebar: () => e((e) => ({ rightSidebarOpen: !e.rightSidebarOpen })),
	toggleConfigPanel: () => e((e) => ({ configPanelOpen: !e.configPanelOpen })),
	toggleFilterPanel: () => e((e) => ({ filterPanelOpen: !e.filterPanelOpen })),
	setFeedbackDialogOpen: (t) => e({ feedbackDialogOpen: t }),
	setSelectedEntity: (t) => {
		t && import("./analytics-xEdo9Jrc.js").then((e) => e.t).then(({ trackEvent: e }) => {
			e("entity-select", {
				plugin: t.pluginId,
				entityId: t.id
			});
		}), e((e) => ({
			selectedEntity: t,
			rightSidebarOpen: t !== null,
			configPanelOpen: t !== null,
			openMobilePanel: t === null ? null : e.openMobilePanel,
			mobileRightPanelGlow: t !== null,
			activeConfigTab: t === null ? "filters" : "intel"
		}));
	},
	setHoveredEntity: (t, n) => e({
		hoveredEntity: t,
		hoveredScreenPosition: n ?? null
	}),
	setLockedEntityId: (t) => e({ lockedEntityId: t }),
	addFloatingStream: (t) => e((e) => e.floatingStreams.find((e) => e.id === t.id) ? e : { floatingStreams: [...e.floatingStreams, {
		...t,
		position: {
			x: 100 + e.floatingStreams.length * 20,
			y: 100 + e.floatingStreams.length * 20
		},
		size: {
			width: 400,
			height: 260
		}
	}] }),
	removeFloatingStream: (t) => e((e) => ({ floatingStreams: e.floatingStreams.filter((e) => e.id !== t) })),
	updateFloatingStream: (t, n) => e((e) => ({ floatingStreams: e.floatingStreams.map((e) => e.id === t ? {
		...e,
		...n
	} : e) })),
	setActiveConfigTab: (t) => e({ activeConfigTab: t }),
	setHighlightLayerId: (t) => e({ highlightLayerId: t }),
	setConfigPanelOpen: (t) => e({ configPanelOpen: t }),
	setOpenMobilePanel: (t) => e((e) => ({
		openMobilePanel: e.openMobilePanel === t ? null : t,
		mobileRightPanelGlow: t === "right" ? !1 : e.mobileRightPanelGlow
	})),
	errorToastMessage: null,
	showErrorToast: (t) => e({ errorToastMessage: t }),
	clearErrorToast: () => e({ errorToastMessage: null })
}), ne = (e) => ({
	filters: {},
	setFilter: (t, n, r) => e((e) => ({ filters: {
		...e.filters,
		[t]: {
			...e.filters[t],
			[n]: r
		}
	} })),
	clearFilters: (t) => e((e) => {
		let n = { ...e.filters };
		return delete n[t], { filters: n };
	}),
	clearAllFilters: () => e({ filters: {} })
}), re = (e, t) => ({
	entitiesByPlugin: {},
	setEntities: (t, n) => e((e) => {
		let r = { entitiesByPlugin: {
			...e.entitiesByPlugin,
			[t]: n
		} };
		if (e.selectedEntity?.pluginId === t) {
			let t = n.find((t) => t.id === e.selectedEntity.id);
			t && (r.selectedEntity = t);
		}
		return r;
	}),
	clearEntities: (t) => e((e) => {
		let n = { ...e.entitiesByPlugin };
		return delete n[t], { entitiesByPlugin: n };
	}),
	getAllEntities: () => {
		let e = t();
		return Object.values(e.entitiesByPlugin).flat();
	}
}), ie = (e) => ({
	dataConfig: {
		pollingIntervals: {},
		cacheEnabled: !0,
		cacheMaxAge: 36e5,
		maxConcurrentRequests: 5,
		retryAttempts: 3,
		experimentalFeatures: {
			predictiveLoading: !1,
			realtimeStreaming: !1,
			clusteringEnabled: !0,
			showTimelineHighlight: !0
		},
		pluginSettings: {}
	},
	mapConfig: {
		showFps: !1,
		resolutionScale: 1,
		antiAliasing: "fxaa",
		maxScreenSpaceError: 32,
		shadowsEnabled: !1,
		enableLighting: !1,
		baseLayerId: typeof window < "u" && window.localStorage && typeof window.localStorage.getItem == "function" && localStorage.getItem("wwv_map_layer") || "google-3d",
		fallbackLayerId: null,
		sceneMode: 3
	},
	updateDataConfig: (t) => e((e) => ({ dataConfig: {
		...e.dataConfig,
		...t
	} })),
	updateMapConfig: (t) => e((e) => (t.baseLayerId && typeof window < "u" && window.localStorage && typeof window.localStorage.setItem == "function" && localStorage.setItem("wwv_map_layer", t.baseLayerId), { mapConfig: {
		...e.mapConfig,
		...t
	} })),
	setPollingInterval: (t, n) => e((e) => ({ dataConfig: {
		...e.dataConfig,
		pollingIntervals: {
			...e.dataConfig.pollingIntervals,
			[t]: n
		}
	} })),
	updatePluginSettings: (t, n) => e((e) => ({ dataConfig: {
		...e.dataConfig,
		pluginSettings: {
			...e.dataConfig.pluginSettings,
			[t]: {
				...e.dataConfig.pluginSettings[t],
				...n
			}
		}
	} }))
}), ae = new Set([
	"local",
	"cloud",
	"demo"
]);
function oe(e) {
	let t = (e ?? "").trim().toLowerCase();
	return ae.has(t) ? t : "local";
}
var b = oe(process.env.NEXT_PUBLIC_WWV_EDITION) === "demo";
process.env.WWV_DEMO_ADMIN_SECRET?.trim();
//#endregion
//#region ../../src/core/state/favoritesSlice.ts
function x(e) {
	if (typeof document < "u") {
		let t = e.map((e) => ({
			...e,
			icon: void 0
		}));
		document.cookie = `wwv_favorites=${encodeURIComponent(JSON.stringify(t))}; path=/; max-age=31536000`;
	}
}
var se = (e, t) => ({
	favorites: [],
	initFavorites: (t) => e({ favorites: t }),
	addFavorite: (n, r, i) => {
		let a = t();
		if (a.favorites.some((e) => e.id === n.id)) return;
		let o = {
			id: n.id,
			pluginId: n.pluginId,
			label: n.label || n.id,
			pluginName: r,
			icon: i,
			lastSeen: Date.now()
		}, s = [...a.favorites, o];
		e({ favorites: s }), b ? x(s) : fetch("/api/user/favorites", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				entityId: n.id,
				pluginId: n.pluginId,
				label: n.label || n.id,
				pluginName: r
			})
		}).catch((e) => console.error("Failed to sync add favorite to DB:", e));
	},
	removeFavorite: (n) => {
		let r = t().favorites.filter((e) => e.id !== n);
		e({ favorites: r }), b ? x(r) : fetch(`/api/user/favorites?entityId=${encodeURIComponent(n)}`, { method: "DELETE" }).catch((e) => console.error("Failed to sync remove favorite from DB:", e));
	}
}), ce = (e) => ({
	importedLayers: [],
	addImportedLayer: (t) => e((e) => ({ importedLayers: [...e.importedLayers, t] })),
	removeImportedLayer: (t) => e((e) => ({ importedLayers: e.importedLayers.filter((e) => e.id !== t) })),
	toggleImportedLayerVisibility: (t) => e((e) => ({ importedLayers: e.importedLayers.map((e) => e.id === t ? {
		...e,
		visible: !e.visible
	} : e) })),
	updateImportedLayer: (t, n) => e((e) => ({ importedLayers: e.importedLayers.map((e) => e.id === t ? {
		...e,
		...n
	} : e) }))
}), S = m((...e) => ({
	...h(...e),
	...g(...e),
	...v(...e),
	...y(...e),
	...ne(...e),
	...re(...e),
	...ie(...e),
	...se(...e),
	...ce(...e)
})), C = [
	"declarative",
	"static",
	"bundle"
], w = ["data-layer", "extension"], T = [
	"built-in",
	"verified",
	"unverified"
];
function E(e) {
	let t = [];
	return e.id?.trim() || t.push("Missing required field: id"), e.name?.trim() || t.push("Missing required field: name"), e.version?.trim() || t.push("Missing required field: version"), w.includes(e.type) || t.push(`Invalid type "${e.type}". Must be: ${w.join(", ")}`), C.includes(e.format) || t.push(`Invalid format "${e.format}". Must be: ${C.join(", ")}`), T.includes(e.trust) || t.push(`Invalid trust "${e.trust}". Must be: ${T.join(", ")}`), (!Array.isArray(e.capabilities) || e.capabilities.length === 0) && t.push("capabilities must be a non-empty array"), t;
}
function D(e) {
	let t = [];
	return e.dataSource ? (e.dataSource.url?.trim() || t.push("dataSource.url is required"), typeof e.dataSource.pollInterval != "number" && t.push("dataSource.pollInterval must be a number")) : t.push("Declarative plugins require dataSource"), e.fieldMapping || t.push("Declarative plugins require fieldMapping"), e.rendering || t.push("Declarative plugins require rendering"), t;
}
function O(e) {
	let t = [];
	return e.dataFile?.trim() || t.push("Static plugins require dataFile"), e.rendering || t.push("Static plugins require rendering"), t;
}
function k(e) {
	let t = [];
	return e.entry?.trim() || t.push("Bundle plugins require entry"), t;
}
function A(e) {
	return e.type === "extension" && (!Array.isArray(e.extends) || e.extends.length === 0) ? ["Extension plugins require a non-empty extends array"] : [];
}
function j(e) {
	let t = [...E(e), ...A(e)];
	if (C.includes(e.format)) switch (e.format) {
		case "declarative":
			t.push(...D(e));
			break;
		case "static":
			t.push(...O(e));
			break;
		case "bundle":
			t.push(...k(e));
			break;
	}
	return {
		valid: t.length === 0,
		errors: t
	};
}
//#endregion
//#region ../../src/core/plugins/loaders/getNestedValue.ts
function M(e, t) {
	if (e == null || !t) return;
	let n = t.replace(/\[(\d+)]/g, ".$1").split(".").filter(Boolean), r = e;
	for (let e of n) {
		if (typeof r != "object" || !r) return;
		r = r[e];
	}
	return r;
}
//#endregion
//#region ../../src/core/plugins/loaders/mapGeoJsonToEntities.ts
function N(e, t, n) {
	let r = e?.features ?? [];
	return Array.isArray(r) ? r.filter((e) => e.geometry?.coordinates?.length >= 2).map((e, r) => {
		let i = e.geometry.coordinates;
		return {
			id: `${n}-${e.id ?? r}`,
			pluginId: n,
			longitude: i[0],
			latitude: i[1],
			altitude: i[2] ?? void 0,
			heading: F(M(e, t.heading ?? "")),
			speed: F(M(e, t.speed ?? "")),
			timestamp: L(M(e, t.timestamp ?? "")),
			label: I(M(e, t.label ?? "")),
			properties: P(e, t)
		};
	}) : [];
}
function P(e, t) {
	if (!t.properties) return {};
	let n = {};
	for (let [r, i] of Object.entries(t.properties)) n[r] = M(e, i);
	return n;
}
function F(e) {
	if (e == null) return;
	let t = Number(e);
	return Number.isFinite(t) ? t : void 0;
}
function I(e) {
	if (e != null) return String(e);
}
function L(e) {
	if (e instanceof Date) return e;
	if (typeof e == "number") return new Date(e);
	if (typeof e == "string") {
		let t = new Date(e);
		if (!isNaN(t.getTime())) return t;
	}
	return /* @__PURE__ */ new Date();
}
//#endregion
//#region ../../src/core/plugins/loaders/mapJsonToEntities.ts
function R(e, t, n, r) {
	let i = z(e, r);
	return Array.isArray(i) ? i.map((e, r) => B(e, r, t, n)).filter((e) => e !== null) : [];
}
function z(e, t) {
	if (Array.isArray(e)) return e;
	if (!t) return [];
	let n = M(e, t);
	return Array.isArray(n) ? n : [];
}
function B(e, t, n, r) {
	let i = H(M(e, n.latitude)), a = H(M(e, n.longitude));
	return i == null || a == null ? null : {
		id: `${r}-${M(e, n.id) ?? t}`,
		pluginId: r,
		latitude: i,
		longitude: a,
		altitude: H(M(e, n.altitude ?? "")),
		heading: H(M(e, n.heading ?? "")),
		speed: H(M(e, n.speed ?? "")),
		timestamp: W(M(e, n.timestamp ?? "")),
		label: U(M(e, n.label ?? "")),
		properties: V(e, n)
	};
}
function V(e, t) {
	if (!t.properties) return {};
	let n = {};
	for (let [r, i] of Object.entries(t.properties)) n[r] = M(e, i);
	return n;
}
function H(e) {
	if (e == null) return;
	let t = Number(e);
	return Number.isFinite(t) ? t : void 0;
}
function U(e) {
	if (e != null) return String(e);
}
function W(e) {
	if (e instanceof Date) return e;
	if (typeof e == "number") return new Date(e);
	if (typeof e == "string") {
		let t = new Date(e);
		if (!isNaN(t.getTime())) return t;
	}
	return /* @__PURE__ */ new Date();
}
//#endregion
//#region ../../src/core/plugins/loaders/DeclarativePlugin.ts
var G = class {
	constructor(e) {
		this.manifest = e, this.context = null, this.id = e.id, this.name = e.name, this.description = e.description ?? "", this.icon = e.icon ?? "📦", this.category = e.category, this.version = e.version;
	}
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	async fetch(e) {
		let t = this.manifest.dataSource;
		if (!t) return [];
		try {
			let e = this.buildUrl(t.url), n = this.buildHeaders(), r = await fetch(e, {
				method: t.method ?? "GET",
				headers: n,
				...t.body ? { body: JSON.stringify(t.body) } : {}
			});
			if (!r.ok) throw Error(`HTTP ${r.status}`);
			let i = await r.json();
			return this.parseResponse(i);
		} catch (e) {
			return console.error(`[DeclarativePlugin:${this.id}] Fetch error:`, e), [];
		}
	}
	getPollingInterval() {
		return this.manifest.dataSource?.pollInterval ?? 3e4;
	}
	getLayerConfig() {
		let e = this.manifest.rendering;
		return {
			color: e?.color ?? "#3b82f6",
			clusterEnabled: e?.clusterEnabled ?? !0,
			clusterDistance: e?.clusterDistance ?? 40,
			maxEntities: e?.maxEntities
		};
	}
	renderEntity(e) {
		let t = this.manifest.rendering;
		return {
			type: t?.entityType === "billboard" ? "billboard" : "point",
			color: t?.color ?? "#3b82f6",
			size: t?.maxEntities ? void 0 : 6,
			iconUrl: t?.icon,
			labelText: e.label ?? void 0
		};
	}
	buildUrl(e) {
		let t = this.manifest.dataSource?.auth;
		if (t?.type !== "query") return e;
		let n = this.resolveEnvVar(t.envVar);
		return n ? `${e}${e.includes("?") ? "&" : "?"}${t.key}=${encodeURIComponent(n)}` : e;
	}
	buildHeaders() {
		let e = { ...this.manifest.dataSource?.headers ?? {} }, t = this.manifest.dataSource?.auth;
		if (t?.type === "header") {
			let n = this.resolveEnvVar(t.envVar);
			n && (e[t.key] = n);
		}
		return e;
	}
	resolveEnvVar(e) {
		if (typeof process < "u" && process.env) return process.env[e] ?? void 0;
	}
	parseResponse(e) {
		let t = this.manifest.dataSource?.format ?? "json", n = this.manifest.fieldMapping;
		return n ? t === "geojson" ? N(e, n, this.id) : R(e, n, this.id, this.manifest.dataSource?.arrayPath) : [];
	}
};
//#endregion
//#region ../../src/core/plugins/loaders/StaticDataPlugin.ts
function le(e) {
	switch (e.type) {
		case "Point": {
			let [t, n, r] = e.coordinates;
			return {
				lat: n,
				lon: t,
				...r === void 0 ? {} : { alt: r }
			};
		}
		case "MultiPoint":
		case "LineString": {
			let t = e.coordinates[0];
			return {
				lat: t[1],
				lon: t[0]
			};
		}
		case "Polygon":
		case "MultiLineString": {
			let t = e.coordinates[0];
			return {
				lat: t[0][1],
				lon: t[0][0]
			};
		}
		case "MultiPolygon": {
			let t = e.coordinates[0];
			return {
				lat: t[0][0][1],
				lon: t[0][0][0]
			};
		}
		default: return {
			lat: 0,
			lon: 0
		};
	}
}
function ue(e, t, n, r) {
	let i = le(e.geometry);
	return {
		id: `${t}-${e.id ?? n}`,
		pluginId: t,
		latitude: i.lat,
		longitude: i.lon,
		altitude: i.alt,
		timestamp: /* @__PURE__ */ new Date(),
		label: r ? e.properties[r] ?? void 0 : e.properties.name ?? void 0,
		properties: {
			...e.properties,
			_geometryType: e.geometry.type
		}
	};
}
function de(e) {
	return {
		color: e?.color ?? "#3b82f6",
		clusterEnabled: e?.clusterEnabled ?? !1,
		clusterDistance: e?.clusterDistance ?? 0,
		minZoomLevel: e?.minZoomLevel,
		maxEntities: e?.maxEntities
	};
}
var fe = class {
	constructor(e, t) {
		this.manifest = e, this.features = t, this.pluginType = "data-layer", this.capabilities = ["data:own"], this.entities = [], this.id = e.id, this.name = e.name, this.description = e.description ?? "", this.icon = e.icon ?? "📍", this.category = e.category ?? "custom", this.version = e.version, this.rendering = e.rendering;
	}
	async initialize(e) {
		this.entities = this.features.map((e, t) => ue(e, this.id, t, this.rendering?.labelField));
	}
	destroy() {
		this.entities = [];
	}
	async fetch(e) {
		return this.entities;
	}
	getPollingInterval() {
		return 0;
	}
	getLayerConfig() {
		return de(this.rendering);
	}
	renderEntity(e) {
		return {
			type: this.rendering?.entityType ?? "point",
			color: this.rendering?.color ?? "#3b82f6",
			iconUrl: this.rendering?.icon
		};
	}
}, K = class extends Error {
	constructor(e, t, n) {
		super(`[ManifestLoad:${e}] ${t}`), this.manifestId = e, this.validationErrors = n, this.name = "ManifestLoadError";
	}
};
async function q(e) {
	let t = await fetch(e);
	if (!t.ok) throw Error(`Failed to load GeoJSON file "${e}": HTTP ${t.status}`);
	return t.json();
}
async function pe(e) {
	let t = await import(
		/* webpackIgnore: true */
		e
), n = t.default ?? t;
	return typeof n == "function" ? new n() : n;
}
async function me(e) {
	let t = j(e);
	if (!t.valid) throw new K(e.id, `Invalid manifest: ${t.errors.join(", ")}`, t.errors);
	try {
		switch (e.format) {
			case "declarative": return new G(e);
			case "static": return new fe(e, (await q(e.dataFile)).features);
			case "bundle": return await pe(e.entry);
			default: throw new K(e.id, `Unknown format: "${e.format}"`);
		}
	} catch (t) {
		throw t instanceof K ? t : new K(e.id, `Failed to load plugin: ${t instanceof Error ? t.message : String(t)}`);
	}
}
var J = new class {
	constructor() {
		this.listeners = /* @__PURE__ */ new Map();
	}
	on(e, t) {
		return this.listeners.has(e) || this.listeners.set(e, /* @__PURE__ */ new Set()), this.listeners.get(e).add(t), () => {
			this.listeners.get(e)?.delete(t);
		};
	}
	emit(e, t) {
		this.listeners.get(e)?.forEach((n) => {
			try {
				n(t);
			} catch (t) {
				console.error(`[DataBus] Error in handler for "${e}":`, t);
			}
		});
	}
	off(e, t) {
		this.listeners.get(e)?.delete(t);
	}
	removeAllListeners(e) {
		e ? this.listeners.delete(e) : this.listeners.clear();
	}
}(), Y = new class {
	constructor() {
		this.tasks = /* @__PURE__ */ new Map(), this.initStoreSubscription();
	}
	initStoreSubscription() {
		S.subscribe((e, t) => {
			e.dataConfig.pollingIntervals !== t.dataConfig.pollingIntervals && this.tasks.forEach((t, n) => {
				let r = e.dataConfig.pollingIntervals[n];
				r && r !== t.intervalMs && (console.log(`[PollingManager] Updating interval for ${n} to ${r}ms`), t.intervalMs = r, t.timerId && (this.stop(n), this.start(n)));
			});
		});
	}
	register(e, t, n) {
		let r = S.getState().dataConfig.pollingIntervals[e];
		this.tasks.set(e, {
			pluginId: e,
			intervalMs: r || t,
			callback: n,
			timerId: null,
			isPaused: !1,
			errorCount: 0,
			maxBackoff: 6e4
		});
	}
	start(e) {
		let t = this.tasks.get(e);
		if (!t || t.timerId) return;
		let n = async () => {
			if (!t.isPaused) try {
				await t.callback(), t.errorCount = 0;
			} catch (n) {
				t.errorCount++, console.warn(`[PollingManager] Error in ${e} (attempt ${t.errorCount}):`, n);
			}
		};
		n();
		let r = this.getEffectiveInterval(t);
		r > 0 ? t.timerId = setInterval(n, r) : t.timerId = "ws-push-only";
	}
	stop(e) {
		let t = this.tasks.get(e);
		!t || !t.timerId || (clearInterval(t.timerId), t.timerId = null, t.errorCount = 0);
	}
	pause(e) {
		let t = this.tasks.get(e);
		t && (t.isPaused = !0);
	}
	resume(e) {
		let t = this.tasks.get(e);
		t && (t.isPaused = !1, t.timerId || this.start(e));
	}
	stopAll() {
		this.tasks.forEach((e, t) => this.stop(t));
	}
	unregister(e) {
		this.stop(e), this.tasks.delete(e);
	}
	getEffectiveInterval(e) {
		return e.errorCount === 0 ? e.intervalMs : Math.min(e.intervalMs * 2 ** e.errorCount, e.maxBackoff);
	}
}(), X = new class {
	constructor() {
		this.memoryCache = /* @__PURE__ */ new Map(), this.dbName = "worldwideview-cache", this.storeName = "entities", this.db = null;
	}
	async init() {
		if (!(typeof window > "u")) return new Promise((e, t) => {
			let n = indexedDB.open(this.dbName, 1);
			n.onupgradeneeded = () => {
				let e = n.result;
				e.objectStoreNames.contains(this.storeName) || e.createObjectStore(this.storeName);
			}, n.onsuccess = () => {
				this.db = n.result, e();
			}, n.onerror = () => {
				console.warn("[CacheLayer] IndexedDB unavailable, using memory only"), e();
			};
		});
	}
	set(e, t, n = 3e4) {
		let r = {
			entities: t,
			timestamp: Date.now(),
			ttl: n
		};
		if (this.memoryCache.set(e, r), this.db) try {
			this.db.transaction(this.storeName, "readwrite").objectStore(this.storeName).put(r, e);
		} catch {}
	}
	get(e) {
		let t = this.memoryCache.get(e);
		return t ? Date.now() - t.timestamp > t.ttl ? (this.memoryCache.delete(e), null) : t.entities : null;
	}
	async getFromPersistent(e) {
		return this.db ? new Promise((t) => {
			let n = this.db.transaction(this.storeName, "readonly").objectStore(this.storeName).get(e);
			n.onsuccess = () => {
				let r = n.result;
				!r || Date.now() - r.timestamp > r.ttl ? t(null) : (this.memoryCache.set(e, r), t(r.entities));
			}, n.onerror = () => t(null);
		}) : null;
	}
	invalidate(e) {
		if (this.memoryCache.delete(e), this.db) try {
			this.db.transaction(this.storeName, "readwrite").objectStore(this.storeName).delete(e);
		} catch {}
	}
	clear() {
		if (this.memoryCache.clear(), this.db) try {
			this.db.transaction(this.storeName, "readwrite").objectStore(this.storeName).clear();
		} catch {}
	}
}(), Z = new class {
	constructor() {
		this.plugins = /* @__PURE__ */ new Map(), this.loadedManifests = /* @__PURE__ */ new Map(), this.initialized = !1, this.configCacheMaxAge = 36e5;
	}
	async init() {
		this.initialized ||= (await X.init(), !0);
	}
	async registerPlugin(t) {
		if (this.plugins.has(t.id)) {
			console.warn(`[PluginManager] Plugin "${t.id}" already registered`);
			return;
		}
		let n = {
			apiBaseUrl: "",
			timeRange: {
				start: /* @__PURE__ */ new Date(Date.now() - 1440 * 60 * 1e3),
				end: /* @__PURE__ */ new Date()
			},
			onDataUpdate: (e) => {
				this.handleDataUpdate(t.id, e);
			},
			onError: (n) => {
				console.error(`[Plugin:${t.id}]`, n), e("plugin-error", {
					plugin: t.id,
					error: n.message
				});
				let r = S.getState();
				r.showErrorToast && r.showErrorToast(`[${t.name || t.id}] ${n.message}`);
			},
			getPluginSettings: (e) => S.getState().dataConfig.pluginSettings[e],
			isPlaybackMode: () => S.getState().isPlaybackMode,
			getCurrentTime: () => S.getState().currentTime
		};
		this.plugins.set(t.id, {
			plugin: t,
			enabled: !1,
			entities: [],
			context: n
		});
		try {
			await t.initialize(n);
		} catch (e) {
			console.error(`[PluginManager] Failed to initialize "${t.id}":`, e);
		}
		J.emit("pluginRegistered", {
			pluginId: t.id,
			defaultInterval: t.getPollingInterval()
		}), Y.register(t.id, t.getPollingInterval(), async () => {
			let e = this.plugins.get(t.id);
			if (!e || !e.enabled) return;
			let n = await t.fetch(e.context.timeRange);
			this.handleDataUpdate(t.id, n);
		});
	}
	async enablePlugin(e) {
		let t = this.plugins.get(e);
		if (!t) return;
		t.enabled = !0, S.getState().setLayerLoading(e, !0);
		let n = X.get(e);
		n ||= await X.getFromPersistent(e), n && t.enabled && (t.entities = n, J.emit("dataUpdated", {
			pluginId: e,
			entities: n
		})), Y.start(e), J.emit("layerToggled", {
			pluginId: e,
			enabled: !0
		});
	}
	disablePlugin(e) {
		let t = this.plugins.get(e);
		t && (t.enabled = !1, t.entities = [], Y.stop(e), J.emit("layerToggled", {
			pluginId: e,
			enabled: !1
		}), J.emit("dataUpdated", {
			pluginId: e,
			entities: []
		}));
	}
	togglePlugin(e) {
		let t = this.plugins.get(e);
		t && (t.enabled ? this.disablePlugin(e) : this.enablePlugin(e));
	}
	async fetchForPlugin(e, t) {
		let n = this.plugins.get(e);
		if (!n || !n.enabled) return;
		n.context.timeRange = t;
		let r = await n.plugin.fetch(t);
		this.handleDataUpdate(e, r);
	}
	getPlugin(e) {
		return this.plugins.get(e);
	}
	getAllPlugins() {
		return Array.from(this.plugins.values());
	}
	getEnabledPlugins() {
		return this.getAllPlugins().filter((e) => e.enabled);
	}
	getEntities(e) {
		return this.plugins.get(e)?.entities ?? [];
	}
	getAllEntities() {
		return this.getEnabledPlugins().flatMap((e) => e.entities);
	}
	async updateTimeRange(e) {
		let t = this.getEnabledPlugins().map((t) => this.fetchForPlugin(t.plugin.id, e));
		await Promise.allSettled(t);
	}
	setCacheMaxAge(e) {
		this.configCacheMaxAge = e;
	}
	async loadFromManifest(e) {
		let t = await me(e);
		this.loadedManifests.set(e.id, e), await this.registerPlugin(t);
	}
	getManifest(e) {
		return this.loadedManifests.get(e);
	}
	destroy() {
		Y.stopAll(), this.plugins.forEach((e) => {
			try {
				e.plugin.destroy();
			} catch {}
		}), this.plugins.clear();
	}
	handleDataUpdate(e, t) {
		let n = this.plugins.get(e);
		n && (n.entities = t, X.set(e, t, this.configCacheMaxAge), J.emit("dataUpdated", {
			pluginId: e,
			entities: t
		}), S.getState().setLayerLoading(e, !1));
	}
}(), he = ({ pluginId: e }) => {
	let t = {
		trailDuration: "1h",
		...S((t) => t.dataConfig.pluginSettings[e]) || {}
	}, n = S((e) => e.updatePluginSettings), r = async (t) => {
		n(e, { trailDuration: t });
		let r = Z.getPlugin(e);
		r && r.enabled && await Z.fetchForPlugin(e, r.context.timeRange);
	};
	return /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			gap: "var(--space-md)"
		},
		children: [
			/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
				style: {
					fontSize: 11,
					color: "var(--text-muted)",
					marginBottom: "var(--space-xs)",
					display: "flex",
					alignItems: "center",
					gap: 4
				},
				children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(l, { size: 12 }), " Trail History Duration"]
			}),
			/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("select", {
				value: t.trailDuration,
				onChange: (e) => r(e.target.value),
				style: {
					background: "var(--bg-secondary)",
					color: "var(--text-primary)",
					border: "1px solid var(--border-subtle)",
					borderRadius: "var(--radius-sm)",
					padding: "6px var(--space-sm)",
					fontSize: 12,
					outline: "none",
					cursor: "pointer"
				},
				children: [
					/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("option", {
						value: "0h",
						children: "Off (0 hours)"
					}),
					/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("option", {
						value: "1h",
						children: "1 Hour"
					}),
					/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("option", {
						value: "6h",
						children: "6 Hours"
					}),
					/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("option", {
						value: "12h",
						children: "12 Hours"
					}),
					/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("option", {
						value: "24h",
						children: "24 Hours"
					})
				]
			}),
			/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("div", {
				style: {
					fontSize: 10,
					color: "var(--text-secondary)",
					lineHeight: 1.4
				},
				children: "Longer trails require more memory and take longer to load. Setting affects visible trails behind vessels."
			})
		]
	});
}, Q = {
	cargo: "#f59e0b",
	tanker: "#ef4444",
	passenger: "#3b82f6",
	fishing: "#22d3ee",
	military: "#a78bfa",
	sailing: "#4ade80",
	tug: "#f97316",
	other: "#94a3b8"
};
function $(e) {
	let t = e.toLowerCase();
	for (let [e, n] of Object.entries(Q)) if (t.includes(e)) return n;
	return Q.other;
}
var ge = class {
	constructor() {
		this.id = "maritime", this.name = "Maritime", this.description = "Vessel tracking via AIS feeds", this.icon = u, this.category = "maritime", this.version = "1.0.0", this.context = null, this.iconUrls = {};
	}
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	mapPayloadToEntities(e, t) {
		let n = new Map(t?.map((e) => [e.id, e]) || []), r = [];
		if (Array.isArray(e)) r = e;
		else if (e && typeof e == "object") r = Object.values(e);
		else return [];
		return r.map((e) => {
			let t = `maritime-${e.mmsi || e.id}`, r = n.get(t), i = e.history || e.properties && e.properties.history || r?.properties.history || [];
			if (e.last_updated || e.ts) {
				let t = e.last_updated || e.ts;
				t > (i.length > 0 ? i[i.length - 1].ts : 0) && (e.lat ?? e.latitude) !== void 0 && (e.lon ?? e.longitude) !== void 0 && i.push({
					lat: e.lat ?? e.latitude,
					lon: e.lon ?? e.longitude,
					ts: t
				});
			}
			return i.length > 61 && i.splice(0, i.length - 61), {
				id: t,
				pluginId: "maritime",
				latitude: e.lat ?? e.latitude,
				longitude: e.lon ?? e.longitude,
				heading: e.hdg === 511 ? void 0 : e.hdg ?? e.heading,
				speed: e.spd === void 0 ? e.speed === void 0 ? void 0 : e.speed * .514444 : e.spd * .514444,
				timestamp: e.last_updated ? /* @__PURE__ */ new Date(e.last_updated * 1e3) : new Date(e.timestamp || Date.now()),
				label: e.name ?? e.label,
				properties: {
					mmsi: e.mmsi,
					vesselName: e.name,
					vesselType: e.type || e.properties && e.properties.vesselType || "other",
					speed_knots: e.spd ?? e.speed,
					heading: e.hdg ?? e.heading,
					history: i
				}
			};
		});
	}
	async fetch(e) {
		try {
			let e = "1h";
			if (this.context) {
				let t = this.context.getPluginSettings(this.id);
				t && t.trailDuration && (e = t.trailDuration);
			}
			e === "0h" && (e = "");
			let t = e ? `?lookback=${e}` : "", n = process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL ? process.env.NEXT_PUBLIC_DEFAULT_ENGINE_URL.replace(/\/stream$/, "").replace(/^ws/, "http") : "https://dataengine.worldwideview.dev", r = await fetch(`${n}/data/maritime${t}`);
			if (!r.ok) throw Error(`Maritime API returned ${r.status}`);
			let i = await r.json();
			return this.mapPayloadToEntities(i.items);
		} catch (e) {
			return console.error("[MaritimePlugin] Fetch error:", e), [];
		}
	}
	mapWebsocketPayload(e, t) {
		return this.mapPayloadToEntities(e, t);
	}
	getPollingInterval() {
		return 0;
	}
	getServerConfig() {
		return {
			apiBasePath: "/api/maritime",
			pollingIntervalMs: 0,
			historyEnabled: !0
		};
	}
	getLayerConfig() {
		return {
			color: "#f59e0b",
			clusterEnabled: !0,
			clusterDistance: 50
		};
	}
	getSettingsComponent() {
		return he;
	}
	renderEntity(e) {
		let t = $(e.properties.vesselType || "other");
		return this.iconUrls[t] || (this.iconUrls[t] = globalThis.__WWV_HOST__.WWVPluginSDK.createSvgIconUrl(u, { color: t })), {
			type: "billboard",
			iconUrl: this.iconUrls[t],
			color: t,
			rotation: e.heading,
			labelText: e.label || void 0,
			labelFont: "11px JetBrains Mono, monospace",
			distanceDisplayCondition: {
				near: 0,
				far: 1e6
			},
			trailOptions: {
				width: 2,
				color: t,
				opacityFade: !0
			}
		};
	}
	getSelectionBehavior(e) {
		return !e.speed || e.speed < .1 ? null : {
			showTrail: !0,
			trailDurationSec: 3600,
			trailStepSec: 60,
			trailColor: $(e.properties.vesselType || "other"),
			flyToOffsetMultiplier: 3,
			flyToBaseDistance: 15e3
		};
	}
	getFilterDefinitions() {
		return [{
			id: "vessel_type",
			label: "Vessel Type",
			type: "select",
			propertyKey: "vesselType",
			options: [
				{
					value: "cargo",
					label: "Cargo"
				},
				{
					value: "tanker",
					label: "Tanker"
				},
				{
					value: "passenger",
					label: "Passenger"
				},
				{
					value: "fishing",
					label: "Fishing"
				},
				{
					value: "military",
					label: "Military"
				},
				{
					value: "sailing",
					label: "Sailing"
				},
				{
					value: "tug",
					label: "Tug"
				},
				{
					value: "other",
					label: "Other"
				}
			]
		}, {
			id: "speed",
			label: "Speed (knots)",
			type: "range",
			propertyKey: "speed_knots",
			range: {
				min: 0,
				max: 30,
				step: 1
			}
		}];
	}
	getLegend() {
		return [
			{
				label: "Cargo",
				color: Q.cargo,
				filterId: "vessel_type",
				filterValue: "cargo"
			},
			{
				label: "Tanker",
				color: Q.tanker,
				filterId: "vessel_type",
				filterValue: "tanker"
			},
			{
				label: "Passenger",
				color: Q.passenger,
				filterId: "vessel_type",
				filterValue: "passenger"
			},
			{
				label: "Fishing",
				color: Q.fishing,
				filterId: "vessel_type",
				filterValue: "fishing"
			},
			{
				label: "Military",
				color: Q.military,
				filterId: "vessel_type",
				filterValue: "military"
			},
			{
				label: "Sailing",
				color: Q.sailing,
				filterId: "vessel_type",
				filterValue: "sailing"
			},
			{
				label: "Tug",
				color: Q.tug,
				filterId: "vessel_type",
				filterValue: "tug"
			},
			{
				label: "Other",
				color: Q.other,
				filterId: "vessel_type",
				filterValue: "other"
			}
		];
	}
};
//#endregion
export { ge as MaritimePlugin };
