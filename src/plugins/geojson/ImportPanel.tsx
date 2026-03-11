"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ImportModal } from "./ImportModal";
import { ImportedLayerList } from "./ImportedLayerList";

export function ImportPanel() {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <div className="geojson-import-panel">
            <button
                className="geojson-btn geojson-btn--primary geojson-btn--full"
                onClick={() => setModalOpen(true)}
            >
                <Plus size={16} />
                Import GeoJSON
            </button>

            <ImportedLayerList />

            {modalOpen && <ImportModal onClose={() => setModalOpen(false)} />}
        </div>
    );
}
