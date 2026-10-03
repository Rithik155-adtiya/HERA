import api from './client';
import type { IAuthUser, IUser, ILoginInput, IRegisterInput, ApiResponse } from '@hera/shared';

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  return res.data.data as T;
}

export const authApi = {
  login: (input: ILoginInput) => unwrap<IAuthUser>(api.post('/auth/login', input)),
  register: (input: IRegisterInput) => unwrap<IAuthUser>(api.post('/auth/register', input)),
  me: () => unwrap<IUser>(api.get('/auth/me')),
  updateProfile: (input: { name?: string; hostelId?: string; blockId?: string; roomId?: string }) =>
    unwrap<IUser>(api.patch('/auth/profile', input)),
};
