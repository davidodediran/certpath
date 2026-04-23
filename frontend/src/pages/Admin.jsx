import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  LogOut, BarChart2, BookOpen, Users, Settings, ShieldOff, MessageSquare,
  Download, Upload, Plus, Trash2, CheckCircle, XCircle, Search, RefreshCw, Edit2,
  KeyRound, Eye, EyeOff, GraduationCap, ShieldCheck
} from 'lucide-react';
import FontScaleBar from '../components/FontScaleBar';
import SettingsPanel from '../components/SettingsPanel';
import ThemeToggle from '../components/ThemeToggle';

const TABS = [
  { id: 'results', label: 'Results', icon: BarChart2 },
  { id: 'questions', label: 'Questions', icon: BookOpen },
  { id: 'cohorts', label: 'Cohorts', icon: Users },
  { id: 'examtypes', label: 'Exam Types', icon: Settings },
  { id: 'teachers', label: 'Teachers', icon: GraduationCap },
  { id: 'lockouts', label: 'Lockouts', icon: ShieldOff },
  { id: 'surveys', label: 'Surveys', icon: MessageSquare },
  { id: 'account', label: 'My Account', icon: KeyRound },
];

// ─── RESULTS TAB ────────────────────────────────────────────
function ResultsTab() {
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [emailFilter, setEmailFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = (p = 1) => {
    setLoading(true);
    api.get('/admin/results', { params: { email: emailFilter, page: p, limit: 25 } })
      .then((r) => { setResults(r.data.results); setTotal(r.data.total); setPage(p); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">All Exam Results</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-8 py-1.5 text-sm w-48" placeholder="Filter by email" value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(1)} />
          </div>
          <button onClick={() => load(1)} className="btn-secondary py-1.5 px-3 text-sm"><RefreshCw size={14} /></button>
          <a href="/api/admin/results/export.csv" className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5">
            <Download size={14} /> CSV
          </a>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs">
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Cohort</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Exam</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Mode</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Score</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Result</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No results found.</td></tr>
            ) : results.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-mono text-xs">{r.email || '—'}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 text-xs">{r.cohortName || '—'}</td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-xs">{r.examName}</td>
                <td className="px-4 py-2.5"><span className="badge-practice capitalize">{r.mode}</span></td>
                <td className="px-4 py-2.5 font-semibold">{r.cancelled ? '—' : `${r.score}/1000`}</td>
                <td className="px-4 py-2.5">
                  {r.cancelled ? <span className="badge-fail">Cancelled</span> : r.passed ? <span className="badge-pass">PASS</span> : <span className="badge-fail">FAIL</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(r.submitted_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {total > 25 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm text-gray-500">
            <span>{total} total</span>
            <div className="flex gap-2">
              <button onClick={() => load(page - 1)} disabled={page <= 1} className="btn-secondary py-1 px-3 text-xs disabled:opacity-40">Prev</button>
              <span className="py-1 px-2">Page {page}</span>
              <button onClick={() => load(page + 1)} disabled={page * 25 >= total} className="btn-secondary py-1 px-3 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── QUESTIONS TAB ──────────────────────────────────────────
function QuestionsTab() {
  const [questions, setQuestions] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadExamType, setUploadExamType] = useState('');
  const fileRef = useRef();

  // Improper format questions from all teachers
  const [flaggedQs, setFlaggedQs] = useState([]);
  const [flaggedTotal, setFlaggedTotal] = useState(0);
  const [expandedFlagged, setExpandedFlagged] = useState(null); // id of expanded row
  const [showRaw, setShowRaw] = useState(null); // id with raw shown

  const loadFlagged = () => {
    api.get('/admin/questions/flagged').then((r) => {
      setFlaggedQs(r.data.questions || []);
      setFlaggedTotal(r.data.total || 0);
    }).catch(() => {});
  };

  useEffect(() => {
    api.get('/admin/exam-types').then((r) => { setExamTypes(r.data); if (r.data[0]) setUploadExamType(String(r.data[0].id)); });
    loadQuestions();
    loadFlagged();
  }, []);

  const loadQuestions = (etId = '', owner = '', quality = '') => {
    // quality filter is client-side — fetch all and filter
    api.get('/admin/questions', { params: { examTypeId: etId || undefined, ownerType: owner || undefined, limit: 200 } })
      .then((r) => {
        let qs = r.data.questions;
        if (quality === 'missing_answer') qs = qs.filter((q) => !q.has_answer);
        if (quality === 'has_answer') qs = qs.filter((q) => q.has_answer);
        setQuestions(qs);
        setTotal(quality ? qs.length : r.data.total);
      });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !uploadExamType) return;
    setUploading(true);
    setUploadMsg('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('examTypeId', uploadExamType);
    try {
      const { data } = await api.post('/admin/questions/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadMsg(`Imported ${data.imported} questions successfully.`);
      loadQuestions(selectedType, ownerFilter, qualityFilter);
    } catch (err) {
      setUploadMsg('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleActive = async (q) => {
    await api.patch(`/admin/questions/${q.id}`, { active: !q.active });
    setQuestions((qs) => qs.map((x) => x.id === q.id ? { ...x, active: !q.active } : x));
  };

  const deleteFlagged = async (id) => {
    if (!confirm('Delete this flagged question? This cannot be undone.')) return;
    await api.delete(`/admin/questions/flagged/${id}`);
    setFlaggedQs((prev) => prev.filter((q) => q.id !== id));
    setFlaggedTotal((t) => Math.max(0, t - 1));
  };

  const ownerLabel = (q) => {
    if (q.owner_type === 'teacher') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" title={q.teacherEmail || ''}>
          <GraduationCap size={11} /> {q.teacherName || 'Teacher'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
        Admin
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sample download */}
      <div className="card p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 mb-2">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Download Sample Question Templates</p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">Use these as a reference format when preparing your own question files for upload.</p>
        <div className="flex gap-2 flex-wrap">
          <a href="/api/samples/questions.json" className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
            <Download size={13} /> sample_questions.json
          </a>
          <a href="/api/samples/questions.csv" className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
            <Download size={13} /> sample_questions.csv
          </a>
        </div>
      </div>

      {/* Upload */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><Upload size={16} /> Upload New Questions</h3>
        <form onSubmit={handleUpload} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Exam Type</label>
            <select className="input text-sm py-2 w-56" value={uploadExamType} onChange={(e) => setUploadExamType(e.target.value)}>
              {examTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">File (PDF, JSON, CSV)</label>
            <input ref={fileRef} type="file" accept=".pdf,.json,.csv" className="input text-sm py-1.5 w-64" required />
          </div>
          <button type="submit" disabled={uploading} className="btn-primary py-2 flex items-center gap-2">
            <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
        {uploadMsg && <p className={`mt-2 text-sm ${uploadMsg.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>{uploadMsg}</p>}
        {uploadExamType && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
            <span className="text-xs text-gray-400">Export questions for this exam type:</span>
            <a
              href={`/api/admin/questions/download?examTypeId=${uploadExamType}`}
              download
              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <Download size={13} /> Download CSV
            </a>
          </div>
        )}
      </div>

      {/* Table */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Questions ({total})</h3>
          <div className="flex gap-2 flex-wrap">
            {/* Quality filter */}
            <select
              className="input text-sm py-1.5 w-44"
              value={qualityFilter}
              onChange={(e) => { setQualityFilter(e.target.value); loadQuestions(selectedType, ownerFilter, e.target.value); }}
            >
              <option value="">All Quality</option>
              <option value="missing_answer">Missing Answer</option>
              <option value="has_answer">Has Answer</option>
            </select>
            {/* Owner filter */}
            <select
              className="input text-sm py-1.5 w-40"
              value={ownerFilter}
              onChange={(e) => { setOwnerFilter(e.target.value); loadQuestions(selectedType, e.target.value, qualityFilter); }}
            >
              <option value="">All Owners</option>
              <option value="admin">Admin only</option>
              <option value="teacher">Teachers only</option>
            </select>
            {/* Exam type filter */}
            <select
              className="input text-sm py-1.5 w-44"
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); loadQuestions(e.target.value, ownerFilter, qualityFilter); }}
            >
              <option value="">All Exam Types</option>
              {examTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
            </select>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs">
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">ID</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Question (preview)</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Exam Type</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Owner</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Answer</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {questions.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No questions found.</td></tr>
              )}
              {questions.map((q) => (
                <tr key={q.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!q.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2 text-gray-400 text-xs">#{q.id}</td>
                  <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate" title={q.question}>{q.question}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{q.examTypeName || '—'}</td>
                  <td className="px-4 py-2">{ownerLabel(q)}</td>
                  <td className="px-4 py-2">{q.has_answer ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-gray-300" />}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => toggleActive(q)} className={`text-xs px-2 py-0.5 rounded border ${q.active ? 'border-green-400 text-green-600 hover:bg-red-50 hover:text-red-600 hover:border-red-400' : 'border-gray-300 text-gray-400 hover:bg-green-50 hover:text-green-600 hover:border-green-400'} transition`}>
                      {q.active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {/* ── Improper Format section ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Improper Format Questions</h3>
            {flaggedTotal > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{flaggedTotal}</span>
            )}
          </div>
          <button onClick={loadFlagged} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            Refresh
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Questions flagged during teacher CSV uploads — formatting issues prevented clean import.
          View the raw CSV line for diagnosis.
        </p>

        {flaggedQs.length === 0 ? (
          <div className="card p-6 text-center text-gray-400 text-sm">
            <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
            No improper-format questions found.
          </div>
        ) : (
          <div className="space-y-2">
            {flaggedQs.map((q) => {
              const issueData = (() => {
                try { return typeof q.import_issue === 'string' ? JSON.parse(q.import_issue) : (q.import_issue || {}); }
                catch { return {}; }
              })();
              const issues = issueData.issues || [];
              const rawLine = issueData.raw || '';
              const isExpanded = expandedFlagged === q.id;
              const isRawShown = showRaw === q.id;
              const opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);

              return (
                <div key={q.id} className="card border-l-4 border-l-red-400 overflow-hidden">
                  <div className="p-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{q.question}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Improper Format</span>
                        {q.teacherName && (
                          <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded-full">
                            {q.teacherName} ({q.teacherEmail})
                          </span>
                        )}
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{q.domain}</span>
                        {q.examTypeName && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{q.examTypeName}</span>}
                      </div>
                      {issues.map((issue, i) => (
                        <p key={i} className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-start gap-1">
                          <XCircle size={11} className="mt-0.5 shrink-0" /> {issue}
                        </p>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setExpandedFlagged(isExpanded ? null : q.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200"
                      >
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </button>
                      <button
                        onClick={() => deleteFlagged(q.id)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3 bg-gray-50 dark:bg-gray-800/30">
                      {/* Parsed options */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Options (as parsed)</p>
                        <div className="space-y-1">
                          {opts.map((o) => (
                            <div key={o.label} className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded ${
                              /^(and|or|,|\.|with)\b/i.test(o.text) ? 'bg-red-50 dark:bg-red-900/20 text-red-700' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}>
                              <span className="font-bold w-4 shrink-0">{o.label}.</span>
                              <span>{o.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Raw CSV line */}
                      {rawLine && (
                        <div>
                          <button
                            onClick={() => setShowRaw(isRawShown ? null : q.id)}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 mb-1"
                          >
                            {isRawShown ? 'Hide' : 'Show'} raw CSV line
                          </button>
                          {isRawShown && (
                            <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all mt-1">
                              {rawLine}
                            </pre>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 italic">
                        Uploaded {new Date(q.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COHORTS TAB ─────────────────────────────────────────────
function CohortsTab() {
  const [cohorts, setCohorts] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [form, setForm] = useState({ code: '', name: '', examTypeId: '' });
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // cohort id pending hard delete

  const load = () => {
    api.get('/admin/cohorts').then((r) => setCohorts(r.data));
    api.get('/admin/exam-types').then((r) => { setExamTypes(r.data); if (r.data[0]) setForm((f) => ({ ...f, examTypeId: String(r.data[0].id) })); });
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/admin/cohorts', { code: form.code, name: form.name, examTypeId: form.examTypeId || null });
      setForm((f) => ({ ...f, code: '', name: '' }));
      load();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  const toggleActive = async (cohort) => {
    const next = !cohort.active;
    const label = next ? 'activate' : 'deactivate';
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} cohort "${cohort.name}"?`)) return;
    try {
      await api.patch(`/admin/cohorts/${cohort.id}`, { active: next });
      load();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const hardDelete = async (cohort) => {
    try {
      await api.delete(`/admin/cohorts/${cohort.id}/permanent`);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      setDeleteConfirm(null);
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const active = cohorts.filter((c) => c.active);
  const inactive = cohorts.filter((c) => !c.active);

  return (
    <div className="space-y-6">
      {/* Delete confirmation modal */}
      {deleteConfirm && (() => {
        const c = cohorts.find((x) => x.id === deleteConfirm);
        return c ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">Permanently Delete Cohort?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                This will permanently delete <span className="font-semibold text-aws-orange">{c.code}</span> — <span className="font-semibold">{c.name}</span>.
                This cannot be undone. Cohorts with students cannot be deleted.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary text-sm py-1.5 px-4">Cancel</button>
                <button onClick={() => hardDelete(c)} className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition">Delete Permanently</button>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><Plus size={16} /> Create Cohort</h3>
        <form onSubmit={create} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cohort Code (e.g. KLICT-2025)</label>
            <input className="input text-sm py-2 uppercase w-40" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} required placeholder="KLICT-2025" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input className="input text-sm py-2 w-48" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Class of 2025" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Default Exam Type</label>
            <select className="input text-sm py-2 w-48" value={form.examTypeId} onChange={(e) => setForm((f) => ({ ...f, examTypeId: e.target.value }))}>
              <option value="">None</option>
              {examTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={creating} className="btn-primary py-2">Create</button>
        </form>
      </div>

      {/* Active cohorts */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Active Cohorts</span>
          <span className="text-xs text-gray-400">{active.length} cohort{active.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs">
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Code</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Name</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Exam Type</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Students</th>
            <th className="px-4 py-2.5 text-gray-500 font-medium text-right text-xs">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {active.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">No active cohorts</td></tr>
            )}
            {active.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-2.5 font-mono font-bold text-aws-orange text-sm">{c.code}</td>
                <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200">{c.name}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{c.examTypeName || '—'}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{c.studentCount}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => toggleActive(c)} className="text-xs text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 flex items-center gap-1 font-medium transition">
                      Deactivate
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <button onClick={() => setDeleteConfirm(c.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition" title="Permanently delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Inactive cohorts */}
      {inactive.length > 0 && (
        <div className="card overflow-hidden opacity-80">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">Inactive Cohorts</span>
            <span className="text-xs text-gray-400">{inactive.length}</span>
          </div>
          <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs">
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Code</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Exam Type</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Students</th>
              <th className="px-4 py-2.5 text-gray-500 font-medium text-right text-xs">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {inactive.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-2.5 font-mono font-bold text-gray-400 text-sm">{c.code}</td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-500">{c.name}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{c.examTypeName || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-400">{c.studentCount}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => toggleActive(c)} className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex items-center gap-1 font-medium transition">
                        Activate
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <button onClick={() => setDeleteConfirm(c.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition" title="Permanently delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}

// ─── EXAM TYPES TAB ──────────────────────────────────────────
// ── Domain Manager (sub-component) ──────────────────────────
function DomainManager({ examType }) {
  const [domains, setDomains] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState({ name: '', weightPercent: '', keywords: '' });
  const [seeding, setSeeding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadDomains = () =>
    api.get(`/admin/exam-types/${examType.id}/domains`).then((r) => setDomains(r.data));

  useEffect(() => { loadDomains(); }, [examType.id]);

  const addDomain = async (e) => {
    e.preventDefault();
    if (!newDomain.name) return;
    try {
      await api.post(`/admin/exam-types/${examType.id}/domains`, {
        name: newDomain.name.trim(),
        weightPercent: newDomain.weightPercent ? Number(newDomain.weightPercent) : null,
        keywords: newDomain.keywords.trim() || null,
      });
      setNewDomain({ name: '', weightPercent: '', keywords: '' });
      setAdding(false);
      loadDomains();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/admin/exam-domains/${id}`, {
        name: editForm.name,
        weightPercent: editForm.weight_percent ? Number(editForm.weight_percent) : null,
        keywords: editForm.keywords || null,
      });
      setEditId(null);
      loadDomains();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const deleteDomain = async (id) => {
    if (!confirm('Delete this domain?')) return;
    await api.delete(`/admin/exam-domains/${id}`);
    loadDomains();
  };

  const seedDefaults = async () => {
    if (!confirm(`Load AWS default domains for "${examType.code}"? This will replace existing domains.`)) return;
    setSeeding(true);
    try {
      const r = await api.post(`/admin/exam-types/${examType.id}/domains/seed`);
      alert(`Seeded ${r.data.seeded} domains.`);
      loadDomains();
    } catch (err) { alert(err.response?.data?.error || 'No defaults available for this exam code'); }
    finally { setSeeding(false); }
  };

  const totalWeight = domains.reduce((s, d) => s + (d.weight_percent || 0), 0);

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Domains / Competency Areas
          {totalWeight > 0 && <span className="ml-2 font-normal text-gray-400">({totalWeight}% total)</span>}
        </p>
        <div className="flex gap-2">
          <button onClick={seedDefaults} disabled={seeding}
            className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 flex items-center gap-1">
            {seeding ? 'Loading…' : '↺ AWS Defaults'}
          </button>
          <button onClick={() => setAdding((v) => !v)}
            className="text-xs text-aws-orange hover:text-orange-700 flex items-center gap-1">
            <Plus size={11} /> Add
          </button>
        </div>
      </div>

      {domains.length === 0 && !adding && (
        <p className="text-xs text-gray-400 italic mb-2">No domains configured. Click "↺ AWS Defaults" to load standard domains.</p>
      )}

      <div className="space-y-1.5">
        {domains.map((d) => (
          <div key={d.id} className="group">
            {editId === d.id ? (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 space-y-2">
                <input className="input text-xs py-1 w-full" value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Domain name" />
                <div className="flex gap-2">
                  <input type="number" className="input text-xs py-1 w-24" value={editForm.weight_percent || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, weight_percent: e.target.value }))} placeholder="Weight %" min={0} max={100} />
                  <input className="input text-xs py-1 flex-1" value={editForm.keywords || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, keywords: e.target.value }))} placeholder="Keywords (comma-separated)" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(d.id)} className="text-xs text-green-600 hover:text-green-800 font-medium">Save</button>
                  <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/30">
                {d.weight_percent && (
                  <div className="flex-shrink-0 w-16">
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-aws-orange rounded-full" style={{ width: `${Math.min(d.weight_percent, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-400">{d.weight_percent}%</span>
                  </div>
                )}
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 font-medium">{d.name}</span>
                <div className="opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                  <button onClick={() => { setEditId(d.id); setEditForm({ name: d.name, weight_percent: d.weight_percent, keywords: d.keywords }); }}
                    className="text-xs text-blue-500 hover:text-blue-700"><Edit2 size={11} /></button>
                  <button onClick={() => deleteDomain(d.id)} className="text-xs text-red-400 hover:text-red-600"><Trash2 size={11} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <form onSubmit={addDomain} className="mt-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 space-y-2">
          <input className="input text-xs py-1 w-full" value={newDomain.name}
            onChange={(e) => setNewDomain((f) => ({ ...f, name: e.target.value }))}
            placeholder="Domain name (e.g. Cloud Concepts)" required autoFocus />
          <div className="flex gap-2">
            <input type="number" className="input text-xs py-1 w-24" value={newDomain.weightPercent}
              onChange={(e) => setNewDomain((f) => ({ ...f, weightPercent: e.target.value }))}
              placeholder="Weight %" min={0} max={100} />
            <input className="input text-xs py-1 flex-1" value={newDomain.keywords}
              onChange={(e) => setNewDomain((f) => ({ ...f, keywords: e.target.value }))}
              placeholder="Normalization keywords (comma-separated)" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="text-xs text-green-600 hover:text-green-800 font-medium">Add Domain</button>
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

const EMPTY_DOMAIN = { name: '', weightPercent: '' };
const EMPTY_ET_FORM = { code: '', name: '', description: '', questionsPerExam: 65, timeLimitMinutes: 90, passingScore: 700 };

function ExamTypesTab() {
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(EMPTY_ET_FORM);
  const [domains, setDomains] = useState([{ ...EMPTY_DOMAIN }]);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = () => api.get('/admin/exam-types').then((r) => setTypes(r.data));
  useEffect(() => { load(); }, []);

  const totalWeight = domains.reduce((s, d) => s + (Number(d.weightPercent) || 0), 0);

  const addDomainRow = () => setDomains((ds) => [...ds, { ...EMPTY_DOMAIN }]);
  const removeDomainRow = (i) => setDomains((ds) => ds.filter((_, idx) => idx !== i));
  const updateDomainRow = (i, field, val) =>
    setDomains((ds) => ds.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data: et } = await api.post('/admin/exam-types', form);
      // Save any filled-in domains
      const validDomains = domains.filter((d) => d.name.trim());
      for (const d of validDomains) {
        await api.post(`/admin/exam-types/${et.id}/domains`, {
          name: d.name.trim(),
          weightPercent: d.weightPercent ? Number(d.weightPercent) : null,
        });
      }
      setForm(EMPTY_ET_FORM);
      setDomains([{ ...EMPTY_DOMAIN }]);
      load();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  const toggle = async (et) => {
    await api.patch(`/admin/exam-types/${et.id}`, { active: !et.active });
    load();
  };

  const remove = async (et) => {
    if (!confirm(`Deactivate "${et.name}"?`)) return;
    await api.delete(`/admin/exam-types/${et.id}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><Plus size={16} /> Add Exam Type</h3>
        <form onSubmit={create} className="space-y-5">

          {/* ── Basic info ── */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Code <span className="text-gray-400">(e.g. clf-c02)</span></label>
              <input className="input text-sm" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))} required placeholder="clf-c02" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input className="input text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="AWS Cloud Practitioner" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input className="input text-sm" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short description..." />
            </div>
          </div>

          {/* ── Exam settings ── */}
          <div className="grid sm:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Questions per Exam</label>
              <input type="number" className="input text-sm" value={form.questionsPerExam} onChange={(e) => setForm((f) => ({ ...f, questionsPerExam: Number(e.target.value) }))} min={1} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Time Limit (minutes)</label>
              <input type="number" className="input text-sm" value={form.timeLimitMinutes} onChange={(e) => setForm((f) => ({ ...f, timeLimitMinutes: Number(e.target.value) }))} min={1} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Pass Mark <span className="text-gray-400 font-normal">(out of 1000)</span>
              </label>
              <input
                type="number"
                className="input text-sm border-aws-orange/60 focus:border-aws-orange"
                value={form.passingScore}
                onChange={(e) => setForm((f) => ({ ...f, passingScore: Number(e.target.value) }))}
                min={1} max={1000}
              />
              <p className="text-xs text-gray-400 mt-1">e.g. AWS CLF = 700, SAA = 720</p>
            </div>
          </div>

          {/* ── Exam Domains ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Exam Domains &amp; Weightings
                </label>
                <p className="text-xs text-gray-400 mt-0.5">Used to show students their area of improvement in results.</p>
              </div>
              {totalWeight > 0 && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${totalWeight === 100 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                  {totalWeight}% total {totalWeight !== 100 && '⚠ should be 100%'}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {domains.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="input text-sm flex-1"
                    placeholder={`Domain name (e.g. Cloud Concepts)`}
                    value={d.name}
                    onChange={(e) => updateDomainRow(i, 'name', e.target.value)}
                  />
                  <div className="relative w-28 flex-shrink-0">
                    <input
                      type="number"
                      className="input text-sm pr-7 w-full"
                      placeholder="Weight"
                      value={d.weightPercent}
                      onChange={(e) => updateDomainRow(i, 'weightPercent', e.target.value)}
                      min={0} max={100}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
                  </div>
                  {domains.length > 1 && (
                    <button type="button" onClick={() => removeDomainRow(i)}
                      className="text-gray-300 hover:text-red-500 transition flex-shrink-0">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addDomainRow}
              className="mt-2 flex items-center gap-1.5 text-xs text-aws-orange hover:text-orange-700 font-medium transition"
            >
              <Plus size={13} /> Add Domain
            </button>
          </div>

          <button type="submit" disabled={creating} className="btn-primary">
            {creating ? 'Creating...' : 'Create Exam Type'}
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {types.map((et) => (
          <div key={et.id} className={`card p-4 ${!et.active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-xs font-mono font-bold text-aws-orange uppercase">{et.code}</span>
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm mt-0.5">{et.name}</h4>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggle(et)} className={`text-xs px-2 py-0.5 rounded border transition ${et.active ? 'border-green-400 text-green-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 hover:border-red-400' : 'border-gray-300 text-gray-400 hover:bg-green-50 hover:text-green-600'}`}>
                  {et.active ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => remove(et)} title="Deactivate" className="text-gray-300 hover:text-red-500 transition">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-2 line-clamp-2">{et.description || '—'}</p>
            <div className="flex gap-3 text-xs mb-2 flex-wrap">
              <span className="text-gray-500">{et.questions_per_exam} questions</span>
              <span className="text-gray-500">{et.time_limit_minutes} min</span>
              <span className="font-semibold text-aws-orange">Pass: {et.passing_score}/1000</span>
            </div>
            <button onClick={() => setExpanded(expanded === et.id ? null : et.id)}
              className="text-xs text-aws-orange hover:underline flex items-center gap-1">
              {expanded === et.id ? '▲ Hide Domains' : '▼ Manage Domains'}
            </button>
            {expanded === et.id && <DomainManager examType={et} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LOCKOUTS TAB ────────────────────────────────────────────
function LockoutsTab() {
  const [lockouts, setLockouts] = useState([]);
  const load = () => api.get('/admin/lockouts').then((r) => setLockouts(r.data));
  useEffect(() => { load(); }, []);

  const clear = async (id) => {
    await api.delete(`/admin/lockouts/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Active Anti-Cheat Lockouts</h2>
        <button onClick={load} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5"><RefreshCw size={14} /> Refresh</button>
      </div>
      {lockouts.length === 0 ? (
        <div className="card p-8 text-center text-gray-400 flex flex-col items-center gap-2">
          <CheckCircle size={32} className="text-green-400" />
          No active lockouts.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs">
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Student Email</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">IP Address</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Locked Until</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Reason</th>
              <th className="px-4 py-2.5"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {lockouts.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 text-xs font-mono">{l.email || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{l.ip_address || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-red-600 dark:text-red-400">{new Date(l.locked_until).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate">{l.reason}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => clear(l.id)} className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1">
                      <CheckCircle size={12} /> Clear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}

// ─── SURVEYS TAB ─────────────────────────────────────────────
function SurveysTab() {
  const [surveys, setSurveys] = useState([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    api.get('/admin/surveys').then((r) => { setSurveys(r.data.surveys); setTotal(r.data.total); });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Survey Responses ({total})</h2>
        <a href="/api/admin/surveys/export.csv" className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5">
          <Download size={14} /> Export CSV
        </a>
      </div>
      <div className="space-y-3">
        {surveys.length === 0 && <div className="card p-8 text-center text-gray-400">No survey responses yet.</div>}
        {surveys.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{s.email || 'Anonymous'}</div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{s.examName}</span>
                <span>{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400 mb-2">
              <span>Difficulty: {'★'.repeat(s.difficulty_rating || 0)}{'☆'.repeat(5 - (s.difficulty_rating || 0))}</span>
              <span>Content: {'★'.repeat(s.content_quality_rating || 0)}{'☆'.repeat(5 - (s.content_quality_rating || 0))}</span>
              {s.found_unclear_questions && <span className="text-amber-600">⚠ Found unclear questions</span>}
            </div>
            {s.unclear_details && <p className="text-xs text-gray-500 mb-1"><strong>Unclear:</strong> {s.unclear_details}</p>}
            {s.suggestions && <p className="text-xs text-gray-500"><strong>Suggestions:</strong> {s.suggestions}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TEACHERS TAB ────────────────────────────────────────────
function TeachersTab() {
  const [teachers, setTeachers] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', cohortIds: [] });
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCohorts, setEditCohorts] = useState([]);

  const load = () => {
    api.get('/admin/teachers').then((r) => setTeachers(r.data));
    api.get('/admin/cohorts').then((r) => setCohorts(r.data));
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/admin/teachers', { ...form, cohortIds: form.cohortIds.map(Number) });
      setForm({ name: '', email: '', password: '', cohortIds: [] });
      load();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  const deleteTeacher = async (id, name) => {
    if (!confirm(`Permanently delete teacher "${name}"?\n\nThis cannot be undone. Their questions will be transferred to admin.`)) return;
    await api.delete(`/admin/teachers/${id}`);
    load();
  };

  const saveAssign = async (teacherId) => {
    await api.put(`/admin/teachers/${teacherId}`, { cohortIds: editCohorts.map(Number) });
    setEditId(null);
    load();
  };

  const toggleCohort = (id, list, setList) => {
    setList((prev) => prev.includes(String(id)) ? prev.filter((x) => x !== String(id)) : [...prev, String(id)]);
  };

  return (
    <div className="space-y-6">
      {/* Add teacher form */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><Plus size={16} /> Add Teacher</h3>
        <form onSubmit={create} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Full Name</label>
            <input className="input text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Jane Doe" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input type="email" className="input text-sm" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required placeholder="jane@company.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Password (min 6 chars)</label>
            <input type="password" className="input text-sm" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required placeholder="••••••" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assign Cohorts</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {cohorts.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.cohortIds.includes(String(c.id))}
                    onChange={() => toggleCohort(c.id, form.cohortIds, (fn) => setForm((f) => ({ ...f, cohortIds: fn(f.cohortIds.map(String)) })))}
                    className="rounded"
                  />
                  <span className="text-aws-orange font-mono font-bold">{c.code}</span>
                </label>
              ))}
              {cohorts.length === 0 && <span className="text-xs text-gray-400">No cohorts yet.</span>}
            </div>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? 'Creating...' : 'Create Teacher'}
            </button>
          </div>
        </form>
      </div>

      {/* Teachers list */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs">
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Name</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Email</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Assigned Cohorts</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Status</th>
            <th className="px-4 py-2.5"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {teachers.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">
                <p className="font-medium text-gray-500 dark:text-gray-400 mb-1">No teachers yet</p>
                <p className="text-xs">Use the form above to create a teacher account and assign them to cohorts.</p>
              </td></tr>
            )}
            {teachers.map((t) => (
              <tr key={t.id} className={`${!t.active ? 'opacity-50' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{t.name}</td>
                <td className="px-4 py-3 text-xs font-mono text-gray-600 dark:text-gray-400">{t.email}</td>
                <td className="px-4 py-3">
                  {editId === t.id ? (
                    <div className="flex flex-wrap gap-1.5">
                      {cohorts.map((c) => (
                        <label key={c.id} className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editCohorts.includes(String(c.id))}
                            onChange={() => setEditCohorts((prev) => prev.includes(String(c.id)) ? prev.filter((x) => x !== String(c.id)) : [...prev, String(c.id)])}
                            className="rounded"
                          />
                          <span className="text-aws-orange font-mono font-bold">{c.code}</span>
                        </label>
                      ))}
                      <button onClick={() => saveAssign(t.id)} className="ml-2 text-xs text-green-600 hover:text-green-800 font-medium">Save</button>
                      <button onClick={() => setEditId(null)} className="ml-1 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(t.cohorts || []).length === 0
                        ? <span className="text-xs text-gray-400">None</span>
                        : (t.cohorts || []).map((c) => (
                          <span key={c.id} className="text-xs font-mono font-bold text-aws-orange bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">{c.code}</span>
                        ))
                      }
                      <button
                        onClick={() => { setEditId(t.id); setEditCohorts((t.cohorts || []).map((c) => String(c.id))); }}
                        className="ml-1 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500'}`}>
                    {t.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteTeacher(t.id, t.name)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                    <Trash2 size={12} /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

// ─── ACCOUNT TAB ─────────────────────────────────────────────
// ─── ADMIN MFA SECTION ───────────────────────────────────────
function AdminMfaSection() {
  const [status, setStatus] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableForm, setDisableForm] = useState({ password: '', code: '' });
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const loadStatus = () => {
    api.get('/admin/mfa/status').then((r) => setStatus(r.data.mfaEnabled)).catch(() => setStatus(false));
  };

  useEffect(() => { loadStatus(); }, []);

  const startSetup = async () => {
    setErr(''); setMsg(''); setLoading(true);
    try {
      const { data } = await api.post('/admin/mfa/setup');
      setSetupData(data); setVerifyCode('');
    } catch (e) { setErr(e.response?.data?.error || 'Setup failed'); }
    finally { setLoading(false); }
  };

  const enableMfa = async () => {
    if (!verifyCode.trim()) { setErr('Enter the 6-digit code.'); return; }
    setErr(''); setLoading(true);
    try {
      await api.post('/admin/mfa/enable', { code: verifyCode.trim() });
      setMsg('MFA enabled successfully!'); setSetupData(null); setVerifyCode('');
      loadStatus();
    } catch (e) { setErr(e.response?.data?.error || 'Invalid code. Try again.'); }
    finally { setLoading(false); }
  };

  const disableMfa = async () => {
    if (!disableForm.password || !disableForm.code) { setErr('Password and code are required.'); return; }
    setErr(''); setLoading(true);
    try {
      await api.post('/admin/mfa/disable', disableForm);
      setMsg('MFA disabled.'); setShowDisableForm(false);
      setDisableForm({ password: '', code: '' }); loadStatus();
    } catch (e) { setErr(e.response?.data?.error || 'Failed to disable MFA.'); }
    finally { setLoading(false); }
  };

  if (status === null) return null;

  return (
    <div className="mt-6 card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Two-Factor Authentication</h3>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
          {status ? '● Enabled' : '○ Disabled'}
        </span>
      </div>

      {msg && <p className="text-sm text-green-600 dark:text-green-400 mb-3">{msg}</p>}
      {err && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{err}</p>}

      {!status && !setupData && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add an extra layer of security using an authenticator app (Google Authenticator, Authy, etc.).</p>
          <button onClick={startSetup} disabled={loading} className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
            {loading ? 'Setting up…' : 'Set Up Two-Factor Auth'}
          </button>
        </div>
      )}

      {!status && setupData && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
          <div className="flex justify-center">
            <img src={setupData.qrDataUrl} alt="MFA QR Code" className="w-44 h-44 rounded-lg border border-gray-200 dark:border-gray-700" />
          </div>
          <div className="text-center">
            <button onClick={() => setShowSecret((v) => !v)} className="text-xs text-blue-500 hover:underline">
              {showSecret ? 'Hide manual key' : "Can't scan? Show manual key"}
            </button>
            {showSecret && (
              <p className="mt-1 font-mono text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-gray-700 dark:text-gray-300 break-all">{setupData.secret}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Verification Code</label>
            <input type="text" inputMode="numeric" maxLength={7} className="input text-center text-xl tracking-widest font-mono"
              placeholder="000 000" value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/[^0-9 ]/g, ''))}
              autoComplete="one-time-code" />
          </div>
          <div className="flex gap-2">
            <button onClick={enableMfa} disabled={loading} className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
              {loading ? 'Verifying…' : 'Enable MFA'}
            </button>
            <button onClick={() => { setSetupData(null); setVerifyCode(''); setErr(''); }} className="btn-secondary text-sm px-4">Cancel</button>
          </div>
        </div>
      )}

      {status && !showDisableForm && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Two-factor authentication is active. Your account requires an authenticator code at each login.</p>
          <button onClick={() => { setShowDisableForm(true); setMsg(''); setErr(''); }}
            className="text-sm text-red-500 hover:text-red-700 underline transition">
            Disable Two-Factor Auth
          </button>
        </div>
      )}

      {status && showDisableForm && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Enter your current password and authenticator code to disable MFA.</p>
          <input type="password" className="input" placeholder="Current password"
            value={disableForm.password} onChange={(e) => setDisableForm((f) => ({ ...f, password: e.target.value }))} />
          <input type="text" inputMode="numeric" maxLength={7}
            className="input text-center tracking-widest font-mono" placeholder="000 000"
            value={disableForm.code}
            onChange={(e) => setDisableForm((f) => ({ ...f, code: e.target.value.replace(/[^0-9 ]/g, '') }))}
            autoComplete="one-time-code" />
          <div className="flex gap-2">
            <button onClick={disableMfa} disabled={loading}
              className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
              {loading ? 'Disabling…' : 'Disable MFA'}
            </button>
            <button onClick={() => { setShowDisableForm(false); setDisableForm({ password: '', code: '' }); setErr(''); }}
              className="btn-secondary text-sm px-4">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ACCOUNT TAB ─────────────────────────────────────────────
function AccountTab() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/auth/me').then((r) => setForm((f) => ({ ...f, email: r.data.email || '' })));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match.'); return;
    }
    if (form.newPassword && form.newPassword.length < 6) {
      setError('New password must be at least 6 characters.'); return;
    }
    setSaving(true);
    try {
      const { data } = await api.put('/auth/admin/settings', {
        email: form.email,
        currentPassword: form.currentPassword,
        newPassword: form.newPassword || undefined,
      });
      setMsg('Settings updated successfully.');
      // Update stored token + user if email changed
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({ email: data.email, isAdmin: true }));
      setForm((f) => ({ ...f, email: data.email, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-2">
        <KeyRound size={18} /> Admin Account Settings
      </h2>
      <div className="card p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admin Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide font-medium">Change Password</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Required to save any changes"
                    value={form.currentPassword}
                    onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    required
                  />
                  <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Min. 6 characters"
                    value={form.newPassword}
                    onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {form.newPassword && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Repeat new password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {msg && <p className="text-sm text-green-600 dark:text-green-400">{msg}</p>}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
      <AdminMfaSection />
    </div>
  );
}

// ─── MAIN ADMIN PAGE ─────────────────────────────────────────
export default function Admin() {
  const nav = useNavigate();
  const [tab, setTab] = useState('results');
  const [stats, setStats] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => { api.get('/admin/stats').then((r) => setStats(r.data)).catch(() => {}); }, []);

  const logout = () => { localStorage.clear(); nav('/login'); };

  const TabContent = {
    results: ResultsTab,
    questions: QuestionsTab,
    cohorts: CohortsTab,
    examtypes: ExamTypesTab,
    teachers: TeachersTab,
    lockouts: LockoutsTab,
    surveys: SurveysTab,
    account: AccountTab,
  }[tab] || ResultsTab;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <nav className="bg-aws-navy shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-aws-orange rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-white font-semibold">Admin Panel</span>
          </div>
          <div className="flex items-center gap-3">
            <FontScaleBar />
            <ThemeToggle />
            <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-white transition" title="Display settings">
              <Settings size={17} />
            </button>
            <span className="text-gray-300 text-sm hidden sm:block">{user.email}</span>
            <button onClick={logout} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm transition">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── Lockout alert strip ── */}
        {stats && stats.lockouts > 0 && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-sm">
            <ShieldOff size={16} className="text-red-500 flex-shrink-0" />
            <span className="text-red-700 dark:text-red-300 flex-1">
              <span className="font-semibold">{stats.lockouts} active lockout{stats.lockouts !== 1 ? 's' : ''}</span> — students are suspended from taking exams.
            </span>
            <button onClick={() => setTab('lockouts')} className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline whitespace-nowrap">
              Review →
            </button>
          </div>
        )}

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Students',         value: stats.students,  color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20',    tab: 'cohorts' },
              { label: 'Cohorts',          value: stats.cohorts,   color: 'text-aws-orange',  bg: 'bg-orange-50 dark:bg-orange-900/20',tab: 'cohorts' },
              { label: 'Exams Taken',      value: stats.exams,     color: 'text-purple-500',  bg: 'bg-purple-50 dark:bg-purple-900/20',tab: 'results' },
              { label: 'Active Questions', value: stats.questions, color: 'text-yellow-600',  bg: 'bg-yellow-50 dark:bg-yellow-900/20',tab: 'questions' },
              { label: 'Teachers',         value: stats.teachers,  color: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-900/20',  tab: 'teachers' },
            ].map(({ label, value, color, bg, tab: target }) => (
              <button key={label} onClick={() => setTab(target)}
                className={`card p-4 flex items-center gap-3 ${bg} cursor-pointer hover:shadow-md hover:ring-2 hover:ring-aws-orange/30 transition-all text-left w-full group`}>
                <div className="min-w-0">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xs text-aws-orange opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">View →</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                tab === id
                  ? 'border-aws-orange text-aws-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <TabContent />
      </div>
    </div>
  );
}
