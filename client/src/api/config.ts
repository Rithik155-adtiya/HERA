import api from './client';
import type {
  IHostel,
  IBlock,
  IRoom,
  IDepartment,
  IComplaintCategory,
  IUser,
  ISystemSettings,
  PaginatedResponse,
  ApiResponse,
} from '@hera/shared';

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  return res.data.data as T;
}

export const configApi = {
  hostels: () => unwrap<IHostel[]>(api.get('/hostels')),
  blocks: (hostelId?: string) =>
    unwrap<IBlock[]>(api.get('/blocks', { params: hostelId ? { hostelId } : {} })),
  rooms: (blockId?: string) =>
    unwrap<IRoom[]>(api.get('/rooms', { params: blockId ? { blockId } : {} })),
  departments: () => unwrap<IDepartment[]>(api.get('/departments')),
  categories: () => unwrap<IComplaintCategory[]>(api.get('/categories')),
  staff: (departmentId?: string) =>
    unwrap<IUser[]>(api.get('/staff', { params: departmentId ? { departmentId } : {} })),
  settings: () => unwrap<ISystemSettings>(api.get('/settings')),

  // Admin mutations
  createHostel: (input: { name: string; code: string }) =>
    unwrap<IHostel>(api.post('/hostels', input)),
  updateHostel: (id: string, input: Partial<{ name: string; code: string; isActive: boolean }>) =>
    unwrap<IHostel>(api.patch(`/hostels/${id}`, input)),
  createBlock: (input: { hostelId: string; name: string; code: string }) =>
    unwrap<IBlock>(api.post('/blocks', input)),
  createRoom: (input: { blockId: string; roomNumber: string; capacity: number }) =>
    unwrap<IRoom>(api.post('/rooms', input)),
  createDepartment: (input: { name: string; code: string; description?: string }) =>
    unwrap<IDepartment>(api.post('/departments', input)),
  updateDepartment: (id: string, input: Partial<{ name: string; code: string; description: string; isActive: boolean }>) =>
    unwrap<IDepartment>(api.patch(`/departments/${id}`, input)),
  createCategory: (input: { name: string; code: string; description?: string; defaultDepartmentId?: string }) =>
    unwrap<IComplaintCategory>(api.post('/categories', input)),
  updateCategory: (
    id: string,
    input: Partial<{ name: string; code: string; description: string; defaultDepartmentId: string; isActive: boolean }>
  ) => unwrap<IComplaintCategory>(api.patch(`/categories/${id}`, input)),
  users: (params: { page?: number; limit?: number; role?: string; search?: string } = {}) =>
    unwrap<PaginatedResponse<IUser>>(api.get('/users', { params })),
  updateUser: (
    id: string,
    input: Partial<{
      name: string;
      role: string;
      isActive: boolean;
      departmentId: string;
      hostelId: string;
    }>
  ) => unwrap<IUser>(api.patch(`/users/${id}`, input)),
  updateSettings: (input: Partial<ISystemSettings>) =>
    unwrap<ISystemSettings>(api.patch('/settings', input)),
};
