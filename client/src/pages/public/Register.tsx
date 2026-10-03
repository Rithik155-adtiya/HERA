import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { registerSchema, type RegisterInput } from '@hera/shared';
import { useAuth } from '../../hooks/useAuth';
import { configApi } from '../../api/config';
import { getErrorMessage } from '../../api/client';

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'student' },
  });

  const selectedHostel = watch('hostelId');
  const selectedBlock = watch('blockId');

  const { data: hostels } = useQuery({
    queryKey: ['hostels'],
    queryFn: configApi.hostels,
  });

  const { data: blocks } = useQuery({
    queryKey: ['blocks', selectedHostel],
    queryFn: () => configApi.blocks(selectedHostel || undefined),
    enabled: !!selectedHostel,
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms', selectedBlock],
    queryFn: () => configApi.rooms(selectedBlock || undefined),
    enabled: !!selectedBlock,
  });

  const onSubmit = async (values: RegisterInput) => {
    setServerError('');
    try {
      await registerUser({
        ...values,
        hostelId: values.hostelId || undefined,
        blockId: values.blockId || undefined,
        roomId: values.roomId || undefined,
        role: 'student',
      });
      navigate('/app', { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
            H
          </span>
          <span className="text-2xl font-semibold tracking-tight">HERA</span>
        </Link>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Register as a student to report problems.</p>

          {serverError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="name" className="label">
                Full name
              </label>
              <input id="name" className="input" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="error-text">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="reg-email" className="label">
                Email address
              </label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                className="input"
                {...register('email')}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="reg-password" className="label">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                className="input"
                {...register('password')}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="error-text">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="hostelId" className="label">
                Hostel <span className="text-slate-400">(optional)</span>
              </label>
              <select
                id="hostelId"
                className="input"
                value={selectedHostel ?? ''}
                onChange={(e) => {
                  setValue('hostelId', e.target.value, { shouldValidate: true });
                  setValue('blockId', '');
                  setValue('roomId', '');
                }}
              >
                <option value="">Select hostel</option>
                {hostels?.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
              </select>
              {errors.hostelId && <p className="error-text">{errors.hostelId.message}</p>}
            </div>

            {selectedHostel && (
              <div>
                <label htmlFor="blockId" className="label">
                  Block <span className="text-slate-400">(optional)</span>
                </label>
                <select
                  id="blockId"
                  className="input"
                  value={selectedBlock ?? ''}
                  onChange={(e) => {
                    setValue('blockId', e.target.value, { shouldValidate: true });
                    setValue('roomId', '');
                  }}
                >
                  <option value="">Select block</option>
                  {blocks?.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedBlock && (
              <div>
                <label htmlFor="roomId" className="label">
                  Room <span className="text-slate-400">(optional)</span>
                </label>
                <select id="roomId" className="input" {...register('roomId')}>
                  <option value="">Select room</option>
                  {rooms?.map((r) => (
                    <option key={r._id} value={r._id}>
                      Room {r.roomNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/" className="font-medium text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
