import { useEffect, useRef } from 'react';
import type { LeaderboardEntry } from '../../data/types';

interface Props {
  data: LeaderboardEntry[];
}

export default function ScoreChart({ data }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    // Simple bar chart using CSS (no ECharts dependency required for static build)
    const container = chartRef.current;
    container.innerHTML = '';

    const title = document.createElement('h3');
    title.className = 'text-sm font-medium text-gray-700 mb-4';
    title.textContent = 'Overall Score Comparison';
    container.appendChild(title);

    const maxScore = Math.max(...data.map(d => d.overall));

    data.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-3 mb-2';

      const label = document.createElement('span');
      label.className = 'text-xs text-gray-600 w-28 truncate text-right';
      label.textContent = entry.model;
      row.appendChild(label);

      const barContainer = document.createElement('div');
      barContainer.className = 'flex-1 bg-gray-100 rounded-full h-6 relative';

      const bar = document.createElement('div');
      bar.className = 'h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-500';
      bar.style.width = `${(entry.overall / maxScore) * 100}%`;
      bar.style.backgroundColor = entry.rank === 1 ? '#f59e0b' : entry.rank === 2 ? '#9ca3af' : entry.rank === 3 ? '#d97706' : '#3b82f6';

      const scoreLabel = document.createElement('span');
      scoreLabel.className = 'text-xs text-white font-medium';
      scoreLabel.textContent = `${entry.overall}`;
      bar.appendChild(scoreLabel);

      barContainer.appendChild(bar);
      row.appendChild(barContainer);
      container.appendChild(row);
    });
  }, [data]);

  return <div ref={chartRef} className="p-4" />;
}
