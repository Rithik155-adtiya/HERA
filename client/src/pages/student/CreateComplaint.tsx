import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createComplaintSchema, type CreateComplaintInput } from '@hera/shared';
import { complaintsApi } from '../../api/complaints';
import { configApi } from '../../api/config';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../api/client';
import { LoadingState } from '../../components/ui';
import toast from 'react-hot-toast';

export default function CreateComplaint() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateComplaintInput>({
    resolver: zodResolver(createComplaintSchema),
    defaultValues: {
      hostelId: user?.hostelId ?? '',
      blockId: user?.blockId ?? '',
      roomId: user?.roomId ?? '',
    },
  });

  const selectedHostel = watch('hostelId');
  const selectedBlock = watch('blockId');

  const { data: hostels, isLoading: loadingHostels } = useQuery({
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

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: configApi.categories,
  });

  const mutation = useMutation({
    mutationFn: complaintsApi.create,
    onSuccess: (complaint) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'student'] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      toast.success('Complaint submitted! AI analysis is running.');
      navigate(`/app/complaints/${complaint._id}`);
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  const onSubmit = (values: CreateComplaintInput) => {
    setServerError('');
    mutation.mutate({
      ...values,
      blockId: values.blockId || undefined,
      roomId: values.roomId || undefined,
      categoryPreference: values.categoryPreference || undefined,
    });
  };

  if (loadingHostels) return <LoadingState label="Loading form..." />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">Report a Problem</h1>
      <p className="mt-1 text-sm text-slate-500">
        Describe the issue in your own words — our AI will classify and route it for you.
      </p>

      {serverError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card mt-6 space-y-5 p-5 sm:p-6" noValidate>
        <div>
          <label htmlFor="title" className="label">
            What&apos;s the problem? (title)
          </label>
          <input
            id="title"
            className="input"
            placeholder="e.g. Fan in my room stopped working"
            {...register('title')}
            aria-invalid={!!errors.title}
          />
          {errors.title && <p className="error-text">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="description" className="label">
            Describe what happened
          </label>
          <textarea
            id="description"
            rows={5}
            className="input"
            placeholder="Tell us exactly what is happening, since when, and how it affects you..."
            {...register('description')}
            aria-invalid={!!errors.description}
          />
          {errors.description && <p className="error-text">{errors.description.message}</p>}
        </div>

        <div>
          <label htmlFor="location" className="label">
            Location
          </label>
          <input
            id="location"
            className="input"
            placeholder="e.g. Block B, Room 204, Bathroom"
            {...register('location')}
            aria-invalid={!!errors.location}
          />
          {errors.location && <p className="error-text">{errors.location.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="hostelId" className="label">
              Hostel
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
        </div>

        <div>
          <label htmlFor="categoryPreference" className="label">
            Category hint <span className="text-slate-400">(optional)</span>
          </label>
          <select id="categoryPreference" className="input" {...register('categoryPreference')}>
            <option value="">Let AI decide</option>
            {categories?.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" className="btn-primary flex-1" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending ? 'Submitting...' : 'Submit Complaint'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
