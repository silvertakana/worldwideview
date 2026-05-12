# GeoJSON Data Guide

WorldWideView supports visualizing external datasets and local static files by interpreting GeoJSON files. When using the built-in GeoJSON parser (for instance, via declarative configs, static plugins, or user-uploaded files), the data is automatically normalized into our internal `GeoEntity` format so it seamlessly displays on the globe and the UI's detail panels.

This guide outlines exactly what structures are supported, what isn't, and how you can map your data into the UI.

---

## What is Supported?

Our parser enforces a subset of the **RFC 7946** standard. To be successfully interpreted, your JSON file must meet the following criteria:

### 1. Root Level
The root of your JSON document must be a `FeatureCollection`. It must contain a `features` array.

```json
{
  "type": "FeatureCollection",
  "features": [ ... ]
}
```

### 2. Supported Geometry: Points
WorldWideView's declarative parser strictly supports **Point** geometries. Your coordinates must be a flat array of numbers: `[longitude, latitude]` or optionally `[longitude, latitude, altitude]`.

```json
"geometry": {
  "type": "Point",
  "coordinates": [-83.74088, 42.27756, 150.0]
}
```
*Note: Altitude (the 3rd coordinate) is optional. If omitted, the entity will be clamped to the ground.*

### 3. Properties and Metadata
You can include any arbitrary metadata inside the `properties` object. The parser maps these properties to the UI using a `FieldMapping` configuration.

```json
"properties": {
  "stream": "http://example.com/video.mjpg",
  "country": "United States",
  "is_static": false,
  "nested_data": {
    "speed": 45,
    "heading": 180
  }
}
```

#### Field Mapping
When configuring your data source, you can define how your GeoJSON properties map to standard WorldWideView `GeoEntity` fields. This is done via dot-notation:

| GeoEntity Field | Description | Example Path |
| --- | --- | --- |
| `id` | Unique identifier | Automatically maps to `Feature.id` if present, otherwise uses array index. |
| `heading` | Rotation angle (degrees) | `properties.nested_data.heading` |
| `speed` | Speed value | `properties.nested_data.speed` |
| `timestamp` | Time of the event (string or epoch) | `properties.last_updated` |
| `label` | Primary text label shown on map | `properties.city` |
| `properties` | Custom fields mapped to the UI panel | `properties.stream` |

Any property extracted via mapping will appear automatically in the Entity Info Card when a user clicks the point on the map.

---

## What is NOT Supported?

To ensure extreme performance (60 FPS with 10k+ entities) and a unified UI experience, the following GeoJSON structures are **not supported** by the automatic data parser:

### 1. Complex Geometries
The declarative parser will fail to render the following geometry types:
- `Polygon`
- `MultiPolygon`
- `LineString`
- `MultiLineString`
- `GeometryCollection`

*Why?* The automatic parser maps features to single point entities (billboards or 3D models). If you supply a `Polygon`, the parser will read the nested coordinate arrays (`[[lon, lat], ...]`) as invalid numbers, resulting in a silent failure (`NaN` clamping). 

If you need to render borders, heatmaps, or route lines, you must build a **Code Bundle Plugin** and interact with the Cesium primitives (`PolygonHierarchy`, `PolylineCollection`) directly via the `renderEntity` API.

### 2. Top-Level Features
A single isolated `Feature` object at the root of the document will not be parsed. The data must be wrapped in a `FeatureCollection`.

### 3. Non-Standard Coordinate Orders
Cesium and GeoJSON strictly require `[longitude, latitude]`. If your system outputs `[latitude, longitude]`, you must transform the data before passing it to WorldWideView.

---

## Example: Perfect GeoJSON Structure

Here is a fully supported and optimized example demonstrating cameras mounted globally:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "cam-001",
      "geometry": {
        "type": "Point",
        "coordinates": [-83.74088, 42.27756]
      },
      "properties": {
        "stream": "http://173.167.10.225:80/mjpg/video.mjpg",
        "country": "United States",
        "city": "Ann Arbor",
        "categories": ["traffic"],
        "is_static": false
      }
    }
  ]
}
```

By ensuring your data matches this structure, WorldWideView can effortlessly stream, render, and display your intelligence layers on the interactive 3D globe.
