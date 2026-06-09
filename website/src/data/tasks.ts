import type { Task } from './types';
import tasksData from '../../site-data/tasks.json';

const tasks: Task[] = tasksData.tasks as Task[];

/** Get all tasks */
export function getAllTasks(): Task[] {
  return tasks;
}

/** Get a task by its name */
export function getTaskByName(name: string): Task | undefined {
  return tasks.find(t => t.name === name);
}

/** Get tasks filtered by difficulty */
export function getTasksByDifficulty(difficulty: string): Task[] {
  return tasks.filter(t => t.difficulty === difficulty);
}

/** Get tasks that use a specific mock app */
export function getTasksByMockApp(mockId: string): Task[] {
  return tasks.filter(t => t.mock_apps.includes(mockId));
}

/** Get tasks that have a specific factor enabled */
export function getTasksByFactor(factor: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'): Task[] {
  return tasks.filter(t => t.factors[factor]);
}

/** Get all unique domains across tasks */
export function getAllDomains(): string[] {
  return [...new Set(tasks.map(t => t.domain))];
}

/** Get all unique mock app IDs across tasks */
export function getAllMockAppIds(): string[] {
  return [...new Set(tasks.flatMap(t => t.mock_apps))];
}
