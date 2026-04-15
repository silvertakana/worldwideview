import React, { useState } from "react";
import { Math as CesiumMath } from "cesium";
import { Eye, EyeOff } from "lucide-react";
import { useOsmStore } from "../store";

const COMMON_TAGS = [
    "amenity=hospital", "amenity=school", "amenity=police", "amenity=fire_station",
    "shop=supermarket", "highway=bus_stop", "building=house", "tourism=hotel",
    "man_made=tower", "industrial=factory"
];

interface OSMSidebarProps {
    plugin?: any; // OSMSearchPlugin
}

export function OSMSidebar({ plugin }: OSMSidebarProps) {
    const { bboxLocked, showBbox, setShowBbox, setBboxLocked, currentBbox, setLockedBbox, lockedBbox } = useOsmStore();
    const [mode, setMode] = useState<"bellingcat" | "turbo">("bellingcat");
    const [rawQuery, setRawQuery] = useState("[out:json];\nnode[amenity=cafe]({{bbox}});\nout center;");
    
    const [searchText, setSearchText] = useState("");
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const [distance, setDistance] = useState(500);
    const [isScanning, setIsScanning] = useState(false);
    
    const toggleLock = () => {
        if (!bboxLocked) {
            setLockedBbox(currentBbox);
            setBboxLocked(true);
        } else {
            setBboxLocked(false);
            setLockedBbox(null);
        }
    };

    const handleScan = async () => {
        if (!bboxLocked) {
            setLockedBbox(currentBbox);
            setBboxLocked(true);
        }
        
        const bboxParams = lockedBbox || currentBbox;
        if (!bboxParams) {
            alert("Please wait for map viewport to initialize");
            return;
        }

        // Overpass bbox order: south, west, north, east (in degrees)
        const s = CesiumMath.toDegrees(bboxParams.south).toFixed(6);
        const w = CesiumMath.toDegrees(bboxParams.west).toFixed(6);
        const n = CesiumMath.toDegrees(bboxParams.north).toFixed(6);
        const e = CesiumMath.toDegrees(bboxParams.east).toFixed(6);
        const bboxString = `${s},${w},${n},${e}`;

        let ql = "";
        if (mode === "turbo") {
            ql = rawQuery.replace(/{{bbox}}/g, bboxString);
        } else {
            // Bellingcat-style proximity search
            if (activeTags.length === 1) {
                const [key, val] = activeTags[0].split("=");
                ql = `[out:json][timeout:25];
nwr["${key}"="${val}"](${bboxString});
out center;`;
            } else if (activeTags.length > 1) {
                // Chain search: Find A, then find B near A, then find C near B...
                // Using .t0, .t1, .t2 as set names
                ql = `[out:json][timeout:25];\n`;
                
                activeTags.forEach((tag, idx) => {
                    const [key, val] = tag.split("=");
                    if (idx === 0) {
                        ql += `nwr["${key}"="${val}"](${bboxString})->.t0;\n`;
                    } else {
                        ql += `nwr["${key}"="${val}"](around.t${idx - 1}:${distance})->.t${idx};\n`;
                    }
                });
                
                // Final output: the last set in the chain
                ql += `.t${activeTags.length - 1} out center;`;
            }
        }
        
        setIsScanning(true);
        try {
            const res = await fetch("/api/plugins/osm-search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: ql })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Search failed");
            
            if (plugin?.pushResults && plugin?.mapOverpassToEntities) {
                const entities = plugin.mapOverpassToEntities(data.data || []);
                plugin.pushResults(entities);
            } else {
                console.warn("Plugin bridge not available in OSMSidebar", data.data);
            }
        } catch (err) {
            console.error(err);
            alert("Search failed: " + (err as Error).message);
        } finally {
            setIsScanning(false);
        }
    };

    const renderedTags = searchText 
        ? COMMON_TAGS.filter(t => t.toLowerCase().includes(searchText.toLowerCase())) 
        : COMMON_TAGS;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
             <div style={{ background: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Viewport Bounding Box</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button 
                            onClick={() => setShowBbox(!showBbox)}
                            title={showBbox ? "Hide Box" : "Show Box"}
                            style={{ 
                                background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", 
                                display: "flex", alignItems: "center", padding: "2px" 
                            }}
                        >
                            {showBbox ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <span style={{ 
                            fontSize: "10px", 
                            padding: "2px 6px", 
                            borderRadius: "10px",
                            background: bboxLocked ? "#ef444422" : "#22c55e22",
                            color: bboxLocked ? "#ef4444" : "#22c55e",
                            border: `1px solid ${bboxLocked ? "#ef444444" : "#22c55e44"}`
                        }}>
                            {bboxLocked ? "LOCKED" : "FOLLOWING"}
                        </span>
                    </div>
                </div>
                <button 
                    onClick={toggleLock} 
                    style={{ 
                        width: "100%", 
                        padding: "6px", 
                        background: "var(--bg-secondary)", 
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "4px",
                        color: "var(--text-primary)",
                        fontSize: "12px",
                        cursor: "pointer"
                    }}
                >
                    {bboxLocked ? "Unlock Viewport" : "Lock Selection Box"}
                </button>
             </div>

             <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.2)", padding: "2px", borderRadius: "6px" }}>
                 <button 
                    style={{ 
                        flex: 1,
                        padding: "6px",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "12px",
                        backgroundColor: mode === "bellingcat" ? "var(--bg-tertiary)" : "transparent", 
                        color: mode === "bellingcat" ? "var(--text-primary)" : "var(--text-muted)",
                        cursor: "pointer"
                    }} 
                    onClick={() => setMode("bellingcat")}
                >
                    Quick Presets
                </button>
                 <button 
                    style={{ 
                        flex: 1,
                        padding: "6px",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "12px",
                        backgroundColor: mode === "turbo" ? "var(--bg-tertiary)" : "transparent", 
                        color: mode === "turbo" ? "var(--text-primary)" : "var(--text-muted)",
                        cursor: "pointer"
                    }} 
                    onClick={() => setMode("turbo")}
                >
                    Overpass QL
                </button>
             </div>

             {mode === "bellingcat" && (
                 <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                     {activeTags.length > 1 && (
                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)", padding: "8px", borderRadius: "4px" }}>
                            <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Intersection Radius: <strong>{distance}m</strong></label>
                            <input 
                                type="range" min="50" max="2000" step="50"
                                value={distance} onChange={e => setDistance(Number(e.target.value))}
                                style={{ width: "100px", accentColor: "var(--accent-blue)" }}
                            />
                         </div>
                     )}
                     <input 
                         style={{ 
                             width: "100%", 
                             padding: "8px", 
                             backgroundColor: "rgba(0,0,0,0.3)", 
                             color: "#fff", 
                             border: "1px solid var(--border-subtle)",
                             borderRadius: "4px",
                             fontSize: "13px"
                         }}
                         placeholder="Filter tags (e.g. amenity=...)" 
                         value={searchText} 
                         onChange={e => setSearchText(e.target.value)} 
                     />
                     <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "150px", overflowY: "auto", padding: "4px" }}>
                         {renderedTags.map(tag => {
                             const isActive = activeTags.includes(tag);
                             return (
                                <button 
                                    key={tag} 
                                    style={{ 
                                        background: isActive ? "var(--accent-blue)" : "rgba(255,255,255,0.05)", 
                                        color: isActive ? "#fff" : "var(--text-secondary)", 
                                        padding: "4px 10px", 
                                        borderRadius: "14px", 
                                        border: `1px solid ${isActive ? "transparent" : "rgba(255,255,255,0.1)"}`,
                                        fontSize: "11px",
                                        cursor: "pointer",
                                        transition: "all 0.2s"
                                    }}
                                    onClick={() => setActiveTags(prev => prev.includes(tag) ? prev.filter(t=>t!==tag) : [...prev, tag])}
                                >
                                    {tag.replace("=", ": ")}
                                </button>
                             );
                         })}
                     </div>
                 </div>
             )}

             {mode === "turbo" && (
                 <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                     <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Raw Overpass Query</label>
                     <textarea 
                         style={{ 
                             backgroundColor: "rgba(0,0,0,0.3)", 
                             color: "#fff", 
                             border: "1px solid var(--border-subtle)", 
                             padding: "8px", 
                             width: "100%",
                             borderRadius: "4px",
                             fontSize: "12px",
                             fontFamily: "monospace",
                             resize: "vertical"
                         }}
                         value={rawQuery} 
                         onChange={e => setRawQuery(e.target.value)} 
                         rows={6} 
                     />
                     <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Use {'{{bbox}}'} as placeholder</span>
                 </div>
             )}

             <button 
                onClick={handleScan} 
                disabled={isScanning || (mode === "bellingcat" && activeTags.length === 0)}
                style={{ 
                    padding: "10px", 
                    background: isScanning ? "var(--bg-tertiary)" : "var(--accent-blue)", 
                    color: "white", 
                    marginTop: "4px", 
                    border: "none", 
                    borderRadius: "4px",
                    fontWeight: 600,
                    cursor: isScanning ? "not-allowed" : "pointer",
                    opacity: (mode === "bellingcat" && activeTags.length === 0) ? 0.5 : 1
                }}
            >
                 {isScanning ? "SCANNING OVERPASS..." : `SCAN AREA (${mode === "turbo" ? "TURBO" : activeTags.length + " TAGS"})`}
             </button>
        </div>
    );
}
