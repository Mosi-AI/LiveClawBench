import type { Database } from "bun:sqlite";

const SEED_TODOS = [
  { title: "Team meeting", date: "2026-03-10", time: "09:00", location: "Office", person: "Team", description: "Review agenda before meeting" },
  { title: "Project deadline", date: "2026-03-12", time: "17:00", location: "Office", person: "Boss", description: "Priority: high" },
  { title: "Code review", date: "2026-03-11", time: "14:00", location: "Conference Room A", person: "Sarah Johnson", description: "Bring laptop and notebook" },
  { title: "Client call", date: "2026-03-13", time: "10:30", location: "Online/Remote", person: "Client", description: "Prepare all necessary documents" },
  { title: "Sprint planning", date: "2026-03-17", time: "09:00", location: "Office", person: "Team", description: "One-time task" },
  { title: "Documentation update", date: "2026-03-14", time: null, location: "Home", person: null, description: "Priority: medium" },
  { title: "Bug fix", date: "2026-03-15", time: "11:00", location: "Office", person: "Mike Brown", description: "Priority: high" },
  { title: "Feature implementation", date: "2026-03-18", time: "13:00", location: "Office", person: "Chris Wilson", description: "Requires travel" },
  { title: "Performance review", date: "2026-03-20", time: "15:00", location: "Conference Room B", person: "David Lee", description: "Dress code: business casual" },
  { title: "Training session", date: "2026-03-21", time: "09:30", location: "School", person: "Team", description: "Confirm attendance 24 hours prior" },
  { title: "Grocery shopping", date: "2026-03-08", time: "18:00", location: "Mall", person: "Family", description: "One-time task" },
  { title: "Doctor appointment", date: "2026-03-09", time: "10:00", location: "Hospital", person: null, description: "Bring insurance card" },
  { title: "Gym session", date: "2026-03-10", time: "07:00", location: "Gym", person: null, description: "Recurring task" },
  { title: "Call mom", date: "2026-03-11", time: null, location: "Home", person: "Family", description: null },
  { title: "Pay bills", date: "2026-03-15", time: null, location: "Home", person: null, description: "Priority: high" },
  { title: "Car maintenance", date: "2026-03-22", time: "08:00", location: "Downtown", person: null, description: "Reservation confirmed" },
  { title: "Home cleaning", date: "2026-03-16", time: null, location: "Home", person: null, description: "Priority: low" },
  { title: "Laundry", date: "2026-03-17", time: null, location: "Home", person: null, description: "Recurring task" },
  { title: "Haircut appointment", date: "2026-03-19", time: "16:00", location: "Downtown", person: null, description: null },
  { title: "Dentist visit", date: "2026-03-23", time: "11:00", location: "Hospital", person: null, description: "Follow up on previous discussion" },
  { title: "Birthday party", date: "2026-03-25", time: "19:00", location: "Restaurant", person: "Friends", description: "Dress code: casual" },
  { title: "Anniversary dinner", date: "2026-03-26", time: "20:00", location: "Restaurant", person: "Family", description: "Reservation confirmed" },
  { title: "Conference", date: "2026-03-27", time: "09:00", location: "Conference Room A", person: "Team", description: "Bring laptop and notebook" },
  { title: "Networking event", date: "2026-03-28", time: "18:00", location: "Downtown", person: "Client", description: "Prepare all necessary documents" },
  { title: "Concert", date: "2026-03-29", time: "20:00", location: "Park", person: "Friends", description: "Childcare arranged" },
  { title: "Review contract", date: "2026-03-30", time: "10:00", location: "Office", person: "Client", description: "Priority: high" },
  { title: "Submit application", date: "2026-03-31", time: null, location: "Online/Remote", person: null, description: "Priority: medium" },
  { title: "Return library books", date: "2026-03-07", time: null, location: "Library", person: null, description: "One-time task" },
  { title: "Organize files", date: "2026-03-24", time: null, location: "Office", person: null, description: "Priority: low" },
  { title: "Backup data", date: "2026-04-01", time: "22:00", location: "Home", person: null, description: "Recurring task" },
];

export function seedDatabase(db: Database): void {
  const stmt = db.query(
    `INSERT INTO todos (title, date, time, location, person, description)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const todo of SEED_TODOS) {
    stmt.run(todo.title, todo.date, todo.time, todo.location, todo.person, todo.description);
  }
}
