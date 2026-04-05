export function MetadataForm({ name, description, color, onNameChange, onDescriptionChange, onColorChange }: {
    name: string; description: string; color: string;
    onNameChange: (v: string) => void;
    onDescriptionChange: (v: string) => void;
    onColorChange: (v: string) => void;
}) {
    return (
        <div className="geojson-meta">
            <input className="geojson-input" placeholder="Layer name" value={name} onChange={(e) => onNameChange(e.target.value)} />
            <input className="geojson-input" placeholder="Description (optional)" value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
            <div className="geojson-color-row">
                <label>Color</label>
                <input type="color" value={color} onChange={(e) => onColorChange(e.target.value)} />
            </div>
        </div>
    );
}
