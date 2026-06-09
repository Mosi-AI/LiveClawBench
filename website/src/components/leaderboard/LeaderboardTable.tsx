import { useState, useMemo, useEffect } from 'react';
import type { LeaderboardEntry } from '../../data/types';
import siteConfig from '../../../site-content/site-config.json';

const factorMap = Object.fromEntries(
  siteConfig.factors.map(f => [f.slug, { name: f.name, Axis: f.Axis, Description: f.Description }])
) as Record<string, { name: string; Axis: string; Description: string }>;

interface Props {
  data: LeaderboardEntry[];
}

type ViewMode = 'overall' | 'difficulty' | 'factor' | 'domain';

export default function LeaderboardTable({ data }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [view, setView] = useState<ViewMode>('overall');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const getSortValue = (entry: LeaderboardEntry, key: string): number => {
    if (key === 'rank') return entry.rank;
    if (key === 'overall') return entry.overall;
    if (key === 'bestScore') return entry.bestScore ?? 0;
    if (key === 'easy') return entry.difficulty.easy;
    if (key === 'medium') return entry.difficulty.medium;
    if (key === 'hard') return entry.difficulty.hard;
    if (key === 'A1') return entry.factors.A1;
    if (key === 'A2') return entry.factors.A2;
    if (key === 'B1') return entry.factors.B1;
    if (key === 'B2') return entry.factors.B2;
    if (key === 'C1') return entry.factors.C1;
    if (key === 'C2') return entry.factors.C2;
    if (key === 'runs') return entry.runs;
    if (key === 'coverage') return entry.coverage;
    if (key.startsWith('domain:')) {
      const domainKey = key.slice(7);
      return entry.domains[domainKey] ?? 0;
    }
    return entry.rank;
  };

  const filteredData = useMemo(() => {
    let result = data;
    if (search) {
      result = result.filter(entry =>
        entry.model.toLowerCase().includes(search.toLowerCase()) ||
        (entry.provider || '').toLowerCase().includes(search.toLowerCase())
      );
    }
    result = [...result].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [data, search, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'rank' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => (
    <span className="ml-1 text-xs">
      {sortKey === column ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  const viewTabs: { key: ViewMode; label: string }[] = [
    { key: 'overall', label: 'Overall' },
    { key: 'difficulty', label: 'Difficulty' },
    { key: 'factor', label: 'Factor' },
    { key: 'domain', label: 'Domain' },
  ];

  const domainKeys = useMemo(() => {
    const keys = new Set<string>();
    data.forEach(entry => {
      Object.keys(entry.domains).forEach(k => keys.add(k));
    });
    return [...keys];
  }, [data]);

  // ─── Mobile: Card-based layout ────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Search */}
        <input
          type="text"
          placeholder="Search models..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />

        {/* View Tabs – scrollable on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {viewTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                view === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Card List */}
        <div className="space-y-3">
          {filteredData.map((entry) => (
            <div
              key={entry.model}
              className="border rounded-lg bg-white shadow-sm overflow-hidden"
            >
              {/* Card Header – always visible */}
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-3"
                onClick={() => setExpandedRow(expandedRow === entry.model ? null : entry.model)}
              >
                {/* Rank */}
                {entry.rank <= 3 ? (
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                    entry.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                    entry.rank === 2 ? 'bg-gray-200 text-gray-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {entry.rank}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 w-6 text-center shrink-0">{entry.rank}</span>
                )}

                {/* Model + Provider */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{entry.model}</div>
                  {entry.provider && (
                    <div className="text-xs text-gray-400 truncate">{entry.provider}</div>
                  )}
                </div>

                {/* Overall score badge */}
                <span className="text-sm font-bold text-primary-700 shrink-0">{entry.overall.toFixed(1)}</span>

                {/* Expand chevron */}
                <span className="text-gray-400 text-xs shrink-0">
                  {expandedRow === entry.model ? '▲' : '▼'}
                </span>
              </button>

              {/* Overall bar – always visible */}
              <div className="px-4 pb-2">
                <div className="rounded-full h-2 bg-gray-200 overflow-hidden">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all"
                    style={{ width: `${entry.overall}%` }}
                  />
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedRow === entry.model && (
                <div className="px-4 pb-4 border-t bg-gray-50 space-y-4 pt-3">
                  {/* Quick stats row */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-gray-500">Best Score</div>
                      <div className="text-sm font-semibold text-gray-800">
                        {entry.bestScore != null ? entry.bestScore.toFixed(1) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Runs</div>
                      <div className="text-sm font-semibold text-gray-800">{entry.runs || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Coverage</div>
                      <div className="text-sm font-semibold text-gray-800">{(entry.coverage * 100).toFixed(0)}%</div>
                    </div>
                  </div>

                  {/* Difficulty Scores */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Difficulty</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-xs text-gray-500">Easy</div>
                        <div className="text-sm font-semibold text-green-600">{entry.difficulty.easy?.toFixed(1) ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Medium</div>
                        <div className="text-sm font-semibold text-yellow-600">{entry.difficulty.medium?.toFixed(1) ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Hard</div>
                        <div className="text-sm font-semibold text-red-600">{entry.difficulty.hard?.toFixed(1) ?? '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Factor Scores */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Factors</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {siteConfig.factors.map(f => (
                        <div key={f.slug} className="text-center" title={f.Description}>
                          <div className="text-xs text-gray-500">{f.slug}: {f.name}</div>
                          <div className="text-sm font-semibold text-primary-600">
                            {entry.factors[f.slug as keyof typeof entry.factors]?.toFixed(1) ?? '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Domain Scores */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Domain Scores</h4>
                    <div className="space-y-2">
                      {Object.entries(entry.domains).map(([domain, score]) => (
                        <div key={domain} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-24 shrink-0 truncate" title={domain}>{domain}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-3 relative overflow-hidden">
                            <div
                              className="bg-primary-500 h-3 rounded-full transition-all"
                              style={{ width: `${Math.max((score as number), 5)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700 w-8 text-right shrink-0">
                            {(score as number).toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filteredData.length === 0 && (
            <div className="text-center text-gray-400 py-8 text-sm">No models found</div>
          )}
        </div>
      </div>
    );
  }

  // ─── Desktop: Table layout (with horizontal scroll for safety) ────────────
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-wrap gap-4 items-center">
        <input
          type="text"
          placeholder="Search models..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* View Tabs */}
      <div className="flex gap-2">
        {viewTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table – wrapped in overflow-x-auto for safety on medium screens */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b bg-gray-50">
              <th
                onClick={() => toggleSort('rank')}
                className="px-3 py-3 text-center text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
              >
                Rank <SortIcon column="rank" />
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-700 whitespace-nowrap">
                Model
              </th>
              <th
                onClick={() => toggleSort('overall')}
                className="px-3 py-3 text-center text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
              >
                Overall Avg Score <SortIcon column="overall" />
              </th>
              <th
                onClick={() => toggleSort('bestScore')}
                className="px-3 py-3 text-center text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
              >
                Best Score <SortIcon column="bestScore" />
              </th>
              {view === 'difficulty' && (
                <>
                  <th onClick={() => toggleSort('easy')} className="px-3 py-3 text-center text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap">
                    Easy <SortIcon column="easy" />
                  </th>
                  <th onClick={() => toggleSort('medium')} className="px-3 py-3 text-center text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap">
                    Medium <SortIcon column="medium" />
                  </th>
                  <th onClick={() => toggleSort('hard')} className="px-3 py-3 text-center text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap">
                    Hard <SortIcon column="hard" />
                  </th>
                </>
              )}
              {view === 'factor' && (
                <>
                  {siteConfig.factors.map(f => (
                    <th key={f.slug} onClick={() => toggleSort(f.slug)} className="px-3 py-3 text-center text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap" title={f.Description}>
                      {f.slug} <SortIcon column={f.slug} />
                    </th>
                  ))}
                </>
              )}
              {view === 'domain' && domainKeys.map(dk => (
                <th key={dk} onClick={() => toggleSort(`domain:${dk}`)} className="px-2 py-3 text-center text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap">
                  {dk} <SortIcon column={`domain:${dk}`} />
                </th>
              ))}
              <th
                onClick={() => toggleSort('runs')}
                className="px-3 py-3 text-center text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
              >
                Runs <SortIcon column="runs" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((entry) => (
              <>
                <tr
                  key={entry.model}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === entry.model ? null : entry.model)}
                >
                  <td className="px-3 py-3 text-xs text-center">
                    {entry.rank <= 3 ? (
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        entry.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                        entry.rank === 2 ? 'bg-gray-200 text-gray-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {entry.rank}
                      </span>
                    ) : (
                      <span className="text-gray-500">{entry.rank}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="text-center">
                      <div className="text-xs font-medium text-gray-900">{entry.model}</div>
                      {entry.provider && (
                        <div className="text-xs text-gray-400 mt-0.5">{entry.provider}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-full h-5 relative overflow-hidden bg-gray-200">
                        <div
                          className="bg-primary-500 h-5 rounded-l-full transition-all"
                          style={{ width: `${entry.overall}%`, borderRadius: entry.overall >= 98 ? '9999px' : '' }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-primary-700 w-10 text-right shrink-0">{entry.overall.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600 text-center">
                    {entry.bestScore != null ? entry.bestScore.toFixed(1) : '—'}
                  </td>
                  {view === 'difficulty' && (
                    <>
                      <td className="px-3 py-3 text-xs text-green-600 text-center">{entry.difficulty.easy?.toFixed(1) ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-yellow-600 text-center">{entry.difficulty.medium?.toFixed(1) ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-red-600 text-center">{entry.difficulty.hard?.toFixed(1) ?? '—'}</td>
                    </>
                  )}
                  {view === 'factor' && (
                    <>
                      <td className="px-3 py-3 text-xs text-orange-600 text-center">{entry.factors.A1?.toFixed(1) ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-red-600 text-center">{entry.factors.A2?.toFixed(1) ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-purple-600 text-center">{entry.factors.B1?.toFixed(1) ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-green-600 text-center">{entry.factors.B2?.toFixed(1) ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-cyan-600 text-center">{entry.factors.C1?.toFixed(1) ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-blue-600 text-center">{entry.factors.C2?.toFixed(1) ?? '—'}</td>
                    </>
                  )}
                  {view === 'domain' && domainKeys.map(dk => (
                    <td key={dk} className="px-2 py-3 text-xs text-blue-600 text-center">{entry.domains[dk]?.toFixed(1) ?? '-'}</td>
                  ))}
                  <td className="px-3 py-3 text-xs text-gray-600 text-center">{entry.runs || '—'}</td>
                </tr>
                {/* Expanded Detail View */}
                {expandedRow === entry.model && (
                  <tr key={`${entry.model}-expanded`}>
                    <td colSpan={5 + (view === 'difficulty' ? 3 : view === 'factor' ? siteConfig.factors.length : view === 'domain' ? domainKeys.length : 0)} className="px-4 sm:px-8 py-4 bg-gray-50">
                      <div className="space-y-4">
                        {/* Domain Scores */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Domain Scores</h4>
                          <div className="space-y-2">
                            {Object.entries(entry.domains).map(([domain, score]) => (
                              <div key={domain} className="flex items-center gap-2 sm:gap-3">
                                <span className="text-xs text-gray-600 w-24 sm:w-52 shrink-0 truncate" title={domain}>{domain}</span>
                                <div className="flex-1 bg-gray-200 rounded-full h-4 relative overflow-hidden">
                                  <div
                                    className="bg-primary-500 h-4 rounded-full flex items-center justify-end pr-2"
                                    style={{ width: `${Math.max((score as number), 5)}%` }}
                                  >
                                    <span className="text-xs text-white font-medium">{(score as number).toFixed(1)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Factor Scores */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Factor Scores</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                            {siteConfig.factors.map(f => (
                              <div key={f.slug} className="text-center" title={f.Description}>
                                <div className="text-xs text-gray-500 mb-1">{f.slug}: {f.name}</div>
                                <div className="text-sm font-semibold text-primary-600">{entry.factors[f.slug as keyof typeof entry.factors]?.toFixed(1) ?? '—'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Difficulty Scores */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Difficulty Scores</h4>
                          <div className="grid grid-cols-3 gap-3 sm:gap-4">
                            <div className="text-center">
                              <div className="text-xs text-gray-500 mb-1">Easy</div>
                              <div className="text-sm font-semibold text-green-600">{entry.difficulty.easy?.toFixed(1) ?? '—'}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-500 mb-1">Medium</div>
                              <div className="text-sm font-semibold text-yellow-600">{entry.difficulty.medium?.toFixed(1) ?? '—'}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-500 mb-1">Hard</div>
                              <div className="text-sm font-semibold text-red-600">{entry.difficulty.hard?.toFixed(1) ?? '—'}</div>
                            </div>
                          </div>
                        </div>
                        {/* Extra Info */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Details</h4>
                          <div className="grid grid-cols-3 gap-3 sm:gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Runs: </span>
                              <span className="font-medium">{entry.runs || '—'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Best Score: </span>
                              <span className="font-medium">{entry.bestScore != null ? entry.bestScore.toFixed(1) : '—'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Coverage: </span>
                              <span className="font-medium">{(entry.coverage * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
