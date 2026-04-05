import { MapPin } from "lucide-react";
import { buildUserKeyHeaders } from "@/lib/userApiKeys";
import { categorizePlace, type PlaceCategory } from "./placeCategories";
import type { SearchResult, SearchSection } from "./searchTypes";

export async function searchLocations(query: string): Promise<SearchSection | null> {
    try {
        const res = await fetch(`/api/places/search?input=${encodeURIComponent(query)}`, {
            headers: buildUserKeyHeaders(),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.predictions?.length) return null;

        const results: SearchResult[] = data.predictions.map(
            (p: { placeId: string; mainText: string; secondaryText: string; types?: string[] }, i: number) => {
                const category = categorizePlace(p.types || []);
                return {
                    id: p.placeId,
                    label: p.mainText,
                    subLabel: p.secondaryText,
                    score: 100 - i,
                    lat: 0,
                    lon: 0,
                    type: category === "region" ? "country" as const : "place" as const,
                    placeCategory: category,
                };
            }
        );

        return {
            title: "Places",
            icon: <MapPin size={16} />,
            results: results.slice(0, 5),
            maxScore: results[0].score,
        };
    } catch (err) {
        console.error("Error fetching places:", err);
        return null;
    }
}
