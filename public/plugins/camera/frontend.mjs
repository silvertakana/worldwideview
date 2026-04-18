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
}, l = c("camera", [["path", {
	d: "M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z",
	key: "18u6gg"
}], ["circle", {
	cx: "12",
	cy: "13",
	r: "3",
	key: "1vg3eu"
}]]), u = c("circle-alert", [
	["circle", {
		cx: "12",
		cy: "12",
		r: "10",
		key: "1mglay"
	}],
	["line", {
		x1: "12",
		x2: "12",
		y1: "8",
		y2: "12",
		key: "1pkeuh"
	}],
	["line", {
		x1: "12",
		x2: "12.01",
		y1: "16",
		y2: "16",
		key: "4dfq90"
	}]
]), d = c("database", [
	["ellipse", {
		cx: "12",
		cy: "5",
		rx: "9",
		ry: "3",
		key: "msslwz"
	}],
	["path", {
		d: "M3 5V19A9 3 0 0 0 21 19V5",
		key: "1wlel7"
	}],
	["path", {
		d: "M3 12A9 3 0 0 0 21 12",
		key: "mv7ke4"
	}]
]), ee = c("external-link", [
	["path", {
		d: "M15 3h6v6",
		key: "1q9fwt"
	}],
	["path", {
		d: "M10 14 21 3",
		key: "gplh6r"
	}],
	["path", {
		d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
		key: "a6xqqp"
	}]
]), f = c("link", [["path", {
	d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
	key: "1cjeqo"
}], ["path", {
	d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
	key: "19qd67"
}]]), te = c("loader-circle", [["path", {
	d: "M21 12a9 9 0 1 1-6.219-8.56",
	key: "13zald"
}]]), p = c("maximize-2", [
	["path", {
		d: "M15 3h6v6",
		key: "1q9fwt"
	}],
	["path", {
		d: "m21 3-7 7",
		key: "1l2asr"
	}],
	["path", {
		d: "m3 21 7-7",
		key: "tjx5ai"
	}],
	["path", {
		d: "M9 21H3v-6",
		key: "wtvkvv"
	}]
]), ne = c("play", [["path", {
	d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",
	key: "10ikf1"
}]]), m = c("rotate-ccw", [["path", {
	d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
	key: "1357e3"
}], ["path", {
	d: "M3 3v5h5",
	key: "1xhq8a"
}]]), re = c("square", [["rect", {
	width: "18",
	height: "18",
	x: "3",
	y: "3",
	rx: "2",
	key: "afitv7"
}]]), h = c("traffic-cone", [
	["path", {
		d: "M16.05 10.966a5 2.5 0 0 1-8.1 0",
		key: "m5jpwb"
	}],
	["path", {
		d: "m16.923 14.049 4.48 2.04a1 1 0 0 1 .001 1.831l-8.574 3.9a2 2 0 0 1-1.66 0l-8.574-3.91a1 1 0 0 1 0-1.83l4.484-2.04",
		key: "rbg3g8"
	}],
	["path", {
		d: "M16.949 14.14a5 2.5 0 1 1-9.9 0L10.063 3.5a2 2 0 0 1 3.874 0z",
		key: "vap8c8"
	}],
	["path", {
		d: "M9.194 6.57a5 2.5 0 0 0 5.61 0",
		key: "15hn5c"
	}]
]), g = c("upload", [
	["path", {
		d: "M12 3v12",
		key: "1x0j5s"
	}],
	["path", {
		d: "m17 8-5-5-5 5",
		key: "7q97r8"
	}],
	["path", {
		d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
		key: "ih7n3h"
	}]
]), _ = (e) => {
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
}, v = ((e) => e ? _(e) : _), y = (e) => e;
function b(e, t = y) {
	let n = globalThis.__WWV_HOST__.React.useSyncExternalStore(e.subscribe, globalThis.__WWV_HOST__.React.useCallback(() => t(e.getState()), [e, t]), globalThis.__WWV_HOST__.React.useCallback(() => t(e.getInitialState()), [e, t]));
	return globalThis.__WWV_HOST__.React.useDebugValue(n), n;
}
var x = (e) => {
	let t = v(e), n = (e) => b(t, e);
	return Object.assign(n, t), n;
}, S = ((e) => e ? x(e) : x), C = (e) => ({
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
}), ie = (e) => ({
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
function w(e) {
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
var ae = (e) => ({
	currentTime: /* @__PURE__ */ new Date(),
	timeWindow: "24h",
	timeRange: w("24h"),
	isPlaying: !1,
	playbackSpeed: 1,
	isPlaybackMode: !1,
	playbackTime: Date.now(),
	timelineAvailability: {},
	setCurrentTime: (t) => e({ currentTime: t }),
	setTimeWindow: (t) => e({
		timeWindow: t,
		timeRange: w(t)
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
}), oe = (e) => ({
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
}), se = (e) => ({
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
}), T = (e, t) => ({
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
}), E = (e) => ({
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
}), D = new Set([
	"local",
	"cloud",
	"demo"
]);
function ce(e) {
	let t = (e ?? "").trim().toLowerCase();
	return D.has(t) ? t : "local";
}
var O = ce(process.env.NEXT_PUBLIC_WWV_EDITION) === "demo";
process.env.WWV_DEMO_ADMIN_SECRET?.trim();
//#endregion
//#region ../../src/core/state/favoritesSlice.ts
function k(e) {
	if (typeof document < "u") {
		let t = e.map((e) => ({
			...e,
			icon: void 0
		}));
		document.cookie = `wwv_favorites=${encodeURIComponent(JSON.stringify(t))}; path=/; max-age=31536000`;
	}
}
var le = (e, t) => ({
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
		e({ favorites: s }), O ? k(s) : fetch("/api/user/favorites", {
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
		e({ favorites: r }), O ? k(r) : fetch(`/api/user/favorites?entityId=${encodeURIComponent(n)}`, { method: "DELETE" }).catch((e) => console.error("Failed to sync remove favorite from DB:", e));
	}
}), ue = (e) => ({
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
}), A = S((...e) => ({
	...C(...e),
	...ie(...e),
	...ae(...e),
	...oe(...e),
	...se(...e),
	...T(...e),
	...E(...e),
	...le(...e),
	...ue(...e)
})), de = ({ src: e, onReady: t, onError: n }) => {
	let r = globalThis.__WWV_HOST__.React.useRef(null), i = globalThis.__WWV_HOST__.React.useRef(null), a = globalThis.__WWV_HOST__.React.useCallback(() => {
		i.current &&= (i.current.destroy(), null);
	}, []);
	return globalThis.__WWV_HOST__.React.useEffect(() => {
		let o = r.current;
		if (!(!o || !e)) return o.canPlayType("application/vnd.apple.mpegurl") ? (o.src = e, o.addEventListener("loadeddata", () => t?.(), { once: !0 }), o.addEventListener("error", () => n?.("Native HLS playback failed. The stream may be offline or blocked by CORS."), { once: !0 }), a) : (import("./hls-BBAH6Mmx.js").then((r) => {
			let s = r.default;
			if (!s.isSupported()) {
				n?.("HLS playback is not supported in this browser.");
				return;
			}
			a();
			let c = new s({
				enableWorker: !0,
				lowLatencyMode: !0
			});
			i.current = c, c.loadSource(e), c.attachMedia(o), c.on(s.Events.MANIFEST_PARSED, () => {
				t?.(), o.play().catch(() => {});
			}), c.on(s.Events.ERROR, (e, t) => {
				if (t.fatal) {
					let e = t.details || "unknown error";
					n?.(`HLS Error: ${e}. The stream may be offline or blocked by CORS.`), c.destroy(), i.current = null;
				}
			});
		}).catch(() => {
			n?.("Failed to load HLS player library.");
		}), a);
	}, [
		e,
		t,
		n,
		a
	]), /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("video", {
		ref: r,
		style: {
			position: "absolute",
			inset: 0,
			width: "100%",
			height: "100%",
			objectFit: "contain",
			backgroundColor: "black"
		},
		autoPlay: !0,
		muted: !0,
		playsInline: !0,
		controls: !0
	});
};
//#endregion
//#region ../../src/components/video/streamUtils.ts
function j(e) {
	if (!e) return !1;
	let t = e.toLowerCase();
	return t.endsWith(".m3u8") || t.includes(".m3u8?");
}
function fe(e) {
	if (!e) return !1;
	let t = e.toLowerCase();
	return t.includes("youtube.com") || t.includes("youtu.be") || t.includes("youtube-nocookie.com") || t.includes("twitch.tv") || t.includes("vimeo.com") || t.includes("player.") || t.includes("/player/") || t.includes("webcamera.pl") || t.includes("ivideon.com") || t.includes("rtsp.me") || t.includes("bnu.tv") || t.includes(".html");
}
function pe(e) {
	if (!e || !e.includes("youtube.com") && !e.includes("youtube-nocookie.com") && !e.includes("youtu.be")) return e;
	try {
		let t = new URL(e.includes("youtu.be") ? e.replace("youtu.be/", "youtube.com/embed/") : e);
		return t.pathname.startsWith("/watch") && (t.pathname = `/embed/${t.searchParams.get("v")}`, t.search = ""), t.searchParams.has("autoplay") || t.searchParams.set("autoplay", "1"), t.searchParams.set("enablejsapi", "1"), t.toString();
	} catch {
		return e;
	}
}
function M(e) {
	if (!e) return e;
	let t = e.startsWith("http://"), n = typeof window < "u" && window.location.protocol === "https:";
	return t && n ? `/api/camera/proxy/stream?url=${encodeURIComponent(e)}` : e;
}
function me(e) {
	return e.startsWith("http://") && typeof window < "u" && window.location.protocol === "https:" ? "Mixed Content Error: Connection blocked because the stream uses insecure HTTP on a secure HTTPS site." : j(e) ? "Unsupported Format: HLS streams (.m3u8) require a dedicated player and cannot be displayed directly as an image." : "Stream Failed: The stream might be offline, unreachable due to CORS restrictions, or restricted by the provider.";
}
//#endregion
//#region ../../src/components/video/CameraStream.tsx
var he = ({ streamUrl: e, previewUrl: t, isIframe: n = !1, label: r, className: i = "", id: a }) => {
	let { addFloatingStream: o } = A(), [s, c] = globalThis.__WWV_HOST__.React.useState(!1), [l, d] = globalThis.__WWV_HOST__.React.useState(!1), [f, m] = globalThis.__WWV_HOST__.React.useState(null), [h, g] = globalThis.__WWV_HOST__.React.useState(!1), [_, v] = globalThis.__WWV_HOST__.React.useState(e);
	globalThis.__WWV_HOST__.React.useEffect(() => {
		c(!1), m(null), d(!1), g(!1), v(e), e.includes("balticlivecam.com") && (d(!0), fetch(`/api/camera/extract?url=${encodeURIComponent(e)}`).then((e) => e.json()).then((e) => {
			e.streamUrl ? (v(e.streamUrl), d(!1), c(!0)) : (m(e.error || "Failed to extract stream"), d(!1));
		}).catch((e) => {
			m(e.message), d(!1);
		}));
	}, [e]);
	let y = (e) => {
		e.stopPropagation(), o({
			id: a || `stream-${Math.random().toString(36).substr(2, 9)}`,
			streamUrl: _,
			isIframe: n,
			label: r || "Camera Stream"
		}), x();
	}, b = (e) => {
		e?.stopPropagation(), m(null), d(!0), c(!0);
	}, x = (e) => {
		e?.stopPropagation(), c(!1), d(!1), m(null), g(!1);
	}, S = () => {
		if (j(_) && !h) return /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(de, {
			src: _,
			onReady: () => d(!1),
			onError: (e) => {
				t ? g(!0) : m(e), d(!1);
			}
		});
		if (n || fe(_)) return /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("iframe", {
			src: pe(_),
			style: {
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				border: "none"
			},
			onLoad: () => d(!1),
			onError: () => {
				m("Stream integration failed: The provider may have blocked embedding this video or the source is unavailable."), d(!1);
			},
			allow: "autoplay; encrypted-media; picture-in-picture; web-share",
			referrerPolicy: "strict-origin-when-cross-origin",
			allowFullScreen: !0
		});
		let e = h && t ? t : _, i = M(e);
		return /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("img", {
			src: i,
			alt: r || "Live camera stream",
			style: {
				maxWidth: "100%",
				maxHeight: "100%",
				objectFit: "contain"
			},
			onLoad: () => d(!1),
			onError: () => {
				m(me(e)), d(!1);
			}
		});
	}, C = (e, t, n, r = 28) => /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("button", {
		onClick: e,
		style: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: `${r}px`,
			height: `${r}px`,
			borderRadius: r < 28 ? "4px" : "50%",
			background: "rgba(0,0,0,0.6)",
			color: "rgba(255,255,255,0.7)",
			border: "none",
			cursor: "pointer",
			backdropFilter: "blur(4px)"
		},
		title: t,
		children: n
	});
	return /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("div", {
		className: i,
		style: {
			position: "relative",
			width: "100%",
			aspectRatio: "16/9",
			backgroundColor: "#050505",
			borderRadius: "8px",
			border: "1px solid rgba(255,255,255,0.1)",
			overflow: "hidden",
			display: "flex",
			alignItems: "center",
			justifyContent: "center"
		},
		children: s ? /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
			style: {
				position: "relative",
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center"
			},
			children: [
				S(),
				l && /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
					style: {
						position: "absolute",
						inset: 0,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "rgba(0,0,0,0.6)",
						backdropFilter: "blur(4px)",
						zIndex: 20
					},
					children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(te, {
						className: "animate-spin",
						style: {
							color: "#60a5fa",
							width: "24px",
							height: "24px"
						}
					}), /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("span", {
						style: {
							marginTop: "8px",
							fontSize: "10px",
							fontWeight: 500,
							color: "rgba(255,255,255,0.6)",
							textTransform: "uppercase",
							letterSpacing: "2px"
						},
						children: "Connecting"
					})]
				}),
				f && /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
					style: {
						position: "absolute",
						inset: 0,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "rgba(0,0,0,0.9)",
						padding: "16px",
						textAlign: "center",
						zIndex: 30
					},
					children: [
						/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(u, { style: {
							color: "#ef4444",
							width: "24px",
							height: "24px",
							marginBottom: "8px"
						} }),
						/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("p", {
							style: {
								fontSize: "10px",
								color: "rgba(255,255,255,0.7)",
								maxWidth: "200px",
								lineHeight: "1.5"
							},
							children: f
						}),
						/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("button", {
							onClick: x,
							style: {
								marginTop: "12px",
								fontSize: "10px",
								fontWeight: "bold",
								textTransform: "uppercase",
								letterSpacing: "1px",
								color: "#60a5fa",
								background: "none",
								border: "none",
								cursor: "pointer"
							},
							children: "Reset Stream"
						})
					]
				}),
				/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
					style: {
						position: "absolute",
						top: "8px",
						right: "8px",
						display: "flex",
						gap: "6px",
						zIndex: 40
					},
					children: [
						C(y, "Pop out video", /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(p, { size: 12 })),
						/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("a", {
							href: _,
							target: "_blank",
							rel: "noopener noreferrer",
							style: {
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								width: "28px",
								height: "28px",
								borderRadius: "50%",
								background: "rgba(0,0,0,0.6)",
								color: "rgba(255,255,255,0.6)",
								textDecoration: "none"
							},
							title: "Open in new tab",
							children: /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(ee, { size: 12 })
						}),
						C(x, "Stop Stream", /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(re, {
							size: 10,
							style: { fill: "currentColor" }
						}))
					]
				})
			]
		}) : /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
			style: {
				position: "absolute",
				inset: 0,
				cursor: "pointer",
				zIndex: 10,
				display: "flex",
				alignItems: "center",
				justifyContent: "center"
			},
			onClick: b,
			children: [
				t && /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("img", {
					src: M(t),
					alt: r || "Camera preview",
					style: {
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						objectFit: "cover",
						opacity: .6
					},
					onError: (e) => {
						e.target.src = "https://placehold.co/640x480?text=No+Preview+Available";
					}
				}),
				/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("div", {
					style: {
						position: "relative",
						zIndex: 11
					},
					children: /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("div", {
						style: {
							display: "flex",
							width: "48px",
							height: "48px",
							alignItems: "center",
							justifyContent: "center",
							borderRadius: "50%",
							backgroundColor: "rgba(37,99,235,0.9)",
							color: "white",
							boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
							border: "1px solid rgba(255,255,255,0.2)"
						},
						children: /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(ne, {
							size: 20,
							style: {
								fill: "currentColor",
								marginLeft: "2px"
							}
						})
					})
				}),
				/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("div", {
					style: {
						position: "absolute",
						top: "8px",
						right: "8px",
						zIndex: 12
					},
					children: C(y, "Pop out video", /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(p, { size: 12 }), 24)
				})
			]
		})
	});
}, ge = ({ entity: e }) => {
	let { properties: t } = e, n = t.stream, r = t.preview_url, i = t.city, a = t.region, o = t.country, s = !!t.is_iframe, c = t.categories || [];
	return /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
		className: "flex flex-col gap-4",
		children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(he, {
			id: e.id,
			streamUrl: n,
			previewUrl: r,
			isIframe: s,
			label: i || o
		}), /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
			className: "intel-panel__props",
			children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
				className: "intel-panel__prop",
				style: {
					flexDirection: "column",
					alignItems: "flex-start",
					gap: "var(--space-xs)",
					borderBottom: "1px solid var(--border-subtle)",
					padding: "var(--space-sm) 0"
				},
				children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("span", {
					className: "intel-panel__prop-key",
					children: "Location"
				}), /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("span", {
					className: "intel-panel__prop-value",
					style: {
						textAlign: "left",
						width: "100%",
						whiteSpace: "normal",
						lineHeight: "1.4",
						fontSize: "12px",
						color: "var(--text-primary)"
					},
					children: [
						i,
						a,
						o
					].filter(Boolean).join(", ")
				})]
			}), c.length > 0 && /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
				className: "intel-panel__prop",
				style: {
					flexDirection: "column",
					alignItems: "flex-start",
					gap: "var(--space-sm)",
					borderBottom: "none",
					padding: "var(--space-sm) 0"
				},
				children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("span", {
					className: "intel-panel__prop-key",
					children: "Categories"
				}), /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("div", {
					style: {
						display: "flex",
						flexWrap: "wrap",
						gap: "6px"
					},
					children: c.map((e) => /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("span", {
						style: {
							borderRadius: "12px",
							backgroundColor: "var(--bg-tertiary)",
							padding: "2px 8px",
							fontSize: "10px",
							fontWeight: 500,
							color: "var(--text-secondary)",
							border: "1px solid var(--border-subtle)"
						},
						children: e
					}, e))
				})]
			})]
		})]
	});
}, N = [
	"declarative",
	"static",
	"bundle"
], P = ["data-layer", "extension"], F = [
	"built-in",
	"verified",
	"unverified"
];
function I(e) {
	let t = [];
	return e.id?.trim() || t.push("Missing required field: id"), e.name?.trim() || t.push("Missing required field: name"), e.version?.trim() || t.push("Missing required field: version"), P.includes(e.type) || t.push(`Invalid type "${e.type}". Must be: ${P.join(", ")}`), N.includes(e.format) || t.push(`Invalid format "${e.format}". Must be: ${N.join(", ")}`), F.includes(e.trust) || t.push(`Invalid trust "${e.trust}". Must be: ${F.join(", ")}`), (!Array.isArray(e.capabilities) || e.capabilities.length === 0) && t.push("capabilities must be a non-empty array"), t;
}
function L(e) {
	let t = [];
	return e.dataSource ? (e.dataSource.url?.trim() || t.push("dataSource.url is required"), typeof e.dataSource.pollInterval != "number" && t.push("dataSource.pollInterval must be a number")) : t.push("Declarative plugins require dataSource"), e.fieldMapping || t.push("Declarative plugins require fieldMapping"), e.rendering || t.push("Declarative plugins require rendering"), t;
}
function _e(e) {
	let t = [];
	return e.dataFile?.trim() || t.push("Static plugins require dataFile"), e.rendering || t.push("Static plugins require rendering"), t;
}
function ve(e) {
	let t = [];
	return e.entry?.trim() || t.push("Bundle plugins require entry"), t;
}
function ye(e) {
	return e.type === "extension" && (!Array.isArray(e.extends) || e.extends.length === 0) ? ["Extension plugins require a non-empty extends array"] : [];
}
function R(e) {
	let t = [...I(e), ...ye(e)];
	if (N.includes(e.format)) switch (e.format) {
		case "declarative":
			t.push(...L(e));
			break;
		case "static":
			t.push(..._e(e));
			break;
		case "bundle":
			t.push(...ve(e));
			break;
	}
	return {
		valid: t.length === 0,
		errors: t
	};
}
//#endregion
//#region ../../src/core/plugins/loaders/getNestedValue.ts
function z(e, t) {
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
function be(e, t, n) {
	let r = e?.features ?? [];
	return Array.isArray(r) ? r.filter((e) => e.geometry?.coordinates?.length >= 2).map((e, r) => {
		let i = e.geometry.coordinates;
		return {
			id: `${n}-${e.id ?? r}`,
			pluginId: n,
			longitude: i[0],
			latitude: i[1],
			altitude: i[2] ?? void 0,
			heading: B(z(e, t.heading ?? "")),
			speed: B(z(e, t.speed ?? "")),
			timestamp: Ce(z(e, t.timestamp ?? "")),
			label: Se(z(e, t.label ?? "")),
			properties: xe(e, t)
		};
	}) : [];
}
function xe(e, t) {
	if (!t.properties) return {};
	let n = {};
	for (let [r, i] of Object.entries(t.properties)) n[r] = z(e, i);
	return n;
}
function B(e) {
	if (e == null) return;
	let t = Number(e);
	return Number.isFinite(t) ? t : void 0;
}
function Se(e) {
	if (e != null) return String(e);
}
function Ce(e) {
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
function we(e, t, n, r) {
	let i = Te(e, r);
	return Array.isArray(i) ? i.map((e, r) => Ee(e, r, t, n)).filter((e) => e !== null) : [];
}
function Te(e, t) {
	if (Array.isArray(e)) return e;
	if (!t) return [];
	let n = z(e, t);
	return Array.isArray(n) ? n : [];
}
function Ee(e, t, n, r) {
	let i = V(z(e, n.latitude)), a = V(z(e, n.longitude));
	return i == null || a == null ? null : {
		id: `${r}-${z(e, n.id) ?? t}`,
		pluginId: r,
		latitude: i,
		longitude: a,
		altitude: V(z(e, n.altitude ?? "")),
		heading: V(z(e, n.heading ?? "")),
		speed: V(z(e, n.speed ?? "")),
		timestamp: ke(z(e, n.timestamp ?? "")),
		label: Oe(z(e, n.label ?? "")),
		properties: De(e, n)
	};
}
function De(e, t) {
	if (!t.properties) return {};
	let n = {};
	for (let [r, i] of Object.entries(t.properties)) n[r] = z(e, i);
	return n;
}
function V(e) {
	if (e == null) return;
	let t = Number(e);
	return Number.isFinite(t) ? t : void 0;
}
function Oe(e) {
	if (e != null) return String(e);
}
function ke(e) {
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
var Ae = class {
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
		return n ? t === "geojson" ? be(e, n, this.id) : we(e, n, this.id, this.manifest.dataSource?.arrayPath) : [];
	}
};
//#endregion
//#region ../../src/core/plugins/loaders/StaticDataPlugin.ts
function je(e) {
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
function Me(e, t, n, r) {
	let i = je(e.geometry);
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
function Ne(e) {
	return {
		color: e?.color ?? "#3b82f6",
		clusterEnabled: e?.clusterEnabled ?? !1,
		clusterDistance: e?.clusterDistance ?? 0,
		minZoomLevel: e?.minZoomLevel,
		maxEntities: e?.maxEntities
	};
}
var Pe = class {
	constructor(e, t) {
		this.manifest = e, this.features = t, this.pluginType = "data-layer", this.capabilities = ["data:own"], this.entities = [], this.id = e.id, this.name = e.name, this.description = e.description ?? "", this.icon = e.icon ?? "📍", this.category = e.category ?? "custom", this.version = e.version, this.rendering = e.rendering;
	}
	async initialize(e) {
		this.entities = this.features.map((e, t) => Me(e, this.id, t, this.rendering?.labelField));
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
		return Ne(this.rendering);
	}
	renderEntity(e) {
		return {
			type: this.rendering?.entityType ?? "point",
			color: this.rendering?.color ?? "#3b82f6",
			iconUrl: this.rendering?.icon
		};
	}
}, H = class extends Error {
	constructor(e, t, n) {
		super(`[ManifestLoad:${e}] ${t}`), this.manifestId = e, this.validationErrors = n, this.name = "ManifestLoadError";
	}
};
async function Fe(e) {
	let t = await fetch(e);
	if (!t.ok) throw Error(`Failed to load GeoJSON file "${e}": HTTP ${t.status}`);
	return t.json();
}
async function Ie(e) {
	let t = await import(
		/* webpackIgnore: true */
		e
), n = t.default ?? t;
	return typeof n == "function" ? new n() : n;
}
async function Le(e) {
	let t = R(e);
	if (!t.valid) throw new H(e.id, `Invalid manifest: ${t.errors.join(", ")}`, t.errors);
	try {
		switch (e.format) {
			case "declarative": return new Ae(e);
			case "static": return new Pe(e, (await Fe(e.dataFile)).features);
			case "bundle": return await Ie(e.entry);
			default: throw new H(e.id, `Unknown format: "${e.format}"`);
		}
	} catch (t) {
		throw t instanceof H ? t : new H(e.id, `Failed to load plugin: ${t instanceof Error ? t.message : String(t)}`);
	}
}
var U = new class {
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
}(), W = new class {
	constructor() {
		this.tasks = /* @__PURE__ */ new Map(), this.initStoreSubscription();
	}
	initStoreSubscription() {
		A.subscribe((e, t) => {
			e.dataConfig.pollingIntervals !== t.dataConfig.pollingIntervals && this.tasks.forEach((t, n) => {
				let r = e.dataConfig.pollingIntervals[n];
				r && r !== t.intervalMs && (console.log(`[PollingManager] Updating interval for ${n} to ${r}ms`), t.intervalMs = r, t.timerId && (this.stop(n), this.start(n)));
			});
		});
	}
	register(e, t, n) {
		let r = A.getState().dataConfig.pollingIntervals[e];
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
}(), G = new class {
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
}(), K = new class {
	constructor() {
		this.plugins = /* @__PURE__ */ new Map(), this.loadedManifests = /* @__PURE__ */ new Map(), this.initialized = !1, this.configCacheMaxAge = 36e5;
	}
	async init() {
		this.initialized ||= (await G.init(), !0);
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
				let r = A.getState();
				r.showErrorToast && r.showErrorToast(`[${t.name || t.id}] ${n.message}`);
			},
			getPluginSettings: (e) => A.getState().dataConfig.pluginSettings[e],
			isPlaybackMode: () => A.getState().isPlaybackMode,
			getCurrentTime: () => A.getState().currentTime
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
		U.emit("pluginRegistered", {
			pluginId: t.id,
			defaultInterval: t.getPollingInterval()
		}), W.register(t.id, t.getPollingInterval(), async () => {
			let e = this.plugins.get(t.id);
			if (!e || !e.enabled) return;
			let n = await t.fetch(e.context.timeRange);
			this.handleDataUpdate(t.id, n);
		});
	}
	async enablePlugin(e) {
		let t = this.plugins.get(e);
		if (!t) return;
		t.enabled = !0, A.getState().setLayerLoading(e, !0);
		let n = G.get(e);
		n ||= await G.getFromPersistent(e), n && t.enabled && (t.entities = n, U.emit("dataUpdated", {
			pluginId: e,
			entities: n
		})), W.start(e), U.emit("layerToggled", {
			pluginId: e,
			enabled: !0
		});
	}
	disablePlugin(e) {
		let t = this.plugins.get(e);
		t && (t.enabled = !1, t.entities = [], W.stop(e), U.emit("layerToggled", {
			pluginId: e,
			enabled: !1
		}), U.emit("dataUpdated", {
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
		let t = await Le(e);
		this.loadedManifests.set(e.id, e), await this.registerPlugin(t);
	}
	getManifest(e) {
		return this.loadedManifests.get(e);
	}
	destroy() {
		W.stopAll(), this.plugins.forEach((e) => {
			try {
				e.plugin.destroy();
			} catch {}
		}), this.plugins.clear();
	}
	handleDataUpdate(e, t) {
		let n = this.plugins.get(e);
		n && (n.entities = t, G.set(e, t, this.configCacheMaxAge), U.emit("dataUpdated", {
			pluginId: e,
			entities: t
		}), A.getState().setLayerLoading(e, !1));
	}
}(), q = {
	display: "flex",
	flexDirection: "column",
	gap: "4px"
}, J = {
	fontSize: 10,
	fontWeight: 600,
	color: "var(--text-muted)",
	textTransform: "uppercase",
	letterSpacing: "0.05em"
}, Y = {
	background: "var(--bg-tertiary)",
	border: "1px solid var(--border-subtle)",
	color: "var(--text-primary)",
	padding: "var(--space-xs) var(--space-sm)",
	borderRadius: "var(--radius-sm)",
	fontSize: 12,
	outline: "none"
}, X = (e) => ({
	background: "var(--accent-cyan)",
	color: "var(--bg-primary)",
	border: "none",
	borderRadius: "var(--radius-sm)",
	padding: "0 var(--space-md)",
	fontSize: 12,
	fontWeight: 500,
	cursor: e ? "not-allowed" : "pointer",
	opacity: e ? .5 : 1,
	transition: "all 0.2s ease"
}), Re = (e) => ({
	flex: 1,
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: "4px",
	padding: "8px",
	borderRadius: "var(--radius-md)",
	background: e ? "var(--accent-cyan-subtle)" : "var(--bg-tertiary)",
	border: e ? "1px solid var(--accent-cyan)" : "1px solid var(--border-subtle)",
	cursor: "pointer",
	color: e ? "var(--accent-cyan)" : "var(--text-secondary)",
	transition: "all 0.2s ease"
}), ze = ({ pluginId: e }) => {
	let t = {
		sourceType: "default",
		...A((t) => t.dataConfig.pluginSettings[e]) || {}
	}, n = A((e) => e.updatePluginSettings), r = A((e) => e.setHighlightLayerId), [i, a] = globalThis.__WWV_HOST__.React.useState(!1), o = (t) => {
		n(e, { sourceType: t }), r(null);
	}, s = async () => {
		let t = K.getPlugin(e);
		t && t.enabled && await K.fetchForPlugin(e, t.context.timeRange);
	}, c = async () => {
		a(!0), n(e, {
			action: "load",
			actionId: Date.now(),
			loaded: !0
		}), r(null), await s(), a(!1);
	}, l = async () => {
		n(e, {
			action: "reset",
			actionId: Date.now(),
			loaded: !1,
			customUrl: "",
			customData: null
		}), r(null), await s();
	}, u = (t) => {
		let i = t.target.files?.[0];
		if (!i) return;
		let a = new FileReader();
		a.onload = async (t) => {
			try {
				n(e, {
					customData: JSON.parse(t.target?.result),
					action: "load",
					actionId: Date.now(),
					loaded: !0
				}), r(null), await s();
			} catch {
				alert("Invalid JSON file format.");
			}
		}, a.readAsText(i);
	};
	return /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			gap: "var(--space-md)"
		},
		children: [
			/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("div", {
				style: {
					fontSize: 11,
					color: "var(--text-muted)",
					marginBottom: "var(--space-xs)"
				},
				children: "Data Source Configuration"
			}),
			/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("div", {
				style: {
					display: "flex",
					gap: "var(--space-xs)"
				},
				children: [
					[
						"default",
						d,
						"Default"
					],
					[
						"traffic",
						h,
						"Traffic Cams"
					],
					[
						"url",
						f,
						"URL"
					],
					[
						"file",
						g,
						"File"
					]
				].map(([e, n, r]) => /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("button", {
					onClick: () => o(e),
					style: Re(t.sourceType === e),
					children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(n, { size: 14 }), /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("span", {
						style: { fontSize: 10 },
						children: r
					})]
				}, e))
			}),
			t.sourceType === "default" && /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
				style: q,
				children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("div", {
					style: {
						fontSize: 11,
						color: "var(--text-secondary)"
					},
					children: "Built-in camera dataset"
				}), /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("button", {
					onClick: c,
					disabled: i,
					style: X(i),
					children: i ? "Loading..." : t.loaded ? "Reload" : "Load"
				})]
			}),
			t.sourceType === "traffic" && /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
				style: q,
				children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("div", {
					style: {
						fontSize: 11,
						color: "var(--text-secondary)"
					},
					children: "DOT traffic cameras (GDOT + more)"
				}), /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("button", {
					onClick: c,
					disabled: i,
					style: X(i),
					children: i ? "Loading..." : t.loaded ? "Reload" : "Load"
				})]
			}),
			t.sourceType === "url" && /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
				style: q,
				children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("label", {
					style: J,
					children: "URL"
				}), /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
					style: {
						display: "flex",
						gap: "var(--space-sm)",
						marginTop: "4px"
					},
					children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("input", {
						type: "text",
						placeholder: "http://...",
						value: t.customUrl || "",
						onChange: (t) => n(e, { customUrl: t.target.value }),
						style: {
							...Y,
							flex: 1
						}
					}), /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("button", {
						onClick: c,
						disabled: !t.customUrl || i,
						style: X(!t.customUrl || i),
						children: i ? "Loading..." : "Load"
					})]
				})]
			}),
			t.sourceType === "file" && /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
				style: q,
				children: [
					/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("label", {
						style: J,
						children: "JSON File"
					}),
					/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx("input", {
						type: "file",
						accept: ".json",
						onChange: u,
						style: {
							...Y,
							width: "100%",
							marginTop: "4px",
							padding: "4px",
							fontSize: "10px"
						}
					}),
					t.customData && Array.isArray(t.customData) && /* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("div", {
						style: {
							fontSize: 10,
							color: "var(--accent-green)",
							marginTop: "4px"
						},
						children: [
							"✓ Data loaded (",
							t.customData.length,
							" cameras)"
						]
					})
				]
			}),
			/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsxs("button", {
				onClick: l,
				style: {
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: "6px",
					background: "transparent",
					border: "1px solid var(--border-subtle)",
					borderRadius: "var(--radius-sm)",
					padding: "6px var(--space-md)",
					fontSize: 11,
					color: "var(--text-muted)",
					cursor: "pointer",
					transition: "all 0.2s ease"
				},
				children: [/* @__PURE__ */ globalThis.__WWV_HOST__.jsxRuntime.jsx(m, { size: 12 }), " Reset All Sources"]
			})
		]
	});
}, Z = 8;
function Q(e, t, n) {
	return {
		id: `camera-${n}-${t}`,
		pluginId: "camera",
		latitude: e.latitude,
		longitude: e.longitude,
		altitude: e.altitude ?? e.elevation ?? Z,
		timestamp: /* @__PURE__ */ new Date(),
		label: e.city || e.country || "Unknown Camera",
		properties: { ...e }
	};
}
function $(e, t, n) {
	let r = e, [i, a] = r.geometry?.coordinates ?? [0, 0], o = r.properties ?? {};
	return {
		id: `camera-${n}-${t}`,
		pluginId: "camera",
		latitude: a,
		longitude: i,
		altitude: Z,
		timestamp: /* @__PURE__ */ new Date(),
		label: o.city || o.country || "Unknown Camera",
		properties: { ...o }
	};
}
//#endregion
//#region src/index.ts
var Be = class {
	constructor() {
		this.id = "camera", this.name = "Cameras", this.description = "Public live cameras from across the globe", this.icon = l, this.category = "infrastructure", this.version = "1.0.0", this.context = null, this.sourceBuckets = {}, this.lastActionId = null;
	}
	async initialize(e) {
		this.context = e;
	}
	destroy() {
		this.context = null;
	}
	requiresConfiguration(e) {
		let t = e, n = t?.sourceType ?? "default";
		return n === "default" || n === "traffic" ? !1 : n === "url" && !t?.customUrl || n === "file" && !t?.customData;
	}
	getAllEntities() {
		return Object.values(this.sourceBuckets).flat();
	}
	pushUpdate() {
		this.context?.onDataUpdate(this.getAllEntities());
	}
	async fetch(t) {
		let n = {
			sourceType: "default",
			action: void 0,
			actionId: void 0,
			loaded: void 0,
			customUrl: void 0,
			customData: void 0,
			...this.context.getPluginSettings(this.id) || {}
		};
		if (n.action === "reset") return this.sourceBuckets = {}, this.lastActionId = n.actionId, [];
		if (!((n.sourceType === "default" || n.sourceType === "traffic") && !this.lastActionId && !this.sourceBuckets.default) && (n.action !== "load" || n.actionId === this.lastActionId)) return this.getAllEntities();
		this.lastActionId = n.actionId ?? -1;
		try {
			return n.sourceType === "default" ? await this.loadDefaultSource() : n.sourceType === "traffic" ? await this.loadTrafficCameras() : n.sourceType === "url" ? await this.loadUrlSource(n) : n.sourceType === "file" && this.loadFileSource(n), e("camera-source-load", { sourceType: n.sourceType }), this.getAllEntities();
		} catch (e) {
			return console.error("[CameraPlugin] Fetch error:", e), this.context?.onError(e instanceof Error ? e : Error(String(e))), this.getAllEntities();
		}
	}
	async loadDefaultSource() {
		let e = await fetch("/public-cameras.json");
		if (e.ok) {
			let t = await e.json();
			t && Array.isArray(t.features) && (this.sourceBuckets.default = t.features.map((e, t) => $(e, t, "default")));
		}
		this.pushUpdate();
	}
	async loadTrafficCameras() {
		try {
			let e = await fetch("/api/camera/traffic");
			if (!e.ok) throw Error(`API returned ${e.status}`);
			let t = await e.json();
			t.cameras && Array.isArray(t.cameras) && (this.sourceBuckets.default = t.cameras.map((e, t) => $(e, t, "traffic")));
		} catch (e) {
			console.warn("[CameraPlugin] Traffic cameras API failed:", e);
		}
		this.pushUpdate();
	}
	async loadUrlSource(e) {
		if (!e.customUrl) return;
		let t = e.customUrl;
		/^https?:\/\//i.test(t) || (t = `http://${t}`);
		let n = await fetch(t);
		if (n.ok) {
			let e = await n.json();
			Array.isArray(e) && (this.sourceBuckets.url = e.map((e, t) => Q(e, t, "url")));
		}
	}
	loadFileSource(e) {
		!e.customData || !Array.isArray(e.customData) || (this.sourceBuckets.file = e.customData.map((e, t) => Q(e, t, "file")));
	}
	getPollingInterval() {
		return 36e5;
	}
	getLayerConfig() {
		return {
			color: "#60a5fa",
			clusterEnabled: !0,
			clusterDistance: 50,
			maxEntities: 1e4
		};
	}
	renderEntity(e) {
		return this.iconUrl ||= "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%3E%3Ccircle%20cx%3D%228%22%20cy%3D%228%22%20r%3D%226%22%20fill%3D%22%2360a5fa%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%222%22%2F%3E%3C%2Fsvg%3E", {
			type: "billboard",
			iconUrl: this.iconUrl,
			color: "#ffffff",
			depthBias: -2e3,
			labelText: e.label,
			labelFont: "11px Inter, system-ui, sans-serif"
		};
	}
	getDetailComponent() {
		return ge;
	}
	getSettingsComponent() {
		return ze;
	}
	getFilterDefinitions() {
		return [
			{
				id: "country",
				label: "Country",
				type: "text",
				propertyKey: "country"
			},
			{
				id: "city",
				label: "City",
				type: "text",
				propertyKey: "city"
			},
			{
				id: "is_popular",
				label: "Popular Only",
				type: "boolean",
				propertyKey: "is_popular"
			}
		];
	}
};
//#endregion
export { Be as CameraPlugin };
