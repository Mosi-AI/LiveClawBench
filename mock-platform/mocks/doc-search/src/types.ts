/**
 * Doc-search domain types
 */

export interface Document {
  id: string;
  slug: string;
  title: string;
  kind: string;
  status: string;
  reliability: string;
  updated_at: string;
  owner: string;
  summary: string;
  body: string;
  tags: string;
}

export interface SearchResult {
  rank: number;
  doc_id: string;
  slug: string;
}

export interface Metadata {
  site_title: string;
  home_title: string;
  home_description: string;
  search_placeholder: string;
}

// JSONL event types
export interface HomeEvent {
  event: "home";
  path: string;
}

export interface SearchEvent {
  event: "search";
  sid: string;
  path: string;
  query: string;
  results: SearchResult[];
}

export interface ClickEvent {
  event: "click";
  sid: string;
  rank: string;
  path: string;
  doc_id: string;
  slug: string;
}

export interface PageEvent {
  event: "page";
  sid: string;
  rank: string;
  path: string;
  doc_id: string;
  slug: string;
}

export type AccessEvent = HomeEvent | SearchEvent | ClickEvent | PageEvent;
