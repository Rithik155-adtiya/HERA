import React from 'react';
import { Link } from 'react-router-dom';
import {
  Brain,
  Gauge,
  Route,
  CopyCheck,
  Eye,
  LineChart,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

const problems = [
  'Complaints get lost in WhatsApp groups and paper registers',
  'No one knows which complaint is urgent and which can wait',
  'Students never find out who is handling their problem or when it will be fixed',
  'The same recurring issues keep coming back without anyone noticing the pattern',
];

const solutions = [
  {
    icon: <Brain size={20} />,
    title: 'AI Understanding',
    desc: 'Every complaint is summarized, categorized and prioritized automatically in plain language.',
  },
  {
    icon: <Gauge size={20} />,
    title: 'Smart Prioritization',
    desc: 'Safety risks and urgent issues are surfaced first, with an explainable confidence score.',
  },
  {
    icon: <Route size={20} />,
    title: 'Automatic Routing',
    desc: 'Complaints are recommended to the right department using admin-configurable mappings.',
  },
  {
    icon: <CopyCheck size={20} />,
    title: 'Duplicate Detection',
    desc: 'Semantic similarity flags possible duplicates so teams can link them instead of double-working.',
  },
  {
    icon: <Eye size={20} />,
    title: 'Transparent Tracking',
    desc: 'A full timeline of every action keeps students and staff aligned from report to resolution.',
  },
  {
    icon: <LineChart size={20} />,
    title: 'Operational Insights',
    desc: 'Evidence-based analytics and recurring issue detection turn history into better decisions.',
  },
];

const workflow = [
  'Student submits complaint',
  'AI analyzes & classifies',
  'Warden reviews & approves',
  'Assigned to department',
  'Work tracked & escalated',
  'Student confirms resolution',
];

const benefits = {
  Students: [
    'Report a problem in under a minute',
    'Track status with a transparent timeline',
    'Confirm or reopen if the fix did not hold',
    'Rate the resolution and shape future improvements',
  ],
  Wardens: [
    'One centralized work queue, sorted by urgency',
    'Review, edit or override every AI recommendation',
    'Assign staff scoped to the right department',
    'Escalation rules that run automatically',
  ],
  Administrators: [
    'Analytics derived from real complaint data',
    'Recurring problem detection with real evidence',
    'Fully configurable categories, departments and rules',
    'Audit-ready activity records',
  ],
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
              H
            </span>
            <span className="text-xl font-semibold tracking-tight">HERA</span>
          </div>
          <nav className="flex items-center gap-3" aria-label="Primary">
            <Link to="/" className="btn-secondary">
              Login
            </Link>
            <Link to="/register" className="btn-primary">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-600">
          Hostel Emergency & Resolution Assistant
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">HERA</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 sm:text-2xl">
          Smart Hostel Complaint &amp; Resolution
        </p>
        <p className="mx-auto mt-3 max-w-xl text-base text-slate-500">
          Report problems. Route intelligently. Resolve faster.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/" className="btn-primary px-6 py-3 text-base">
            Login <ArrowRight size={18} />
          </Link>
          <Link to="/register" className="btn-secondary px-6 py-3 text-base">
            Get Started
          </Link>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            The traditional hostel complaint problem
          </h2>
          <ul className="mx-auto mt-8 grid max-w-3xl gap-4">
            {problems.map((p) => (
              <li key={p} className="card flex items-start gap-3 p-4 text-slate-700">
                <span className="mt-0.5 text-red-500" aria-hidden="true">
                  ✕
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Solution */}
      <section className="py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">How HERA solves it</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {solutions.map((s) => (
              <div key={s.title} className="card p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  {s.icon}
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="bg-slate-900 py-14 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            The complete complaint lifecycle
          </h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workflow.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-sm text-slate-400">
            AI recommends — authorized humans decide at every consequential step.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">Benefits for everyone</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {Object.entries(benefits).map(([role, items]) => (
              <div key={role} className="card p-5">
                <h3 className="font-semibold text-brand-700">{role}</h3>
                <ul className="mt-3 space-y-2">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold sm:text-3xl">Ready to resolve faster?</h2>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register" className="btn-primary px-6 py-3">
              Create your account
            </Link>
            <Link to="/" className="btn-secondary px-6 py-3">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        HERA — Hostel Emergency &amp; Resolution Assistant
      </footer>
    </div>
  );
}
