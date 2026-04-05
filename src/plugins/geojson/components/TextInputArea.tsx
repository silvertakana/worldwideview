export function TextInputArea({ method, value, onChange, onParse }: {
    method: "paste" | "custom";
    value: string;
    onChange: (v: string) => void;
    onParse: () => void;
}) {
    return (
        <>
            <textarea
                className="geojson-textarea"
                placeholder={
                    method === "paste"
                        ? "Paste GeoJSON here..."
                        : "Paste custom JSON array (with lat/lon fields)..."
                }
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={8}
            />
            <button
                className="geojson-btn geojson-btn--secondary"
                onClick={onParse}
                disabled={!value.trim()}
            >
                Parse
            </button>
        </>
    );
}
