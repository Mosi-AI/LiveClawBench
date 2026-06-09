import { useState } from 'react';

interface FilterState {
  search: string;
  view: 'overall' | 'difficulty' | 'factor' | 'domain';
}

interface Props {
  onFilterChange: (filters: FilterState) => void;
}

export default function FilterPanel({ onFilterChange }: Props) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    view: 'overall',
  });

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const reset = () => {
    const resetFilters: FilterState = { search: '', view: 'overall' };
    setFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const viewOptions: { key: FilterState['view']; label: string }[] = [
    { key: 'overall', label: 'Overall' },
    { key: 'difficulty', label: 'Difficulty' },
    { key: 'factor', label: 'Factor' },
    { key: 'domain', label: 'Domain' },
  ];

  return (
    <div className="space-y-4">
      {/* Search & Reset */}
      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search models..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="px-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">
          Reset
        </button>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2">
        {viewOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => updateFilter('view', opt.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filters.view === opt.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
