import { Upload, ClipboardPaste, FileJson } from "lucide-react";
import type { ImportMethod } from "../types";

export function MethodTabs({ method, onChange }: { method: ImportMethod; onChange: (m: ImportMethod) => void }) {
    const tabs: [ImportMethod, typeof Upload, string][] = [
        ["file", Upload, "File"],
        ["paste", ClipboardPaste, "Paste"],
        ["custom", FileJson, "Custom JSON"],
    ];
    return (
        <div className="geojson-modal__tabs">
            {tabs.map(([key, Icon, label]) => (
                <button
                    key={key}
                    className={`geojson-tab ${method === key ? "geojson-tab--active" : ""}`}
                    onClick={() => onChange(key)}
                >
                    <Icon size={14} />
                    {label}
                </button>
            ))}
        </div>
    );
}
