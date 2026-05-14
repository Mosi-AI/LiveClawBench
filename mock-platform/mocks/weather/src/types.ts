export interface Location {
  id: number;
  slug: string;
  display_name: string;
  timezone_label: string;
}

export interface WeatherDaily {
  id: number;
  location_id: number;
  valid_date: string;
  condition_text: string;
  temp_high_c: number;
  temp_low_c: number;
  precip_mm: number;
  wind_dir: string;
  wind_speed_kmh: number;
  uv_index: number;
}

export interface WeatherHourly {
  id: number;
  location_id: number;
  valid_date: string;
  hour: number;
  temp_c: number;
  feels_like_c: number;
  condition_text: string;
  precip_mm: number;
  humidity: number;
  cloud_cover: number;
}

export interface AirQualitySnapshot {
  id: number;
  location_id: number;
  observed_at: string;
  aqi: number;
  category: string;
  summary_text: string;
}

export interface HealthActivityTip {
  id: number;
  location_id: number;
  valid_date: string;
  tip_title: string;
  tip_body: string;
}
