import type { OpenAPIApp } from "mock-lib";
import { ok } from "../helpers";

const RESTAURANTS = [
  { id: 1, name: "Sky Bistro", cuisine: "International", location: "Terminal 1, Gate A", rating: 4.5, price_range: "$$$", hours: "06:00 - 22:00" },
  { id: 2, name: "Sushi Bar", cuisine: "Japanese", location: "Terminal 2, Gate B", rating: 4.7, price_range: "$$", hours: "11:00 - 21:00" },
  { id: 3, name: "Pasta Palace", cuisine: "Italian", location: "Terminal 1, Food Court", rating: 4.2, price_range: "$$", hours: "07:00 - 23:00" },
  { id: 4, name: "Burger Joint", cuisine: "American", location: "Terminal 3, Gate C", rating: 3.9, price_range: "$", hours: "05:00 - 00:00" },
  { id: 5, name: "Green Leaf", cuisine: "Vegetarian", location: "Terminal 2, Gate D", rating: 4.4, price_range: "$$", hours: "08:00 - 20:00" },
];

const AIRPORT_INFO = {
  name: "GKD International Airport",
  code: "GKD",
  location: "New York, USA",
  terminals: ["Terminal 1", "Terminal 2", "Terminal 3", "Terminal 4"],
  facilities: ["WiFi", "Lounges", "Duty Free", "Car Rental", "Parking"],
  contact: { phone: "+1-555-AIRPORT", email: "info@gkdairport.com" },
};

export function registerInfoRoutes(app: OpenAPIApp): void {
  // GET /api/info/restaurant
  app.get("/api/info/restaurant", (c) => {
    return c.json(ok({ restaurants: RESTAURANTS }));
  });

  // GET /api/info/airport
  app.get("/api/info/airport", (c) => {
    return c.json(ok({ airport_info: AIRPORT_INFO }));
  });
}
