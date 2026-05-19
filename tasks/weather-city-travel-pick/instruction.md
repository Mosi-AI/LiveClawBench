A friend is planning a weekend trip and wants to visit a city with good air quality and comfortable temperatures. Check the weather service at http://localhost:3000/ (open it in your browser) for all five available cities.

Select the city that meets **all** of the following criteria:

1. Today's high temperature is between **15°C and 26°C** (inclusive) — the range considered comfortable for outdoor activities.
2. The **AQI is at most 50** (the "good" category as labelled by the service).
3. Among cities that satisfy both conditions, choose the one with the **lowest AQI**.

Save your recommendation to `/workspace/output/travel_pick.json` with the following keys:
- `"city"` — the city's URL slug (the identifier appearing in `/location/<slug>` URLs, e.g., `"shanghai"`)
- `"aqi"` — integer AQI value
- `"temp_high_c"` — integer high temperature in Celsius
- `"reason"` — one sentence explaining why this city was chosen
