import type { LeaderboardData, LeaderboardEntry } from './types';
import leaderboardData from '../../site-data/leaderboard.json';

/** Infer provider from model name prefix (case-insensitive) */
function inferProvider(modelName: string): string {
  const lower = modelName.toLowerCase();
  if (lower.startsWith('qwen')) return 'Alibaba';
  if (lower.startsWith('minimax')) return 'MiniMax';
  if (lower.startsWith('glm')) return 'Zhipu';
  if (lower.startsWith('deepseek')) return 'DeepSeek';
  return '';
}

/** Enrich leaderboard entries with inferred provider if missing */
function enrichWithProvider(data: LeaderboardData): LeaderboardData {
  return {
    ...data,
    models: data.models.map(m => ({
      ...m,
      provider: m.provider || inferProvider(m.model),
    })),
  };
}

const data = enrichWithProvider(leaderboardData as unknown as LeaderboardData);

/** Get full leaderboard data */
export function getLeaderboardData(): LeaderboardData {
  return data;
}

/** Get top N models */
export function getTopModels(n: number): LeaderboardData['models'] {
  return data.models.slice(0, n);
}
