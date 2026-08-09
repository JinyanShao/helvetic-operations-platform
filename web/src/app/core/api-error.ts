import { ApiException } from '../api/generated/work-orders-api';

export interface ApiProblem { title?: string; detail?: string; errors?: Record<string, string[]>; }

export function readApiProblem(error: unknown): ApiProblem {
  if (!(error instanceof ApiException) || !error.response) return { title: 'Request failed', detail: 'Please try again.' };
  try { return JSON.parse(error.response) as ApiProblem; }
  catch { return { title: 'Request failed', detail: error.message }; }
}
