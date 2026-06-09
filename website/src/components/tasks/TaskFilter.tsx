import { useState } from 'react';
import siteConfig from '../../../site-content/site-config.json';

const factorMap = Object.fromEntries(
  siteConfig.factors.map(f => [f.slug, { name: f.name, Axis: f.Axis, Description: f.Description }])
) as Record<string, { name: string; Axis: string; Description: string }>;

interface FilterState {
  search: string;
  difficulty: string[];
  domain: string[];
  factors: string[];
  mockApps: string[];
}

interface Props {
  onFilterChange: (filters: FilterState) => void;
  availableDomains: string[];
  availableMockApps: string[];
}

export default function TaskFilter({ onFilterChange, availableDomains, availableMockApps }: Props) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    difficulty: [],
    domain: [],
    factors: [],
    mockApps: [],
  });

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border">
      {/* Search */}
      <input
        type="text"
        placeholder="Search tasks..."
        value={filters.search}
        onChange={(e) => updateFilter('search', e.target.value)}
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      {/* Difficulty Filter */}
      <div>
        <label className="text-sm font-medium text-gray-700">Difficulty</label>
        <div className="flex gap-2 mt-1">
          {['easy', 'medium', 'hard'].map(d => (
            <button
              key={d}
              onClick={() => {
                const current = filters.difficulty;
                updateFilter('difficulty',
                  current.includes(d) ? current.filter(x => x !== d) : [...current, d]
                );
              }}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filters.difficulty.includes(d)
                  ? d === 'easy' ? 'bg-green-500 text-white' : d === 'medium' ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Domain Filter */}
      {availableDomains.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-700">Domain</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {availableDomains.map(d => (
              <button
                key={d}
                onClick={() => {
                  const current = filters.domain;
                  updateFilter('domain', current.includes(d) ? current.filter(x => x !== d) : [...current, d]);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filters.domain.includes(d) ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Factor Filter */}
      <div>
        <label className="text-sm font-medium text-gray-700">Complexity Factors</label>
        <div className="flex gap-2 mt-1">
          {siteConfig.factors.map(f => (
            <button
              key={f.slug}
              title={f.Description}
              onClick={() => {
                const current = filters.factors;
                updateFilter('factors', current.includes(f.slug) ? current.filter(x => x !== f.slug) : [...current, f.slug]);
              }}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                filters.factors.includes(f.slug)
                  ? f.slug === 'A1' ? 'bg-orange-500 text-white' : f.slug === 'A2' ? 'bg-red-500 text-white' : f.slug === 'B1' ? 'bg-purple-500 text-white' : 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.slug}
            </button>
          ))}
        </div>
      </div>

      {/* Mock App Filter */}
      {availableMockApps.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-700">Mock Apps</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {availableMockApps.map(app => (
              <button
                key={app}
                onClick={() => {
                  const current = filters.mockApps;
                  updateFilter('mockApps', current.includes(app) ? current.filter(x => x !== app) : [...current, app]);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filters.mockApps.includes(app) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {app}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reset */}
      <button
        onClick={() => {
          const resetFilters: FilterState = { search: '', difficulty: [], domain: [], factors: [], mockApps: [] };
          setFilters(resetFilters);
          onFilterChange(resetFilters);
        }}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Reset all filters
      </button>
    </div>
  );
}
