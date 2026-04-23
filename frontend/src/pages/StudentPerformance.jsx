import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { ChevronLeft, TrendingUp, TrendingDown, Minus, Award, AlertTriangle, Activity, Eye, Clock, Monitor, Trash2, RefreshCw, Lock, Unlock, Video, ExternalLink, Star, CheckCircle } from 'lucide-react';

// ── Simple SVG bar chart ─────────────────────────────────────
function BarChart({ sessions, passingScore = 700 }) {
  if (!sessions.length) return <p className="text-gray-400 text-sm text-center py-8">No exam data yet.</p>;

  const W = 600, H = 200, PAD = { top: 20, right: 20, bottom: 50, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxScore = 1000;

  const barW = Math.max(10, Math.min(40, chartW / sessions.length - 6));
  const gap = (chartW - barW * sessions.length) / (sessions.length + 1);

  const passY = chartH - (passingScore / maxScore) * chartH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {/* Y-axis lines */}
        {[0, 250, 500, 700, 750, 1000].map((v) => {
          const y = chartH - (v / maxScore) * chartH;
          return (
            <g key={v}>
              <line x1={0} y1={y} x2={chartW} y2={y} stroke={v === passingScore ? '#f97316' : '#e5e7eb'} strokeWidth={v === passingScore ? 1.5 : 0.5} strokeDasharray={v === passingScore ? '4 3' : undefined} />
              <text x={-6} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</text>
            </g>
          );
        })}

        {/* Pass line label */}
        <text x={chartW + 2} y={passY + 4} fontSize={8} fill="#f97316">Pass</text>

        {/* Bars */}
        {sessions.map((s, i) => {
          const x = gap + i * (barW + gap);
          const barH = ((s.score || 0) / maxScore) * chartH;
          const y = chartH - barH;
          const passed = s.passed;
          const fill = passed ? '#22c55e' : '#ef4444';
          const date = new Date(s.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          return (
            <g key={s.id}>
              <rect x={x} y={y} width={barW} height={barH} fill={fill} rx={3} opacity={0.85} />
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill={fill} fontWeight="bold">
                {s.score}
              </text>
              <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" fontSize={8} fill="#9ca3af" transform={`rotate(-40, ${x + barW / 2}, ${chartH + 14})`}>
                {date}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ── Domain competency bars ───────────────────────────────────
function DomainBars({ domainSummary }) {
  if (!domainSummary.length) return null;
  return (
    <div className="space-y-3">
      {domainSummary.map(({ domain, meetsPct }) => (
        <div key={domain}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-700 dark:text-gray-300 font-medium">{domain}</span>
            <span className={meetsPct >= 70 ? 'text-green-600' : 'text-red-500'}>{meetsPct}% meets competency</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${meetsPct >= 70 ? 'bg-green-500' : meetsPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${meetsPct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Readiness card ───────────────────────────────────────────
const READINESS_CONFIG = {
  ready:       { bg: 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700', text: 'text-green-800 dark:text-green-300', icon: Award, msg: 'This student has consistently scored above 750/1000 and is ready to sit the AWS certification exam.' },
  close:       { bg: 'bg-lime-50 dark:bg-lime-900/20 border-lime-300 dark:border-lime-700', text: 'text-lime-800 dark:text-lime-300', icon: Award, msg: 'Average score meets the passing threshold. A little more practice to build confidence is recommended.' },
  progressing: { bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700', text: 'text-yellow-800 dark:text-yellow-300', icon: TrendingUp, msg: 'The student is on track. Continue practising weak domains to close the gap to the passing score.' },
  early:       { bg: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700', text: 'text-red-800 dark:text-red-300', icon: AlertTriangle, msg: 'More practice is needed across multiple domains. Focus on consistently scoring above 600 before attempting the exam.' },
};

// ── Activity Event formatting ────────────────────────────────
const EVENT_LABELS = {
  exam_started:       { label: 'Exam started', icon: Monitor, color: 'text-blue-500' },
  tab_switch:         { label: 'Left exam tab', icon: Eye, color: 'text-red-500' },
  tab_switch_return:  { label: 'Returned to tab', icon: Eye, color: 'text-green-500' },
  window_blur:        { label: 'Switched app/window', icon: Monitor, color: 'text-red-500' },
  window_blur_return: { label: 'Returned to exam', icon: Monitor, color: 'text-green-500' },
  fullscreen_exit:    { label: 'Exited fullscreen', icon: Monitor, color: 'text-amber-500' },
  devtools_open:      { label: 'DevTools detected', icon: Eye, color: 'text-red-600' },
  devtools_shortcut:  { label: 'DevTools shortcut blocked', icon: Eye, color: 'text-red-500' },
  alt_tab_attempt:    { label: 'Alt+Tab blocked', icon: Monitor, color: 'text-amber-500' },
  print_attempt:      { label: 'Print blocked', icon: Monitor, color: 'text-amber-500' },
  clipboard_block:    { label: 'Clipboard blocked', icon: Monitor, color: 'text-amber-500' },
  key_block:          { label: 'Shortcut blocked', icon: Monitor, color: 'text-gray-500' },
  mouse_left_window:  { label: 'Mouse left window', icon: Monitor, color: 'text-gray-500' },
  screen_recording:   { label: 'Screen capture blocked', icon: Video, color: 'text-red-600' },
  url_open_attempt:   { label: 'External URL blocked', icon: ExternalLink, color: 'text-red-500' },
};

function ActivityTab({ studentId, activeLockout, onUnlock }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    api.get(`/teacher/students/${studentId}/activity`)
      .then((r) => setSessions(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  const handleUnlock = async () => {
    setUnlocking(true);
    try {
      await api.delete(`/teacher/students/${studentId}/lockout`);
      onUnlock?.();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove lock');
    } finally {
      setUnlocking(false);
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const suspiciousEvents = ['tab_switch', 'window_blur', 'fullscreen_exit', 'devtools_open', 'devtools_shortcut', 'alt_tab_attempt', 'print_attempt'];

  if (loading) return <div className="py-10 text-center text-gray-400">Loading activity data...</div>;

  if (sessions.length === 0) return (
    <div className="card p-8 text-center text-gray-400">
      No exam sessions found for this student.
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Active lockout banner with unlock button */}
      {activeLockout && (
        <div className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border ${
          activeLockout.type === 'device'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
        }`}>
          <div className="flex items-start gap-3 min-w-0">
            <Lock size={16} className={`mt-0.5 shrink-0 ${activeLockout.type === 'device' ? 'text-red-500' : 'text-amber-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${activeLockout.type === 'device' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {activeLockout.label}
              </p>
              <p className={`text-xs mt-0.5 ${activeLockout.type === 'device' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {activeLockout.reason} · Locked until {new Date(activeLockout.until).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={handleUnlock}
            disabled={unlocking}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 font-medium transition disabled:opacity-50"
          >
            <Unlock size={12} /> {unlocking ? 'Removing…' : 'Remove Lock'}
          </button>
        </div>
      )}

      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
        <Activity size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          This report shows browser and application activity recorded during each exam session. All window switches, tab changes, screen capture attempts, and blocked actions are captured.
          <strong> Students are informed that their activity is monitored.</strong>
        </p>
      </div>

      {sessions.map((session) => {
        const suspicious = session.activities.filter((a) => suspiciousEvents.includes(a.event_type));
        const isExpanded = expanded === session.id;
        return (
          <div key={session.id} className="card overflow-hidden">
            <button
              onClick={() => setExpanded(isExpanded ? null : session.id)}
              className="w-full text-left px-4 py-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${session.cancelled ? 'bg-red-500' : session.score !== null ? 'bg-green-500' : 'bg-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {session.examTypeName || 'Unknown exam'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${session.mode === 'exam' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                    {session.mode}
                  </span>
                  {session.cancelled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Cancelled</span>
                  )}
                  {session.anti_cheat_strikes > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      {session.anti_cheat_strikes} strike{session.anti_cheat_strikes !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(session.started_at).toLocaleString()} ·{' '}
                  {suspicious.length > 0
                    ? <span className="text-red-500 font-medium">{suspicious.length} suspicious event{suspicious.length !== 1 ? 's' : ''}</span>
                    : <span className="text-green-600">Clean session</span>
                  }
                  {' '}· {session.activities.length} total events
                </p>
              </div>
              <div className="text-xs text-gray-400 shrink-0">
                {isExpanded ? '▲' : '▼'}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-800">
                {session.activities.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-400">No activity events recorded for this session.</p>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                    {session.activities.map((activity) => {
                      const cfg = EVENT_LABELS[activity.event_type] || { label: activity.event_type, icon: Monitor, color: 'text-gray-400' };
                      const isSuspicious = suspiciousEvents.includes(activity.event_type);
                      const Icon = cfg.icon;
                      return (
                        <div key={activity.id} className={`flex items-start gap-3 px-4 py-2.5 ${isSuspicious ? 'bg-red-50/50 dark:bg-red-900/5' : ''}`}>
                          <Icon size={13} className={`mt-0.5 shrink-0 ${cfg.color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                              {activity.duration_ms && (
                                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                  <Clock size={10} /> {formatDuration(activity.duration_ms)}
                                </span>
                              )}
                            </div>
                            {activity.details && activity.details !== cfg.label && (
                              <p className="text-xs text-gray-400 mt-0.5">{activity.details}</p>
                            )}
                          </div>
                          <span className="text-xs text-gray-300 dark:text-gray-600 shrink-0">
                            {new Date(activity.occurred_at).toLocaleTimeString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function StudentPerformance() {
  const { studentId } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('performance');
  const [deletingSession, setDeletingSession] = useState(null); // sessionId being deleted
  const [resettingAll, setResettingAll] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [lockoutCleared, setLockoutCleared] = useState(false);

  const loadPerformance = () => {
    setLoading(true);
    api.get(`/teacher/students/${studentId}/performance`)
      .then((r) => setData(r.data))
      .catch(() => setError('Failed to load performance data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPerformance(); }, [studentId]);

  const deleteSession = async (sessionId) => {
    if (!confirm('Delete this exam session? This cannot be undone.')) return;
    setDeletingSession(sessionId);
    try {
      await api.delete(`/teacher/students/${studentId}/sessions/${sessionId}`);
      setActionMsg('Session deleted.');
      loadPerformance();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete session');
    } finally {
      setDeletingSession(null);
      setTimeout(() => setActionMsg(''), 3000);
    }
  };

  const resetAllSessions = async () => {
    if (!confirm('Reset ALL exam history for this student? Every session, score, and attempt record will be permanently deleted.')) return;
    setResettingAll(true);
    try {
      const { data: r } = await api.delete(`/teacher/students/${studentId}/sessions`);
      setActionMsg(`Reset complete — ${r.deleted} session(s) removed.`);
      loadPerformance();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset sessions');
    } finally {
      setResettingAll(false);
      setTimeout(() => setActionMsg(''), 4000);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-gray-400">Loading...</div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-red-400">{error || 'Not found.'}</div>
    </div>
  );

  const {
    student, examSessions, sessions, avgScore, readiness, trend,
    domainSummary, totalExamAttempts, passCount,
    avgPassScore, isQualified,
    activeLockout: rawLockout,
  } = data;

  // If teacher just cleared the lock, hide the banner immediately
  const activeLockout = lockoutCleared ? null : rawLockout;

  const rc = readiness ? READINESS_CONFIG[readiness.level] : null;
  const ReadinessIcon = rc?.icon || Award;

  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
  const trendColor = trend === 'improving' ? 'text-green-500' : trend === 'declining' ? 'text-red-500' : 'text-gray-400';

  const passRate = totalExamAttempts > 0 ? Math.round((passCount / totalExamAttempts) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => nav('/teacher')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-aws-orange mb-6 transition">
          <ChevronLeft size={16} /> Back to Dashboard
        </button>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'performance', label: 'Performance', icon: Award },
            { id: 'activity', label: 'Exam Activity', icon: Activity },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                activeTab === id
                  ? 'border-aws-orange text-aws-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Activity tab */}
        {activeTab === 'activity' && (
          <ActivityTab
            studentId={studentId}
            activeLockout={activeLockout}
            onUnlock={() => setLockoutCleared(true)}
          />
        )}

        {activeTab === 'performance' && <>

        {/* Header */}
        <div className="card p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white font-mono">{student.email}</h1>
                {isQualified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs font-semibold border border-yellow-300 dark:border-yellow-700">
                    <Star size={11} className="fill-yellow-400 text-yellow-500" /> Qualified
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">Student Performance Report — Exam Mode Only</p>
            </div>
            {trend && (
              <div className={`flex items-center gap-2 text-sm font-medium ${trendColor}`}>
                <TrendIcon size={18} />
                <span className="capitalize">{trend} trend</span>
              </div>
            )}
          </div>

          {/* Qualification banner */}
          {isQualified && (
            <div className="mt-4 flex items-start gap-3 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/15 border border-yellow-300 dark:border-yellow-700 rounded-xl">
              <Star size={18} className="text-yellow-500 fill-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">🏆 This student is qualified for certification</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                  Passed exam mode {passCount} times · Avg passing score {avgPassScore}/1000 · {totalExamAttempts} total attempts
                </p>
              </div>
            </div>
          )}

          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Exam Attempts', value: totalExamAttempts },
              { label: 'Avg Score', value: avgScore !== null ? `${avgScore}/1000` : '—' },
              { label: 'Pass Count', value: passCount },
              { label: 'Avg Pass Score', value: avgPassScore !== null ? `${avgPassScore}/1000` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center bg-gray-50 dark:bg-gray-800 rounded-xl py-4 px-2">
                <p className="text-2xl font-bold text-aws-orange">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Readiness recommendation */}
        {readiness && rc && (
          <div className={`rounded-xl border p-5 mb-6 ${rc.bg}`}>
            <div className={`flex items-start gap-3 ${rc.text}`}>
              <ReadinessIcon size={24} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-base">{readiness.label}</p>
                <p className="text-sm mt-1 opacity-90">{rc.msg}</p>
                <p className="text-xs mt-2 opacity-70">
                  Based on {totalExamAttempts} exam mode attempt{totalExamAttempts !== 1 ? 's' : ''}.
                  Average score: <strong>{avgScore}/1000</strong> (passing: 700).
                </p>
              </div>
            </div>
          </div>
        )}

        {!totalExamAttempts && (
          <div className="card p-8 text-center text-gray-400 mb-6">
            This student hasn't taken any exam mode sessions yet.
          </div>
        )}

        {/* Score history bar chart */}
        {examSessions.length > 0 && (
          <div className="card p-6 mb-6">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Score History (Exam Mode)</h2>
            <p className="text-xs text-gray-400 mb-4">Orange dashed line = passing score (700). Green = Pass, Red = Fail.</p>
            <BarChart sessions={examSessions} passingScore={700} />
          </div>
        )}

        {/* Domain competency */}
        {domainSummary.length > 0 && (
          <div className="card p-6 mb-6">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Domain Competency (Across All Exam Sessions)</h2>
            <DomainBars domainSummary={domainSummary} />
            <p className="text-xs text-gray-400 mt-4">Percentage of sessions where each domain was marked "Meets Competency".</p>
          </div>
        )}

        {/* Full session history */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">All Sessions</h2>
            <div className="flex items-center gap-3">
              {actionMsg && (
                <span className="text-xs text-green-600 font-medium">{actionMsg}</span>
              )}
              {sessions.length > 0 && (
                <button
                  onClick={resetAllSessions}
                  disabled={resettingAll}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition font-medium disabled:opacity-50"
                  title="Delete all exam history for this student"
                >
                  <RefreshCw size={12} className={resettingAll ? 'animate-spin' : ''} />
                  {resettingAll ? 'Resetting…' : 'Reset All History'}
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 text-xs">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Exam</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Mode</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Score</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Result</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sessions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No sessions yet.</td></tr>
              ) : [...sessions].reverse().map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                  <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(s.submitted_at || s.started_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">{s.examName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.mode === 'exam' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                      {s.mode}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">
                    {s.score != null ? `${s.score}/1000` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {s.cancelled
                      ? <span className="text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">Cancelled</span>
                      : s.passed
                        ? <span className="badge-pass">PASS</span>
                        : <span className="badge-fail">FAIL</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {s.submitted_at && !s.cancelled && (
                        <button
                          onClick={() => nav(`/results/${s.id}`)}
                          title="View full result report"
                          className="opacity-0 group-hover:opacity-100 text-aws-orange hover:underline text-xs font-medium flex items-center gap-1 transition"
                        >
                          <Eye size={12} /> Report
                        </button>
                      )}
                      <button
                        onClick={() => deleteSession(s.id)}
                        disabled={deletingSession === s.id}
                        title="Delete this session"
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition disabled:opacity-50"
                      >
                        {deletingSession === s.id
                          ? <RefreshCw size={13} className="animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        </> /* end performance tab */}
      </div>
    </div>
  );
}
