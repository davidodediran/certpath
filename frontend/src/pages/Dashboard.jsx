import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  Clock, BookOpen, Award, ChevronRight, LogOut, BarChart2,
  TrendingUp, TrendingDown, Minus, Rocket, CheckCircle,
  AlertTriangle, Target, Zap, Settings, XCircle, ShieldCheck, KeyRound, Star
} from 'lucide-react';
import FontScaleBar from '../components/FontScaleBar';
import SettingsPanel from '../components/SettingsPanel';
import ThemeToggle from '../components/ThemeToggle';

// ── SVG Score Chart ──────────────────────────────────────────
function ScoreChart({ timeline, passingScore = 700 }) {
  if (!timeline || timeline.length < 2) return (
    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
      Take at least 2 exams to see your trend chart.
    </div>
  );

  const W = 560, H = 160, PAD = { top: 16, right: 16, bottom: 32, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const minScore = Math.min(0, ...timeline.map((t) => t.score));
  const maxScore = 1000;
  const scaleY = (v) => PAD.top + innerH - ((v - minScore) / (maxScore - minScore)) * innerH;
  const scaleX = (i) => PAD.left + (i / Math.max(timeline.length - 1, 1)) * innerW;

  const examPoints = timeline.filter((t) => t.mode === 'exam');
  const practicePoints = timeline.filter((t) => t.mode === 'practice');

  const toPath = (pts, allPts) =>
    pts.map((p) => {
      const i = allPts.indexOf(p);
      return `${i === 0 ? 'M' : 'L'}${scaleX(timeline.indexOf(p))},${scaleY(p.score)}`;
    }).join(' ');

  // Passing line Y
  const passY = scaleY(passingScore);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
      {/* Grid lines */}
      {[0, 250, 500, 700, 750, 1000].map((v) => (
        <g key={v}>
          <line x1={PAD.left} y1={scaleY(v)} x2={W - PAD.right} y2={scaleY(v)}
            stroke={v === passingScore ? '#f59e0b' : '#e5e7eb'} strokeWidth={v === passingScore ? 1.5 : 0.5}
            strokeDasharray={v === passingScore ? '4 3' : undefined} />
          <text x={PAD.left - 6} y={scaleY(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</text>
        </g>
      ))}

      {/* Passing score label */}
      <text x={W - PAD.right + 2} y={passY + 4} fontSize={8} fill="#f59e0b">Pass</text>

      {/* Practice line */}
      {practicePoints.length >= 2 && (
        <path d={toPath(practicePoints, timeline)} fill="none" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="3 2" />
      )}

      {/* Exam line */}
      {examPoints.length >= 2 && (
        <path d={toPath(examPoints, timeline)} fill="none" stroke="#f97316" strokeWidth={2} strokeLinejoin="round" />
      )}

      {/* Dots */}
      {timeline.map((pt, i) => {
        const cx = scaleX(i), cy = scaleY(pt.score);
        const isExam = pt.mode === 'exam';
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={isExam ? 5 : 3.5}
              fill={isExam ? (pt.passed ? '#22c55e' : '#ef4444') : '#9ca3af'}
              stroke="white" strokeWidth={1.5} />
          </g>
        );
      })}

      {/* X-axis dates */}
      {timeline.map((pt, i) => (
        <text key={i} x={scaleX(i)} y={H - 4} textAnchor="middle" fontSize={8} fill="#9ca3af">
          {new Date(pt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </text>
      ))}
    </svg>
  );
}

// ── Domain Bar ───────────────────────────────────────────────
function DomainBars({ domainSummary }) {
  if (!domainSummary || !domainSummary.length) return (
    <p className="text-gray-400 text-sm">No domain data yet.</p>
  );
  return (
    <div className="space-y-3">
      {domainSummary.map(({ domain, avgPct, meetsPct }) => (
        <div key={domain}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-700 dark:text-gray-300 font-medium truncate pr-2">{domain}</span>
            <span className={`font-semibold ${avgPct >= 70 ? 'text-green-600' : avgPct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
              {avgPct}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${avgPct >= 70 ? 'bg-green-500' : avgPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${avgPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{meetsPct}% of sessions met competency</p>
        </div>
      ))}
    </div>
  );
}

// ── Readiness Card ───────────────────────────────────────────
function ReadinessCard({ readiness, trend, avgExamScore, bestScore, passCount, examAttempts }) {
  if (!readiness) {
    return (
      <div className="card p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[160px]">
        <Target size={28} className="text-gray-300" />
        <p className="font-semibold text-gray-500">No Exam Data Yet</p>
        <p className="text-xs text-gray-400">Complete an exam (not practice) to see your readiness rating.</p>
      </div>
    );
  }

  const colors = {
    green: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    lime:  { bg: 'bg-lime-50 dark:bg-lime-900/20',   border: 'border-lime-200 dark:border-lime-800',   text: 'text-lime-700 dark:text-lime-300',   badge: 'bg-lime-100 text-lime-800' },
    yellow:{ bg: 'bg-yellow-50 dark:bg-yellow-900/20',border: 'border-yellow-200 dark:border-yellow-700',text: 'text-yellow-700 dark:text-yellow-300',badge: 'bg-yellow-100 text-yellow-800' },
    red:   { bg: 'bg-red-50 dark:bg-red-900/20',     border: 'border-red-200 dark:border-red-800',     text: 'text-red-700 dark:text-red-300',     badge: 'bg-red-100 text-red-800' },
  };
  const c = colors[readiness.color] || colors.yellow;
  const Icon = readiness.icon === 'rocket' ? Rocket : readiness.icon === 'check' ? CheckCircle : readiness.icon === 'trending' ? TrendingUp : AlertTriangle;

  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;
  const trendColor = trend?.direction === 'up' ? 'text-green-500' : trend?.direction === 'down' ? 'text-red-500' : 'text-gray-400';

  return (
    <div className={`card p-5 border ${c.border} ${c.bg}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.badge}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className={`font-bold text-lg leading-tight ${c.text}`}>{readiness.label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{readiness.sublabel}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{avgExamScore ?? '—'}</p>
          <p className="text-xs text-gray-500">Avg Score</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{bestScore ?? '—'}</p>
          <p className="text-xs text-gray-500">Best Score</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{passCount}/{examAttempts}</p>
          <p className="text-xs text-gray-500">Passed</p>
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1.5 mt-3 text-sm font-medium ${trendColor}`}>
          <TrendIcon size={16} />
          <span>{trend.label}</span>
          {trend.delta > 0 && <span className="text-xs text-gray-400">(Δ{trend.delta} pts)</span>}
        </div>
      )}
    </div>
  );
}

// ── Qualification Progress Card ──────────────────────────────
function QualificationCard({ qp }) {
  if (!qp) return null;
  const { passCount, passCount750, passCount800, pathA, pathB,
          avgPassScore, totalAttempts, isQualified } = qp;

  // Support both old and new API shape gracefully
  const pA = pathA || { required: 11, scoreMin: 750, current: passCount750 ?? passCount };
  const pB = pathB || { required: 9,  scoreMin: 800, current: passCount800 ?? 0 };

  const pathADone = pA.current > (pA.required - 1);
  const pathBDone = pB.current > (pB.required - 1);

  const pctA = Math.min(100, Math.round((pA.current / pA.required) * 100));
  const pctB = Math.min(100, Math.round((pB.current / pB.required) * 100));

  if (isQualified) {
    return (
      <div className="card p-5 border-2 border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
            <Star size={22} className="text-yellow-500 fill-yellow-400" />
          </div>
          <div>
            <p className="font-bold text-yellow-800 dark:text-yellow-300 text-lg leading-tight">🏆 You're Qualified!</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
              You've met the requirements to be put forward for certification.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-yellow-200 dark:border-yellow-700/50 text-center">
          <div>
            <p className="text-lg font-bold text-yellow-800 dark:text-yellow-300">{passCount}</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400">Total Passes</p>
          </div>
          <div>
            <p className="text-lg font-bold text-yellow-800 dark:text-yellow-300">
              {avgPassScore !== null ? `${avgPassScore}/1000` : '—'}
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400">Avg Pass Score</p>
          </div>
          <div>
            <p className="text-lg font-bold text-yellow-800 dark:text-yellow-300">{totalAttempts}</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400">Total Attempts</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Star size={16} className="text-aws-orange" />
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Qualification Progress</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
        Complete <strong>either path</strong> below to qualify for certification:
      </p>

      <div className="space-y-5">
        {/* Path A */}
        <div className={`rounded-xl p-3.5 border ${pathADone ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Path A — Score ≥ {pA.scoreMin}/1000 more than {pA.required - 1} times
            </span>
            {pathADone
              ? <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={12} /> Done</span>
              : <span className="text-xs text-gray-500 font-medium">{pA.current} / {pA.required}</span>
            }
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pathADone ? 'bg-green-500' : 'bg-aws-orange'}`}
              style={{ width: `${pctA}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Passes with score ≥ {pA.scoreMin}: <strong className="text-gray-600 dark:text-gray-300">{pA.current}</strong>
          </p>
        </div>

        {/* OR divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">OR</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Path B */}
        <div className={`rounded-xl p-3.5 border ${pathBDone ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Path B — Score ≥ {pB.scoreMin}/1000 more than {pB.required - 1} times
            </span>
            {pathBDone
              ? <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={12} /> Done</span>
              : <span className="text-xs text-gray-500 font-medium">{pB.current} / {pB.required}</span>
            }
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pathBDone ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${pctB}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Passes with score ≥ {pB.scoreMin}: <strong className="text-gray-600 dark:text-gray-300">{pB.current}</strong>
          </p>
        </div>

        {totalAttempts === 0 && (
          <p className="text-xs text-gray-400 text-center">Start taking exam mode attempts to track your progress.</p>
        )}
      </div>
    </div>
  );
}

// ── Student MFA Section ──────────────────────────────────────
function StudentMfaSection() {
  const [status, setStatus] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const loadStatus = () => {
    api.get('/student/mfa/status').then((r) => setStatus(r.data.mfaEnabled)).catch(() => setStatus(false));
  };

  useEffect(() => { loadStatus(); }, []);

  const startSetup = async () => {
    setErr(''); setMsg(''); setLoading(true);
    try {
      const { data } = await api.post('/student/mfa/setup');
      setSetupData(data); setVerifyCode('');
    } catch (e) { setErr(e.response?.data?.error || 'Setup failed'); }
    finally { setLoading(false); }
  };

  const enableMfa = async () => {
    if (!verifyCode.trim()) { setErr('Enter the 6-digit code.'); return; }
    setErr(''); setLoading(true);
    try {
      await api.post('/student/mfa/enable', { code: verifyCode.trim() });
      setMsg('Two-factor authentication is now active. You will be prompted for a code at each login.'); setSetupData(null); setVerifyCode('');
      loadStatus();
    } catch (e) { setErr(e.response?.data?.error || 'Invalid code. Try again.'); }
    finally { setLoading(false); }
  };

  const disableMfa = async () => {
    if (!disableCode.trim()) { setErr('Enter your authenticator code to confirm.'); return; }
    setErr(''); setLoading(true);
    try {
      await api.post('/student/mfa/disable', { code: disableCode.trim() });
      setMsg('Two-factor authentication disabled.'); setShowDisableForm(false); setDisableCode('');
      loadStatus();
    } catch (e) { setErr(e.response?.data?.error || 'Failed to disable MFA.'); }
    finally { setLoading(false); }
  };

  if (status === null) return (
    <div className="card p-6 mt-4 flex items-center gap-3 text-gray-400 text-sm">
      <ShieldCheck size={18} /> Loading security settings…
    </div>
  );

  return (
    <div className="card p-6 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-aws-orange" />
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Two-Factor Authentication</h3>
        </div>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${status ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
          {status ? '● Enabled' : '○ Disabled'}
        </span>
      </div>

      {msg && <p className="text-sm text-green-600 dark:text-green-400 mb-3">{msg}</p>}
      {err && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{err}</p>}

      {!status && !setupData && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Protect your account with an authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.).
            Once enabled, you'll be asked for a 6-digit code each time you sign in.
          </p>
          <button onClick={startSetup} disabled={loading}
            className="py-2 px-5 bg-aws-orange hover:bg-aws-orange/90 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
            {loading ? 'Setting up…' : 'Set Up Two-Factor Auth'}
          </button>
        </div>
      )}

      {!status && setupData && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Scan the QR code below with your authenticator app, then enter the 6-digit code it shows to confirm.
          </p>
          <div className="flex justify-center">
            <img src={setupData.qrDataUrl} alt="MFA QR Code" className="w-48 h-48 rounded-xl border border-gray-200 dark:border-gray-700 p-1 bg-white" />
          </div>
          <div className="text-center">
            <button onClick={() => setShowSecret((v) => !v)} className="text-xs text-aws-orange hover:underline">
              {showSecret ? 'Hide manual key' : "Can't scan? Show manual entry key"}
            </button>
            {showSecret && (
              <p className="mt-2 font-mono text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 break-all select-all border border-gray-200 dark:border-gray-700">{setupData.secret}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Verification Code</label>
            <input type="text" inputMode="numeric" maxLength={7}
              className="input text-center text-xl tracking-widest font-mono"
              placeholder="000 000" value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/[^0-9 ]/g, ''))}
              autoComplete="one-time-code" />
            <p className="text-xs text-gray-400 mt-1">Enter the 6-digit code your authenticator app shows right now.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={enableMfa} disabled={loading}
              className="flex-1 py-2 px-4 bg-aws-orange hover:bg-aws-orange/90 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
              {loading ? 'Verifying…' : 'Enable Two-Factor Auth'}
            </button>
            <button onClick={() => { setSetupData(null); setVerifyCode(''); setErr(''); }} className="btn-secondary text-sm px-4">Cancel</button>
          </div>
        </div>
      )}

      {status && !showDisableForm && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Your account is protected. You'll be asked for your authenticator code every time you sign in.
          </p>
          <button onClick={() => { setShowDisableForm(true); setMsg(''); setErr(''); }}
            className="text-sm text-red-500 hover:text-red-700 underline transition">
            Disable Two-Factor Auth
          </button>
        </div>
      )}

      {status && showDisableForm && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Enter the current code from your authenticator app to disable two-factor authentication.</p>
          <input type="text" inputMode="numeric" maxLength={7}
            className="input text-center tracking-widest font-mono text-lg"
            placeholder="000 000" value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/[^0-9 ]/g, ''))}
            autoComplete="one-time-code" autoFocus />
          <div className="flex gap-2">
            <button onClick={disableMfa} disabled={loading}
              className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
              {loading ? 'Disabling…' : 'Disable MFA'}
            </button>
            <button onClick={() => { setShowDisableForm(false); setDisableCode(''); setErr(''); }}
              className="btn-secondary text-sm px-4">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────
export default function Dashboard() {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [examTypes, setExamTypes] = useState([]);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [historyFilter, setHistoryFilter] = useState(null); // null | 'exam' | 'practice' | 'passed'
  const [examSort, setExamSort] = useState('az');   // 'az' | 'za'
  const [historySort, setHistorySort] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'score_desc' | 'score_asc' | 'name_az' | 'name_za'
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('certpath_onboarded')
  );
  const dismissOnboarding = () => {
    localStorage.setItem('certpath_onboarded', '1');
    setShowOnboarding(false);
  };

  useEffect(() => {
    Promise.all([
      api.get('/exam-types'),
      api.get('/results'),
      api.get('/results/progress'),
    ]).then(([et, res, prog]) => {
      setExamTypes(et.data);
      setResults(res.data);
      setProgress(prog.data);
    }).finally(() => setLoading(false));
  }, []);

  const logout = () => { localStorage.clear(); nav('/login'); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-gray-500 dark:text-gray-400">Loading...</div>
    </div>
  );

  const displayName = user.name || user.email || 'Student';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <nav className="bg-aws-navy shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-aws-orange rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-white font-semibold">AWS Exam Platform</span>
          </div>
          <div className="flex items-center gap-3">
            <FontScaleBar />
            <ThemeToggle />
            <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-white transition" title="Display settings">
              <Settings size={17} />
            </button>
            <span className="text-gray-300 text-sm hidden sm:block">{user.name || user.email}</span>
            <button onClick={logout} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm transition">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── First-visit onboarding banner ── */}
        {showOnboarding && (
          <div className="mb-6 card p-5 border-aws-orange/40 bg-orange-50 dark:bg-orange-900/10 border-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-bold text-aws-orange text-base mb-1">Welcome to CertPath!</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  Here's how to get started with your AWS certification journey:
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { step: '1', title: 'Pick an exam', desc: 'Choose your target certification from the Available Exams below.' },
                    { step: '2', title: 'Practice first', desc: 'Use Practice Mode to learn without time pressure — answers shown after each question.' },
                    { step: '3', title: 'Take the exam', desc: 'When ready, switch to Exam Mode for a timed, realistic simulation.' },
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-aws-orange text-white font-bold text-sm flex items-center justify-center flex-shrink-0 mt-0.5">{step}</div>
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={dismissOnboarding}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0 mt-0.5"
                title="Dismiss">
                <XCircle size={20} />
              </button>
            </div>
            <button onClick={dismissOnboarding}
              className="mt-4 text-xs text-aws-orange hover:underline font-medium">
              Got it, don't show again →
            </button>
          </div>
        )}

        {/* Welcome + quick stats */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {displayName}
          </h1>
          {user.cohort && (
            <p className="text-gray-500 dark:text-gray-400 mt-0.5">
              Cohort: <span className="font-medium text-aws-orange">{user.cohort}</span>
            </p>
          )}
        </div>

        {/* Stats strip */}
        {progress && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Attempts', value: progress.totalAttempts, icon: BarChart2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', hint: 'View all history', filter: null },
              { label: 'Exam Mode', value: progress.examAttempts, icon: Target, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', hint: 'View exam attempts', filter: 'exam' },
              { label: 'Practice Mode', value: progress.practiceAttempts, icon: BookOpen, color: 'text-aws-orange', bg: 'bg-orange-50 dark:bg-orange-900/20', hint: 'View practice sessions', filter: 'practice' },
              { label: 'Exams Passed', value: progress.passCount, icon: Award, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', hint: 'View passed exams', filter: 'passed' },
            ].map(({ label, value, icon: Icon, color, bg, hint, filter }) => (
              <button key={label} onClick={() => { setActiveTab('history'); setHistoryFilter(filter); }}
                className={`card p-4 flex items-center gap-3 ${bg} cursor-pointer hover:shadow-md hover:ring-2 hover:ring-aws-orange/30 transition-all text-left w-full group`}>
                <Icon size={20} className={color} />
                <div className="min-w-0">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xs text-aws-orange opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">{hint} →</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BookOpen },
            { id: 'progress', label: 'My Progress', icon: BarChart2 },
            { id: 'history', label: 'History', icon: Clock },
            { id: 'account', label: 'Account', icon: KeyRound },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setActiveTab(id); if (id !== 'history') setHistoryFilter(null); }}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                activeTab === id
                  ? 'border-aws-orange text-aws-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <section>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <BookOpen size={18} className="text-aws-orange" /> Available Exams
              </h2>
              {examTypes.length > 1 && (
                <select
                  value={examSort}
                  onChange={(e) => setExamSort(e.target.value)}
                  className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer"
                >
                  <option value="az">A → Z</option>
                  <option value="za">Z → A</option>
                </select>
              )}
            </div>
            {examTypes.length === 0 ? (
              <div className="card p-10 text-center">
                <BookOpen size={36} className="text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">No exams available yet</p>
                <p className="text-sm text-gray-400">Your administrator hasn't set up any certifications for your cohort. Check back soon or contact your admin.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...examTypes].sort((a, b) =>
                  examSort === 'az'
                    ? a.name.localeCompare(b.name)
                    : b.name.localeCompare(a.name)
                ).map((et) => (
                  <button key={et.id} onClick={() => nav(`/exam/${et.id}/mode`)}
                    className="card p-5 text-left hover:shadow-md hover:border-aws-orange transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-aws-orange/10 rounded-lg flex items-center justify-center">
                        <Award size={22} className="text-aws-orange" />
                      </div>
                      <ChevronRight size={18} className="text-gray-400 group-hover:text-aws-orange transition-colors mt-1" />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight mb-1">{et.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{et.description}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1"><BookOpen size={12} /> {et.questions_per_exam ?? et.questionsPerExam} questions</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {et.time_limit_minutes ?? et.timeLimitMinutes} min</span>
                    </div>
                    <div className="mt-2 text-xs font-medium text-aws-orange uppercase tracking-wide">{et.code}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Progress Tab ── */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            {/* Readiness */}
            <ReadinessCard
              readiness={progress?.readiness}
              trend={progress?.trend}
              avgExamScore={progress?.avgExamScore}
              bestScore={progress?.bestScore}
              passCount={progress?.passCount}
              examAttempts={progress?.examAttempts}
            />

            {/* Qualification progress */}
            <QualificationCard qp={progress?.qualificationProgress} />

            {/* Score chart */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-2">
                <TrendingUp size={16} className="text-aws-orange" /> Score Timeline
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                <span className="inline-flex items-center gap-1 mr-3">
                  <span className="w-3 h-0.5 bg-aws-orange inline-block rounded" /> Exam mode
                </span>
                <span className="inline-flex items-center gap-1 mr-3">
                  <span className="w-3 h-0.5 bg-gray-300 inline-block rounded" style={{borderTop:'1px dashed #9ca3af'}} /> Practice
                </span>
                <span className="inline-flex items-center gap-1 mr-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Pass
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Fail
                </span>
              </p>
              <ScoreChart
                timeline={progress?.timeline || []}
                passingScore={700}
              />
            </div>

            {/* Domain breakdown */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-2">
                <Zap size={16} className="text-aws-orange" /> Domain Performance
              </h3>
              <p className="text-xs text-gray-400 mb-4">Based on your exam-mode sessions. Below 70% means needs improvement.</p>
              <DomainBars domainSummary={progress?.domainSummary} />
            </div>
          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === 'history' && (
          <section>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {historyFilter && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Showing: <span className="font-semibold text-aws-orange capitalize">
                      {historyFilter === 'passed' ? 'Passed Exams' : historyFilter === 'exam' ? 'Exam Mode' : 'Practice Mode'}
                    </span>
                  </span>
                  <button onClick={() => setHistoryFilter(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-400">Sort:</span>
                <select
                  value={historySort}
                  onChange={(e) => setHistorySort(e.target.value)}
                  className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="score_desc">Highest Score</option>
                  <option value="score_asc">Lowest Score</option>
                  <option value="name_az">Exam Name A → Z</option>
                  <option value="name_za">Exam Name Z → A</option>
                </select>
              </div>
            </div>
            {(() => {
              const filtered = results
                .filter((r) => {
                  if (!historyFilter) return true;
                  if (historyFilter === 'exam') return r.mode === 'exam';
                  if (historyFilter === 'practice') return r.mode === 'practice';
                  if (historyFilter === 'passed') return r.passed && !r.cancelled;
                  return true;
                })
                .sort((a, b) => {
                  if (historySort === 'date_desc') return new Date(b.submitted_at) - new Date(a.submitted_at);
                  if (historySort === 'date_asc')  return new Date(a.submitted_at) - new Date(b.submitted_at);
                  if (historySort === 'score_desc') return (b.score ?? -1) - (a.score ?? -1);
                  if (historySort === 'score_asc')  return (a.score ?? 9999) - (b.score ?? 9999);
                  if (historySort === 'name_az') return (a.examName || '').localeCompare(b.examName || '');
                  if (historySort === 'name_za') return (b.examName || '').localeCompare(a.examName || '');
                  return 0;
                });
              return filtered.length === 0 ? (
                <div className="card p-8 text-center text-gray-400">
                  {results.length === 0 ? 'No attempts yet. Start an exam!' : 'No results match this filter.'}
                </div>
              ) : (
              <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs">
                      {['Exam', 'Mode', 'Date', 'Score', 'Result', ''].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.examName}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            r.mode === 'exam'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          }`}>
                            {r.mode === 'exam' ? 'Exam' : 'Practice'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(r.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                          {r.cancelled ? <span className="text-red-500 text-xs">Cancelled</span> : `${r.score} / 1000`}
                        </td>
                        <td className="px-4 py-3">
                          {r.cancelled ? (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Cancelled</span>
                          ) : r.passed ? (
                            <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full font-semibold">PASS</span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full font-semibold">FAIL</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!r.cancelled && (
                            <button onClick={() => nav(`/results/${r.id}`)}
                              className="text-aws-orange hover:underline text-xs font-medium">
                              View Report
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
              );
            })()}
          </section>
        )}

        {/* ── Account Tab ── */}
        {activeTab === 'account' && (
          <section>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-1">
              <KeyRound size={17} className="text-aws-orange" /> Account Security
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Manage two-factor authentication for your student account.</p>
            <StudentMfaSection />
          </section>
        )}
      </div>
    </div>
  );
}
