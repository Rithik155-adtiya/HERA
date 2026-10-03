import api from './client';
import type {
  IComplaint,
  IComplaintTimeline,
  IFeedback,
  ICreateComplaintInput,
  IApproveAIInput,
  IAssignComplaintInput,
  IStatusUpdateInput,
  IFeedbackInput,
  ComplaintFilter,
  PaginatedResponse,
  ApiResponse,
} from '@hera/shared';

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  return res.data.data as T;
}

export interface ComplaintDetail {
  complaint: IComplaint;
  timeline: IComplaintTimeline[];
  feedback: IFeedback | null;
}

export interface DuplicateCandidate {
  complaint: IComplaint;
  similarity: number;
}

function filterToParams(filter: Partial<ComplaintFilter>): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value;
    }
  });
  return params;
}

export const complaintsApi = {
  list: (filter: Partial<ComplaintFilter> = {}) =>
    unwrap<PaginatedResponse<IComplaint>>(api.get('/complaints', { params: filterToParams(filter) })),
  get: (id: string) => unwrap<ComplaintDetail>(api.get(`/complaints/${id}`)),
  create: (input: ICreateComplaintInput) => unwrap<IComplaint>(api.post('/complaints', input)),
  reanalyze: (id: string) =>
    api.post(`/complaints/${id}/analyze`).then((r) => r.data as ApiResponse<unknown>),
  approveAI: (id: string, input: IApproveAIInput) =>
    unwrap<IComplaint>(api.post(`/complaints/${id}/approve-ai`, input)),
  assign: (id: string, input: IAssignComplaintInput) =>
    unwrap<IComplaint>(api.post(`/complaints/${id}/assign`, input)),
  updateStatus: (id: string, input: IStatusUpdateInput) =>
    unwrap<IComplaint>(api.post(`/complaints/${id}/status`, input)),
  reopen: (id: string, reason: string) =>
    unwrap<IComplaint>(api.post(`/complaints/${id}/reopen`, { reason })),
  feedback: (id: string, input: IFeedbackInput) =>
    unwrap<IFeedback>(api.post(`/complaints/${id}/feedback`, input)),
  link: (id: string, targetComplaintId: string) =>
    api.post(`/complaints/${id}/link`, { targetComplaintId }).then((r) => r.data),
  duplicates: (id: string) =>
    unwrap<DuplicateCandidate[]>(api.get(`/complaints/${id}/duplicates`)),
  chat: (query: string) =>
    unwrap<{ response: string }>(api.post('/complaints/chat/query', { query })),
};
