import { useState, useMemo } from 'react';

interface TrajectoryRow {
  sample_id: string;
  model_name: string;
  case_id: number;
  ability_category: string;
  case_name: string;
  difficulty: string;
  domain: string;
  domains_multi: string;
  complexity_factor: string[];
  step_count: number;
}

interface Props {
  rows: TrajectoryRow[];
  modelNames: string[];
}

// Field definitions with descriptions and usage for tooltips
const FIELD_INFO: Record<string, { desc: string; usage: string }> = {
  sample_id: { desc: 'Unique trajectory identifier', usage: 'Unique ID for each trajectory' },
  model_name: { desc: 'Model name used for this trajectory run', usage: 'Filter by model to compare performance' },
  case_id: { desc: 'Task case number', usage: 'Task case number' },
  case_name: { desc: 'Task name (case slug)', usage: 'Task name identifier' },
  difficulty: { desc: 'Difficulty level: E=Easy, M=Medium, H=Hard', usage: 'Filter by difficulty to analyze complexity' },
  domain: { desc: 'Primary domain of the task', usage: 'Domain distribution & analysis' },
  domains_multi: { desc: 'Multi-domain info for cross-domain tasks', usage: 'Cross-domain task display' },
  ability_category: { desc: 'Ability category of the task', usage: 'Ability classification & analysis' },
  complexity_factor: { desc: 'Complexity factors (A1/A2/B1/B2/C1/C2)', usage: 'Complexity factor analysis' },
  trajectory: { desc: 'ATIF-v1.2 trajectory JSON', usage: 'Step count, tool calls, tokens, behavior analysis' },
};

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'E', label: 'Easy (E)' },
  { value: 'M', label: 'Medium (M)' },
  { value: 'H', label: 'Hard (H)' },
];

const difficultyClass: Record<string, string> = {
  E: 'bg-green-100 text-green-800',
  M: 'bg-yellow-100 text-yellow-800',
  H: 'bg-red-100 text-red-800',
};

const difficultyLabel: Record<string, string> = {
  E: 'Easy',
  M: 'Medium',
  H: 'Hard',
};

const factorColorMap: Record<string, string> = {
  A1: 'bg-orange-50 text-orange-700',
  A2: 'bg-red-50 text-red-700',
  B1: 'bg-purple-50 text-purple-700',
  B2: 'bg-green-50 text-green-700',
  C1: 'bg-cyan-50 text-cyan-700',
  C2: 'bg-blue-50 text-blue-700',
};

export default function TrajectoryTable({ rows, modelNames }: Props) {
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('case') || params.get('search') || '';
    }
    return '';
  });
  const [modelFilter, setModelFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const filteredRows = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.sample_id.toLowerCase().includes(q) ||
        r.case_name.toLowerCase().includes(q) ||
        r.domain.toLowerCase().includes(q) ||
        r.ability_category.toLowerCase().includes(q) ||
        String(r.case_id).includes(q)
      );
    }
    if (modelFilter) {
      result = result.filter(r => r.model_name === modelFilter);
    }
    if (difficultyFilter) {
      result = result.filter(r => r.difficulty === difficultyFilter);
    }
    return result;
  }, [rows, search, modelFilter, difficultyFilter]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => {
    setSearch('');
    setModelFilter('');
    setDifficultyFilter('');
    setCurrentPage(1);
  };

  // Generate page numbers with ellipsis for large page counts
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search by sample_id, case_name, domain, case_id..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Model filter */}
        <select
          value={modelFilter}
          onChange={(e) => { setModelFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Model: All</option>
          {modelNames.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* Difficulty filter */}
        <select
          value={difficultyFilter}
          onChange={(e) => { setDifficultyFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {DIFFICULTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label === 'All' ? 'Difficulty: All' : o.label}</option>)}
        </select>

        {/* Reset */}
        <button onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-700 underline">
          Reset
        </button>

        {/* Results count */}
        <span className="text-sm text-gray-400 ml-auto">
          {filteredRows.length} of {rows.length} trajectories
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th
                className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-help"
                style={{ minWidth: '180px' }}
                title={`${FIELD_INFO.sample_id.desc}\nUsage: ${FIELD_INFO.sample_id.usage}`}
              >
                sample_id
              </th>
              <th
                className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-help"
                style={{ minWidth: '120px' }}
                title={`${FIELD_INFO.model_name.desc}\nUsage: ${FIELD_INFO.model_name.usage}`}
              >
                model_name
              </th>
              <th
                className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-help"
                style={{ minWidth: '60px' }}
                title={`${FIELD_INFO.case_id.desc}\nUsage: ${FIELD_INFO.case_id.usage}`}
              >
                case_id
              </th>
              <th
                className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-help"
                style={{ minWidth: '150px' }}
                title={`${FIELD_INFO.case_name.desc}\nUsage: ${FIELD_INFO.case_name.usage}`}
              >
                case_name
              </th>
              <th
                className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-help"
                style={{ minWidth: '70px' }}
                title={`${FIELD_INFO.difficulty.desc}\nUsage: ${FIELD_INFO.difficulty.usage}`}
              >
                difficulty
              </th>
              <th
                className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-help"
                style={{ minWidth: '120px' }}
                title={`${FIELD_INFO.domain.desc}\nUsage: ${FIELD_INFO.domain.usage}`}
              >
                domain
              </th>
              <th
                className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-help"
                style={{ minWidth: '100px' }}
                title={`${FIELD_INFO.ability_category.desc}\nUsage: ${FIELD_INFO.ability_category.usage}`}
              >
                ability_category
              </th>
              <th
                className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-help"
                style={{ minWidth: '80px' }}
                title={`${FIELD_INFO.complexity_factor.desc}\nUsage: ${FIELD_INFO.complexity_factor.usage}`}
              >
                complexity_factor
              </th>
              <th
                className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-help"
                style={{ minWidth: '60px' }}
                title={`${FIELD_INFO.trajectory.desc}\nUsage: ${FIELD_INFO.trajectory.usage}`}
              >
                steps
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map(row => {
              const stepCount = row.step_count;
              return (
                <tr key={row.sample_id} className="border-b hover:bg-gray-50">
                  {/* sample_id */}
                  <td className="px-2 py-2 text-xs text-gray-700 break-all">
                    <a href={`/data/${row.sample_id}`} className="text-primary-600 hover:underline hover:text-primary-700">
                      {row.sample_id}
                    </a>
                  </td>
                  {/* model_name */}
                  <td className="px-2 py-2 text-xs text-gray-700">{row.model_name}</td>
                  {/* case_id */}
                  <td className="px-2 py-2 text-xs text-gray-700">{row.case_id}</td>
                  {/* case_name */}
                  <td className="px-2 py-2 text-xs text-gray-700">{row.case_name}</td>
                  {/* difficulty */}
                  <td className="px-2 py-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${difficultyClass[row.difficulty] || 'bg-gray-100 text-gray-800'}`}>
                      {row.difficulty}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">{difficultyLabel[row.difficulty] || ''}</span>
                  </td>
                  {/* domain */}
                  <td className="px-2 py-2 text-xs text-gray-600">{row.domain}</td>
                  {/* ability_category */}
                  <td className="px-2 py-2 text-xs text-gray-500">{row.ability_category}</td>
                  {/* complexity_factor */}
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-0.5">
                      {(row.complexity_factor || []).map((f: string) => (
                        <span
                          key={f}
                          className={`px-1 py-0.5 rounded text-xs ${factorColorMap[f] || 'bg-gray-50 text-gray-700'}`}
                        >
                          {f}
                        </span>
                      ))}
                      {(!row.complexity_factor || row.complexity_factor.length === 0) && (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  </td>
                  {/* steps count (from trajectory) */}
                  <td className="px-2 py-2 text-xs text-gray-500">
                    {stepCount !== null ? stepCount : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {paginatedRows.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>No trajectories match your filters.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            ← Prev
          </button>
          {getPageNumbers().map((page, idx) =>
            typeof page === 'string' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  page === currentPage ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {page}
              </button>
            )
          )}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
