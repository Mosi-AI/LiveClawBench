import { useState, useMemo } from 'react';
import type { Task } from '../../data/types';
import siteConfig from '../../../site-content/site-config.json';
import { withBase } from '../../lib/urls';

interface Props {
  tasks: Task[];
}

type SortKey = 'name' | 'difficulty' | 'domain' | 'case_id';
type SortDir = 'asc' | 'desc';

const factorMap = Object.fromEntries(
  siteConfig.factors.map(f => [f.slug, { name: f.name, Axis: f.Axis, Description: f.Description }])
) as Record<string, { name: string; Axis: string; Description: string }>;

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const FACTOR_OPTIONS = [
  { value: '', label: 'All' },
  ...siteConfig.factors.map(f => ({ value: f.slug, label: `${f.slug}: ${f.name}` })),
];

const difficultyClass: Record<string, string> = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800',
};

const difficultyOrder: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

export default function TaskList({ tasks }: Props) {
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('search') || '';
    }
    return '';
  });
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [factorFilter, setFactorFilter] = useState('');
  const [mockAppFilter, setMockAppFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('case_id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Derive filter options from the actual task corpus so they always match
  // what the user can find. Hardcoded lists drift the moment a task is
  // added/renamed/removed.
  const domainOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const t of tasks) {
      if (t.domain) seen.add(t.domain);
      for (const d of t.domains_multi || []) {
        if (d) seen.add(d);
      }
    }
    return [
      { value: '', label: 'All' },
      ...[...seen].sort().map(d => ({ value: d, label: d })),
    ];
  }, [tasks]);

  const mockAppOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const t of tasks) {
      for (const m of t.mock_apps || []) {
        if (m) seen.add(m);
      }
    }
    return [
      { value: '', label: 'All' },
      ...[...seen].sort().map(m => ({ value: m, label: m })),
    ];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    // Search across case_id, name, description, instruction
    if (search) {
      const q = search.toLowerCase();
      const qNum = parseInt(q, 10);
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (!isNaN(qNum) && t.case_id === qNum) ||
        (t.description_en && t.description_en.toLowerCase().includes(q)) ||
        (t.description_zh && t.description_zh.toLowerCase().includes(q)) ||
        t.instruction.toLowerCase().includes(q)
      );
    }
    // Difficulty filter (single select)
    if (difficultyFilter) {
      result = result.filter(t => t.difficulty === difficultyFilter);
    }
    // Domain filter (single select)
    if (domainFilter) {
      result = result.filter(t => t.domain === domainFilter || t.domains_multi.includes(domainFilter));
    }
    // Factor filter (single select)
    if (factorFilter) {
      result = result.filter(t => t.factors[factorFilter as keyof typeof t.factors]);
    }
    // Mock app filter (single select)
    if (mockAppFilter) {
      result = result.filter(t => t.mock_apps.includes(mockAppFilter));
    }
    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === 'difficulty') {
        cmp = (difficultyOrder[a.difficulty] || 0) - (difficultyOrder[b.difficulty] || 0);
      } else if (sortKey === 'domain') {
        cmp = a.domain.localeCompare(b.domain);
      } else {
        cmp = a.case_id - b.case_id;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [tasks, search, difficultyFilter, domainFilter, factorFilter, mockAppFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'case_id' ? 'asc' : 'asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => (
    <span className="ml-1 text-xs">
      {sortKey === column ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  const resetFilters = () => {
    setSearch('');
    setDifficultyFilter('');
    setDomainFilter('');
    setFactorFilter('');
    setMockAppFilter('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search by task name, description, or instruction..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      {/* Filter Row - Single Select Dropdowns */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Difficulty */}
        <select
          value={difficultyFilter}
          onChange={(e) => { setDifficultyFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {DIFFICULTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label === 'All' ? 'Difficulty: All' : o.label}</option>)}
        </select>

        {/* Domain */}
        <select
          value={domainFilter}
          onChange={(e) => { setDomainFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {domainOptions.map(o => <option key={o.value} value={o.value}>{o.label === 'All' ? 'Domain: All' : o.label}</option>)}
        </select>

        {/* Factor */}
        <select
          value={factorFilter}
          onChange={(e) => { setFactorFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {FACTOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label === 'All' ? 'Factor: All' : o.label}</option>)}
        </select>

        {/* Mock App */}
        <select
          value={mockAppFilter}
          onChange={(e) => { setMockAppFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {mockAppOptions.map(o => <option key={o.value} value={o.value}>{o.label === 'All' ? 'Mock App: All' : o.label}</option>)}
        </select>

        {/* Reset */}
        <button onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-700 underline">
          Reset
        </button>

        {/* Results count */}
        <span className="text-sm text-gray-400 ml-auto">{filteredTasks.length} tasks</span>
      </div>

      {/* Table */}
      <div>
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="border-b bg-gray-50">
              <th onClick={() => toggleSort('case_id')} className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 break-words" style={{width: '50px'}}>
                ID <SortIcon column="case_id" />
              </th>
              <th onClick={() => toggleSort('name')} className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 break-words" style={{width: '15%'}}>
                Name <SortIcon column="name" />
              </th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-700 break-words" style={{width: '25%'}}>
                Description
              </th>
              <th onClick={() => toggleSort('difficulty')} className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 break-words" style={{width: '65px'}}>
                Difficulty <SortIcon column="difficulty" />
              </th>
              <th onClick={() => toggleSort('domain')} className="px-2 py-3 text-left text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 break-words" style={{width: '12%'}}>
                Domain <SortIcon column="domain" />
              </th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-700 break-words" style={{width: '8%'}}>
                Factors
              </th>
              <th className="px-2 py-3 text-left text-xs font-medium text-gray-700 break-words" style={{width: '12%'}}>
                Mock Apps
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedTasks.map(task => {
              const activeFactors = Object.entries(task.factors)
                .filter(([_, v]) => v)
                .map(([k]) => k);
              return (
                <tr
                  key={task.name}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="px-2 py-2 text-xs text-gray-500">{task.case_id}</td>
                  <td className="px-2 py-2 text-xs">
                    <a href={withBase(`/tasks/${task.name}`)} className="font-medium text-primary-600 hover:text-primary-700 hover:underline break-words">
                      {task.name}
                    </a>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-500 break-words line-clamp-2">
                    {task.description_en || task.instruction}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${difficultyClass[task.difficulty] || 'bg-gray-100 text-gray-800'}`}>
                      {task.difficulty}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 break-words">{task.domain}</td>
                  <td className="px-2 py-2 text-xs">
                    <div className="flex flex-wrap gap-0.5">
                      {activeFactors.map(f => (
                        <span className={`px-1 py-0.5 rounded text-xs ${
                          f === 'A1' ? 'bg-orange-50 text-orange-700' :
                          f === 'A2' ? 'bg-red-50 text-red-700' :
                          f === 'B1' ? 'bg-purple-50 text-purple-700' :
                          f === 'B2' ? 'bg-green-50 text-green-700' :
                          f === 'C1' ? 'bg-cyan-50 text-cyan-700' :
                          'bg-blue-50 text-blue-700'
                        }`} title={factorMap[f]?.Description || ''}>{f}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {task.mock_apps.map(app => (
                        <a
                          key={app}
                          href={withBase(`/mocks/${app}`)}
                          className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {app}
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {paginatedTasks.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>No tasks match your filters.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                page === currentPage ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {page}
            </button>
          ))}
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
