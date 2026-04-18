//#region \0react
var e = globalThis.__WWV_HOST__.React, { useState: t, useEffect: n, useRef: r, useMemo: i, useCallback: a, useContext: o, useReducer: s, useLayoutEffect: c, StrictMode: l, Suspense: u, createContext: d, createElement: f, cloneElement: p, isValidElement: m, Fragment: h, Children: g, Component: _, PureComponent: v, createRef: y, forwardRef: b, memo: ee, lazy: te, startTransition: ne, useTransition: re, useDeferredValue: ie, useId: ae, useSyncExternalStore: oe, useInsertionEffect: se } = e, x = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), S = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), C = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, n) => n ? n.toUpperCase() : t.toLowerCase()), w = (e) => {
	let t = C(e);
	return t.charAt(0).toUpperCase() + t.slice(1);
}, T = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, E = (e) => {
	for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
	return !1;
}, D = d({}), O = () => o(D), k = b(({ color: e, size: t, strokeWidth: n, absoluteStrokeWidth: r, className: i = "", children: a, iconNode: o, ...s }, c) => {
	let { size: l = 24, strokeWidth: u = 2, absoluteStrokeWidth: d = !1, color: p = "currentColor", className: m = "" } = O() ?? {}, h = r ?? d ? Number(n ?? u) * 24 / Number(t ?? l) : n ?? u;
	return f("svg", {
		ref: c,
		...T,
		width: t ?? l ?? T.width,
		height: t ?? l ?? T.height,
		stroke: e ?? p,
		strokeWidth: h,
		className: x("lucide", m, i),
		...!a && !E(s) && { "aria-hidden": "true" },
		...s
	}, [...o.map(([e, t]) => f(e, t)), ...Array.isArray(a) ? a : [a]]);
}), A = (e, t) => {
	let n = b(({ className: n, ...r }, i) => f(k, {
		ref: i,
		iconNode: t,
		className: x(`lucide-${S(w(e))}`, `lucide-${e}`, n),
		...r
	}));
	return n.displayName = w(e), n;
}, j = A("camera", [["path", {
	d: "M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z",
	key: "18u6gg"
}], ["circle", {
	cx: "12",
	cy: "13",
	r: "3",
	key: "1vg3eu"
}]]), M = A("database", [
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
]), N = A("link", [["path", {
	d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
	key: "1cjeqo"
}], ["path", {
	d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
	key: "19qd67"
}]]), P = A("rotate-ccw", [["path", {
	d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
	key: "1357e3"
}], ["path", {
	d: "M3 3v5h5",
	key: "1xhq8a"
}]]), F = A("traffic-cone", [
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
]), I = A("upload", [
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
]), L = globalThis.__WWV_HOST__.CameraStream, R = globalThis.__WWV_HOST__.jsxRuntime, z = R.jsx, B = R.jsxs;
R.Fragment;
//#endregion
//#region src/CameraDetail.tsx
var V = ({ entity: e }) => {
	let { properties: t } = e, n = t.stream, r = t.preview_url, i = t.city, a = t.region, o = t.country, s = !!t.is_iframe, c = t.categories || [];
	return /* @__PURE__ */ B("div", {
		className: "flex flex-col gap-4",
		children: [/* @__PURE__ */ z(L, {
			id: e.id,
			streamUrl: n,
			previewUrl: r,
			isIframe: s,
			label: i || o
		}), /* @__PURE__ */ B("div", {
			className: "intel-panel__props",
			children: [/* @__PURE__ */ B("div", {
				className: "intel-panel__prop",
				style: {
					flexDirection: "column",
					alignItems: "flex-start",
					gap: "var(--space-xs)",
					borderBottom: "1px solid var(--border-subtle)",
					padding: "var(--space-sm) 0"
				},
				children: [/* @__PURE__ */ z("span", {
					className: "intel-panel__prop-key",
					children: "Location"
				}), /* @__PURE__ */ z("span", {
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
			}), c.length > 0 && /* @__PURE__ */ B("div", {
				className: "intel-panel__prop",
				style: {
					flexDirection: "column",
					alignItems: "flex-start",
					gap: "var(--space-sm)",
					borderBottom: "none",
					padding: "var(--space-sm) 0"
				},
				children: [/* @__PURE__ */ z("span", {
					className: "intel-panel__prop-key",
					children: "Categories"
				}), /* @__PURE__ */ z("div", {
					style: {
						display: "flex",
						flexWrap: "wrap",
						gap: "6px"
					},
					children: c.map((e) => /* @__PURE__ */ z("span", {
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
}, H = globalThis.__WWV_HOST__.useStore, U = globalThis.__WWV_HOST__.pluginManager, W = {
	display: "flex",
	flexDirection: "column",
	gap: "4px"
}, G = {
	fontSize: 10,
	fontWeight: 600,
	color: "var(--text-muted)",
	textTransform: "uppercase",
	letterSpacing: "0.05em"
}, K = {
	background: "var(--bg-tertiary)",
	border: "1px solid var(--border-subtle)",
	color: "var(--text-primary)",
	padding: "var(--space-xs) var(--space-sm)",
	borderRadius: "var(--radius-sm)",
	fontSize: 12,
	outline: "none"
}, q = (e) => ({
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
}), J = (e) => ({
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
}), Y = ({ pluginId: t }) => {
	let n = {
		sourceType: "default",
		...H((e) => e.dataConfig.pluginSettings[t]) || {}
	}, r = H((e) => e.updatePluginSettings), i = H((e) => e.setHighlightLayerId), [a, o] = e.useState(!1), s = (e) => {
		r(t, { sourceType: e }), i(null);
	}, c = async () => {
		let e = U.getPlugin(t);
		e && e.enabled && await U.fetchForPlugin(t, e.context.timeRange);
	}, l = async () => {
		o(!0), r(t, {
			action: "load",
			actionId: Date.now(),
			loaded: !0
		}), i(null), await c(), o(!1);
	}, u = async () => {
		r(t, {
			action: "reset",
			actionId: Date.now(),
			loaded: !1,
			customUrl: "",
			customData: null
		}), i(null), await c();
	}, d = (e) => {
		let n = e.target.files?.[0];
		if (!n) return;
		let a = new FileReader();
		a.onload = async (e) => {
			try {
				r(t, {
					customData: JSON.parse(e.target?.result),
					action: "load",
					actionId: Date.now(),
					loaded: !0
				}), i(null), await c();
			} catch {
				alert("Invalid JSON file format.");
			}
		}, a.readAsText(n);
	};
	return /* @__PURE__ */ B("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			gap: "var(--space-md)"
		},
		children: [
			/* @__PURE__ */ z("div", {
				style: {
					fontSize: 11,
					color: "var(--text-muted)",
					marginBottom: "var(--space-xs)"
				},
				children: "Data Source Configuration"
			}),
			/* @__PURE__ */ z("div", {
				style: {
					display: "flex",
					gap: "var(--space-xs)"
				},
				children: [
					[
						"default",
						M,
						"Default"
					],
					[
						"traffic",
						F,
						"Traffic Cams"
					],
					[
						"url",
						N,
						"URL"
					],
					[
						"file",
						I,
						"File"
					]
				].map(([e, t, r]) => /* @__PURE__ */ B("button", {
					onClick: () => s(e),
					style: J(n.sourceType === e),
					children: [/* @__PURE__ */ z(t, { size: 14 }), /* @__PURE__ */ z("span", {
						style: { fontSize: 10 },
						children: r
					})]
				}, e))
			}),
			n.sourceType === "default" && /* @__PURE__ */ B("div", {
				style: W,
				children: [/* @__PURE__ */ z("div", {
					style: {
						fontSize: 11,
						color: "var(--text-secondary)"
					},
					children: "Built-in camera dataset"
				}), /* @__PURE__ */ z("button", {
					onClick: l,
					disabled: a,
					style: q(a),
					children: a ? "Loading..." : n.loaded ? "Reload" : "Load"
				})]
			}),
			n.sourceType === "traffic" && /* @__PURE__ */ B("div", {
				style: W,
				children: [/* @__PURE__ */ z("div", {
					style: {
						fontSize: 11,
						color: "var(--text-secondary)"
					},
					children: "DOT traffic cameras (GDOT + more)"
				}), /* @__PURE__ */ z("button", {
					onClick: l,
					disabled: a,
					style: q(a),
					children: a ? "Loading..." : n.loaded ? "Reload" : "Load"
				})]
			}),
			n.sourceType === "url" && /* @__PURE__ */ B("div", {
				style: W,
				children: [/* @__PURE__ */ z("label", {
					style: G,
					children: "URL"
				}), /* @__PURE__ */ B("div", {
					style: {
						display: "flex",
						gap: "var(--space-sm)",
						marginTop: "4px"
					},
					children: [/* @__PURE__ */ z("input", {
						type: "text",
						placeholder: "http://...",
						value: n.customUrl || "",
						onChange: (e) => r(t, { customUrl: e.target.value }),
						style: {
							...K,
							flex: 1
						}
					}), /* @__PURE__ */ z("button", {
						onClick: l,
						disabled: !n.customUrl || a,
						style: q(!n.customUrl || a),
						children: a ? "Loading..." : "Load"
					})]
				})]
			}),
			n.sourceType === "file" && /* @__PURE__ */ B("div", {
				style: W,
				children: [
					/* @__PURE__ */ z("label", {
						style: G,
						children: "JSON File"
					}),
					/* @__PURE__ */ z("input", {
						type: "file",
						accept: ".json",
						onChange: d,
						style: {
							...K,
							width: "100%",
							marginTop: "4px",
							padding: "4px",
							fontSize: "10px"
						}
					}),
					n.customData && Array.isArray(n.customData) && /* @__PURE__ */ B("div", {
						style: {
							fontSize: 10,
							color: "var(--accent-green)",
							marginTop: "4px"
						},
						children: [
							"✓ Data loaded (",
							n.customData.length,
							" cameras)"
						]
					})
				]
			}),
			/* @__PURE__ */ B("button", {
				onClick: u,
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
				children: [/* @__PURE__ */ z(P, { size: 12 }), " Reset All Sources"]
			})
		]
	});
}, X = 8;
function Z(e, t, n) {
	return {
		id: `camera-${n}-${t}`,
		pluginId: "camera",
		latitude: e.latitude,
		longitude: e.longitude,
		altitude: e.altitude ?? e.elevation ?? X,
		timestamp: /* @__PURE__ */ new Date(),
		label: e.city || e.country || "Unknown Camera",
		properties: { ...e }
	};
}
function Q(e, t, n) {
	let r = e, [i, a] = r.geometry?.coordinates ?? [0, 0], o = r.properties ?? {};
	return {
		id: `camera-${n}-${t}`,
		pluginId: "camera",
		latitude: a,
		longitude: i,
		altitude: X,
		timestamp: /* @__PURE__ */ new Date(),
		label: o.city || o.country || "Unknown Camera",
		properties: { ...o }
	};
}
//#endregion
//#region src/index.ts
var $ = class {
	constructor() {
		this.id = "camera", this.name = "Cameras", this.description = "Public live cameras from across the globe", this.icon = j, this.category = "infrastructure", this.version = "1.0.0", this.context = null, this.sourceBuckets = {}, this.lastActionId = null;
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
	async fetch(e) {
		let t = {
			sourceType: "default",
			action: void 0,
			actionId: void 0,
			loaded: void 0,
			customUrl: void 0,
			customData: void 0,
			...this.context.getPluginSettings(this.id) || {}
		};
		if (t.action === "reset") return this.sourceBuckets = {}, this.lastActionId = t.actionId, [];
		if (!((t.sourceType === "default" || t.sourceType === "traffic") && !this.lastActionId && !this.sourceBuckets.default) && (t.action !== "load" || t.actionId === this.lastActionId)) return this.getAllEntities();
		this.lastActionId = t.actionId ?? -1;
		try {
			return t.sourceType === "default" ? await this.loadDefaultSource() : t.sourceType === "traffic" ? await this.loadTrafficCameras() : t.sourceType === "url" ? await this.loadUrlSource(t) : t.sourceType === "file" && this.loadFileSource(t), this.getAllEntities();
		} catch (e) {
			return console.error("[CameraPlugin] Fetch error:", e), this.context?.onError(e instanceof Error ? e : Error(String(e))), this.getAllEntities();
		}
	}
	async loadDefaultSource() {
		let e = await fetch("/public-cameras.json");
		if (e.ok) {
			let t = await e.json();
			t && Array.isArray(t.features) && (this.sourceBuckets.default = t.features.map((e, t) => Q(e, t, "default")));
		}
		this.pushUpdate();
	}
	async loadTrafficCameras() {
		try {
			let e = await fetch("/api/camera/traffic");
			if (!e.ok) throw Error(`API returned ${e.status}`);
			let t = await e.json();
			t.cameras && Array.isArray(t.cameras) && (this.sourceBuckets.default = t.cameras.map((e, t) => Q(e, t, "traffic")));
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
			Array.isArray(e) && (this.sourceBuckets.url = e.map((e, t) => Z(e, t, "url")));
		}
	}
	loadFileSource(e) {
		!e.customData || !Array.isArray(e.customData) || (this.sourceBuckets.file = e.customData.map((e, t) => Z(e, t, "file")));
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
		return V;
	}
	getSettingsComponent() {
		return Y;
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
export { $ as CameraPlugin };
