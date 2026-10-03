import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configApi } from '../../api/config';
import { LoadingState, ErrorState } from '../../components/ui';
import { getErrorMessage } from '../../api/client';
import type { ISystemSettings, PriorityLevel } from '@hera/shared';
import toast from 'react-hot-toast';

const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: configApi.settings,
  });

  const [form, setForm] = useState<ISystemSettings | null>(null);

  useEffect(() => {
    if (data) setForm(structuredClone(data));
  }, [data]);

  const save = useMutation({
    mutationFn: (input: Partial<ISystemSettings>) => configApi.updateSettings(input),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading || !form) return <LoadingState label="Loading settings..." />;
  if (isError) return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;

  const updateRule = (idx: number, field: string, value: number | string | string[]) => {
    setForm((f) => {
      if (!f) return f;
      const rules = [...f.escalationRules];
      rules[idx] = { ...rules[idx], [field]: value } as ISystemSettings['escalationRules'][number];
      return { ...f, escalationRules: rules };
    });
  };

  const updateTarget = (priority: PriorityLevel, hours: number) => {
    setForm((f) => (f ? { ...f, defaultResolutionTargets: { ...f.defaultResolutionTargets, [priority]: hours } } : f));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">System Settings</h1>
          <p className="text-sm text-slate-500">
            Escalation thresholds and operational rules live in the database — no hardcoded values.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              escalationRules: form.escalationRules,
              defaultResolutionTargets: form.defaultResolutionTargets,
              maxComplaintsPerDay: form.maxComplaintsPerDay,
              aiAnalysisEnabled: form.aiAnalysisEnabled,
              duplicateDetectionEnabled: form.duplicateDetectionEnabled,
              duplicateSimilarityThreshold: form.duplicateSimilarityThreshold,
            })
          }
        >
          {save.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <section className="card p-5" aria-labelledby="esc-heading">
        <h2 id="esc-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Escalation Rules
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          First threshold notifies configured roles; second threshold escalates further. Complaints
          never receive duplicate escalation notifications.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">Priority</th>
                <th scope="col" className="py-2 pr-3">1st escalation (hours)</th>
                <th scope="col" className="py-2 pr-3">2nd escalation (hours)</th>
                <th scope="col" className="py-2">Notify roles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {form.escalationRules.map((rule, idx) => (
                <tr key={rule.priorityLevel}>
                  <td className="py-2 pr-3 font-medium text-slate-800">
                    {PRIORITY_LABELS[rule.priorityLevel]}
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={1}
                      className="input py-1 sm:w-28"
                      value={rule.firstEscalationHours}
                      onChange={(e) => updateRule(idx, 'firstEscalationHours', Number(e.target.value))}
                      aria-label={`First escalation hours for ${rule.priorityLevel}`}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={1}
                      className="input py-1 sm:w-28"
                      value={rule.secondEscalationHours}
                      onChange={(e) => updateRule(idx, 'secondEscalationHours', Number(e.target.value))}
                      aria-label={`Second escalation hours for ${rule.priorityLevel}`}
                    />
                  </td>
                  <td className="py-2">
                    <div className="flex gap-3 text-xs">
                      {(['warden', 'admin'] as const).map((role) => (
                        <label key={role} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={rule.notifyRoles.includes(role)}
                            onChange={(e) => {
                              const roles = e.target.checked
                                ? [...rule.notifyRoles, role]
                                : rule.notifyRoles.filter((r) => r !== role);
                              updateRule(idx, 'notifyRoles', roles);
                            }}
                          />
                          {role}
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5" aria-labelledby="targets-heading">
        <h2 id="targets-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Resolution Targets (hours)
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(Object.keys(PRIORITY_LABELS) as PriorityLevel[]).map((p) => (
            <div key={p}>
              <label htmlFor={`target-${p}`} className="label">
                {PRIORITY_LABELS[p]}
              </label>
              <input
                id={`target-${p}`}
                type="number"
                min={1}
                className="input"
                value={form.defaultResolutionTargets[p]}
                onChange={(e) => updateTarget(p, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5" aria-labelledby="ops-heading">
        <h2 id="ops-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Operational Settings
        </h2>
        <div className="mt-3 space-y-4">
          <div className="max-w-xs">
            <label htmlFor="max-per-day" className="label">
              Max complaints per student / day
            </label>
            <input
              id="max-per-day"
              type="number"
              min={1}
              max={100}
              className="input"
              value={form.maxComplaintsPerDay}
              onChange={(e) => setForm({ ...form, maxComplaintsPerDay: Number(e.target.value) })}
            />
          </div>
          <div className="max-w-xs">
            <label htmlFor="dup-threshold" className="label">
              Duplicate similarity threshold ({form.duplicateSimilarityThreshold.toFixed(2)})
            </label>
            <input
              id="dup-threshold"
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              className="w-full"
              value={form.duplicateSimilarityThreshold}
              onChange={(e) => setForm({ ...form, duplicateSimilarityThreshold: Number(e.target.value) })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.aiAnalysisEnabled}
              onChange={(e) => setForm({ ...form, aiAnalysisEnabled: e.target.checked })}
            />
            Enable automatic AI analysis on submission
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.duplicateDetectionEnabled}
              onChange={(e) => setForm({ ...form, duplicateDetectionEnabled: e.target.checked })}
            />
            Enable duplicate detection
          </label>
        </div>
      </section>
    </div>
  );
}
