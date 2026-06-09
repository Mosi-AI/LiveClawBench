import type { MockApp } from './types';
import mockAppsData from '../../site-data/mock-apps.json';
import { getAllTasks } from './tasks';

/** Build MockApp list with computed tasksCount and usedByTasks */
function buildMockApps(): MockApp[] {
  const tasks = getAllTasks();
  return mockAppsData.mockApps.map(app => {
    const usedByTasks = tasks
      .filter(t => t.mock_apps.includes(app.id))
      .map(t => t.name);
    return {
      ...app,
      tasksCount: usedByTasks.length,
      usedByTasks,
    } as MockApp;
  });
}

/** Get all mock apps */
export function getAllMockApps(): MockApp[] {
  return buildMockApps();
}

/** Get a mock app by its ID */
export function getMockAppById(id: string): MockApp | undefined {
  return buildMockApps().find(a => a.id === id);
}
