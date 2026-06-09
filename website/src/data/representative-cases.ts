import type { RepresentativeCasesData } from './types';
import repCasesData from '../../site-data/representative-cases.json';

const data = repCasesData as RepresentativeCasesData;

/** Get all representative cases */
export function getRepresentativeCases() {
  return data.cases;
}
