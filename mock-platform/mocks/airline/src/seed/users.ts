import type { Database } from "bun:sqlite";
import { generateWerkzeugHashSync } from "../helpers";

export function createUsers(db: Database, taskMode: boolean): number[] {
  const users = taskMode
    ? [
        { email: "peter.griffin@work.mosi.inc", password: "password123", first_name: "Peter", last_name: "Griffin", phone: "+1-555-0100", dob: "1975-04-12" },
        { email: "john.doe@email.com", password: "password123", first_name: "John", last_name: "Doe", phone: "+1-555-0101", dob: "1988-06-15" },
        { email: "jane.smith@email.com", password: "password123", first_name: "Jane", last_name: "Smith", phone: "+1-555-0102", dob: "1990-03-22" },
        { email: "mike.johnson@email.com", password: "password123", first_name: "Mike", last_name: "Johnson", phone: "+1-555-0103", dob: "1985-11-08" },
        { email: "sarah.williams@email.com", password: "password123", first_name: "Sarah", last_name: "Williams", phone: "+1-555-0104", dob: "1992-09-30" },
        { email: "david.brown@email.com", password: "password123", first_name: "David", last_name: "Brown", phone: "+1-555-0105", dob: "1980-01-18" },
      ]
    : [
        { email: "peter.griffin@work.mosi.inc", password: "password123", first_name: "Peter", last_name: "Griffin", phone: "+1-555-0100", dob: "1975-04-12" },
      ];

  const ids: number[] = [];
  for (const u of users) {
    ids.push(Number(db.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, phone, date_of_birth, is_verified, is_active) VALUES (?, ?, ?, ?, ?, ?, 1, 1)"
    ).run(u.email, generateWerkzeugHashSync(u.password), u.first_name, u.last_name, u.phone, u.dob).lastInsertRowid));
  }
  return ids;
}
