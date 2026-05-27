/**
 * World Capitals Plugin — All 195 sovereign state capitals with flag emoji and metadata.
 * Hardcoded data from the Smithsonian/standard geographic references.
 * No API key required. No refresh needed (static data).
 */
import { Star } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";

// Gold star icon for capitals
const STAR_ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="13" fill="rgba(15,23,42,0.85)"/>
  <path d="M14 4 L16.5 11 L24 11 L18 15.5 L20.5 23 L14 18.5 L7.5 23 L10 15.5 L4 11 L11.5 11 Z"
        fill="#fbbf24" stroke="#f59e0b" stroke-width="0.5"/>
</svg>
`);

interface Capital {
    country: string;
    flag: string;
    capital: string;
    lat: number;
    lon: number;
    pop: number;
    continent: string;
}

const CAPITALS: Capital[] = [
    { country: "Afghanistan", flag: "🇦🇫", capital: "Kabul", lat: 34.5289, lon: 69.1725, pop: 4601789, continent: "Asia" },
    { country: "Albania", flag: "🇦🇱", capital: "Tirana", lat: 41.3317, lon: 19.8319, pop: 895000, continent: "Europe" },
    { country: "Algeria", flag: "🇩🇿", capital: "Algiers", lat: 36.7372, lon: 3.0865, pop: 3915811, continent: "Africa" },
    { country: "Andorra", flag: "🇦🇩", capital: "Andorra la Vella", lat: 42.5075, lon: 1.5218, pop: 22614, continent: "Europe" },
    { country: "Angola", flag: "🇦🇴", capital: "Luanda", lat: -8.8147, lon: 13.2302, pop: 8330000, continent: "Africa" },
    { country: "Antigua and Barbuda", flag: "🇦🇬", capital: "St. John's", lat: 17.1274, lon: -61.8468, pop: 30000, continent: "North America" },
    { country: "Argentina", flag: "🇦🇷", capital: "Buenos Aires", lat: -34.6037, lon: -58.3816, pop: 15594428, continent: "South America" },
    { country: "Armenia", flag: "🇦🇲", capital: "Yerevan", lat: 40.1872, lon: 44.5152, pop: 1093500, continent: "Asia" },
    { country: "Australia", flag: "🇦🇺", capital: "Canberra", lat: -35.2809, lon: 149.1300, pop: 453342, continent: "Oceania" },
    { country: "Austria", flag: "🇦🇹", capital: "Vienna", lat: 48.2082, lon: 16.3738, pop: 1897491, continent: "Europe" },
    { country: "Azerbaijan", flag: "🇦🇿", capital: "Baku", lat: 40.4093, lon: 49.8671, pop: 2293100, continent: "Asia" },
    { country: "Bahamas", flag: "🇧🇸", capital: "Nassau", lat: 25.0480, lon: -77.3554, pop: 274400, continent: "North America" },
    { country: "Bahrain", flag: "🇧🇭", capital: "Manama", lat: 26.2154, lon: 50.5832, pop: 157000, continent: "Asia" },
    { country: "Bangladesh", flag: "🇧🇩", capital: "Dhaka", lat: 23.7104, lon: 90.4074, pop: 21741000, continent: "Asia" },
    { country: "Barbados", flag: "🇧🇧", capital: "Bridgetown", lat: 13.0969, lon: -59.6145, pop: 110000, continent: "North America" },
    { country: "Belarus", flag: "🇧🇾", capital: "Minsk", lat: 53.9045, lon: 27.5615, pop: 2009786, continent: "Europe" },
    { country: "Belgium", flag: "🇧🇪", capital: "Brussels", lat: 50.8503, lon: 4.3517, pop: 1208542, continent: "Europe" },
    { country: "Belize", flag: "🇧🇿", capital: "Belmopan", lat: 17.2514, lon: -88.7590, pop: 22800, continent: "North America" },
    { country: "Benin", flag: "🇧🇯", capital: "Porto-Novo", lat: 6.3676, lon: 2.4252, pop: 309000, continent: "Africa" },
    { country: "Bhutan", flag: "🇧🇹", capital: "Thimphu", lat: 27.4716, lon: 89.6386, pop: 114551, continent: "Asia" },
    { country: "Bolivia", flag: "🇧🇴", capital: "Sucre", lat: -19.0196, lon: -65.2619, pop: 337000, continent: "South America" },
    { country: "Bosnia and Herzegovina", flag: "🇧🇦", capital: "Sarajevo", lat: 43.8486, lon: 18.3564, pop: 275524, continent: "Europe" },
    { country: "Botswana", flag: "🇧🇼", capital: "Gaborone", lat: -24.6282, lon: 25.9231, pop: 231592, continent: "Africa" },
    { country: "Brazil", flag: "🇧🇷", capital: "Brasília", lat: -15.7801, lon: -47.9292, pop: 3015268, continent: "South America" },
    { country: "Brunei", flag: "🇧🇳", capital: "Bandar Seri Begawan", lat: 4.9400, lon: 114.9480, pop: 64409, continent: "Asia" },
    { country: "Bulgaria", flag: "🇧🇬", capital: "Sofia", lat: 42.6977, lon: 23.3219, pop: 1241675, continent: "Europe" },
    { country: "Burkina Faso", flag: "🇧🇫", capital: "Ouagadougou", lat: 12.3647, lon: -1.5337, pop: 2415266, continent: "Africa" },
    { country: "Burundi", flag: "🇧🇮", capital: "Gitega", lat: -3.4271, lon: 29.9307, pop: 135467, continent: "Africa" },
    { country: "Cabo Verde", flag: "🇨🇻", capital: "Praia", lat: 14.9305, lon: -23.5133, pop: 131602, continent: "Africa" },
    { country: "Cambodia", flag: "🇰🇭", capital: "Phnom Penh", lat: 11.5625, lon: 104.9160, pop: 2009264, continent: "Asia" },
    { country: "Cameroon", flag: "🇨🇲", capital: "Yaoundé", lat: 3.8480, lon: 11.5021, pop: 2765000, continent: "Africa" },
    { country: "Canada", flag: "🇨🇦", capital: "Ottawa", lat: 45.4215, lon: -75.6972, pop: 1017449, continent: "North America" },
    { country: "Central African Republic", flag: "🇨🇫", capital: "Bangui", lat: 4.3947, lon: 18.5582, pop: 889231, continent: "Africa" },
    { country: "Chad", flag: "🇹🇩", capital: "N'Djamena", lat: 12.1091, lon: 15.0444, pop: 1248121, continent: "Africa" },
    { country: "Chile", flag: "🇨🇱", capital: "Santiago", lat: -33.4489, lon: -70.6693, pop: 5743719, continent: "South America" },
    { country: "China", flag: "🇨🇳", capital: "Beijing", lat: 39.9042, lon: 116.4074, pop: 21893095, continent: "Asia" },
    { country: "Colombia", flag: "🇨🇴", capital: "Bogotá", lat: 4.7110, lon: -74.0721, pop: 8380801, continent: "South America" },
    { country: "Comoros", flag: "🇰🇲", capital: "Moroni", lat: -11.7022, lon: 43.2551, pop: 60200, continent: "Africa" },
    { country: "Congo (Dem. Rep.)", flag: "🇨🇩", capital: "Kinshasa", lat: -4.3317, lon: 15.3139, pop: 14342439, continent: "Africa" },
    { country: "Congo (Rep.)", flag: "🇨🇬", capital: "Brazzaville", lat: -4.2634, lon: 15.2429, pop: 1827000, continent: "Africa" },
    { country: "Costa Rica", flag: "🇨🇷", capital: "San José", lat: 9.9281, lon: -84.0907, pop: 1403455, continent: "North America" },
    { country: "Croatia", flag: "🇭🇷", capital: "Zagreb", lat: 45.8150, lon: 15.9819, pop: 767131, continent: "Europe" },
    { country: "Cuba", flag: "🇨🇺", capital: "Havana", lat: 23.1136, lon: -82.3666, pop: 2141652, continent: "North America" },
    { country: "Cyprus", flag: "🇨🇾", capital: "Nicosia", lat: 35.1856, lon: 33.3823, pop: 330000, continent: "Europe" },
    { country: "Czech Republic", flag: "🇨🇿", capital: "Prague", lat: 50.0755, lon: 14.4378, pop: 1309000, continent: "Europe" },
    { country: "Denmark", flag: "🇩🇰", capital: "Copenhagen", lat: 55.6761, lon: 12.5683, pop: 794128, continent: "Europe" },
    { country: "Djibouti", flag: "🇩🇯", capital: "Djibouti City", lat: 11.5886, lon: 43.1451, pop: 603000, continent: "Africa" },
    { country: "Dominica", flag: "🇩🇲", capital: "Roseau", lat: 15.3009, lon: -61.3879, pop: 16582, continent: "North America" },
    { country: "Dominican Republic", flag: "🇩🇴", capital: "Santo Domingo", lat: 18.4861, lon: -69.9312, pop: 3172000, continent: "North America" },
    { country: "Ecuador", flag: "🇪🇨", capital: "Quito", lat: -0.1807, lon: -78.4678, pop: 2781641, continent: "South America" },
    { country: "Egypt", flag: "🇪🇬", capital: "Cairo", lat: 30.0444, lon: 31.2357, pop: 20076242, continent: "Africa" },
    { country: "El Salvador", flag: "🇸🇻", capital: "San Salvador", lat: 13.6929, lon: -89.2182, pop: 1767079, continent: "North America" },
    { country: "Equatorial Guinea", flag: "🇬🇶", capital: "Malabo", lat: 3.7500, lon: 8.7833, pop: 297000, continent: "Africa" },
    { country: "Eritrea", flag: "🇪🇷", capital: "Asmara", lat: 15.3229, lon: 38.9251, pop: 963000, continent: "Africa" },
    { country: "Estonia", flag: "🇪🇪", capital: "Tallinn", lat: 59.4370, lon: 24.7536, pop: 446055, continent: "Europe" },
    { country: "Eswatini", flag: "🇸🇿", capital: "Mbabane", lat: -26.3054, lon: 31.1367, pop: 94874, continent: "Africa" },
    { country: "Ethiopia", flag: "🇪🇹", capital: "Addis Ababa", lat: 9.0320, lon: 38.7469, pop: 3352000, continent: "Africa" },
    { country: "Fiji", flag: "🇫🇯", capital: "Suva", lat: -18.1416, lon: 178.4419, pop: 330000, continent: "Oceania" },
    { country: "Finland", flag: "🇫🇮", capital: "Helsinki", lat: 60.1699, lon: 24.9384, pop: 658864, continent: "Europe" },
    { country: "France", flag: "🇫🇷", capital: "Paris", lat: 48.8566, lon: 2.3522, pop: 2161000, continent: "Europe" },
    { country: "Gabon", flag: "🇬🇦", capital: "Libreville", lat: 0.4162, lon: 9.4673, pop: 813000, continent: "Africa" },
    { country: "Gambia", flag: "🇬🇲", capital: "Banjul", lat: 13.4549, lon: -16.5790, pop: 34589, continent: "Africa" },
    { country: "Georgia", flag: "🇬🇪", capital: "Tbilisi", lat: 41.6938, lon: 44.8015, pop: 1118035, continent: "Asia" },
    { country: "Germany", flag: "🇩🇪", capital: "Berlin", lat: 52.5200, lon: 13.4050, pop: 3769495, continent: "Europe" },
    { country: "Ghana", flag: "🇬🇭", capital: "Accra", lat: 5.6037, lon: -0.1870, pop: 2557000, continent: "Africa" },
    { country: "Greece", flag: "🇬🇷", capital: "Athens", lat: 37.9838, lon: 23.7275, pop: 3153000, continent: "Europe" },
    { country: "Grenada", flag: "🇬🇩", capital: "St. George's", lat: 12.0561, lon: -61.7486, pop: 40000, continent: "North America" },
    { country: "Guatemala", flag: "🇬🇹", capital: "Guatemala City", lat: 14.6349, lon: -90.5069, pop: 3015081, continent: "North America" },
    { country: "Guinea", flag: "🇬🇳", capital: "Conakry", lat: 9.6412, lon: -13.5784, pop: 1660973, continent: "Africa" },
    { country: "Guinea-Bissau", flag: "🇬🇼", capital: "Bissau", lat: 11.8636, lon: -15.5977, pop: 388028, continent: "Africa" },
    { country: "Guyana", flag: "🇬🇾", capital: "Georgetown", lat: 6.8013, lon: -58.1551, pop: 235017, continent: "South America" },
    { country: "Haiti", flag: "🇭🇹", capital: "Port-au-Prince", lat: 18.5944, lon: -72.3074, pop: 2844229, continent: "North America" },
    { country: "Honduras", flag: "🇭🇳", capital: "Tegucigalpa", lat: 14.0818, lon: -87.2068, pop: 1363000, continent: "North America" },
    { country: "Hungary", flag: "🇭🇺", capital: "Budapest", lat: 47.4979, lon: 19.0402, pop: 1752286, continent: "Europe" },
    { country: "Iceland", flag: "🇮🇸", capital: "Reykjavik", lat: 64.1355, lon: -21.8954, pop: 128793, continent: "Europe" },
    { country: "India", flag: "🇮🇳", capital: "New Delhi", lat: 28.6139, lon: 77.2090, pop: 32941309, continent: "Asia" },
    { country: "Indonesia", flag: "🇮🇩", capital: "Jakarta", lat: -6.2088, lon: 106.8456, pop: 10562088, continent: "Asia" },
    { country: "Iran", flag: "🇮🇷", capital: "Tehran", lat: 35.6892, lon: 51.3890, pop: 9134000, continent: "Asia" },
    { country: "Iraq", flag: "🇮🇶", capital: "Baghdad", lat: 33.3152, lon: 44.3661, pop: 7144260, continent: "Asia" },
    { country: "Ireland", flag: "🇮🇪", capital: "Dublin", lat: 53.3498, lon: -6.2603, pop: 1388000, continent: "Europe" },
    { country: "Israel", flag: "🇮🇱", capital: "Jerusalem", lat: 31.7683, lon: 35.2137, pop: 936425, continent: "Asia" },
    { country: "Italy", flag: "🇮🇹", capital: "Rome", lat: 41.9028, lon: 12.4964, pop: 2844234, continent: "Europe" },
    { country: "Jamaica", flag: "🇯🇲", capital: "Kingston", lat: 17.9970, lon: -76.7936, pop: 662426, continent: "North America" },
    { country: "Japan", flag: "🇯🇵", capital: "Tokyo", lat: 35.6762, lon: 139.6503, pop: 13960000, continent: "Asia" },
    { country: "Jordan", flag: "🇯🇴", capital: "Amman", lat: 31.9454, lon: 35.9284, pop: 4007526, continent: "Asia" },
    { country: "Kazakhstan", flag: "🇰🇿", capital: "Astana", lat: 51.1694, lon: 71.4491, pop: 1136000, continent: "Asia" },
    { country: "Kenya", flag: "🇰🇪", capital: "Nairobi", lat: -1.2921, lon: 36.8219, pop: 4735000, continent: "Africa" },
    { country: "Kiribati", flag: "🇰🇮", capital: "South Tarawa", lat: 1.3290, lon: 172.9790, pop: 64000, continent: "Oceania" },
    { country: "Kosovo", flag: "🇽🇰", capital: "Pristina", lat: 42.6629, lon: 21.1655, pop: 228000, continent: "Europe" },
    { country: "Kuwait", flag: "🇰🇼", capital: "Kuwait City", lat: 29.3759, lon: 47.9774, pop: 2989000, continent: "Asia" },
    { country: "Kyrgyzstan", flag: "🇰🇬", capital: "Bishkek", lat: 42.8746, lon: 74.5698, pop: 1074075, continent: "Asia" },
    { country: "Laos", flag: "🇱🇦", capital: "Vientiane", lat: 17.9757, lon: 102.6331, pop: 820000, continent: "Asia" },
    { country: "Latvia", flag: "🇱🇻", capital: "Riga", lat: 56.9496, lon: 24.1052, pop: 633000, continent: "Europe" },
    { country: "Lebanon", flag: "🇱🇧", capital: "Beirut", lat: 33.8886, lon: 35.4955, pop: 2200000, continent: "Asia" },
    { country: "Lesotho", flag: "🇱🇸", capital: "Maseru", lat: -29.3142, lon: 27.4833, pop: 330760, continent: "Africa" },
    { country: "Liberia", flag: "🇱🇷", capital: "Monrovia", lat: 6.3005, lon: -10.7969, pop: 1611000, continent: "Africa" },
    { country: "Libya", flag: "🇱🇾", capital: "Tripoli", lat: 32.8872, lon: 13.1913, pop: 1150989, continent: "Africa" },
    { country: "Liechtenstein", flag: "🇱🇮", capital: "Vaduz", lat: 47.1410, lon: 9.5215, pop: 5696, continent: "Europe" },
    { country: "Lithuania", flag: "🇱🇹", capital: "Vilnius", lat: 54.6872, lon: 25.2797, pop: 574221, continent: "Europe" },
    { country: "Luxembourg", flag: "🇱🇺", capital: "Luxembourg City", lat: 49.6116, lon: 6.1319, pop: 128514, continent: "Europe" },
    { country: "Madagascar", flag: "🇲🇬", capital: "Antananarivo", lat: -18.9137, lon: 47.5361, pop: 3371700, continent: "Africa" },
    { country: "Malawi", flag: "🇲🇼", capital: "Lilongwe", lat: -13.9626, lon: 33.7741, pop: 1077116, continent: "Africa" },
    { country: "Malaysia", flag: "🇲🇾", capital: "Kuala Lumpur", lat: 3.1390, lon: 101.6869, pop: 1982112, continent: "Asia" },
    { country: "Maldives", flag: "🇲🇻", capital: "Malé", lat: 4.1755, lon: 73.5093, pop: 133000, continent: "Asia" },
    { country: "Mali", flag: "🇲🇱", capital: "Bamako", lat: 12.6392, lon: -8.0029, pop: 2515000, continent: "Africa" },
    { country: "Malta", flag: "🇲🇹", capital: "Valletta", lat: 35.8997, lon: 14.5146, pop: 6444, continent: "Europe" },
    { country: "Marshall Islands", flag: "🇲🇭", capital: "Majuro", lat: 7.0897, lon: 171.3803, pop: 27797, continent: "Oceania" },
    { country: "Mauritania", flag: "🇲🇷", capital: "Nouakchott", lat: 18.0735, lon: -15.9582, pop: 1205000, continent: "Africa" },
    { country: "Mauritius", flag: "🇲🇺", capital: "Port Louis", lat: -20.1609, lon: 57.4989, pop: 148001, continent: "Africa" },
    { country: "Mexico", flag: "🇲🇽", capital: "Mexico City", lat: 19.4326, lon: -99.1332, pop: 21671908, continent: "North America" },
    { country: "Micronesia", flag: "🇫🇲", capital: "Palikir", lat: 6.9248, lon: 158.1618, pop: 6647, continent: "Oceania" },
    { country: "Moldova", flag: "🇲🇩", capital: "Chișinău", lat: 47.0105, lon: 28.8638, pop: 510800, continent: "Europe" },
    { country: "Monaco", flag: "🇲🇨", capital: "Monaco City", lat: 43.7384, lon: 7.4246, pop: 18771, continent: "Europe" },
    { country: "Mongolia", flag: "🇲🇳", capital: "Ulaanbaatar", lat: 47.8864, lon: 106.9057, pop: 1372000, continent: "Asia" },
    { country: "Montenegro", flag: "🇲🇪", capital: "Podgorica", lat: 42.4304, lon: 19.2594, pop: 150977, continent: "Europe" },
    { country: "Morocco", flag: "🇲🇦", capital: "Rabat", lat: 33.9716, lon: -6.8498, pop: 577827, continent: "Africa" },
    { country: "Mozambique", flag: "🇲🇿", capital: "Maputo", lat: -25.9692, lon: 32.5732, pop: 1101170, continent: "Africa" },
    { country: "Myanmar", flag: "🇲🇲", capital: "Naypyidaw", lat: 19.7450, lon: 96.1297, pop: 1160000, continent: "Asia" },
    { country: "Namibia", flag: "🇳🇦", capital: "Windhoek", lat: -22.5609, lon: 17.0658, pop: 431000, continent: "Africa" },
    { country: "Nauru", flag: "🇳🇷", capital: "Yaren", lat: -0.5477, lon: 166.9209, pop: 10000, continent: "Oceania" },
    { country: "Nepal", flag: "🇳🇵", capital: "Kathmandu", lat: 27.7172, lon: 85.3240, pop: 1442271, continent: "Asia" },
    { country: "Netherlands", flag: "🇳🇱", capital: "Amsterdam", lat: 52.3676, lon: 4.9041, pop: 873338, continent: "Europe" },
    { country: "New Zealand", flag: "🇳🇿", capital: "Wellington", lat: -41.2865, lon: 174.7762, pop: 412500, continent: "Oceania" },
    { country: "Nicaragua", flag: "🇳🇮", capital: "Managua", lat: 12.1364, lon: -86.2514, pop: 1028808, continent: "North America" },
    { country: "Niger", flag: "🇳🇪", capital: "Niamey", lat: 13.5137, lon: 2.1098, pop: 1026848, continent: "Africa" },
    { country: "Nigeria", flag: "🇳🇬", capital: "Abuja", lat: 9.0579, lon: 7.4951, pop: 3464000, continent: "Africa" },
    { country: "North Korea", flag: "🇰🇵", capital: "Pyongyang", lat: 39.0392, lon: 125.7625, pop: 2581000, continent: "Asia" },
    { country: "North Macedonia", flag: "🇲🇰", capital: "Skopje", lat: 41.9981, lon: 21.4254, pop: 544086, continent: "Europe" },
    { country: "Norway", flag: "🇳🇴", capital: "Oslo", lat: 59.9139, lon: 10.7522, pop: 693494, continent: "Europe" },
    { country: "Oman", flag: "🇴🇲", capital: "Muscat", lat: 23.5880, lon: 58.3829, pop: 1421000, continent: "Asia" },
    { country: "Pakistan", flag: "🇵🇰", capital: "Islamabad", lat: 33.6844, lon: 73.0479, pop: 1014825, continent: "Asia" },
    { country: "Palau", flag: "🇵🇼", capital: "Ngerulmud", lat: 7.5000, lon: 134.6240, pop: 391, continent: "Oceania" },
    { country: "Panama", flag: "🇵🇦", capital: "Panama City", lat: 8.9936, lon: -79.5197, pop: 1440000, continent: "North America" },
    { country: "Papua New Guinea", flag: "🇵🇬", capital: "Port Moresby", lat: -9.4438, lon: 147.1803, pop: 364125, continent: "Oceania" },
    { country: "Paraguay", flag: "🇵🇾", capital: "Asunción", lat: -25.2867, lon: -57.6470, pop: 2139465, continent: "South America" },
    { country: "Peru", flag: "🇵🇪", capital: "Lima", lat: -12.0464, lon: -77.0428, pop: 11044607, continent: "South America" },
    { country: "Philippines", flag: "🇵🇭", capital: "Manila", lat: 14.5995, lon: 120.9842, pop: 13923452, continent: "Asia" },
    { country: "Poland", flag: "🇵🇱", capital: "Warsaw", lat: 52.2297, lon: 21.0122, pop: 1794166, continent: "Europe" },
    { country: "Portugal", flag: "🇵🇹", capital: "Lisbon", lat: 38.7223, lon: -9.1393, pop: 509751, continent: "Europe" },
    { country: "Qatar", flag: "🇶🇦", capital: "Doha", lat: 25.2854, lon: 51.5310, pop: 956000, continent: "Asia" },
    { country: "Romania", flag: "🇷🇴", capital: "Bucharest", lat: 44.4268, lon: 26.1025, pop: 1883425, continent: "Europe" },
    { country: "Russia", flag: "🇷🇺", capital: "Moscow", lat: 55.7558, lon: 37.6176, pop: 13010112, continent: "Europe" },
    { country: "Rwanda", flag: "🇷🇼", capital: "Kigali", lat: -1.9441, lon: 30.0619, pop: 1259000, continent: "Africa" },
    { country: "Saint Kitts and Nevis", flag: "🇰🇳", capital: "Basseterre", lat: 17.3026, lon: -62.7177, pop: 14000, continent: "North America" },
    { country: "Saint Lucia", flag: "🇱🇨", capital: "Castries", lat: 14.0101, lon: -60.9875, pop: 22000, continent: "North America" },
    { country: "Saint Vincent", flag: "🇻🇨", capital: "Kingstown", lat: 13.1600, lon: -61.2248, pop: 25000, continent: "North America" },
    { country: "Samoa", flag: "🇼🇸", capital: "Apia", lat: -13.8506, lon: -171.7513, pop: 36735, continent: "Oceania" },
    { country: "San Marino", flag: "🇸🇲", capital: "San Marino City", lat: 43.9424, lon: 12.4578, pop: 4040, continent: "Europe" },
    { country: "São Tomé and Príncipe", flag: "🇸🇹", capital: "São Tomé", lat: 0.3365, lon: 6.7273, pop: 71868, continent: "Africa" },
    { country: "Saudi Arabia", flag: "🇸🇦", capital: "Riyadh", lat: 24.6877, lon: 46.7219, pop: 7538200, continent: "Asia" },
    { country: "Senegal", flag: "🇸🇳", capital: "Dakar", lat: 14.7167, lon: -17.4677, pop: 3137196, continent: "Africa" },
    { country: "Serbia", flag: "🇷🇸", capital: "Belgrade", lat: 44.8176, lon: 20.4633, pop: 1688667, continent: "Europe" },
    { country: "Seychelles", flag: "🇸🇨", capital: "Victoria", lat: -4.6191, lon: 55.4513, pop: 26450, continent: "Africa" },
    { country: "Sierra Leone", flag: "🇸🇱", capital: "Freetown", lat: 8.4697, lon: -13.2659, pop: 1055964, continent: "Africa" },
    { country: "Singapore", flag: "🇸🇬", capital: "Singapore", lat: 1.3521, lon: 103.8198, pop: 5453600, continent: "Asia" },
    { country: "Slovakia", flag: "🇸🇰", capital: "Bratislava", lat: 48.1486, lon: 17.1077, pop: 475503, continent: "Europe" },
    { country: "Slovenia", flag: "🇸🇮", capital: "Ljubljana", lat: 46.0569, lon: 14.5058, pop: 295504, continent: "Europe" },
    { country: "Solomon Islands", flag: "🇸🇧", capital: "Honiara", lat: -9.4333, lon: 159.9500, pop: 84520, continent: "Oceania" },
    { country: "Somalia", flag: "🇸🇴", capital: "Mogadishu", lat: 2.0469, lon: 45.3182, pop: 2587183, continent: "Africa" },
    { country: "South Africa", flag: "🇿🇦", capital: "Pretoria", lat: -25.7461, lon: 28.1881, pop: 2921488, continent: "Africa" },
    { country: "South Korea", flag: "🇰🇷", capital: "Seoul", lat: 37.5665, lon: 126.9780, pop: 9776000, continent: "Asia" },
    { country: "South Sudan", flag: "🇸🇸", capital: "Juba", lat: 4.8594, lon: 31.5713, pop: 1500000, continent: "Africa" },
    { country: "Spain", flag: "🇪🇸", capital: "Madrid", lat: 40.4168, lon: -3.7038, pop: 3223334, continent: "Europe" },
    { country: "Sri Lanka", flag: "🇱🇰", capital: "Sri Jayawardenepura Kotte", lat: 6.8935, lon: 79.9009, pop: 115826, continent: "Asia" },
    { country: "Sudan", flag: "🇸🇩", capital: "Khartoum", lat: 15.5007, lon: 32.5599, pop: 5274321, continent: "Africa" },
    { country: "Suriname", flag: "🇸🇷", capital: "Paramaribo", lat: 5.8520, lon: -55.2038, pop: 240924, continent: "South America" },
    { country: "Sweden", flag: "🇸🇪", capital: "Stockholm", lat: 59.3293, lon: 18.0686, pop: 975551, continent: "Europe" },
    { country: "Switzerland", flag: "🇨🇭", capital: "Bern", lat: 46.9480, lon: 7.4474, pop: 133791, continent: "Europe" },
    { country: "Syria", flag: "🇸🇾", capital: "Damascus", lat: 33.5102, lon: 36.2913, pop: 2503000, continent: "Asia" },
    { country: "Taiwan", flag: "🇹🇼", capital: "Taipei", lat: 25.0330, lon: 121.5654, pop: 2646204, continent: "Asia" },
    { country: "Tajikistan", flag: "🇹🇯", capital: "Dushanbe", lat: 38.5737, lon: 68.7738, pop: 863400, continent: "Asia" },
    { country: "Tanzania", flag: "🇹🇿", capital: "Dodoma", lat: -6.1730, lon: 35.7382, pop: 410956, continent: "Africa" },
    { country: "Thailand", flag: "🇹🇭", capital: "Bangkok", lat: 13.7563, lon: 100.5018, pop: 10539000, continent: "Asia" },
    { country: "Timor-Leste", flag: "🇹🇱", capital: "Dili", lat: -8.5569, lon: 125.5789, pop: 277279, continent: "Asia" },
    { country: "Togo", flag: "🇹🇬", capital: "Lomé", lat: 6.1375, lon: 1.2123, pop: 1477660, continent: "Africa" },
    { country: "Tonga", flag: "🇹🇴", capital: "Nuku'alofa", lat: -21.1393, lon: -175.2049, pop: 23661, continent: "Oceania" },
    { country: "Trinidad and Tobago", flag: "🇹🇹", capital: "Port of Spain", lat: 10.6596, lon: -61.5086, pop: 544000, continent: "North America" },
    { country: "Tunisia", flag: "🇹🇳", capital: "Tunis", lat: 36.8065, lon: 10.1815, pop: 2291185, continent: "Africa" },
    { country: "Turkey", flag: "🇹🇷", capital: "Ankara", lat: 39.9334, lon: 32.8597, pop: 5663322, continent: "Asia" },
    { country: "Turkmenistan", flag: "🇹🇲", capital: "Ashgabat", lat: 37.9601, lon: 58.3261, pop: 683000, continent: "Asia" },
    { country: "Tuvalu", flag: "🇹🇻", capital: "Funafuti", lat: -8.5211, lon: 179.1983, pop: 6025, continent: "Oceania" },
    { country: "Uganda", flag: "🇺🇬", capital: "Kampala", lat: 0.3476, lon: 32.5825, pop: 1659600, continent: "Africa" },
    { country: "Ukraine", flag: "🇺🇦", capital: "Kyiv", lat: 50.4501, lon: 30.5234, pop: 2967360, continent: "Europe" },
    { country: "United Arab Emirates", flag: "🇦🇪", capital: "Abu Dhabi", lat: 24.4539, lon: 54.3773, pop: 1483000, continent: "Asia" },
    { country: "United Kingdom", flag: "🇬🇧", capital: "London", lat: 51.5074, lon: -0.1278, pop: 9748000, continent: "Europe" },
    { country: "United States", flag: "🇺🇸", capital: "Washington D.C.", lat: 38.9072, lon: -77.0369, pop: 689545, continent: "North America" },
    { country: "Uruguay", flag: "🇺🇾", capital: "Montevideo", lat: -34.9011, lon: -56.1645, pop: 1381000, continent: "South America" },
    { country: "Uzbekistan", flag: "🇺🇿", capital: "Tashkent", lat: 41.2995, lon: 69.2401, pop: 2485900, continent: "Asia" },
    { country: "Vanuatu", flag: "🇻🇺", capital: "Port Vila", lat: -17.7333, lon: 168.3167, pop: 44040, continent: "Oceania" },
    { country: "Vatican City", flag: "🇻🇦", capital: "Vatican City", lat: 41.9029, lon: 12.4534, pop: 800, continent: "Europe" },
    { country: "Venezuela", flag: "🇻🇪", capital: "Caracas", lat: 10.4806, lon: -66.9036, pop: 2943000, continent: "South America" },
    { country: "Vietnam", flag: "🇻🇳", capital: "Hanoi", lat: 21.0285, lon: 105.8542, pop: 8053663, continent: "Asia" },
    { country: "Yemen", flag: "🇾🇪", capital: "Sana'a", lat: 15.3694, lon: 44.1910, pop: 2957000, continent: "Asia" },
    { country: "Zambia", flag: "🇿🇲", capital: "Lusaka", lat: -15.3875, lon: 28.3228, pop: 2731696, continent: "Africa" },
    { country: "Zimbabwe", flag: "🇿🇼", capital: "Harare", lat: -17.8252, lon: 31.0335, pop: 1542813, continent: "Africa" },
];

// Pre-build entities at module load time (static data, no fetch needed)
const CAPITAL_ENTITIES: GeoEntity[] = CAPITALS.map((c) => ({
    id: `capital-${c.country.replace(/\s+/g, "-").toLowerCase()}`,
    pluginId: "capitals",
    latitude: c.lat,
    longitude: c.lon,
    timestamp: new Date(0), // static
    label: `${c.flag} ${c.capital}`,
    properties: {
        country: c.country,
        flag: c.flag,
        capital: c.capital,
        population: c.pop,
        continent: c.continent,
    },
}));

class CapitalsPlugin implements WorldPlugin {
    id = "capitals";
    name = "World Capitals";
    description = "All 195 sovereign state capitals with flag emoji, population, and continent";
    icon = Star;
    category = "infrastructure" as const;
    version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> {}
    destroy(): void {}

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        return CAPITAL_ENTITIES;
    }

    getPollingInterval(): number {
        return 24 * 60 * 60_000; // once a day (static data, effectively never re-fetches)
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#fbbf24",
            iconUrl: STAR_ICON,
            clusterEnabled: true,
            clusterDistance: 25,
            maxEntities: 195,
        };
    }

    renderEntity(_entity: GeoEntity): CesiumEntityOptions {
        return {
            type: "billboard",
            iconUrl: STAR_ICON,
            iconScale: 0.65,
            color: "#fbbf24",
        };
    }
}

export const capitalsPlugin = new CapitalsPlugin();
