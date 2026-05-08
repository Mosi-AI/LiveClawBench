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

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextSunday(): string {
  const today = new Date();
  // Python weekday(): 0=Mon, 6=Sun
  const pyWeekday = (today.getDay() + 6) % 7;
  const daysUntilSunday = 6 - pyWeekday;
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + daysUntilSunday);
  return formatLocalDate(sunday);
}

function getTodayPlus(days: number): string {
  const today = new Date();
  const date = new Date(today);
  date.setDate(today.getDate() + days);
  return formatLocalDate(date);
}

function getTaskSpecificTodos(taskName: string): Array<{
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  person: string | null;
  description: string | null;
}> {
  switch (taskName) {
    case "schedule-change-request": {
      const sunday = getNextSunday();
      return [
        {
          title: "Game party w/ my old friends",
          date: sunday,
          time: "10:00",
          location: "Mary's house",
          person: "Mary Grande, Gary Alexander",
          description: "Play Super Mario Party. Contact Mary via email: marytheshot@gmail.com",
        },
        {
          title: "Morning run",
          date: sunday,
          time: "7:00",
          location: "Lakeside Forest Park",
          person: "Dr. Jason Wang",
          description: "First, run 7km in the park, then discuss our paper ideas. Contact him via email: jason.wang97@mail.ucsd.edu.",
        },
        {
          title: "Book club meeting",
          date: sunday,
          time: "19:00",
          location: "Conference Room A, 9th Floor, School Library",
          person: "Prakash Nath, founder of the book club",
          description: "For registration inquiries, contact the assistant administrator: karre8523@outlook.com",
        },
      ];
    }
    case "flight-info-change-notice": {
      const date = getTodayPlus(2);
      return [
        {
          title: "Game party w/ my old friends",
          date,
          time: "17:40",
          location: "Los Angeles Union Station",
          person: "Mary Grande",
          description: "Meeting mary. Contact her via email: marytheshot@gmail.com",
        },
      ];
    }
    default:
      return [];
  }
}

export function seedDatabase(db: Database, taskName?: string): void {
  const effectiveTaskName = taskName ?? process.env.TASK_NAME ?? "";

  // Skip if baseline todos already exist (handles container restart and
  // cross-app containers where seed may have been called already)
  const existingCount = Number(
    (db.query("SELECT COUNT(*) as count FROM todos").get() as { count: number }).count
  );
  if (existingCount > 0) {
    return;
  }

  const stmt = db.query(
    `INSERT INTO todos (title, date, time, location, person, description)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const todo of SEED_TODOS) {
    stmt.run(todo.title, todo.date, todo.time, todo.location, todo.person, todo.description);
  }

  // Inject task-specific manual todos
  const taskTodos = getTaskSpecificTodos(effectiveTaskName);
  for (const todo of taskTodos) {
    stmt.run(todo.title, todo.date, todo.time, todo.location, todo.person, todo.description);
  }
}
