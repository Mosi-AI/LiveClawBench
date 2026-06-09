// ========== Task 相关 ==========
export interface Task {
  case_id: number;
  name: string;
  slug: string;
  difficulty: 'easy' | 'medium' | 'hard';
  domain: string;
  domains_multi: string[];
  factors: {
    A1: boolean;
    A2: boolean;
    B1: boolean;
    B2: boolean;
    C1: boolean;
    C2: boolean;
  };
  instruction: string;
  description_zh?: string;
  description_en?: string;
  mock_apps: string[];
  mock_app_features: MockAppFeature[];
  verifier_type: 'verify.py' | 'evaluate.py' | 'llm_judge.py';
  paths: {
    task_toml: string;
    instruction: string;
    environment: string;
    test_sh: string;
    solution?: string;
  };
}

export interface MockAppFeature {
  id: string;
  name: string;
  summary: string;
  task_usage: string;
}

// ========== Mock App 相关 ==========
export interface MainScreen {
  name: string;
  src: string;
}

export interface MockApp {
  id: string;
  name: string;
  summary: string;
  mainScreens: MainScreen[];
  agentActions: string[];
  previewAssets: PreviewAsset[];
  demoGif?: string;
  sourceFiles: string[];
  tasksCount: number;
  usedByTasks: string[];
}

export interface PreviewAsset {
  type: 'image' | 'video' | 'gif';
  src: string;
  caption?: string;
  hotspots?: Hotspot[];
}

export interface Hotspot {
  x: number;
  y: number;
  description: string;
}

// ========== Leaderboard 相关 ==========
export interface LeaderboardEntry {
  rank: number;
  model: string;
  provider: string;
  overall: number;
  bestScore?: number;
  difficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
  factors: {
    A1: number;
    A2: number;
    B1: number;
    B2: number;
    C1: number;
    C2: number;
  };
  domains: Record<string, number>;
  runs: number;
  coverage: number;
}

export interface LeaderboardData {
  updatedAt: string;
  source: string;
  scoreScale: '0-100' | '0-1';
  metrics: string[];
  models: LeaderboardEntry[];
}

// ========== Representative Cases ==========

export interface RepresentativeCase {
  name: string;
  domain: string;
  difficulty: 'easy' | 'medium' | 'hard';
  factors: {
    A1: boolean;
    A2: boolean;
    B1: boolean;
    B2: boolean;
    C1: boolean;
    C2: boolean;
  };
  summary_zh: string;
  summary_en: string;
  detailUrl: string;
}

export interface RepresentativeCasesData {
  cases: RepresentativeCase[];
}

// ========== 站点配置 ==========
export interface SiteConfig {
  title: string;
  subtitle: string;
  version: string;
  team: {
    name: string;
    url: string;
  };
  affiliations: Array<{
    id: number;
    name: string;
    url: string;
  }>;
  members: Array<{
    name: string;
    url: string;
    affiliations: number[];
  }>;
  links: {
    paper: string;
    code: string;
    data: string;
    data_viewer: string;

  };
  nav: Array<{
    label: string;
    href: string;
  }>;
  factors: Array<{
    slug: string;
    name: string;
    Axis: string;
    Description: string;
  }>;
}
