import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  LogOut, Users, BarChart2, ChevronRight, BookOpen, Award, Settings,
  Plus, Upload, Download, Trash2, FileText, RefreshCw,
  CheckCircle, XCircle, AlertCircle, HelpCircle, Edit2, Save, X,
  Image as ImageIcon, Lock, Unlock, ShieldAlert, Eye, ShieldCheck, Star,
} from 'lucide-react';
import FontScaleBar from '../components/FontScaleBar';
import SettingsPanel from '../components/SettingsPanel';
import ThemeToggle from '../components/ThemeToggle';

// ── Readiness badge ──────────────────────────────────────────
function ReadinessBadge({ readiness }) {
  if (!readiness) return <span className="text-xs text-gray-400">No data</span>;
  const colors = {
    green:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    lime:   'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    red:    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[readiness.color] || colors.yellow}`}>
      {readiness.label}
    </span>
  );
}

// ── Students Tab ─────────────────────────────────────────────
function StudentsTab() {
  const nav = useNavigate();
  const [cohorts, setCohorts] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [readinessFilter, setReadinessFilter] = useState(false);
  const [perfCache, setPerfCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadErr, setUploadErr] = useState('');
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState('');
  const fileRef = useRef();
  const cohortsRef = useRef();
  const studentsRef = useRef();
  const cohortFileRef = useRef();
  const [cohortUploadMsg, setCohortUploadMsg] = useState('');
  const [cohortUploadErr, setCohortUploadErr] = useState('');
  const [showCreateCohort, setShowCreateCohort] = useState(false);
  const [cohortForm, setCohortForm] = useState({ name: '', code: '', examTypeId: '' });
  const [cohortCreating, setCohortCreating] = useState(false);
  const [cohortCreateErr, setCohortCreateErr] = useState('');
  const [examTypes, setExamTypes] = useState([]);
  // Add student form
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', cohortId: '' });
  const [addingStudent, setAddingStudent] = useState(false);
  const [addStudentErr, setAddStudentErr] = useState('');
  // Lockout unlock state
  const [unlockingId, setUnlockingId] = useState(null);
  // Filter + multi-select + sort state
  const [searchStudent, setSearchStudent] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [studentSort, setStudentSort] = useState('score_desc'); // sort order

  const uploadWithCohort = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setCohortUploadMsg(''); setCohortUploadErr('');
    const fd = new FormData(); fd.append('file', file);
    try {
      const { data } = await api.post('/teacher/students/upload-with-cohort', fd);
      let msg = `Added ${data.added} student(s). ${data.skipped} skipped (already exist).`;
      if (data.errors?.length) msg += ` Errors: ${data.errors.join('; ')}`;
      setCohortUploadMsg(msg);
      load();
    } catch (err) { setCohortUploadErr(err.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const load = () => Promise.all([
    api.get('/teacher/cohorts'),
    api.get('/teacher/students'),
    api.get('/exam-types'),
  ]).then(([c, s, et]) => {
    setCohorts(c.data);
    setStudents(s.data);
    setExamTypes(et.data || []);
  }).finally(() => setLoading(false));

  const createCohort = async (e) => {
    e.preventDefault();
    if (!cohortForm.name || !cohortForm.code) { setCohortCreateErr('Name and code are required.'); return; }
    setCohortCreating(true); setCohortCreateErr('');
    try {
      await api.post('/teacher/cohorts', {
        name: cohortForm.name,
        code: cohortForm.code,
        examTypeId: cohortForm.examTypeId || null,
      });
      setCohortForm({ name: '', code: '', examTypeId: '' });
      setShowCreateCohort(false);
      load();
    } catch (err) { setCohortCreateErr(err.response?.data?.error || 'Failed to create cohort'); }
    finally { setCohortCreating(false); }
  };

  const deleteCohort = async (c) => {
    if (!confirm(`Delete cohort "${c.name}" (${c.code})? This cannot be undone. The cohort must have no students.`)) return;
    try {
      await api.delete(`/teacher/cohorts/${c.id}`);
      load();
    } catch (err) { alert(err.response?.data?.error || 'Failed to delete cohort'); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const visible = selectedCohort
      ? students.filter((s) => String(s.cohort_id) === selectedCohort)
      : students;
    visible.forEach((s) => {
      if (!perfCache[s.id] && s.examAttempts > 0) {
        api.get(`/teacher/students/${s.id}/performance`).then((r) => {
          setPerfCache((prev) => ({ ...prev, [s.id]: r.data }));
        }).catch(() => {});
      }
    });
  }, [students, selectedCohort]);

  const downloadSample = async () => {
    const res = await api.get('/teacher/students/sample.csv', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = 'sample_students.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const uploadCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!selectedCohort) { setUploadErr('Select a cohort first.'); return; }
    setUploading(true); setUploadMsg(''); setUploadErr('');
    const fd = new FormData(); fd.append('file', file); fd.append('cohortId', selectedCohort);
    try {
      const { data } = await api.post('/teacher/students/upload', fd);
      setUploadMsg(`Added ${data.added} student(s). ${data.skipped} skipped (already exist).`);
      load();
    } catch (err) { setUploadErr(err.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const startEdit = (s) => {
    setEditId(s.id);
    setEditForm({ name: s.name || '', email: s.email });
    setEditErr('');
  };

  const saveEdit = async (id) => {
    setEditSaving(true); setEditErr('');
    try {
      await api.put(`/teacher/students/${id}`, editForm);
      setStudents((prev) => prev.map((s) => s.id === id ? { ...s, ...editForm } : s));
      setEditId(null);
    } catch (err) { setEditErr(err.response?.data?.error || 'Save failed'); }
    finally { setEditSaving(false); }
  };

  const deleteStudent = async (id) => {
    if (!confirm('Remove this student? They will no longer have access.')) return;
    await api.delete(`/teacher/students/${id}`);
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const createStudent = async (e) => {
    e.preventDefault();
    setAddingStudent(true); setAddStudentErr('');
    try {
      await api.post('/teacher/students', {
        name: addForm.name,
        email: addForm.email,
        cohortId: addForm.cohortId,
      });
      setAddForm({ name: '', email: '', cohortId: addForm.cohortId });
      setShowAddStudent(false);
      setUploadMsg('Student added successfully.');
      load();
    } catch (err) { setAddStudentErr(err.response?.data?.error || 'Failed to add student'); }
    finally { setAddingStudent(false); }
  };

  const deleteSelectedStudents = async () => {
    if (!confirm(`Remove ${selectedStudents.size} student${selectedStudents.size !== 1 ? 's' : ''}? They will lose access.`)) return;
    setDeletingBulk(true);
    try {
      await api.delete('/teacher/students/bulk', { data: { ids: Array.from(selectedStudents) } });
      setSelectedStudents(new Set());
      load();
    } catch (e) { setUploadErr(e.response?.data?.error || 'Bulk delete failed'); }
    finally { setDeletingBulk(false); }
  };

  const unlockStudent = async (id) => {
    setUnlockingId(id);
    try {
      await api.delete(`/teacher/students/${id}/lockout`);
      // Refresh the student list so the badge disappears
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unlock student');
    } finally {
      setUnlockingId(null);
    }
  };

  // Date range helper
  const getDateBounds = () => {
    const now = new Date();
    const startOfDay = (d) => { d.setHours(0, 0, 0, 0); return d; };
    if (datePreset === 'today') { const d = startOfDay(new Date()); return [d, now]; }
    if (datePreset === 'week') {
      const d = startOfDay(new Date());
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
      return [d, now];
    }
    if (datePreset === 'month') { return [new Date(now.getFullYear(), now.getMonth(), 1), now]; }
    if (datePreset === 'lastmonth') {
      return [new Date(now.getFullYear(), now.getMonth() - 1, 1),
              new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)];
    }
    if (datePreset === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      return [new Date(now.getFullYear(), q * 3, 1), now];
    }
    if (datePreset === 'custom' && dateFrom) {
      return [new Date(dateFrom), dateTo ? new Date(dateTo + 'T23:59:59') : now];
    }
    return null;
  };

  const filteredStudents = students
    .filter((s) => !selectedCohort || String(s.cohort_id) === selectedCohort)
    .filter((s) => !readinessFilter || (s.avgScore !== null && s.avgScore >= 700))
    .filter((s) => {
      if (!searchStudent) return true;
      const q = searchStudent.toLowerCase();
      return (s.name || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    })
    .filter((s) => {
      const bounds = getDateBounds();
      if (!bounds) return true;
      const d = new Date(s.created_at);
      return d >= bounds[0] && d <= bounds[1];
    })
    .sort((a, b) => {
      if (studentSort === 'score_desc') return (b.avgScore ?? -1) - (a.avgScore ?? -1);
      if (studentSort === 'score_asc')  return (a.avgScore ?? 9999) - (b.avgScore ?? 9999);
      if (studentSort === 'attempts_desc') return b.examAttempts - a.examAttempts;
      if (studentSort === 'attempts_asc')  return a.examAttempts - b.examAttempts;
      if (studentSort === 'name_az') return (a.name || a.email).localeCompare(b.name || b.email);
      if (studentSort === 'name_za') return (b.name || b.email).localeCompare(a.name || a.email);
      if (studentSort === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (studentSort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      return 0;
    });

  const allFiltered = filteredStudents;
  const allSelected = allFiltered.length > 0 && allFiltered.every((s) => selectedStudents.has(s.id));

  const toggleStudentSelect = (id) => {
    setSelectedStudents((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const toggleSelectAllStudents = () => {
    if (allSelected) {
      setSelectedStudents((prev) => { const s = new Set(prev); allFiltered.forEach((st) => s.delete(st.id)); return s; });
    } else {
      setSelectedStudents((prev) => { const s = new Set(prev); allFiltered.forEach((st) => s.add(st.id)); return s; });
    }
  };

  const formatJoined = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) return <div className="text-gray-400 py-10 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            icon: BookOpen, color: 'text-aws-orange', bg: 'bg-aws-orange/10',
            val: cohorts.length, label: 'My Cohorts', hint: 'View cohorts',
            active: false,
            onClick: () => { setReadinessFilter(false); cohortsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
          },
          {
            icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10',
            val: students.length, label: 'Total Students', hint: 'View all students',
            active: false,
            onClick: () => { setReadinessFilter(false); setSelectedCohort(''); studentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
          },
          {
            icon: Award, color: 'text-green-500', bg: 'bg-green-500/10',
            val: students.filter((s) => s.avgScore !== null && s.avgScore >= 700).length,
            label: 'Ready for Exam', hint: readinessFilter ? 'Clear filter' : 'Filter ready students',
            active: readinessFilter,
            onClick: () => { setReadinessFilter((v) => !v); studentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
          },
          {
            icon: BarChart2, color: 'text-purple-500', bg: 'bg-purple-500/10',
            val: students.reduce((a, b) => a + b.examAttempts, 0),
            label: 'Total Attempts', hint: 'View all students',
            active: false,
            onClick: () => { setReadinessFilter(false); studentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
          },
          {
            icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10',
            val: students.filter((s) => s.activeLockout).length,
            label: 'Exam Suspended', hint: 'View suspended students',
            active: false,
            onClick: () => { setReadinessFilter(false); studentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
          },
          {
            icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10',
            val: students.filter((s) => s.isQualified).length,
            label: 'Qualified', hint: 'Students who met all qualification criteria',
            active: false,
            onClick: () => { setReadinessFilter(false); studentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
          },
        ].map(({ icon: Icon, color, bg, val, label, hint, active, onClick }) => (
          <button key={label} onClick={onClick}
            className={`card p-4 text-left w-full cursor-pointer transition-all group hover:shadow-md ${active ? 'ring-2 ring-green-400/60 bg-green-50 dark:bg-green-900/10' : 'hover:ring-2 hover:ring-aws-orange/30'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{val}</p>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xs text-aws-orange opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">{hint} →</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Create Cohort */}
      <div ref={cohortsRef} className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <BookOpen size={16} /> Cohorts
          </h3>
          <button onClick={() => { setShowCreateCohort((v) => !v); setCohortCreateErr(''); }}
            className="btn-primary py-1.5 text-sm flex items-center gap-2">
            <Plus size={14} /> New Cohort
          </button>
        </div>

        {/* Cohort list */}
        {cohorts.length === 0 && !showCreateCohort && (
          <p className="text-sm text-gray-400">No cohorts yet. Create one to start adding students.</p>
        )}
        {cohorts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {cohorts.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-aws-orange/10 text-aws-orange text-sm rounded-full font-medium">
                {c.name} <span className="text-xs opacity-70">({c.code})</span>
                {c.studentCount > 0 && <span className="ml-1 text-xs opacity-60">· {c.studentCount} students</span>}
                {c.created_by_teacher_id && (
                  <button
                    onClick={() => deleteCohort(c)}
                    title="Delete this cohort"
                    className="ml-1 text-aws-orange/50 hover:text-red-500 transition"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Create form */}
        {showCreateCohort && (
          <form onSubmit={createCohort} className="mt-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-3">
            <p className="text-xs text-gray-500 mb-2">Create a new cohort you can assign students to.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cohort Name *</label>
                <input className="input text-sm py-1.5 w-full" placeholder="e.g. KLICT 2025 Batch A"
                  value={cohortForm.name}
                  onChange={(e) => setCohortForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cohort Code * <span className="font-normal opacity-60">(used in CSV uploads)</span></label>
                <input className="input text-sm py-1.5 w-full" placeholder="e.g. KLICT-2025-A"
                  value={cohortForm.code}
                  onChange={(e) => setCohortForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Exam Type <span className="font-normal opacity-60">(optional)</span></label>
                <select className="input text-sm py-1.5 w-full" value={cohortForm.examTypeId}
                  onChange={(e) => setCohortForm((f) => ({ ...f, examTypeId: e.target.value }))}>
                  <option value="">None</option>
                  {examTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
                </select>
              </div>
            </div>
            {cohortCreateErr && <p className="text-sm text-red-500">{cohortCreateErr}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={cohortCreating} className="btn-primary py-1.5 text-sm">
                {cohortCreating ? 'Creating…' : 'Create Cohort'}
              </button>
              <button type="button" onClick={() => setShowCreateCohort(false)}
                className="btn-secondary py-1.5 text-sm">Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* Upload + Add Student */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Users size={16} /> Add Students
          </h3>
          <button onClick={() => { setShowAddStudent((v) => !v); setAddStudentErr(''); }}
            className="btn-primary py-1.5 text-sm flex items-center gap-2">
            <Plus size={14} /> Add Single Student
          </button>
        </div>

        {/* Inline add-student form */}
        {showAddStudent && (
          <form onSubmit={createStudent} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-3">
            <p className="text-xs text-gray-500">Fill in the student's details and assign them to a cohort.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name <span className="font-normal opacity-60">(optional)</span></label>
                <input className="input text-sm py-1.5 w-full" placeholder="e.g. Jane Doe"
                  value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email *</label>
                <input className="input text-sm py-1.5 w-full" type="email" placeholder="student@example.com" required
                  value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cohort *</label>
                <select className="input text-sm py-1.5 w-full" required
                  value={addForm.cohortId} onChange={(e) => setAddForm((f) => ({ ...f, cohortId: e.target.value }))}>
                  <option value="">Select cohort…</option>
                  {cohorts.map((c) => <option key={c.id} value={String(c.id)}>{c.name} ({c.code})</option>)}
                </select>
              </div>
            </div>
            {addStudentErr && <p className="text-sm text-red-500">{addStudentErr}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={addingStudent} className="btn-primary py-1.5 text-sm">
                {addingStudent ? 'Adding…' : 'Add Student'}
              </button>
              <button type="button" onClick={() => setShowAddStudent(false)} className="btn-secondary py-1.5 text-sm">Cancel</button>
            </div>
          </form>
        )}

        {/* CSV upload */}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
          <p className="text-xs text-gray-500 mb-3 font-medium">Or upload a CSV list:</p>
          <p className="text-xs text-gray-400 mb-3">
            CSV must have columns: <strong>name</strong>, <strong>email</strong> (in any order). Header row optional.
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <select className="input text-sm py-1.5 w-52" value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}>
              <option value="">Select cohort…</option>
              {cohorts.map((c) => <option key={c.id} value={String(c.id)}>{c.name} ({c.code})</option>)}
            </select>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={uploadCSV} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading || !selectedCohort}
              className="btn-primary py-2 text-sm flex items-center gap-2">
              <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload CSV'}
            </button>
            <button onClick={downloadSample} className="text-sm text-aws-orange hover:underline flex items-center gap-1">
              <Download size={14} /> Download sample CSV
            </button>
          </div>
        </div>

        {uploadMsg && <p className="text-sm text-green-600">{uploadMsg}</p>}
        {uploadErr && <p className="text-sm text-red-500">{uploadErr}</p>}
      </div>

      {/* Students table */}
      <div ref={studentsRef} className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Students</h2>
          {readinessFilter && (
            <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              Ready for Exam
              <button onClick={() => setReadinessFilter(false)} className="ml-1 hover:text-green-900 font-bold">×</button>
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filteredStudents.length} of {students.length} students</span>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 items-start">
          <input type="text" placeholder="Search name or email…"
            value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)}
            className="input text-sm py-1.5 w-56" />
          <select className="input text-sm py-1.5 w-48" value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}>
            <option value="">All Cohorts</option>
            {cohorts.map((c) => <option key={c.id} value={String(c.id)}>{c.name} ({c.code})</option>)}
          </select>
          {/* Date filter (Excel-style) */}
          <div className="flex items-center gap-2 flex-wrap">
            <select className="input text-sm py-1.5 w-40" value={datePreset}
              onChange={(e) => { setDatePreset(e.target.value); setDateFrom(''); setDateTo(''); }}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="lastmonth">Last Month</option>
              <option value="quarter">This Quarter</option>
              <option value="custom">Custom Range…</option>
            </select>
            {datePreset === 'custom' && (
              <>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="input text-sm py-1.5 w-36" />
                <span className="text-xs text-gray-400">to</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="input text-sm py-1.5 w-36" />
              </>
            )}
          </div>
          {/* Sort */}
          <select className="input text-sm py-1.5 w-48" value={studentSort}
            onChange={(e) => setStudentSort(e.target.value)}>
            <option value="score_desc">Highest Score First</option>
            <option value="score_asc">Lowest Score First</option>
            <option value="attempts_desc">Most Attempts First</option>
            <option value="attempts_asc">Fewest Attempts First</option>
            <option value="name_az">Name A → Z</option>
            <option value="name_za">Name Z → A</option>
            <option value="newest">Newest Joined</option>
            <option value="oldest">Oldest Joined</option>
          </select>
          {(searchStudent || selectedCohort || readinessFilter || datePreset !== 'all') && (
            <button onClick={() => { setSearchStudent(''); setSelectedCohort(''); setReadinessFilter(false); setDatePreset('all'); setDateFrom(''); setDateTo(''); }}
              className="text-xs text-gray-400 hover:text-red-500 underline self-center">Clear all filters</button>
          )}
        </div>

        {/* Bulk toolbar */}
        {selectedStudents.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-aws-orange/10 border border-aws-orange/30 rounded-lg">
            <span className="text-sm font-medium text-aws-orange">{selectedStudents.size} selected</span>
            <button onClick={deleteSelectedStudents} disabled={deletingBulk}
              className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50">
              <Trash2 size={12} /> {deletingBulk ? 'Removing…' : `Remove ${selectedStudents.size}`}
            </button>
            <button onClick={() => setSelectedStudents(new Set())} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs">
                <th className="px-3 py-2.5 w-8">
                  <input type="checkbox" className="rounded" checked={allSelected}
                    onChange={toggleSelectAllStudents} disabled={allFiltered.length === 0} />
                </th>
                {['Name', 'Email', 'Cohort', 'Joined', 'Attempts', 'Avg Score', 'Status', 'Readiness', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredStudents.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400">
                  {students.length === 0
                    ? 'No students in your cohorts yet. Upload a student CSV or ask admin to assign cohorts to you.'
                    : 'No students match the current filters — try clearing the search.'}
                </td></tr>
              ) : filteredStudents.map((s) => {
                const perf = perfCache[s.id];
                const isEditing = editId === s.id;
                const lockout = s.activeLockout;
                return (
                  <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selectedStudents.has(s.id) ? 'bg-orange-50 dark:bg-orange-900/10' : ''} ${lockout ? 'bg-red-50/40 dark:bg-red-900/5' : ''}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" className="rounded"
                        checked={selectedStudents.has(s.id)}
                        onChange={() => toggleStudentSelect(s.id)} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-800 dark:text-gray-200">
                      {isEditing ? (
                        <input className="input text-xs py-1 w-32" value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Full name" />
                      ) : (
                        <span className="font-medium">{s.name || <span className="text-gray-400 italic">—</span>}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {isEditing ? (
                        <input className="input text-xs py-1 w-44" type="email" value={editForm.email}
                          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                      ) : s.email}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-aws-orange font-medium">{s.cohortCode}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatJoined(s.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{s.examAttempts}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {s.avgScore !== null ? `${s.avgScore}/1000` : '—'}
                    </td>

                    {/* Lockout / Status cell */}
                    <td className="px-4 py-3">
                      {lockout ? (
                        <div className="space-y-1">
                          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${
                            lockout.type === 'device'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}>
                            <Lock size={10} />
                            {lockout.type === 'device' ? 'Anti-cheat Suspended' : 'Attempt Locked'}
                          </div>
                          <p className="text-xs text-gray-400 leading-tight">
                            Until {new Date(lockout.until).toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle size={11} /> Active
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ReadinessBadge readiness={perf?.readiness} />
                        {s.isQualified && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs font-semibold border border-yellow-300 dark:border-yellow-700" title="This student is qualified for certification">
                            <Star size={10} className="fill-yellow-400" /> Qualified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => saveEdit(s.id)} disabled={editSaving}
                            className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-1">
                            <Save size={11} /> {editSaving ? '…' : 'Save'}
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"><X size={12} /></button>
                          {editErr && <span className="text-xs text-red-500">{editErr}</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => nav(`/teacher/students/${s.id}`)}
                            className="text-aws-orange hover:underline text-xs font-medium flex items-center gap-1">
                            View <ChevronRight size={12} />
                          </button>
                          <button onClick={() => startEdit(s)}
                            className="text-blue-500 hover:text-blue-700 text-xs flex items-center gap-1">
                            <Edit2 size={11} />
                          </button>
                          {lockout && (
                            <button
                              onClick={() => unlockStudent(s.id)}
                              disabled={unlockingId === s.id}
                              title={`Unlock exam mode for ${s.name || s.email}`}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 transition disabled:opacity-50 font-medium"
                            >
                              <Unlock size={11} /> {unlockingId === s.id ? '…' : 'Unlock'}
                            </button>
                          )}
                          <button onClick={() => deleteStudent(s.id)}
                            className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Questions Tab ────────────────────────────────────────────
function QuestionsTab() {
  const nav = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [bankFilter, setBankFilter] = useState('mine');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [form, setForm] = useState({
    examTypeId: '', question: '',
    optA: '', optB: '', optC: '', optD: '',
    correctAnswer: '', explanation: '', referenceUrl: '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [converting, setConverting] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [search, setSearch] = useState('');
  const [filterExamType, setFilterExamType] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [sampleTab, setSampleTab] = useState('json');
  const [conversionJob, setConversionJob] = useState(null); // { jobId, status, pagesDone, pagesTotal }
  const pollRef = useRef(null);
  // Exam type selected for upload / download (visible selector near upload buttons)
  const [uploadExamTypeId, setUploadExamTypeId] = useState('');
  // Edit question modal state
  const [editingQ, setEditingQ] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState('');
  // Preview modal state
  const [previewQ, setPreviewQ] = useState(null);
  const jsonFileRef = useRef();
  const convertFileRef = useRef();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/teacher/questions?bank=${bankFilter}&limit=100`),
      api.get('/exam-types'),
      api.get('/teacher/questions?drafts=true&bank=mine&limit=1'),
      api.get('/teacher/questions/flagged'),
    ]).then(([q, et, d, fl]) => {
      setQuestions(q.data.questions || q.data || []);
      setExamTypes(et.data);
      setDraftCount(d.data.total || (d.data.questions || d.data || []).length);
      setFlaggedCount(fl.data.total || (fl.data.questions || []).length);
      if (et.data.length && !form.examTypeId) {
        setForm((f) => ({ ...f, examTypeId: String(et.data[0].id) }));
      }
      if (et.data.length && !uploadExamTypeId) {
        setUploadExamTypeId(String(et.data[0].id));
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [bankFilter]);

  const createQuestion = async (e) => {
    e.preventDefault();
    setCreating(true); setMsg(''); setErr('');
    try {
      await api.post('/teacher/questions', {
        examTypeId: form.examTypeId,
        question: form.question,
        options: [
          { label: 'A', text: form.optA },
          { label: 'B', text: form.optB },
          { label: 'C', text: form.optC },
          { label: 'D', text: form.optD },
        ].filter((o) => o.text.trim()),
        correctAnswer: form.correctAnswer,
        explanation: form.explanation,
        referenceUrl: form.referenceUrl,
      });
      setMsg('Question created and published.');
      setForm((f) => ({ ...f, question: '', optA: '', optB: '', optC: '', optD: '', correctAnswer: '', explanation: '', referenceUrl: '' }));
      setShowForm(false);
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Failed'); }
    finally { setCreating(false); }
  };

  const uploadBulk = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMsg(''); setErr('');
    const ext = file.name.split('.').pop().toLowerCase();

    // Client-side format validation before upload
    try {
      const text = await file.text();
      if (ext === 'json') {
        let parsed;
        try { parsed = JSON.parse(text); } catch {
          setErr('Invalid JSON file — the file could not be parsed. Download the JSON sample format to see the expected structure.');
          setShowSamples(true); setSampleTab('json'); e.target.value = ''; return;
        }
        if (!Array.isArray(parsed) || !parsed[0]?.question) {
          setErr('Wrong JSON structure — expected an array of question objects with a "question" field. Download the JSON sample to see the correct format.');
          setShowSamples(true); setSampleTab('json'); e.target.value = ''; return;
        }
      } else if (ext === 'csv') {
        const firstLine = text.split('\n')[0].toLowerCase();
        if (!firstLine.includes('question')) {
          setErr('Wrong CSV format — the file must have a "question" column header. Download the CSV sample to see the correct format.');
          setShowSamples(true); setSampleTab('csv'); e.target.value = ''; return;
        }
      }
    } catch { /* skip validation if file read fails */ }

    const fd = new FormData(); fd.append('file', file);
    if (uploadExamTypeId) fd.append('examTypeId', uploadExamTypeId);
    try {
      const { data } = await api.post('/teacher/questions/upload', fd);
      const parts = [`${data.imported} questions saved as drafts.`];
      if (data.flagged > 0) parts.push(`${data.flagged} question${data.flagged !== 1 ? 's' : ''} flagged for format review.`);
      parts.push('Go to "Review Drafts" to publish them.');
      setMsg(parts.join(' '));
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Upload failed'); }
    finally { e.target.value = ''; }
  };

  const convertFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setConverting(true); setMsg(''); setErr('');
    const fd = new FormData(); fd.append('file', file);
    if (uploadExamTypeId) fd.append('examTypeId', uploadExamTypeId);
    try {
      const { data, status } = await api.post('/teacher/questions/convert', fd);
      if (status === 202 && data.jobId) {
        // Large file — start polling
        setConversionJob({ jobId: data.jobId, status: 'processing', pagesDone: 0, pagesTotal: null });
        pollRef.current = setInterval(async () => {
          try {
            const { data: jobData } = await api.get(`/teacher/conversion-jobs/${data.jobId}`);
            setConversionJob(jobData);
            if (jobData.status === 'done') {
              clearInterval(pollRef.current);
              setConverting(false);
              setConversionJob(null);
              setMsg(`${jobData.imported} questions extracted and saved as drafts. Click "Review Drafts" to review and publish.`);
              setDraftCount((prev) => prev + jobData.imported);
              load();
            } else if (jobData.status === 'error') {
              clearInterval(pollRef.current);
              setConverting(false);
              setConversionJob(null);
              setErr((jobData.error || 'Conversion failed.') + ' Download the PDF/Word sample format to check the expected layout.');
              setShowSamples(true); setSampleTab('pdf');
            }
          } catch {}
        }, 3000);
      } else {
        // Legacy synchronous response
        if (data.imported === 0) {
          setErr('No questions could be extracted from this file. Make sure the document follows the expected format.');
          setShowSamples(true); setSampleTab('pdf');
        } else {
          setMsg(`${data.imported} questions extracted and saved as drafts. Click "Review Drafts" to review and publish.`);
          setDraftCount((prev) => prev + data.imported);
          load();
        }
        setConverting(false);
      }
    } catch (e) {
      setErr((e.response?.data?.error || 'Conversion failed.') + ' Download the PDF/Word sample format to check the expected layout.');
      setShowSamples(true); setSampleTab('pdf');
      setConverting(false);
    } finally {
      e.target.value = '';
    }
  };

  const toggleActive = async (q) => {
    await api.patch(`/teacher/questions/${q.id}`, { active: !q.active });
    load();
  };

  const deleteQ = async (q) => {
    if (!confirm('Delete this question?')) return;
    await api.delete(`/teacher/questions/${q.id}`);
    load();
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selected.size} selected question${selected.size !== 1 ? 's' : ''}?`)) return;
    setDeletingBulk(true);
    try {
      await api.delete('/teacher/questions/bulk', { data: { ids: Array.from(selected) } });
      setSelected(new Set());
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Bulk delete failed'); }
    finally { setDeletingBulk(false); }
  };

  const openEdit = (q) => {
    const opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
    const getOpt = (label) => (opts.find((o) => o.label === label)?.text || '');
    setEditForm({
      question: q.question || '',
      optA: getOpt('A'), optB: getOpt('B'), optC: getOpt('C'), optD: getOpt('D'),
      correctAnswer: q.correct_answer || '',
      explanation: q.explanation || '',
      referenceUrl: q.reference_url || '',
      examTypeId: q.exam_type_id ? String(q.exam_type_id) : '',
      active: q.active,
    });
    setEditErr('');
    setEditingQ(q);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true); setEditErr('');
    try {
      await api.put(`/teacher/questions/${editingQ.id}`, {
        question: editForm.question,
        options: [
          { label: 'A', text: editForm.optA },
          { label: 'B', text: editForm.optB },
          { label: 'C', text: editForm.optC },
          { label: 'D', text: editForm.optD },
        ].filter((o) => o.text.trim()),
        correctAnswer: editForm.correctAnswer,
        explanation: editForm.explanation,
        referenceUrl: editForm.referenceUrl,
        examTypeId: editForm.examTypeId || null,
        active: editForm.active,
      });
      setEditingQ(null);
      load();
    } catch (err) { setEditErr(err.response?.data?.error || 'Save failed'); }
    finally { setEditSaving(false); }
  };

  const filteredQuestions = questions.filter((q) => {
    if (search && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterExamType && String(q.exam_type_id) !== String(filterExamType)) return false;
    if (filterStatus === 'active' && !q.active) return false;
    if (filterStatus === 'inactive' && q.active) return false;
    return true;
  });

  const ownedFiltered = filteredQuestions.filter((q) => q.owner_type === 'teacher');
  const allOwnedSelected = ownedFiltered.length > 0 && ownedFiltered.every((q) => selected.has(q.id));

  const toggleSelect = (id) => {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const toggleSelectAll = () => {
    if (allOwnedSelected) {
      setSelected((prev) => { const s = new Set(prev); ownedFiltered.forEach((q) => s.delete(q.id)); return s; });
    } else {
      setSelected((prev) => { const s = new Set(prev); ownedFiltered.forEach((q) => s.add(q.id)); return s; });
    }
  };

  return (
    <div className="space-y-5">
      {/* Draft banner */}
      {(draftCount > 0 || flaggedCount > 0) && (
        <div className="card p-4 border-l-4 border-l-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 flex items-start gap-3">
          <AlertCircle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            {draftCount > 0 && (
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                {draftCount} draft question{draftCount !== 1 ? 's' : ''} waiting for review
              </p>
            )}
            {flaggedCount > 0 && (
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mt-0.5">
                {flaggedCount} question{flaggedCount !== 1 ? 's' : ''} flagged — Improper Format
              </p>
            )}
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">Review, correct errors, then publish to make them available to students.</p>
          </div>
          <button onClick={() => nav('/teacher/questions/review')}
            className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition shrink-0">
            Review Drafts →
          </button>
        </div>
      )}

      {/* Upload target + download bar */}
      <div className="card p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Exam Type for Upload / Download
            </label>
            <select
              className="input text-sm py-1.5 w-full"
              value={uploadExamTypeId}
              onChange={(e) => setUploadExamTypeId(e.target.value)}
            >
              <option value="">— Select exam type —</option>
              {examTypes.map((et) => (
                <option key={et.id} value={String(et.id)}>{et.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={jsonFileRef} type="file" accept=".json,.csv" className="hidden" onChange={uploadBulk} />
            <button
              onClick={() => { if (!uploadExamTypeId) { setErr('Please select an exam type before uploading.'); return; } jsonFileRef.current?.click(); }}
              className="btn-secondary py-2 text-sm flex items-center gap-2"
            >
              <Upload size={14} /> Upload JSON / CSV
            </button>
            <input ref={convertFileRef} type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg" className="hidden" onChange={convertFile} />
            <button
              onClick={() => { if (!uploadExamTypeId) { setErr('Please select an exam type before uploading.'); return; } convertFileRef.current?.click(); }}
              disabled={converting}
              className="btn-secondary py-2 text-sm flex items-center gap-2"
            >
              {converting ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
              {converting ? 'Converting...' : 'Convert PDF / Word / Image'}
            </button>
            <a
              href={`/api/teacher/questions/download${uploadExamTypeId ? `?examTypeId=${uploadExamTypeId}` : ''}`}
              download
              className="btn-secondary py-2 text-sm flex items-center gap-2"
            >
              <Download size={14} /> Download My Questions
            </a>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          All uploads and the CSV export apply to the selected exam type above.
        </p>
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap gap-3 items-center">
        <select className="input text-sm py-1.5 w-44" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
          <option value="mine">My Questions</option>
          <option value="admin">Admin Questions</option>
          <option value="all">All Questions</option>
        </select>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary py-2 text-sm flex items-center gap-2">
            <Plus size={14} /> Add Single Question
          </button>
          <button
            onClick={() => setShowSamples((v) => !v)}
            className={`py-2 text-sm flex items-center gap-2 border rounded-lg px-3 font-medium transition ${showSamples ? 'bg-aws-orange text-white border-aws-orange' : 'border-aws-orange text-aws-orange hover:bg-orange-50 dark:hover:bg-orange-900/10'}`}>
            <Download size={14} /> Sample Formats
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input text-sm py-1.5 w-64"
        />
        <select className="input text-sm py-1.5 w-48" value={filterExamType} onChange={(e) => setFilterExamType(e.target.value)}>
          <option value="">All Exam Types</option>
          {examTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
        </select>
        <select className="input text-sm py-1.5 w-36" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {(search || filterExamType || filterStatus !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterExamType(''); setFilterStatus('all'); }}
            className="text-xs text-gray-400 hover:text-red-500 underline">Clear filters</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filteredQuestions.length} of {questions.length} questions</span>
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-aws-orange/10 border border-aws-orange/30 rounded-lg">
          <span className="text-sm font-medium text-aws-orange">{selected.size} selected</span>
          <button onClick={deleteSelected} disabled={deletingBulk}
            className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50">
            <Trash2 size={12} /> {deletingBulk ? 'Deleting...' : `Delete ${selected.size}`}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      )}

      {msg && <p className="text-sm text-green-600 bg-green-50 dark:bg-green-900/10 rounded-lg px-4 py-2">{msg}</p>}
      {err && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg px-4 py-3 flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-500" />
          <span>{err}</span>
        </div>
      )}

      {/* Conversion progress */}
      {conversionJob && (
        <div className="card p-4 border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-900/10">
          <div className="flex items-center gap-3 mb-2">
            <RefreshCw size={16} className="animate-spin text-blue-500" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Processing PDF — please keep this page open...
            </span>
          </div>
          {conversionJob.pagesTotal && (
            <>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-1">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((conversionJob.pagesDone / conversionJob.pagesTotal) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Page {conversionJob.pagesDone} of {conversionJob.pagesTotal} — {Math.round((conversionJob.pagesDone / conversionJob.pagesTotal) * 100)}% complete
              </p>
            </>
          )}
          {!conversionJob.pagesTotal && (
            <p className="text-xs text-blue-700 dark:text-blue-400">Starting up — this may take several minutes for image-based PDFs...</p>
          )}
        </div>
      )}

      {/* Sample Formats Panel */}
      {showSamples && (
        <div className="card border border-aws-orange/30 bg-orange-50/50 dark:bg-orange-900/5">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Download size={15} className="text-aws-orange" /> Sample Formats — Download a template for any supported type
            </p>
            <button onClick={() => setShowSamples(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>

          {/* Format tabs */}
          <div className="flex gap-1 px-5 border-b border-orange-200 dark:border-orange-800/40">
            {[
              { id: 'json',  label: 'JSON' },
              { id: 'csv',   label: 'CSV' },
              { id: 'pdf',   label: 'PDF / Word' },
              { id: 'image', label: 'Image (OCR)' },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setSampleTab(id)}
                className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition ${sampleTab === id ? 'border-aws-orange text-aws-orange' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {sampleTab === 'json' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600 dark:text-gray-400">An array of question objects. Supports up to 6 options (A–F). For multi-select, set <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">question_type</code> to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">"multi"</code> and <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">max_selections</code> to the required count.</p>
                  <a href="/api/samples/questions.json" className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 shrink-0 ml-3">
                    <Download size={12} /> Download sample_questions.json
                  </a>
                </div>
                <pre className="text-xs bg-gray-900 text-green-300 rounded-lg p-4 overflow-x-auto leading-relaxed">{`[
  {
    "question": "Which AWS service provides scalable object storage?",
    "options": [
      { "label": "A", "text": "Amazon EC2" },
      { "label": "B", "text": "Amazon S3" },
      { "label": "C", "text": "Amazon RDS" },
      { "label": "D", "text": "Amazon EBS" }
    ],
    "correct_answer": "B",
    "explanation": "Amazon S3 is an object storage service.",
    "domain": "Cloud Technology",
    "reference_url": "https://aws.amazon.com/s3/"
  },
  {
    "question": "Which are pillars of the AWS Well-Architected Framework? (Choose two.)",
    "options": [
      { "label": "A", "text": "Availability" },
      { "label": "B", "text": "Reliability" },
      { "label": "C", "text": "Scalability" },
      { "label": "D", "text": "Responsive design" },
      { "label": "E", "text": "Performance Efficiency" }
    ],
    "correct_answer": "BE",
    "question_type": "multi",
    "max_selections": 2,
    "explanation": "Reliability and Performance Efficiency are two of the six pillars.",
    "domain": "Cloud Concepts",
    "reference_url": "https://aws.amazon.com/architecture/well-architected/"
  }
]`}</pre>
              </div>
            )}

            {sampleTab === 'csv' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600 dark:text-gray-400">One question per row. Supports columns <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">option_a</code> through <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">option_f</code> (up to 6 options). For multi-select, include <strong>(Choose two.)</strong> in the question — max_selections is auto-detected.</p>
                  <a href="/api/samples/questions.csv" className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 shrink-0 ml-3">
                    <Download size={12} /> Download sample_questions.csv
                  </a>
                </div>
                <pre className="text-xs bg-gray-900 text-green-300 rounded-lg p-4 overflow-x-auto leading-relaxed">{`question,option_a,option_b,option_c,option_d,option_e,option_f,correct_answer,explanation,domain,reference_url
"Which AWS service provides scalable object storage?","Amazon EC2","Amazon S3","Amazon RDS","Amazon EBS","","","B","S3 is object storage.","Cloud Technology","https://aws.amazon.com/s3/"
"Which are pillars of the AWS Well-Architected Framework? (Choose two.)","Availability","Reliability","Scalability","Responsive design","Performance Efficiency","","BE","Reliability and Performance Efficiency are two pillars.","Cloud Concepts",""`}</pre>
                <div className="text-xs space-y-1">
                  <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                    Wrap all values in double quotes. Escape internal quotes by doubling them (<code>{`""`}</code>). Leave unused option columns empty.
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 px-1">
                    Multi-select answers: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">BE</code> or <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">B, E</code> or <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">B and E</code> are all accepted.
                  </p>
                </div>
              </div>
            )}

            {sampleTab === 'pdf' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Questions must be numbered with A–F options and an <strong>Answer:</strong> line. For multi-select add <strong>(Choose two.)</strong> to the question text. Works for PDF and Word (.docx) files.</p>
                  <a href="/api/samples/questions-pdf-format.txt" className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 shrink-0 ml-3">
                    <Download size={12} /> Download format guide (.txt)
                  </a>
                </div>
                <pre className="text-xs bg-gray-900 text-green-300 rounded-lg p-4 overflow-x-auto leading-relaxed">{`1. Which AWS service provides scalable object storage in the cloud?

A. Amazon EC2
B. Amazon S3
C. Amazon RDS
D. Amazon EBS

Answer: B

Explanation: Amazon S3 is an object storage service offering
99.999999999% durability and industry-leading availability.

---

2. Which are pillars of the AWS Well-Architected Framework? (Choose two.)

A. Availability
B. Reliability
C. Scalability
D. Responsive design
E. Performance Efficiency

Answer: B, E

Explanation: Reliability and Performance Efficiency are two
of the six pillars of the AWS Well-Architected Framework.

---

3. Which AWS services decouple application components? (Choose two.)

A. Amazon SQS
B. Amazon EC2
C. Amazon SNS
D. Amazon RDS

Answer: A, C

Explanation: SQS and SNS are messaging services used to decouple
application components.`}</pre>
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 px-1">
                  <p><strong>Answer formats accepted:</strong> <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">B</code> &nbsp;|&nbsp; <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">BE</code> &nbsp;|&nbsp; <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">B, E</code> &nbsp;|&nbsp; <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">B and E</code></p>
                  <p>Supports A–F options. Scanned PDFs use OCR — ensure text is clear for best results.</p>
                </div>
              </div>
            )}

            {sampleTab === 'image' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 dark:text-gray-400">Upload a <strong>.png</strong> or <strong>.jpg</strong> image containing exam questions. The system uses OCR (Tesseract) to extract text, then parses it using the same rules as PDF/Word.</p>
                <div className="bg-gray-900 rounded-lg p-4 text-xs text-green-300 leading-relaxed">
                  <p className="text-gray-400 mb-2"># Image should clearly show numbered questions like:</p>
                  <p>1. Which service is Amazon's managed relational database?</p>
                  <p className="mt-1">A. DynamoDB</p>
                  <p>B. Amazon RDS</p>
                  <p>C. Amazon Redshift</p>
                  <p>D. Aurora Serverless</p>
                  <p className="mt-1">Answer: B</p>
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg space-y-1">
                  <p><strong>Tips for best OCR accuracy:</strong></p>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li>Use high resolution (300 DPI or higher)</li>
                    <li>Black text on white background works best</li>
                    <li>Avoid decorative fonts or heavy watermarks</li>
                    <li>Crop tightly around the question content</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">New Question</h3>
          <form onSubmit={createQuestion} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Exam Type</label>
              <select className="input text-sm py-1.5 w-full" value={form.examTypeId}
                onChange={(e) => setForm((f) => ({ ...f, examTypeId: e.target.value }))} required>
                {examTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Question</label>
              <textarea className="input text-sm py-2 h-20 resize-none" value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['A', 'B', 'C', 'D'].map((letter) => (
                <div key={letter}>
                  <label className="block text-xs text-gray-500 mb-1">Option {letter}</label>
                  <input className="input text-sm py-1.5" value={form[`opt${letter}`]}
                    onChange={(e) => setForm((f) => ({ ...f, [`opt${letter}`]: e.target.value }))}
                    placeholder={`Option ${letter}…`} required={letter === 'A' || letter === 'B'} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Correct Answer(s)</label>
                <input className="input text-sm py-1.5 uppercase w-full" value={form.correctAnswer}
                  onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value.toUpperCase() }))}
                  placeholder="e.g. B or BC" required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reference URL (optional)</label>
                <input className="input text-sm py-1.5" value={form.referenceUrl}
                  onChange={(e) => setForm((f) => ({ ...f, referenceUrl: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Explanation (optional)</label>
              <textarea className="input text-sm py-2 h-16 resize-none" value={form.explanation}
                onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creating} className="btn-primary py-2 text-sm">
                {creating ? 'Creating...' : 'Create & Publish'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Question Preview Modal — shows exactly how a student sees it */}
      {previewQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Question Preview</h3>
                <p className="text-xs text-gray-400 mt-0.5">As seen by a student during an exam</p>
              </div>
              <button onClick={() => setPreviewQ(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Question text */}
              <p className="text-base font-medium text-gray-900 dark:text-white leading-relaxed">{previewQ.question}</p>
              {/* Options */}
              <div className="space-y-2.5">
                {(() => {
                  let opts = previewQ.options;
                  if (typeof opts === 'string') { try { opts = JSON.parse(opts); } catch { opts = []; } }
                  return (Array.isArray(opts) ? opts : []).map((opt, i) => {
                    const label = opt.label || String.fromCharCode(65 + i);
                    const text  = opt.text || opt;
                    const isCorrect = label === previewQ.correct_answer;
                    return (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border-2 transition ${
                        isCorrect
                          ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                      }`}>
                        <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                          isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isCorrect && <span className="w-2 h-2 rounded-full bg-white" />}
                        </span>
                        <span className={`text-sm ${isCorrect ? 'font-semibold text-green-800 dark:text-green-200' : 'text-gray-700 dark:text-gray-300'}`}>
                          {text}
                        </span>
                        {isCorrect && (
                          <span className="ml-auto text-xs font-bold text-green-600 dark:text-green-400 flex-shrink-0">✓ Correct</span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              {/* Explanation */}
              {previewQ.explanation && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Explanation</p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">{previewQ.explanation}</p>
                </div>
              )}
              {/* Meta */}
              <div className="flex flex-wrap gap-2 pt-1">
                {previewQ.domain && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{previewQ.domain}</span>}
                {previewQ.examTypeName && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-aws-orange">{previewQ.examTypeName}</span>}
                {previewQ.draft && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Draft</span>}
              </div>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-2">
              <button onClick={() => { setPreviewQ(null); openEdit(previewQ); }}
                className="btn-secondary text-sm py-2 px-4 flex items-center gap-1.5">
                <Edit2 size={14} /> Edit Question
              </button>
              <button onClick={() => setPreviewQ(null)} className="btn-primary text-sm py-2 px-4">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {editingQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white">Edit Question</h3>
              <button onClick={() => setEditingQ(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              {editErr && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">{editErr}</p>}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Exam Type</label>
                <select className="input text-sm py-1.5 w-full" value={editForm.examTypeId}
                  onChange={(e) => setEditForm((f) => ({ ...f, examTypeId: e.target.value }))}>
                  <option value="">— None —</option>
                  {examTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Question</label>
                <textarea className="input text-sm py-2 h-24 resize-none w-full" value={editForm.question}
                  onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['A', 'B', 'C', 'D'].map((letter) => (
                  <div key={letter}>
                    <label className="block text-xs text-gray-500 mb-1">Option {letter}</label>
                    <input className="input text-sm py-1.5 w-full" value={editForm[`opt${letter}`]}
                      onChange={(e) => setEditForm((f) => ({ ...f, [`opt${letter}`]: e.target.value }))}
                      placeholder={`Option ${letter}…`} required={letter === 'A' || letter === 'B'} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Correct Answer(s)</label>
                  <input className="input text-sm py-1.5 uppercase w-full" value={editForm.correctAnswer}
                    onChange={(e) => setEditForm((f) => ({ ...f, correctAnswer: e.target.value.toUpperCase() }))}
                    placeholder="e.g. B or BC" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reference URL (optional)</label>
                  <input className="input text-sm py-1.5 w-full" value={editForm.referenceUrl}
                    onChange={(e) => setEditForm((f) => ({ ...f, referenceUrl: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Explanation (optional)</label>
                <textarea className="input text-sm py-2 h-16 resize-none w-full" value={editForm.explanation}
                  onChange={(e) => setEditForm((f) => ({ ...f, explanation: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="editActive" checked={editForm.active}
                  onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))} className="rounded" />
                <label htmlFor="editActive" className="text-sm text-gray-600 dark:text-gray-400">Active (visible to students)</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editSaving} className="btn-primary py-2 text-sm">
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditingQ(null)} className="btn-secondary py-2 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Questions table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b text-xs">
              <th className="px-3 py-2.5 w-8">
                <input type="checkbox" className="rounded"
                  checked={allOwnedSelected}
                  onChange={toggleSelectAll}
                  disabled={ownedFiltered.length === 0}
                />
              </th>
              {['Question', 'Exam Type', 'Answer', 'Source', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : filteredQuestions.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">
                {questions.length === 0
                  ? 'No questions yet — upload a JSON/CSV file or create one using the form above.'
                  : 'No questions match the current filters. Try clearing the search or changing the exam type filter.'}
              </td></tr>
            ) : filteredQuestions.map((q) => (
              <tr key={q.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selected.has(q.id) ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}>
                <td className="px-3 py-3">
                  {q.owner_type === 'teacher' && (
                    <input type="checkbox" className="rounded"
                      checked={selected.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                    />
                  )}
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2">{q.question}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{q.examTypeName || '—'}</td>
                <td className="px-4 py-3 text-xs font-mono font-bold text-aws-orange">{q.correct_answer || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{q.owner_type === 'teacher' ? 'Mine' : 'Admin'}</td>
                <td className="px-4 py-3">
                  {q.active
                    ? <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Active</span>
                    : <span className="text-xs text-gray-400 flex items-center gap-1"><XCircle size={12} /> Inactive</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPreviewQ(q)} className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-0.5" title="Preview as student">
                      <Eye size={12} />
                    </button>
                    {q.owner_type === 'teacher' && (
                      <>
                        <button onClick={() => openEdit(q)} className="text-xs text-aws-orange hover:text-orange-700 flex items-center gap-0.5" title="Edit">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => toggleActive(q)} className="text-xs text-blue-500 hover:text-blue-700">
                          {q.active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => deleteQ(q)} className="text-xs text-red-500 hover:text-red-700">
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
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

// ── Settings Tab ─────────────────────────────────────────────
function SettingsTab() {
  const [cohorts, setCohorts] = useState([]);
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState('');

  // Exam type management
  const [examTypes, setExamTypes] = useState([]);
  const [showCreateExam, setShowCreateExam] = useState(false);
  const [examForm, setExamForm] = useState({ code: '', name: '', description: '', questionsPerExam: 65, timeLimitMinutes: 90, passingScore: 700 });
  const [examCreating, setExamCreating] = useState(false);
  const [examErr, setExamErr] = useState('');

  const loadExamTypes = () => api.get('/teacher/exam-types').then((r) => setExamTypes(r.data));
  useEffect(() => {
    api.get('/teacher/cohorts').then((r) => setCohorts(r.data));
    loadExamTypes();
  }, []);

  const setBank = async (cohortId, bank) => {
    setSaving((prev) => ({ ...prev, [cohortId]: true })); setMsg('');
    try {
      await api.patch(`/teacher/cohorts/${cohortId}/question-bank`, { questionBank: bank });
      setCohorts((prev) => prev.map((c) => c.id === cohortId ? { ...c, question_bank: bank } : c));
      setMsg('Saved.'); setTimeout(() => setMsg(''), 2000);
    } catch { setMsg('Failed to save.'); }
    finally { setSaving((prev) => ({ ...prev, [cohortId]: false })); }
  };

  const createExamType = async (e) => {
    e.preventDefault();
    setExamCreating(true); setExamErr('');
    try {
      await api.post('/teacher/exam-types', {
        code: examForm.code.trim().toLowerCase(),
        name: examForm.name.trim(),
        description: examForm.description || null,
        questionsPerExam: examForm.questionsPerExam,
        timeLimitMinutes: examForm.timeLimitMinutes,
        passingScore: examForm.passingScore,
      });
      setExamForm({ code: '', name: '', description: '', questionsPerExam: 65, timeLimitMinutes: 90, passingScore: 700 });
      setShowCreateExam(false);
      loadExamTypes();
    } catch (err) { setExamErr(err.response?.data?.error || 'Failed to create exam type'); }
    finally { setExamCreating(false); }
  };

  const deleteExamType = async (et) => {
    if (!confirm(`Remove "${et.name}"? This will hide it from the platform.`)) return;
    try {
      await api.delete(`/teacher/exam-types/${et.id}`);
      loadExamTypes();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="max-w-3xl space-y-8">

      {/* ── Exam Types ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Exam Types</h2>
          <button onClick={() => { setShowCreateExam((v) => !v); setExamErr(''); }}
            className="btn-primary py-1.5 text-sm flex items-center gap-2">
            <Plus size={14} /> New Exam Type
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Create custom exam types for your students. Domain competency areas and question weights
          can be configured by an admin after creation.
        </p>

        {showCreateExam && (
          <form onSubmit={createExamType} className="card p-4 mb-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Code <span className="text-gray-400">(e.g. saa-c03)</span></label>
                <input className="input text-sm py-1.5 w-full" value={examForm.code}
                  onChange={(e) => setExamForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))}
                  required placeholder="my-exam-01" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input className="input text-sm py-1.5 w-full" value={examForm.name}
                  onChange={(e) => setExamForm((f) => ({ ...f, name: e.target.value }))}
                  required placeholder="My Custom Exam" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Description <span className="text-gray-400">(optional)</span></label>
                <input className="input text-sm py-1.5 w-full" value={examForm.description}
                  onChange={(e) => setExamForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description..." />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Questions per Exam</label>
                <input type="number" className="input text-sm py-1.5 w-full" value={examForm.questionsPerExam}
                  onChange={(e) => setExamForm((f) => ({ ...f, questionsPerExam: Number(e.target.value) }))} min={1} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Time Limit (minutes)</label>
                <input type="number" className="input text-sm py-1.5 w-full" value={examForm.timeLimitMinutes}
                  onChange={(e) => setExamForm((f) => ({ ...f, timeLimitMinutes: Number(e.target.value) }))} min={1} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Passing Score <span className="text-gray-400">(out of 1000)</span></label>
                <input type="number" className="input text-sm py-1.5 w-full" value={examForm.passingScore}
                  onChange={(e) => setExamForm((f) => ({ ...f, passingScore: Number(e.target.value) }))} min={1} max={1000} />
              </div>
            </div>
            {examErr && <p className="text-sm text-red-500">{examErr}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={examCreating} className="btn-primary py-1.5 text-sm">
                {examCreating ? 'Creating…' : 'Create Exam Type'}
              </button>
              <button type="button" onClick={() => setShowCreateExam(false)} className="btn-secondary py-1.5 text-sm">Cancel</button>
            </div>
          </form>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {examTypes.map((et) => (
            <div key={et.id} className="card p-4 flex items-start justify-between">
              <div className="min-w-0">
                <span className="text-xs font-mono font-bold text-aws-orange uppercase">{et.code}</span>
                <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm mt-0.5 truncate">{et.name}</p>
                <div className="flex gap-3 text-xs text-gray-500 mt-1">
                  <span>{et.questions_per_exam} Qs</span>
                  <span>{et.time_limit_minutes} min</span>
                  <span>Pass {et.passing_score}/1000</span>
                </div>
              </div>
              {et.created_by_teacher_id && (
                <button onClick={() => deleteExamType(et)}
                  className="text-gray-300 hover:text-red-500 transition ml-2 flex-shrink-0" title="Remove this exam type">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {examTypes.length === 0 && (
            <p className="text-gray-400 text-sm col-span-2">No exam types available.</p>
          )}
        </div>
      </div>

      {/* ── Question Bank per Cohort ── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">Question Bank per Cohort</h2>
        <p className="text-sm text-gray-500 mb-5">
          <strong className="text-gray-700 dark:text-gray-300">Admin</strong> — admin questions only. &nbsp;
          <strong className="text-gray-700 dark:text-gray-300">Mine</strong> — your questions only. &nbsp;
          <strong className="text-gray-700 dark:text-gray-300">Mixed</strong> — both.
        </p>
        {msg && <p className="text-sm text-green-600 mb-3">{msg}</p>}
        {cohorts.length === 0 ? (
          <p className="text-gray-400 text-sm">No cohorts assigned.</p>
        ) : cohorts.map((c) => (
          <div key={c.id} className="card p-4 flex items-center gap-4 mb-3">
            <div className="flex-1">
              <p className="font-semibold text-gray-800 dark:text-gray-200">{c.name}</p>
              <p className="text-xs text-gray-500 font-mono">{c.code}</p>
            </div>
            <select className="input text-sm py-1.5 w-44" value={c.question_bank || 'admin'}
              onChange={(e) => setBank(c.id, e.target.value)} disabled={saving[c.id]}>
              <option value="admin">Admin Questions</option>
              <option value="teacher">Mine (Teacher)</option>
              <option value="mixed">Mixed</option>
            </select>
            {saving[c.id] && <RefreshCw size={14} className="text-gray-400 animate-spin" />}
          </div>
        ))}
      </div>

      {/* ── MFA Section ── */}
      <MfaSection />

    </div>
  );
}

// ── MFA Settings Section ──────────────────────────────────────
function MfaSection() {
  const [mfaEnabled, setMfaEnabled] = useState(null); // null = loading
  const [step, setStep] = useState('idle'); // 'idle' | 'setup' | 'verify' | 'disable'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    api.get('/teacher/mfa/status')
      .then((r) => setMfaEnabled(r.data.mfaEnabled))
      .catch(() => setMfaEnabled(false));
  }, []);

  const startSetup = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const { data } = await api.post('/teacher/mfa/setup');
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setStep('setup');
    } catch (e) { setErr(e.response?.data?.error || 'Failed to start setup'); }
    finally { setBusy(false); }
  };

  const verifyAndEnable = async (e) => {
    e.preventDefault();
    if (!code.trim()) { setErr('Enter the 6-digit code from your authenticator app.'); return; }
    setBusy(true); setErr('');
    try {
      await api.post('/teacher/mfa/enable', { code: code.trim() });
      setMfaEnabled(true);
      setStep('idle');
      setMsg('MFA enabled! Your account is now protected.');
      setCode('');
    } catch (e) { setErr(e.response?.data?.error || 'Invalid code — try again.'); }
    finally { setBusy(false); }
  };

  const disableMfa = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api.post('/teacher/mfa/disable', { password: disablePassword, code: disableCode.trim() });
      setMfaEnabled(false);
      setStep('idle');
      setMsg('MFA has been disabled.');
      setDisablePassword(''); setDisableCode('');
    } catch (e) { setErr(e.response?.data?.error || 'Failed to disable MFA'); }
    finally { setBusy(false); }
  };

  if (mfaEnabled === null) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <ShieldCheck size={18} className="text-aws-orange" /> Two-Factor Authentication
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Add an extra layer of security to your teacher account using an authenticator app.
          </p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${mfaEnabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
          {mfaEnabled ? '● Enabled' : '○ Disabled'}
        </span>
      </div>

      {msg && <p className="text-sm text-green-600 dark:text-green-400 mb-3 font-medium">{msg}</p>}
      {err && <p className="text-sm text-red-500 mb-3">{err}</p>}

      {/* ── Idle state ── */}
      {step === 'idle' && !mfaEnabled && (
        <div className="card p-5 border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Use <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app to scan a QR code
            and generate login codes. Once enabled, you'll need the code every time you sign in.
          </p>
          <button onClick={startSetup} disabled={busy} className="btn-primary py-2 flex items-center gap-2 text-sm">
            <ShieldCheck size={15} /> {busy ? 'Preparing…' : 'Set Up Two-Factor Authentication'}
          </button>
        </div>
      )}

      {step === 'idle' && mfaEnabled && (
        <div className="card p-5 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
          <p className="text-sm text-green-700 dark:text-green-300 mb-4">
            Your account requires a 6-digit authenticator code on every login. Keep your authenticator app installed.
          </p>
          <button onClick={() => { setStep('disable'); setErr(''); setDisablePassword(''); setDisableCode(''); }}
            className="text-sm text-red-500 hover:text-red-700 underline font-medium">
            Disable Two-Factor Authentication
          </button>
        </div>
      )}

      {/* ── Setup: show QR code ── */}
      {step === 'setup' && (
        <div className="card p-6 space-y-5">
          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Step 1 — Scan this QR code</p>
            <p className="text-sm text-gray-500 mb-4">
              Open your authenticator app (Google Authenticator, Authy, etc.) and scan the QR code below.
            </p>
            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 inline-block">
                <img src={qrDataUrl} alt="MFA QR Code" className="w-48 h-48" />
              </div>
            </div>
            <div className="mt-3 text-center">
              <button onClick={() => setShowSecret((v) => !v)}
                className="text-xs text-gray-400 hover:text-aws-orange underline">
                {showSecret ? 'Hide' : 'Can\'t scan? Enter code manually instead'}
              </button>
              {showSecret && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg font-mono text-sm text-gray-700 dark:text-gray-300 tracking-widest text-center break-all border border-gray-200 dark:border-gray-700">
                  {secret}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Step 2 — Enter the 6-digit code</p>
            <p className="text-sm text-gray-500 mb-3">Enter the code shown in your authenticator app to confirm setup.</p>
            <form onSubmit={verifyAndEnable} className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9 ]*"
                maxLength={7}
                className="input text-center text-xl tracking-widest font-mono w-40"
                placeholder="000 000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, ''))}
                autoComplete="one-time-code"
              />
              <button type="submit" disabled={busy} className="btn-primary px-5 text-sm">
                {busy ? 'Verifying…' : 'Enable MFA'}
              </button>
              <button type="button" onClick={() => { setStep('idle'); setCode(''); setErr(''); }}
                className="btn-secondary text-sm px-4">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Disable MFA ── */}
      {step === 'disable' && (
        <div className="card p-6 border border-red-200 dark:border-red-800 space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            To disable MFA, confirm your password and enter the current code from your authenticator app.
          </p>
          <form onSubmit={disableMfa} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Current Password</label>
              <input type="password" className="input text-sm py-1.5 w-full max-w-xs" placeholder="••••••••"
                value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Authenticator Code</label>
              <input type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7}
                className="input text-sm py-1.5 w-36 font-mono tracking-widest text-center"
                placeholder="000 000"
                value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/[^0-9 ]/g, ''))}
                autoComplete="one-time-code" required />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy}
                className="flex items-center gap-1.5 text-sm px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50 font-medium">
                {busy ? 'Disabling…' : 'Disable MFA'}
              </button>
              <button type="button" onClick={() => { setStep('idle'); setErr(''); }}
                className="btn-secondary text-sm px-4">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Results Tab ───────────────────────────────────────────────
function ResultsTab() {
  const nav = useNavigate();
  const [results, setResults]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [modeFilter, setMode]   = useState('all');
  const [passedFilter, setPassed] = useState('all');
  const LIMIT = 30;

  const load = (p = 1, s = search, m = modeFilter, pf = passedFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, limit: LIMIT, mode: m, passed: pf });
    if (s) params.set('search', s);
    api.get(`/teacher/results?${params}`)
      .then((r) => { setResults(r.data.results || []); setTotal(r.data.total || 0); setPage(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault();
    load(1, search, modeFilter, passedFilter);
  };

  const changeMode = (v) => { setMode(v); load(1, search, v, passedFilter); };
  const changePassed = (v) => { setPassed(v); load(1, search, modeFilter, v); };
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="input-field text-sm px-3 py-1.5 w-56" />
          <button type="submit" className="btn-secondary text-sm px-3 py-1.5">Search</button>
        </form>
        <select value={modeFilter} onChange={(e) => changeMode(e.target.value)}
          className="input-field text-sm px-2 py-1.5">
          <option value="all">All modes</option>
          <option value="exam">Exam only</option>
          <option value="practice">Practice only</option>
        </select>
        <select value={passedFilter} onChange={(e) => changePassed(e.target.value)}
          className="input-field text-sm px-2 py-1.5">
          <option value="all">All results</option>
          <option value="true">Passed</option>
          <option value="false">Failed</option>
        </select>
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          {total} session{total !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : results.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No sessions found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300">Student</th>
                <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300">Exam</th>
                <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300">Mode</th>
                <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300 text-center">Score</th>
                <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300 text-center">Result</th>
                <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300">Date</th>
                <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-800 dark:text-gray-100">{r.studentName || '—'}</div>
                    <div className="text-xs text-gray-400">{r.studentEmail}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{r.examName || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.mode === 'exam'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    }`}>
                      {r.mode === 'exam' ? 'Exam' : 'Practice'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-semibold text-gray-800 dark:text-gray-100">
                    {r.score ?? '—'}
                    {r.passingScore ? <span className="text-xs text-gray-400 font-normal">/{r.passingScore}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {r.passed
                      ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium"><CheckCircle size={11} />Pass</span>
                      : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-medium"><XCircle size={11} />Fail</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => nav(`/results/${r.id}`)}
                      className="flex items-center gap-1 text-xs text-aws-orange hover:underline font-medium">
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button disabled={page <= 1} onClick={() => load(page - 1)}
            className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => load(page + 1)}
            className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
const TABS = [
  { id: 'students',  label: 'Students',     icon: Users },
  { id: 'results',   label: 'Results',      icon: BarChart2 },
  { id: 'questions', label: 'My Questions',  icon: HelpCircle },
  { id: 'settings',  label: 'Settings',     icon: Settings },
];

export default function TeacherDashboard() {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [tab, setTab] = useState('students');
  const [showSettings, setShowSettings] = useState(false);
  const logout = () => { localStorage.clear(); nav('/login'); };
  const TabContent = { students: StudentsTab, results: ResultsTab, questions: QuestionsTab, settings: SettingsTab }[tab];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <nav className="bg-aws-navy shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-aws-orange rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="text-white font-semibold">Teacher Dashboard</span>
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

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                tab === id ? 'border-aws-orange text-aws-orange' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <TabContent />
      </div>
    </div>
  );
}
