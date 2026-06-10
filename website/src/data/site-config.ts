import type { SiteConfig } from './types';
import siteConfig from '../../site-content/site-config.json';

export function getSiteConfig(): SiteConfig {
  return siteConfig as SiteConfig;
}

/** Get a map from factor slug to factor info (name, Axis, Description) */
export function getFactorMap(): Record<string, { name: string; Axis: string; Description: string }> {
  const map: Record<string, { name: string; Axis: string; Description: string }> = {};
  for (const f of siteConfig.factors) {
    map[f.slug] = { name: f.name, Axis: f.Axis, Description: f.Description };
  }
  return map;
}

/** Get factor slugs in order */
export function getFactorSlugs(): string[] {
  return siteConfig.factors.map(f => f.slug);
}

/** Get the GitHub repo base URL (e.g. https://github.com/Mosi-AI/LiveClawBench) */
export function getGithubRepoUrl(): string {
  return siteConfig.links.code;
}

/** Get a GitHub file URL (blob/main/ prefix) */
export function getGithubFileUrl(filePath: string): string {
  return `${siteConfig.links.code}/blob/main/${filePath}`;
}

/** Get a GitHub directory URL (tree/main/ prefix) */
export function getGithubDirUrl(dirPath: string): string {
  return `${siteConfig.links.code}/tree/main/${dirPath}`;
}
