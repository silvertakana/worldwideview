/**
 * IssTracker — WorldWideView Plugin
 *
 * Build with: npm run build
 * Publish with: npm publish
 */

import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
    PluginCategory,
} from "@worldwideview/wwv-plugin-sdk";

import https from "https";
import format from 'util';

export default class IssTrackerPlugin implements WorldPlugin {
    readonly id = "iss-tracker";
    readonly name = "IssTracker";
    readonly description = "A tracker for ISS";
    readonly icon = "📍";
    readonly category: PluginCategory = "custom";
    readonly version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {
	this.context = "ISS";
        console.log(`[IssTracker] Initialized`);
    }

    destroy(): void {
	this.context = null;
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
	if(!_timeRange) _timeRange = {
		start = new Date.getTime(),
		end = new Date.getTime()
	};
	const res = await new Promise<any>((resolve, reject) => { 
		//To See: https://wheretheiss.at/
		//ISS: 25544
		const url = new URL(
			format("https://api.wheretheiss.at/v1/satellites/25544/positions?"
			       +"timestamps=%d,%d"
			       +"&units=miles", _timeRange.start.getTime(), 
						_timeRange.end.getTime()
			)//format
		);//URL

		const timeoutMS = 5000;
		//Set 5000ms = 5s
		
		const req = https.request(url, {
		    method: "GET",
		    family: 4, // Force IPv4 to avoid Docker IPv6 dropout
		    headers: {
			"Content-Type": "application/json",
			"User-Agent": "WorldWideView/1.11"
		    },
		    timeout: timeoutMS,
		}, (res) => {
		    let data = "";
		    res.on("data", chunk => data += chunk);
		    res.on("end", () => {
			resolve({
			    ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
			    status: res.statusCode || 500,
			    statusText: res.statusMessage || "",
			    json: async () => JSON.parse(data),
			    text: async () => data
			});//resolve
			//set object.json()/object.text()
		    });//res.on
		});//https.request
		
		req.on("error", reject);
		req.on("timeout", () => {
		    req.destroy();
		    reject(new Error("Request timed out"));
		});
		req.end();
	});

	const aJSON = await res.json();
	const len = aJSON.length;
	let raGeoEntity: GeoEntity[] = new Array(len);
	for(let i=0; i<len; i++){
		const json = aJSON[i];
		raGeoEntity[i] = {
			id 		: format("%s_%d", this.name, new Date().getTime()),
			pluginID 	: this.id,
			latitude 	: json.latitude,
			longitude 	: json.longitude,
			altitude 	: json.altitude,
			timestamp 	: json.timestamp
		};//raGeoEntity
	}//for
	//To See: @worldwideview/packages/wwv-plugin-sdk/src/index.ts
        return raGeoEntity;
    }

    getPollingInterval(): number {
        return 5000; //5s
    }

    getLayerConfig(): LayerConfig {
        return { color: "#3b82f6", clusterEnabled: true, clusterDistance: 40 };
    }

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        return { type: "point", color: "#3b82f6", size: 6 };
    }
}
