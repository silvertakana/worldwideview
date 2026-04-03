import { v4 as uuidv4 } from 'uuid';
import { setLiveSnapshot } from '../redis';
import { registerSeeder } from '../scheduler';

export async function fetchSanctionsData() {
    try {
        console.log('[Sanctions] Generating mock sanctions data...');
        
        const SANCTION_ENTITIES = [
            { targetName: "Central Bank of Iran", country: "Iran", lat: 35.6892, lon: 51.3890, authority: "OFAC", program: "Iran", list: "SDN" },
            { targetName: "Gazprombank", country: "Russia", lat: 55.7558, lon: 37.6173, authority: "OFAC", program: "Russia", list: "SDN" },
            { targetName: "Sberbank", country: "Russia", lat: 55.7338, lon: 37.5881, authority: "EU", program: "Russia", list: "Consolidated" },
            { targetName: "Aeroflot", country: "Russia", lat: 55.9736, lon: 37.4125, authority: "UK", program: "Russia", list: "Consolidated" },
            { targetName: "Mahan Air", country: "Iran", lat: 35.6881, lon: 51.3888, authority: "OFAC", program: "SDGT", list: "SDN" },
            { targetName: "PDVSA", country: "Venezuela", lat: 10.4806, lon: -66.9036, authority: "OFAC", program: "Venezuela", list: "SDN" },
            { targetName: "Huawei Technologies", country: "China", lat: 22.6533, lon: 114.0540, authority: "BIS", program: "Entity List", list: "Entity List" },
            { targetName: "Korea Mining Development Trading Corporation", country: "North Korea", lat: 39.0194, lon: 125.7381, authority: "UN", program: "DPRK", list: "Consolidated" },
        ];

        const sanctionsObj = {
            id: 'sanctions-live',
            timestamp: new Date().toISOString(),
            items: SANCTION_ENTITIES.map(e => ({
                id: uuidv4(),
                targetName: e.targetName,
                country: e.country,
                latitude: e.lat,
                longitude: e.lon,
                authority: e.authority,
                program: e.program,
                list: e.list,
                timestamp: new Date().toISOString()
            }))
        };

        // Cache for live polling (24 hr TTL)
        await setLiveSnapshot('sanctions', sanctionsObj, 86400);

        console.log(`[Sanctions] Published ${sanctionsObj.items.length} records.`);
    } catch (err) {
        console.error('[Sanctions] Error:', err);
    }
}

registerSeeder({
    name: "sanctions",
    cron: "0 * * * *", // run hourly
    fn: fetchSanctionsData
});
