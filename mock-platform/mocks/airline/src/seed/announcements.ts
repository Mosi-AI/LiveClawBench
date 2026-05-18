import type { Database } from "bun:sqlite";

export function createAnnouncements(db: Database): void {
  const announcements = [
    { title: "New Route Announcement", content: "We are excited to announce new routes to Europe starting next month.", category: "general", priority: "high", expires_at: null },
    { title: "Summer Sale", content: "Book your summer vacation now and save up to 30% on selected routes.", category: "promotion", priority: "high", expires_at: null },
    { title: "Baggage Policy Update", content: "Updated baggage policies effective immediately. Check our website for details.", category: "policy", priority: "normal", expires_at: null },
    { title: "COVID-19 Guidelines", content: "Please follow updated health and safety guidelines during your travel.", category: "safety", priority: "high", expires_at: null },
    { title: "Loyalty Program", content: "Join our new loyalty program and earn points on every flight.", category: "promotion", priority: "normal", expires_at: null },
    { title: "Mobile App Update", content: "Download our updated mobile app for a better booking experience.", category: "general", priority: "low", expires_at: null },
  ];

  for (const a of announcements) {
    db.query(
      "INSERT INTO announcements (title, content, category, priority, expires_at) VALUES (?, ?, ?, ?, ?)"
    ).run(a.title, a.content, a.category, a.priority, a.expires_at);
  }
}

export function createFaqs(db: Database): void {
  const faqs = [
    { question: "How do I book a flight?", answer: "You can book a flight through our website or mobile app.", category: "booking", display_order: 1 },
    { question: "What is your baggage policy?", answer: "Economy passengers can check one bag up to 23kg.", category: "baggage", display_order: 2 },
    { question: "How do I cancel my booking?", answer: "You can cancel your booking through the 'My Bookings' section.", category: "booking", display_order: 3 },
    { question: "How do I file a claim?", answer: "Submit a claim through our claims portal with your booking reference.", category: "claims", display_order: 4 },
    { question: "What is your refund policy?", answer: "Refunds depend on your ticket type and cancellation timing.", category: "booking", display_order: 5 },
  ];

  for (const f of faqs) {
    db.query(
      "INSERT INTO faqs (question, answer, category, display_order) VALUES (?, ?, ?, ?)"
    ).run(f.question, f.answer, f.category, f.display_order);
  }
}
