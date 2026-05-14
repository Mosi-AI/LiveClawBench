Please check the current air quality for Beijing using the local weather service at http://localhost:3000/.

Save the result to `/workspace/output/aqi_report.json` as a JSON object with the following keys:
- `"city"`: the city name in Chinese (北京)
- `"aqi"`: the AQI integer value
- `"category"`: the AQI category string

Example output format:
```json
{"city": "北京", "aqi": 75, "category": "moderate"}
```
