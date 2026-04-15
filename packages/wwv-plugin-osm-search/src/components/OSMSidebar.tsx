import React, { useState } from "react";
import { useOsmStore } from "../store";

const COMMON_TAGS = ["amenity=hospital", "amenity=school", "shop=supermarket", "highway=bus_stop", "building=house"];

export function OSMSidebar() {
    const { bboxLocked, setBboxLocked, currentBbox, setLockedBbox, lockedBbox } = useOsmStore();
    const [mode, setMode] = useState<"bellingcat" | "turbo">("bellingcat");
    const [rawQuery, setRawQuery] = useState("");
    
    // Chips state
    const [searchText, setSearchText] = useState("");
    const [activeTags, setActiveTags] = useState<string[]>([]);
    
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
        
        let ql = rawQuery;
        const bboxParams = lockedBbox || currentBbox;
        let bboxString = "";
        if (bboxParams) {
             // Overpass bbox order usually: south,west,north,east OR it's built into the tag e.g. [bbox:south,west,north,east]
             // We'll append `({{bbox}})` in Turbo, or properly construct it here for bellingcat
        }

        if (mode === "bellingcat") {
            // Very simple version for now, proxy might need more but this is the dumb proxy contract:
            ql = "[out:json];\n(\n" + activeTags.map(t => `  node[${t}]({{bbox}});`).join("\n") + "\n);\nout center;";
            // real bellingcat uses 'around' for distance logic, which we can refine later
        }
        
        // POST to /api/plugins/osm-search
        try {
            // Note: the mapWebsocketPayload or generic plugin logic handles pushing data up, but here we can just console.log
            console.log("Scanning...", ql);
        } catch (err) {
            console.error(err);
        }
    };

    const renderedTags = searchText 
        ? COMMON_TAGS.filter(t => t.includes(searchText)) 
        : COMMON_TAGS;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px" }}>
             <div style={{ background: "#222", padding: "8px", borderRadius: "4px" }}>
                <span>Viewport Status: <strong>{bboxLocked ? "LOCKED" : "FOLLOWING"}</strong></span>
                <button onClick={toggleLock} style={{ marginLeft: "10px" }}>
                    {bboxLocked ? "Unlock Viewport" : "Lock Viewport"}
                </button>
             </div>

             <div style={{ display: "flex", gap: "8px" }}>
                 <button style={{ backgroundColor: mode === "bellingcat" ? "#555" : "#333", color: "white" }} onClick={() => setMode("bellingcat")}>Proximity</button>
                 <button style={{ backgroundColor: mode === "turbo" ? "#555" : "#333", color: "white" }} onClick={() => setMode("turbo")}>Raw QL</button>
             </div>

             {mode === "bellingcat" && (
                 <div>
                     <input 
                         style={{ width: "100%", padding: "4px", marginBottom: "8px", backgroundColor: "#000", color: "#fff", border: "1px solid #555" }}
                         placeholder="Search tags..." 
                         value={searchText} 
                         onChange={e => setSearchText(e.target.value)} 
                     />
                     <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                         {renderedTags.map(tag => (
                             <button 
                                 key={tag} 
                                 style={{ background: activeTags.includes(tag) ? "blue" : "#444", color: "white", padding: "4px 8px", borderRadius: "12px", border: "none" }}
                                 onClick={() => setActiveTags(prev => prev.includes(tag) ? prev.filter(t=>t!==tag) : [...prev, tag])}
                             >
                                 {tag}
                             </button>
                         ))}
                     </div>
                 </div>
             )}

             {mode === "turbo" && (
                 <textarea 
                     style={{ backgroundColor: "#000", color: "#fff", border: "1px solid #555", padding: "4px", width: "100%" }}
                     value={rawQuery} 
                     onChange={e => setRawQuery(e.target.value)} 
                     rows={6} 
                 />
             )}

             <button onClick={handleScan} style={{ padding: "8px", background: "green", color: "white", marginTop: "8px", border: "none", borderRadius: "4px" }}>
                 SCAN {activeTags.length} TAGS
             </button>
        </div>
    );
}
