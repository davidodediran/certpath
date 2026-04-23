import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  LogOut, ShieldCheck, Users, BarChart2, Plus, Trash2, Edit2,
  CheckCircle, XCircle, Eye, EyeOff, KeyRound, BookOpen, Settings,
  ShieldOff, MessageSquare, Download, Upload, Search, RefreshCw,
  GraduationCap, FileText, Users2
} from 'lucide-react';
import FontScaleBar from '../components/FontScaleBar';
import SettingsPanel from '../components/SettingsPanel';
import ThemeToggle from '../components/ThemeToggle';

const TABS = [
  { id: 'overview',   label: 'Overview',        icon: BarChart2 },
  { id: 'admins',     label: 'Admin Accounts',   icon: ShieldCheck },
  { id: 'results',    label: 'Results',           icon: BarChart2 },
  { id: 'questions',  label: 'Questions',         icon: BookOpen },
  { id: 'cohorts',    label: 'Cohorts',           icon: Users },
  { id: 'examtypes',  label: 'Exam Types',        icon: Settings },
  { id: 'teachers',   label: 'Teachers',          icon: GraduationCap },
  { id: 'students',   label: 'All Students',      icon: Users2 },
  { id: 'teacherqs',  label: 'Teacher Drafts',    icon: FileText },
  { id: 'lockouts',   label: 'Lockouts',          icon: ShieldOff },
  { id: 'surveys',    label: 'Surveys',           icon: MessageSquare },
  { id: 'account',    label: 'My Account',        icon: KeyRound },
];

// ── Overview ────────────────────────────────────────────────
function OverviewTab({ setTab }) {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get('/superuser/stats').then((r) => setStats(r.data)); }, []);

  const items = stats ? [
    { label: 'Admin Accounts',   value: stats.admins,    color: 'text-aws-orange', tab: 'admins' },
    { label: 'Active Teachers',  value: stats.teachers,  color: 'text-blue-500',   tab: 'teachers' },
    { label: 'Students',         value: stats.students,  color: 'text-green-500',  tab: 'students' },
    { label: 'Exams Taken',      value: stats.exams,     color: 'text-purple-500', tab: 'results' },
    { label: 'Active Questions', value: stats.questions, color: 'text-yellow-500', tab: 'questions' },
  ] : [];

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">Platform Overview</h2>
      {!stats ? <div className="text-gray-400">Loading...</div> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {items.map(({ label, value, color, tab }) => (
            <button key={label} onClick={() => setTab(tab)}
              className="card p-5 text-center hover:shadow-lg hover:ring-2 hover:ring-purple-400/40 transition-all cursor-pointer w-full group">
              <p className={`text-3xl font-bold ${color} group-hover:scale-110 transition-transform`}>{value}</p>
              <p className="text-xs text-gray-500 mt-2">{label}</p>
              <p className="text-xs text-purple-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View →</p>
            </button>
          ))}
        </div>
      )}
      <div className="mt-8 card p-5 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="text-purple-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-purple-800 dark:text-purple-300">Superuser Privileges</p>
            <ul className="text-xs text-purple-700 dark:text-purple-400 mt-2 space-y-1 list-disc list-inside">
              <li>Full admin panel access — Results, Questions, Cohorts, Exam Types, Teachers, Lockouts, Surveys</li>
              <li>View all students across every teacher (no isolation)</li>
              <li>Review and publish teacher-uploaded draft questions</li>
              <li>Create, update, and delete admin accounts</li>
              <li>Manage your own superuser credentials</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin Accounts ──────────────────────────────────────────
function AdminsTab() {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);

  const load = () => api.get('/superuser/admins').then((r) => setAdmins(r.data));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setCreating(true);
    try { await api.post('/superuser/admins', form); setForm({ email: '', password: '' }); load(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  const save = async (id) => {
    try { await api.put(`/superuser/admins/${id}`, editForm); setEditId(null); load(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this admin account?')) return;
    try { await api.delete(`/superuser/admins/${id}`); load(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><Plus size={16} /> Create Admin Account</h3>
        <form onSubmit={create} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input type="email" className="input text-sm py-2 w-56" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required placeholder="admin@company.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Password</label>
            <input type="password" className="input text-sm py-2 w-44" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required placeholder="Min 6 chars" />
          </div>
          <button type="submit" disabled={creating} className="btn-primary py-2">{creating ? 'Creating...' : 'Create'}</button>
        </form>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs">
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Email</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Created</th>
            <th className="px-4 py-2.5"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {admins.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-gray-400">No admin accounts.</td></tr>}
            {admins.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200">
                  {editId === a.id ? <input className="input text-xs py-1 w-48" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} /> : a.email}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {editId === a.id ? (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} className="input text-xs py-1 w-36 pr-8" placeholder="New password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} />
                        <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                      </div>
                      <button onClick={() => save(a.id)} className="text-xs text-green-600 hover:text-green-800 font-medium">Save</button>
                      <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setEditId(a.id); setEditForm({ email: a.email, password: '' }); setShowPw(false); }} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><Edit2 size={11} /> Edit</button>
                      <button onClick={() => remove(a.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 size={11} /> Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Results ─────────────────────────────────────────────────
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
          <a href="/api/admin/results/export.csv" className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5"><Download size={14} /> CSV</a>
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs">
            <th className="text-left px-4 py-2.5 font-medium text-gray-500">Email</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-500">Cohort</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-500">Exam</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-500">Mode</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-500">Score</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-500">Result</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-500">Date</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
              : results.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">No results found.</td></tr>
              : results.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-mono text-xs">{r.email || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 text-xs">{r.cohortName || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-xs">{r.examName}</td>
                  <td className="px-4 py-2.5"><span className="badge-practice capitalize">{r.mode}</span></td>
                  <td className="px-4 py-2.5 font-semibold">{r.cancelled ? '—' : `${r.score}/1000`}</td>
                  <td className="px-4 py-2.5">{r.cancelled ? <span className="badge-fail">Cancelled</span> : r.passed ? <span className="badge-pass">PASS</span> : <span className="badge-fail">FAIL</span>}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(r.submitted_at).toLocaleDateString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
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

// ── Questions (admin bank) ───────────────────────────────────
function QuestionsTab() {
  const [questions, setQuestions] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [total, setTotal] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadExamType, setUploadExamType] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    api.get('/admin/exam-types').then((r) => { setExamTypes(r.data); if (r.data[0]) setUploadExamType(String(r.data[0].id)); });
    loadQuestions();
  }, []);

  const loadQuestions = (etId = '') => {
    api.get('/admin/questions', { params: { examTypeId: etId || undefined, limit: 30 } })
      .then((r) => { setQuestions(r.data.questions); setTotal(r.data.total); });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !uploadExamType) return;
    setUploading(true); setUploadMsg('');
    const fd = new FormData();
    fd.append('file', file); fd.append('examTypeId', uploadExamType);
    try {
      const { data } = await api.post('/admin/questions/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadMsg(`Imported ${data.imported} questions successfully.`);
      loadQuestions(selectedType);
    } catch (err) { setUploadMsg('Upload failed: ' + (err.response?.data?.error || err.message)); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const toggleActive = async (q) => {
    await api.patch(`/admin/questions/${q.id}`, { active: !q.active });
    setQuestions((qs) => qs.map((x) => x.id === q.id ? { ...x, active: !q.active } : x));
  };

  return (
    <div className="space-y-6">
      <div className="card p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Download Sample Question Templates</p>
        <div className="flex gap-2 flex-wrap">
          <a href="/api/samples/questions.json" className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"><Download size={13} /> sample_questions.json</a>
          <a href="/api/samples/questions.csv" className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"><Download size={13} /> sample_questions.csv</a>
        </div>
      </div>
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
          <button type="submit" disabled={uploading} className="btn-primary py-2 flex items-center gap-2"><Upload size={14} /> {uploading ? 'Uploading...' : 'Upload'}</button>
        </form>
        {uploadMsg && <p className={`mt-2 text-sm ${uploadMsg.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>{uploadMsg}</p>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Questions ({total})</h3>
          <select className="input text-sm py-1.5 w-48" value={selectedType} onChange={(e) => { setSelectedType(e.target.value); loadQuestions(e.target.value); }}>
            <option value="">All Exam Types</option>
            {examTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
          </select>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs">
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">ID</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Question (preview)</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Domain</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Answer</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {questions.map((q) => (
                <tr key={q.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!q.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2 text-gray-400 text-xs">#{q.id}</td>
                  <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate" title={q.question}>{q.question}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{q.domain}</td>
                  <td className="px-4 py-2">{q.has_answer ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-gray-300" />}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => toggleActive(q)} className={`text-xs px-2 py-0.5 rounded border transition ${q.active ? 'border-green-400 text-green-600 hover:bg-red-50 hover:text-red-600 hover:border-red-400' : 'border-gray-300 text-gray-400 hover:bg-green-50 hover:text-green-600 hover:border-green-400'}`}>
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
  );
}

// ── Cohorts ──────────────────────────────────────────────────
function CohortsTab() {
  const [cohorts, setCohorts] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [form, setForm] = useState({ code: '', name: '', examTypeId: '' });
  const [creating, setCreating] = useState(false);

  const load = () => {
    api.get('/admin/cohorts').then((r) => setCohorts(r.data));
    api.get('/admin/exam-types').then((r) => { setExamTypes(r.data); if (r.data[0]) setForm((f) => ({ ...f, examTypeId: String(r.data[0].id) })); });
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setCreating(true);
    try { await api.post('/admin/cohorts', { code: form.code, name: form.name, examTypeId: form.examTypeId || null }); setForm((f) => ({ ...f, code: '', name: '' })); load(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  const deactivate = async (id) => {
    if (!confirm('Deactivate this cohort?')) return;
    await api.delete(`/admin/cohorts/${id}`); load();
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><Plus size={16} /> Create Cohort</h3>
        <form onSubmit={create} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cohort Code</label>
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
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs">
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Code</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Name</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Exam Type</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Students</th>
            <th className="px-4 py-2.5"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {cohorts.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 font-mono font-bold text-aws-orange text-sm">{c.code}</td>
                <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200">{c.name}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{c.examTypeName || '—'}</td>
                <td className="px-4 py-2.5 text-gray-600">{c.studentCount}</td>
                <td className="px-4 py-2.5">
                  <button onClick={() => deactivate(c.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 size={12} /> Deactivate</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Exam Types ───────────────────────────────────────────────
function ExamTypesTab() {
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ code: '', name: '', description: '', questionsPerExam: 65, timeLimitMinutes: 90, passingScore: 700 });
  const [creating, setCreating] = useState(false);

  const load = () => api.get('/admin/exam-types').then((r) => setTypes(r.data));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setCreating(true);
    try { await api.post('/admin/exam-types', form); setForm({ code: '', name: '', description: '', questionsPerExam: 65, timeLimitMinutes: 90, passingScore: 700 }); load(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  const toggle = async (et) => { await api.patch(`/admin/exam-types/${et.id}`, { active: !et.active }); load(); };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><Plus size={16} /> Add Exam Type</h3>
        <form onSubmit={create} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Code (e.g. saa-c03)</label>
            <input className="input text-sm" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))} required placeholder="saa-c03" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input className="input text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="AWS Solutions Architect Associate" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input className="input text-sm" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short description..." />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Questions per Exam</label>
            <input type="number" className="input text-sm" value={form.questionsPerExam} onChange={(e) => setForm((f) => ({ ...f, questionsPerExam: Number(e.target.value) }))} min={1} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Time Limit (minutes)</label>
            <input type="number" className="input text-sm" value={form.timeLimitMinutes} onChange={(e) => setForm((f) => ({ ...f, timeLimitMinutes: Number(e.target.value) }))} min={1} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Passing Score (out of 1000)</label>
            <input type="number" className="input text-sm" value={form.passingScore} onChange={(e) => setForm((f) => ({ ...f, passingScore: Number(e.target.value) }))} min={1} max={1000} />
          </div>
          <div className="sm:col-span-2"><button type="submit" disabled={creating} className="btn-primary">Create Exam Type</button></div>
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
              <button onClick={() => toggle(et)} className={`text-xs px-2 py-0.5 rounded border transition ${et.active ? 'border-green-400 text-green-600 hover:bg-red-50 hover:text-red-600 hover:border-red-400' : 'border-gray-300 text-gray-400 hover:bg-green-50 hover:text-green-600'}`}>
                {et.active ? 'Active' : 'Inactive'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{et.description || '—'}</p>
            <div className="flex gap-3 text-xs text-gray-500">
              <span>{et.questions_per_exam} questions</span>
              <span>{et.time_limit_minutes} min</span>
              <span>Pass: {et.passing_score}/1000</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Teachers ─────────────────────────────────────────────────
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
    e.preventDefault(); setCreating(true);
    try { await api.post('/admin/teachers', { ...form, cohortIds: form.cohortIds.map(Number) }); setForm({ name: '', email: '', password: '', cohortIds: [] }); load(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  const deactivate = async (id) => {
    if (!confirm('Deactivate this teacher?')) return;
    await api.delete(`/admin/teachers/${id}`); load();
  };

  const saveAssign = async (teacherId) => {
    await api.put(`/admin/teachers/${teacherId}`, { cohortIds: editCohorts.map(Number) }); setEditId(null); load();
  };

  return (
    <div className="space-y-6">
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
                  <input type="checkbox" checked={form.cohortIds.includes(String(c.id))} onChange={() => setForm((f) => ({ ...f, cohortIds: f.cohortIds.includes(String(c.id)) ? f.cohortIds.filter((x) => x !== String(c.id)) : [...f.cohortIds, String(c.id)] }))} className="rounded" />
                  <span className="text-aws-orange font-mono font-bold">{c.code}</span>
                </label>
              ))}
              {cohorts.length === 0 && <span className="text-xs text-gray-400">No cohorts yet.</span>}
            </div>
          </div>
          <div className="sm:col-span-2"><button type="submit" disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create Teacher'}</button></div>
        </form>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs">
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Name</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Email</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Assigned Cohorts</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Status</th>
            <th className="px-4 py-2.5"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {teachers.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No teachers yet.</td></tr>}
            {teachers.map((t) => (
              <tr key={t.id} className={`${!t.active ? 'opacity-50' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{t.name}</td>
                <td className="px-4 py-3 text-xs font-mono text-gray-600 dark:text-gray-400">{t.email}</td>
                <td className="px-4 py-3">
                  {editId === t.id ? (
                    <div className="flex flex-wrap gap-1.5">
                      {cohorts.map((c) => (
                        <label key={c.id} className="flex items-center gap-1 text-xs cursor-pointer">
                          <input type="checkbox" checked={editCohorts.includes(String(c.id))} onChange={() => setEditCohorts((prev) => prev.includes(String(c.id)) ? prev.filter((x) => x !== String(c.id)) : [...prev, String(c.id)])} className="rounded" />
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
                        : (t.cohorts || []).map((c) => <span key={c.id} className="text-xs font-mono font-bold text-aws-orange bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">{c.code}</span>)}
                      <button onClick={() => { setEditId(t.id); setEditCohorts((t.cohorts || []).map((c) => String(c.id))); }} className="ml-1 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"><Edit2 size={11} /> Edit</button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500'}`}>{t.active ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="px-4 py-3">
                  {t.active && <button onClick={() => deactivate(t.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 size={12} /> Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── All Students (cross-teacher) ─────────────────────────────
function StudentsTab() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/superuser/students').then((r) => setStudents(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm('Delete this student and all their exam records? This cannot be undone.')) return;
    try { await api.delete(`/superuser/students/${id}`); load(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return !q || (s.email || '').includes(q) || (s.name || '').toLowerCase().includes(q) || (s.cohortCode || '').toLowerCase().includes(q) || (s.teacherName || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">All Students ({filtered.length})</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-8 py-1.5 text-sm w-56" placeholder="Search name, email, cohort…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button onClick={load} className="btn-secondary py-1.5 px-3 text-sm"><RefreshCw size={14} /></button>
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs">
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Name</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Email</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Cohort</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Teacher</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Attempts</th>
            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Avg Score</th>
            <th className="px-4 py-2.5"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No students found.</td></tr>
            ) : filtered.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium text-sm">{s.name || <span className="text-gray-400 italic">—</span>}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-400">{s.email}</td>
                <td className="px-4 py-2.5 text-xs font-mono font-bold text-aws-orange">{s.cohortCode || '—'}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{s.teacherName || <span className="italic text-gray-400">Open</span>}</td>
                <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">
                  <span title={`${s.examCount} exam, ${s.practiceCount} practice`}>{s.totalAttempts} total</span>
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {s.avgExamScore != null ? (
                    <span className={`font-semibold ${s.avgExamScore >= 700 ? 'text-green-600' : 'text-red-500'}`}>{s.avgExamScore}/1000</span>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => remove(s.id)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-0.5"><Trash2 size={11} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Teacher Drafts ───────────────────────────────────────────
function TeacherDraftsTab() {
  const [questions, setQuestions] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterDraft, setFilterDraft] = useState('true');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = () => {
    setLoading(true);
    const params = {};
    if (filterDraft !== '') params.draft = filterDraft;
    if (filterTeacher) params.teacherId = filterTeacher;
    api.get('/superuser/teacher-questions', { params }).then((r) => setQuestions(r.data.questions)).finally(() => setLoading(false));
  };

  useEffect(() => { api.get('/admin/teachers').then((r) => setTeachers(r.data)); }, []);
  useEffect(() => { load(); }, [filterDraft, filterTeacher]);

  const publish = async (id) => {
    await api.patch(`/superuser/teacher-questions/${id}/publish`);
    setQuestions((qs) => qs.map((q) => q.id === id ? { ...q, draft: false, active: true } : q));
  };

  const remove = async (id) => {
    if (!confirm('Delete this question?')) return;
    await api.delete(`/superuser/teacher-questions/${id}`);
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  };

  const publishAll = async () => {
    const drafts = questions.filter((q) => q.draft);
    if (!drafts.length || !confirm(`Publish all ${drafts.length} draft questions?`)) return;
    await Promise.all(drafts.map((q) => api.patch(`/superuser/teacher-questions/${q.id}/publish`)));
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Teacher Questions</h2>
        <div className="flex gap-2 flex-wrap">
          <select className="input text-sm py-1.5 w-36" value={filterDraft} onChange={(e) => setFilterDraft(e.target.value)}>
            <option value="true">Drafts only</option>
            <option value="false">Published only</option>
            <option value="">All</option>
          </select>
          <select className="input text-sm py-1.5 w-44" value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}>
            <option value="">All Teachers</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={load} className="btn-secondary py-1.5 px-3 text-sm"><RefreshCw size={14} /></button>
          {filterDraft === 'true' && questions.some((q) => q.draft) && (
            <button onClick={publishAll} className="btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5"><CheckCircle size={13} /> Publish All</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : questions.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">No questions found.</div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className={`card border-l-4 ${q.draft ? 'border-amber-400' : 'border-green-400'}`}>
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.draft ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                      {q.draft ? 'Draft' : 'Published'}
                    </span>
                    <span className="text-xs text-gray-400">{q.domain}</span>
                    <span className="text-xs text-purple-500 font-medium">{q.teacherName || q.teacherEmail || 'Unknown teacher'}</span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{q.question}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setExpanded(expanded === q.id ? null : q.id)} className="text-xs text-blue-500 hover:text-blue-700">{expanded === q.id ? 'Collapse' : 'View'}</button>
                  {q.draft && <button onClick={() => publish(q.id)} className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-0.5"><CheckCircle size={12} /> Publish</button>}
                  <button onClick={() => remove(q.id)} className="text-xs text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </div>
              {expanded === q.id && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
                  {(q.options || []).map((opt) => {
                    const label = typeof opt === 'string' ? opt : opt.label;
                    const text = typeof opt === 'string' ? opt : opt.text;
                    const isCorrect = q.correct_answer && q.correct_answer.includes(label);
                    return (
                      <div key={label} className={`text-xs flex items-start gap-2 rounded px-2 py-1 ${isCorrect ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                        <span className="font-bold shrink-0">{label}.</span>
                        <span>{text}</span>
                        {isCorrect && <CheckCircle size={12} className="text-green-500 ml-auto shrink-0 mt-0.5" />}
                      </div>
                    );
                  })}
                  {q.explanation && <p className="text-xs text-gray-500 italic mt-2 border-t border-gray-100 dark:border-gray-800 pt-2">{q.explanation}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Lockouts ─────────────────────────────────────────────────
function LockoutsTab() {
  const [lockouts, setLockouts] = useState([]);
  const load = () => api.get('/admin/lockouts').then((r) => setLockouts(r.data));
  useEffect(() => { load(); }, []);
  const clear = async (id) => { await api.delete(`/admin/lockouts/${id}`); load(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Active Anti-Cheat Lockouts</h2>
        <button onClick={load} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5"><RefreshCw size={14} /> Refresh</button>
      </div>
      {lockouts.length === 0 ? (
        <div className="card p-8 text-center text-gray-400 flex flex-col items-center gap-2"><CheckCircle size={32} className="text-green-400" />No active lockouts.</div>
      ) : (
        <div className="card overflow-hidden">
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
                    <button onClick={() => clear(l.id)} className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"><CheckCircle size={12} /> Clear</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Surveys ──────────────────────────────────────────────────
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
        <a href="/api/admin/surveys/export.csv" className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5"><Download size={14} /> Export CSV</a>
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

// ── My Account ───────────────────────────────────────────────
// ── Superuser MFA Section ────────────────────────────────────
function SuperMfaSection() {
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
    api.get('/superuser/mfa/status').then((r) => setStatus(r.data.mfaEnabled)).catch(() => setStatus(false));
  };

  useEffect(() => { loadStatus(); }, []);

  const startSetup = async () => {
    setErr(''); setMsg(''); setLoading(true);
    try {
      const { data } = await api.post('/superuser/mfa/setup');
      setSetupData(data); setVerifyCode('');
    } catch (e) { setErr(e.response?.data?.error || 'Setup failed'); }
    finally { setLoading(false); }
  };

  const enableMfa = async () => {
    if (!verifyCode.trim()) { setErr('Enter the 6-digit code.'); return; }
    setErr(''); setLoading(true);
    try {
      await api.post('/superuser/mfa/enable', { code: verifyCode.trim() });
      setMsg('MFA enabled successfully!'); setSetupData(null); setVerifyCode('');
      loadStatus();
    } catch (e) { setErr(e.response?.data?.error || 'Invalid code. Try again.'); }
    finally { setLoading(false); }
  };

  const disableMfa = async () => {
    if (!disableForm.password || !disableForm.code) { setErr('Password and code are required.'); return; }
    setErr(''); setLoading(true);
    try {
      await api.post('/superuser/mfa/disable', disableForm);
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
          <ShieldCheck size={18} className="text-purple-600" />
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
          <button onClick={startSetup} disabled={loading} className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
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
            <button onClick={() => setShowSecret((v) => !v)} className="text-xs text-purple-500 hover:underline">
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
            <button onClick={enableMfa} disabled={loading} className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
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

// ── My Account ───────────────────────────────────────────────
function MyAccountTab() {
  const [form, setForm] = useState({ name: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/superuser/me').then((r) => setForm((f) => ({ ...f, name: r.data.name || '', email: r.data.email || '' })));
  }, []);

  const save = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    if (form.newPassword && form.newPassword !== form.confirmPassword) { setErr('Passwords do not match'); return; }
    setSaving(true);
    try {
      const { data } = await api.put('/superuser/me', { name: form.name, email: form.email, currentPassword: form.currentPassword, newPassword: form.newPassword || undefined });
      setMsg('Settings saved.');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({ email: data.email, isSuperUser: true }));
      setForm((f) => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (e) { setErr(e.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6">My Superuser Account</h2>
      <div className="card p-6">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Change Password</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type={showCur ? 'text' : 'password'} className="input pr-10" value={form.currentPassword} onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))} required />
                  <button type="button" onClick={() => setShowCur((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showCur ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} className="input pr-10" placeholder="Leave blank to keep current" value={form.newPassword} onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))} />
                  <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showNew ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                </div>
              </div>
              {form.newPassword && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                  <input type="password" className="input" value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
                </div>
              )}
            </div>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          {msg && <p className="text-sm text-green-600">{msg}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </div>
      <SuperMfaSection />
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
const TAB_MAP = {
  overview:  OverviewTab,
  admins:    AdminsTab,
  results:   ResultsTab,
  questions: QuestionsTab,
  cohorts:   CohortsTab,
  examtypes: ExamTypesTab,
  teachers:  TeachersTab,
  students:  StudentsTab,
  teacherqs: TeacherDraftsTab,
  lockouts:  LockoutsTab,
  surveys:   SurveysTab,
  account:   MyAccountTab,
};

export default function SuperUser() {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [tab, setTab] = useState('overview');
  const [showSettings, setShowSettings] = useState(false);

  const logout = () => { localStorage.clear(); nav('/login'); };
  const TabContent = TAB_MAP[tab] || OverviewTab;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <nav className="bg-aws-navy shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-purple-600 rounded flex items-center justify-center">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <span className="text-white font-semibold">Super Admin</span>
            <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-full font-mono">superuser</span>
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
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                tab === id ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <TabContent setTab={setTab} />
      </div>
    </div>
  );
}
