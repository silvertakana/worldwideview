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
})("pickaxe", [
	["path", {
		d: "m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999",
		key: "1lw9ds"
	}],
	["path", {
		d: "M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024",
		key: "ffj4ej"
	}],
	["path", {
		d: "M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069",
		key: "8tj4zw"
	}],
	["path", {
		d: "M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z",
		key: "hh6h97"
	}]
]), c = ({ viewer: e, enabled: t }) => {
	let n = globalThis.__WWV_HOST__.React.useRef(null);
	return globalThis.__WWV_HOST__.React.useEffect(() => {
		if (!e || !t) {
			e && n.current && (e.dataSources.remove(n.current), n.current = null);
			return;
		}
		let r = !1;
		async function i() {
			if (e) try {
				let t = new globalThis.__WWV_HOST__.Cesium.GeoJsonDataSource("mineral-mines");
				if (await t.load("/data/mineral_mines.geojson", {
					markerSymbol: "minepost",
					markerColor: globalThis.__WWV_HOST__.Cesium.Color.fromCssColorString("#d97706"),
					markerSize: 24,
					clampToGround: !0
				}), r) return;
				t.clustering.enabled = !0, t.clustering.pixelRange = 40, t.clustering.minimumClusterSize = 3, t.clustering.clusterEvent.addEventListener((e, t) => {
					t.label.show = !0, t.label.text = e.length.toLocaleString(), t.label.font = "bold 14px sans-serif", t.label.fillColor = globalThis.__WWV_HOST__.Cesium.Color.WHITE, t.label.outlineColor = globalThis.__WWV_HOST__.Cesium.Color.BLACK, t.label.outlineWidth = 2, t.label.style = globalThis.__WWV_HOST__.Cesium.LabelStyle.FILL_AND_OUTLINE, t.label.verticalOrigin = globalThis.__WWV_HOST__.Cesium.VerticalOrigin.CENTER, t.label.horizontalOrigin = globalThis.__WWV_HOST__.Cesium.HorizontalOrigin.CENTER, t.billboard.show = !0, t.billboard.id = t.label.id, t.billboard.verticalOrigin = globalThis.__WWV_HOST__.Cesium.VerticalOrigin.CENTER;
					let n = new globalThis.__WWV_HOST__.Cesium.PinBuilder();
					t.billboard.image = n.fromColor(globalThis.__WWV_HOST__.Cesium.Color.fromCssColorString("#d97706").withAlpha(.8), 48).toDataURL();
				}), e.dataSources.add(t), n.current = t;
			} catch (e) {
				console.error("[MineralMinesPlugin] Failed to load data", e);
			}
		}
		return i(), () => {
			r = !0, e && n.current && (e.dataSources.remove(n.current), n.current = null);
		};
	}, [e, t]), null;
}, l = class {
	constructor() {
		this.id = "mineral-mines", this.name = "Mineral Mines", this.description = "Global mining sites and quarries from OpenStreetMap.", this.icon = s, this.category = "economic", this.version = "1.0.0";
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
			color: "#d97706",
			clusterEnabled: !0,
			clusterDistance: 50,
			maxEntities: 5e4
		};
	}
	renderEntity(e) {
		return this.iconUrl ||= globalThis.__WWV_HOST__.WWVPluginSDK.createSvgIconUrl(s, { color: "#d97706" }), {
			type: "billboard",
			iconUrl: this.iconUrl,
			color: "#d97706"
		};
	}
	getGlobeComponent() {
		return c;
	}
};
//#endregion
export { l as MineralMinesPlugin };
