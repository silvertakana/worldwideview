# @worldwideview/wwv-plugin-military

[WorldWideView](https://github.com/silvertakana/worldwideview) plugin for **real-time military aircraft tracking** via [adsb.lol](https://api.adsb.lol).

## Features

- 🛡️ Live military aircraft positions updated every 60 seconds
- 🎨 Altitude-based coloring (green → orange → red → pink → yellow)
- ✈️ 3D airplane model rendering with heading-oriented rotation
- 📡 Flight trail rendering on entity selection
- 🔍 Filters: aircraft type, callsign, registration, altitude range, on-ground status
- 📋 Rich entity properties (hex, squawk, category, emergency status)

## Installation

```bash
npm install @worldwideview/wwv-plugin-military
```

### Peer Dependencies

- `@worldwideview/wwv-plugin-sdk`
- `lucide-react` ≥ 0.576.0

## Usage

```ts
import { MilitaryPlugin } from "@worldwideview/wwv-plugin-military";

const plugin = new MilitaryPlugin();
```

Register the plugin with the WorldWideView plugin engine to start tracking military aircraft on the globe.

## Data Source

Military aircraft data is fetched from [adsb.lol](https://api.adsb.lol/) via the `/api/military` endpoint. No authentication required.

## Changelog

- **v1.0.0** — Initial release. Renamed from wwv-plugin-military for clarity.

## License

ISC
