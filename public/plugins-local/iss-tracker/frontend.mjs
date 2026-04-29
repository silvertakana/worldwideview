var y = Object.defineProperty;
var w = (n, t, a) => t in n ? y(n, t, { enumerable: !0, configurable: !0, writable: !0, value: a }) : n[t] = a;
var i = (n, t, a) => w(n, typeof t != "symbol" ? t + "" : t, a);
const d = {};
class f {
  constructor() {
    i(this, "id", "iss-tracker");
    i(this, "name", "IssTracker");
    i(this, "description", "A custom WorldWideView plugin");
    i(this, "icon", "📍");
    i(this, "category", "custom");
    i(this, "version", "1.0.0");
  }
  async initialize(t) {
    console.log("[IssTracker] Initialized");
  }
  destroy() {
  }
  async fetch(t) {
    const u = await (await new Promise((o, e) => {
      const g = new URL(
        d(
          "https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=%d,%d&units=miles",
          t.start.getTime(),
          t.end.getTime()
        )
        //format
      ), r = d.request(g, {
        method: "GET",
        family: 4,
        // Force IPv4 to avoid Docker IPv6 dropout
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "WorldWideView/1.11"
        },
        timeout: 5e3
      }, (s) => {
        let l = "";
        s.on("data", (p) => l += p), s.on("end", () => {
          o({
            ok: s.statusCode && s.statusCode >= 200 && s.statusCode < 300,
            status: s.statusCode || 500,
            statusText: s.statusMessage || "",
            json: async () => JSON.parse(l),
            text: async () => l
          });
        });
      });
      r.on("error", e), r.on("timeout", () => {
        r.destroy(), e(new Error("Request timed out"));
      }), r.end();
    })).json(), c = u.length;
    let m = new Array(c);
    for (let o = 0; o < c; o++) {
      const e = u[o];
      m[o] = {
        id: d("%s_%d", this.name, (/* @__PURE__ */ new Date()).getTime()),
        pluginID: this.id,
        latitude: e.latitude,
        longitude: e.longitude,
        altitude: e.altitude,
        timestamp: e.timestamp
      };
    }
    return m;
  }
  getPollingInterval() {
    return 6e4;
  }
  getLayerConfig() {
    return { color: "#3b82f6", clusterEnabled: !0, clusterDistance: 40 };
  }
  renderEntity(t) {
    return { type: "point", color: "#3b82f6", size: 6 };
  }
}
export {
  f as default
};
