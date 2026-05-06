/**
 * Not found page renderer
 */

import type { Metadata } from "../types";
import { renderPage } from "./html";

export function renderNotFound(metadata: Metadata): string {
  return renderPage(metadata, "Not Found", "<h1>Not Found</h1>");
}
