import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  ArrowLeft, CheckCircle, XCircle, Edit2, Save, Trash2,
  ChevronDown, ChevronUp, BookOpen, AlertCircle, AlertTriangle,
  Code, RefreshCw, ThumbsUp, CheckSquare, Square, Loader,
} from 'lucide-react';

const PAGE_SIZE = 200;       // how many to fetch per request
const REFILL_AT = 20;        // auto-fetch more when visible drops below this

// ── Draft question card ────────────────────────────────────────
function QuestionCard({ q, examTypes, domainsByExamType, onUpdate, onPublish, onDelete, selected, onToggleSelect }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    question: q.question,
    domain: q.domain,
    examTypeId: q.exam_type_id || '',
    correctAnswer: q.correct_answer || '',
    explanation: q.explanation || '',
    referenceUrl: q.reference_url || '',
    options: (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) || [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);

  const save = async () => {
    if (!form.question.trim()) { setError('Question text is required.'); return; }
    if (!form.domain) { setError('Domain is required.'); return; }
    if (form.options.filter((o) => o.text.trim()).length < 2) { setError('At least 2 options are required.'); return; }
    setSaving(true); setError('');
    try {
      await api.put(`/teacher/questions/${q.id}`, {
        question: form.question,
        domain: form.domain,
        examTypeId: form.examTypeId || undefined,
        correctAnswer: form.correctAnswer,
        explanation: form.explanation,
        referenceUrl: form.referenceUrl,
        options: form.options.filter((o) => o.text.trim()),
      });
      onUpdate(q.id, { ...q, ...form, options: form.options });
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const publish = async () => {
    await api.patch(`/teacher/questions/${q.id}/publish`);
    onPublish([q.id]);
  };

  const del = async () => {
    if (!confirm('Delete this question? This cannot be undone.')) return;
    await api.delete(`/teacher/questions/${q.id}`);
    onDelete([q.id]);
  };

  return (
    <div className={`card overflow-hidden border-l-4 transition-all ${selected ? 'border-l-aws-orange bg-orange-50/30 dark:bg-orange-900/5' : 'border-l-yellow-400'}`}>
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        {/* Checkbox */}
        <button onClick={() => onToggleSelect(q.id)} className="mt-0.5 shrink-0 text-gray-400 hover:text-aws-orange transition">
          {selected ? <CheckSquare size={18} className="text-aws-orange" /> : <Square size={18} />}
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <textarea
              className="input text-sm py-2 w-full h-20 resize-none"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
            />
          ) : (
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{q.question}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 px-2 py-0.5 rounded-full">Draft</span>
            <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">{q.domain}</span>
            {q.correct_answer
              ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle size={10} /> Answer: {q.correct_answer}</span>
              : <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertCircle size={10} /> No answer set</span>}
            {q.question_type === 'multi' && (
              <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                Multi-select ({q.max_selections})
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="text-gray-400 hover:text-gray-600 mt-1 shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Domain</label>
                  <select className="input text-sm py-1.5" value={form.domain}
                    onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}>
                    {form.domain && !(domainsByExamType[form.examTypeId] || []).some((d) => d.name === form.domain) && (
                      <option value={form.domain}>{form.domain}</option>
                    )}
                    {(domainsByExamType[form.examTypeId] || []).map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                    {!form.examTypeId && <option value="" disabled>Select an exam type first</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Exam Type</label>
                  <select className="input text-sm py-1.5" value={form.examTypeId}
                    onChange={(e) => setForm((f) => ({ ...f, examTypeId: e.target.value }))}>
                    <option value="">None</option>
                    {examTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-2">Answer Options</label>
                <div className="space-y-2">
                  {['A', 'B', 'C', 'D', 'E', 'F'].map((lbl) => {
                    const opt = form.options.find((o) => o.label === lbl) || { label: lbl, text: '' };
                    return (
                      <div key={lbl} className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          form.correctAnswer.includes(lbl) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>{lbl}</span>
                        <input className="input text-sm py-1.5 flex-1" value={opt.text}
                          onChange={(e) => {
                            const newOpts = form.options.filter((o) => o.label !== lbl);
                            if (e.target.value.trim()) newOpts.push({ label: lbl, text: e.target.value });
                            setForm((f) => ({ ...f, options: newOpts.sort((a, b) => a.label.localeCompare(b.label)) }));
                          }}
                          placeholder={`Option ${lbl}…`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Correct Answer(s)</label>
                <input className="input text-sm py-1.5 uppercase w-32" value={form.correctAnswer}
                  onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value.toUpperCase() }))}
                  placeholder="e.g. B or AE" />
                <p className="text-xs text-gray-400 mt-1">For multi-select enter all letters e.g. AE or A, E</p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Explanation</label>
                <textarea className="input text-sm py-2 h-16 resize-none" value={form.explanation}
                  onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reference URL</label>
                <input className="input text-sm py-1.5" value={form.referenceUrl}
                  onChange={(e) => setForm((f) => ({ ...f, referenceUrl: e.target.value }))}
                  placeholder="https://docs.aws.amazon.com/…" />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2">
                <button onClick={save} disabled={saving} className="btn-primary py-1.5 text-sm flex items-center gap-2">
                  <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => { setEditing(false); setError(''); }} className="text-sm text-gray-400 hover:text-gray-600 px-3">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                {opts.map((o) => (
                  <div key={o.label} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                    q.correct_answer?.includes(o.label)
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-800'
                  }`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      q.correct_answer?.includes(o.label) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-200'
                    }`}>{o.label}</span>
                    <span className="text-gray-700 dark:text-gray-300">{o.text}</span>
                  </div>
                ))}
              </div>
              {q.explanation && (
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2.5 flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50">
        {!editing && (
          <button onClick={() => { setEditing(true); setExpanded(true); }}
            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 font-medium">
            <Edit2 size={12} /> Edit
          </button>
        )}
        <button onClick={publish}
          className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 font-medium">
          <CheckCircle size={12} /> Publish
        </button>
        <button onClick={del}
          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium ml-auto">
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Improper Format question card ──────────────────────────────
function FlaggedCard({ q, examTypes, domainsByExamType, onDelete, onApprove, selected, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [approving, setApproving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState('');
  const [form, setForm] = useState({
    question: q.question,
    domain: q.domain,
    examTypeId: q.exam_type_id || '',
    correctAnswer: q.correct_answer || '',
    explanation: q.explanation || '',
    referenceUrl: q.reference_url || '',
    options: (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) || [],
  });

  const opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
  const issueData = (() => {
    try { return typeof q.import_issue === 'string' ? JSON.parse(q.import_issue) : (q.import_issue || {}); }
    catch { return {}; }
  })();
  const issues = issueData.issues || [];
  const rawLine = issueData.raw || '';

  const del = async () => {
    if (!confirm('Delete this flagged question? This cannot be undone.')) return;
    await api.delete(`/teacher/questions/${q.id}`);
    onDelete([q.id]);
  };

  const approve = async () => {
    setApproving(true);
    try {
      await api.patch(`/teacher/questions/${q.id}/approve`);
      onApprove([q.id]);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve');
    } finally { setApproving(false); }
  };

  // Save edits AND approve in one step — moves question to draft queue
  const saveAndApprove = async () => {
    if (!form.question.trim()) { setEditErr('Question text is required.'); return; }
    if (form.options.filter((o) => o.text.trim()).length < 2) { setEditErr('At least 2 options are required.'); return; }
    setSaving(true); setEditErr('');
    try {
      await api.put(`/teacher/questions/${q.id}`, {
        question: form.question,
        domain: form.domain,
        examTypeId: form.examTypeId || undefined,
        correctAnswer: form.correctAnswer,
        explanation: form.explanation,
        referenceUrl: form.referenceUrl,
        options: form.options.filter((o) => o.text.trim()),
      });
      // Clear the improper-format flag and move to drafts
      await api.patch(`/teacher/questions/${q.id}/approve`);
      onApprove([q.id]);
    } catch (err) {
      setEditErr(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className={`card overflow-hidden border-l-4 transition-all ${selected ? 'border-l-aws-orange bg-orange-50/30 dark:bg-orange-900/5' : 'border-l-red-400'}`}>
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <button onClick={() => onToggleSelect(q.id)} className="mt-0.5 shrink-0 text-gray-400 hover:text-aws-orange transition">
          {selected ? <CheckSquare size={18} className="text-aws-orange" /> : <Square size={18} />}
        </button>
        <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{q.question}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full">
              Improper Format
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {q.domain}
            </span>
            {q.correct_answer && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                Imported answer: {q.correct_answer}
              </span>
            )}
          </div>
          {issues.map((issue, i) => (
            <p key={i} className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-start gap-1.5">
              <XCircle size={11} className="mt-0.5 shrink-0" /> {issue}
            </p>
          ))}
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="text-gray-400 hover:text-gray-600 mt-1 shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          {editing ? (
            /* ── Inline edit form ── */
            <>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                Editing — fix issues then save to move to Drafts
              </p>

              {/* Question text */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Question</label>
                <textarea className="input text-sm py-2 w-full h-20 resize-none" value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />
              </div>

              {/* Domain + exam type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Domain</label>
                  <select className="input text-sm py-1.5" value={form.domain}
                    onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}>
                    {form.domain && !(domainsByExamType[form.examTypeId] || []).some((d) => d.name === form.domain) && (
                      <option value={form.domain}>{form.domain}</option>
                    )}
                    {(domainsByExamType[form.examTypeId] || []).map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                    {!form.examTypeId && <option value="" disabled>Select exam type first</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Exam Type</label>
                  <select className="input text-sm py-1.5" value={form.examTypeId}
                    onChange={(e) => setForm((f) => ({ ...f, examTypeId: e.target.value }))}>
                    <option value="">None</option>
                    {examTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Options A-F */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">Answer Options</label>
                <div className="space-y-2">
                  {['A', 'B', 'C', 'D', 'E', 'F'].map((lbl) => {
                    const opt = form.options.find((o) => o.label === lbl) || { label: lbl, text: '' };
                    return (
                      <div key={lbl} className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          form.correctAnswer.toUpperCase().includes(lbl) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>{lbl}</span>
                        <input className="input text-sm py-1.5 flex-1" value={opt.text}
                          onChange={(e) => {
                            const newOpts = form.options.filter((o) => o.label !== lbl);
                            if (e.target.value.trim()) newOpts.push({ label: lbl, text: e.target.value });
                            setForm((f) => ({ ...f, options: newOpts.sort((a, b) => a.label.localeCompare(b.label)) }));
                          }}
                          placeholder={`Option ${lbl}…`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Correct answer */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Correct Answer(s)</label>
                <input className="input text-sm py-1.5 uppercase w-40" value={form.correctAnswer}
                  onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value.toUpperCase() }))}
                  placeholder="e.g. B or AE or A, E" />
                <p className="text-xs text-gray-400 mt-1">Multi-select: AE or A, E or A and E</p>
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Explanation (optional)</label>
                <textarea className="input text-sm py-2 h-16 resize-none" value={form.explanation}
                  onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} />
              </div>

              {editErr && <p className="text-sm text-red-500">{editErr}</p>}

              <div className="flex gap-2 flex-wrap">
                <button onClick={saveAndApprove} disabled={saving}
                  className="btn-primary py-1.5 text-sm flex items-center gap-2">
                  <Save size={14} /> {saving ? 'Saving…' : 'Save & Move to Drafts'}
                </button>
                <button onClick={() => { setEditing(false); setEditErr(''); }}
                  className="text-sm text-gray-400 hover:text-gray-600 px-3">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            /* ── Read-only view ── */
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Options (as parsed)</p>
                <div className="space-y-1.5">
                  {opts.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No options parsed</p>
                  ) : opts.map((o) => (
                    <div key={o.label} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                      /^(and|or|,|\.|with)\b/i.test(o.text) ? 'bg-red-50 dark:bg-red-900/20 text-red-700' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-200">
                        {o.label}
                      </span>
                      <span>{o.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              {rawLine && (
                <div>
                  <button onClick={() => setShowRaw((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-1">
                    <Code size={12} /> {showRaw ? 'Hide' : 'Show'} raw CSV line
                  </button>
                  {showRaw && (
                    <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                      {rawLine}
                    </pre>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2.5 flex items-center gap-3 bg-red-50 dark:bg-red-900/5">
        {!editing && (
          <button onClick={() => { setEditing(true); setExpanded(true); }}
            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 font-medium">
            <Edit2 size={12} /> Edit & Fix
          </button>
        )}
        {!editing && (
          <button onClick={approve} disabled={approving}
            className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 font-medium">
            {approving ? <RefreshCw size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
            {approving ? 'Moving…' : 'Move to Drafts'}
          </button>
        )}
        <button onClick={del}
          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium ml-auto">
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Batch toolbar ──────────────────────────────────────────────
function BatchToolbar({ selectedCount, totalVisible, onSelectAll, onDeselectAll, onBatchPublish, onBatchDelete, onBatchApprove, mode }) {
  if (selectedCount === 0) return null;
  const allSelected = selectedCount === totalVisible;
  return (
    <div className="sticky top-0 z-20 bg-aws-navy text-white rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-lg mb-4 text-sm">
      <span className="font-semibold">{selectedCount} selected</span>
      <button onClick={allSelected ? onDeselectAll : onSelectAll}
        className="text-xs text-gray-300 hover:text-white underline">
        {allSelected ? 'Deselect all' : `Select all ${totalVisible}`}
      </button>
      <div className="ml-auto flex flex-wrap gap-2">
        {mode === 'drafts' && (
          <>
            <button onClick={onBatchPublish}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
              <CheckCircle size={13} /> Publish {selectedCount}
            </button>
            <button onClick={onBatchDelete}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
              <Trash2 size={13} /> Delete {selectedCount}
            </button>
          </>
        )}
        {mode === 'flagged' && (
          <>
            <button onClick={onBatchApprove}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
              <ThumbsUp size={13} /> Move {selectedCount} to Drafts
            </button>
            <button onClick={onBatchDelete}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
              <Trash2 size={13} /> Delete {selectedCount}
            </button>
          </>
        )}
        <button onClick={onDeselectAll}
          className="text-xs text-gray-400 hover:text-white px-2">
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function QuestionReview() {
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState('drafts');

  // Drafts state
  const [drafts, setDrafts] = useState([]);
  const [draftTotal, setDraftTotal] = useState(0);
  const [draftOffset, setDraftOffset] = useState(0);   // how many we've fetched so far
  const [draftLoadingMore, setDraftLoadingMore] = useState(false);

  // Flagged state
  const [flagged, setFlagged] = useState([]);
  const [flaggedTotal, setFlaggedTotal] = useState(0);
  const [flaggedOffset, setFlaggedOffset] = useState(0);
  const [flaggedLoadingMore, setFlaggedLoadingMore] = useState(false);

  // Selection
  const [draftSelected, setDraftSelected] = useState(new Set());
  const [flaggedSelected, setFlaggedSelected] = useState(new Set());

  // Other
  const [examTypes, setExamTypes] = useState([]);
  const [domainsByExamType, setDomainsByExamType] = useState({});
  const [loading, setLoading] = useState(true);
  const [showSample, setShowSample] = useState(false);

  // ── Initial load ───────────────────────────────────────────
  const initialLoad = useCallback(async () => {
    setLoading(true);
    try {
      const [draftRes, flagRes, etRes] = await Promise.all([
        api.get(`/teacher/questions?drafts=true&bank=mine&limit=${PAGE_SIZE}&offset=0`),
        api.get('/teacher/questions/flagged'),
        api.get('/exam-types'),
      ]);

      const draftQs = draftRes.data.questions || [];
      setDrafts(draftQs);
      setDraftTotal(draftRes.data.total || draftQs.length);
      setDraftOffset(draftQs.length);

      const flagQs = flagRes.data.questions || [];
      setFlagged(flagQs);
      setFlaggedTotal(flagRes.data.total || flagQs.length);
      setFlaggedOffset(flagQs.length);

      const types = etRes.data || [];
      setExamTypes(types);
      const domainResults = await Promise.all(
        types.map((t) => api.get(`/teacher/exam-types/${t.id}/domains`).then((r) => [t.id, r.data]).catch(() => [t.id, []]))
      );
      setDomainsByExamType(Object.fromEntries(domainResults));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { initialLoad(); }, []);

  // ── Dynamic load more drafts ───────────────────────────────
  const loadMoreDrafts = useCallback(async () => {
    if (draftLoadingMore) return;
    setDraftLoadingMore(true);
    try {
      const res = await api.get(`/teacher/questions?drafts=true&bank=mine&limit=${PAGE_SIZE}&offset=${draftOffset}`);
      const more = res.data.questions || [];
      if (more.length > 0) {
        setDrafts((prev) => {
          // Deduplicate by id
          const existingIds = new Set(prev.map((q) => q.id));
          return [...prev, ...more.filter((q) => !existingIds.has(q.id))];
        });
        setDraftOffset((prev) => prev + more.length);
        setDraftTotal(res.data.total || 0);
      }
    } finally {
      setDraftLoadingMore(false);
    }
  }, [draftOffset, draftLoadingMore]);

  // Auto-refill drafts when visible count drops low
  useEffect(() => {
    if (!loading && activeTab === 'drafts' && drafts.length < REFILL_AT && draftOffset < draftTotal) {
      loadMoreDrafts();
    }
  }, [drafts.length, loading, activeTab]);

  // ── Draft handlers ─────────────────────────────────────────
  const handleDraftUpdate = (id, updated) => {
    setDrafts((prev) => prev.map((q) => q.id === id ? { ...q, ...updated } : q));
  };

  const removeDrafts = useCallback((ids) => {
    setDrafts((prev) => prev.filter((q) => !ids.includes(q.id)));
    setDraftTotal((t) => Math.max(0, t - ids.length));
    setDraftSelected((prev) => { const s = new Set(prev); ids.forEach((id) => s.delete(id)); return s; });
  }, []);

  const handleDraftPublish = useCallback(async (ids) => {
    removeDrafts(ids);
  }, [removeDrafts]);

  const handleDraftDelete = useCallback(async (ids) => {
    removeDrafts(ids);
  }, [removeDrafts]);

  // ── Batch draft actions ────────────────────────────────────
  const batchPublishDrafts = async () => {
    const ids = [...draftSelected];
    if (!confirm(`Publish ${ids.length} question${ids.length !== 1 ? 's' : ''}?`)) return;
    await api.post('/teacher/questions/publish/bulk', { ids });
    removeDrafts(ids);
  };

  const batchDeleteDrafts = async () => {
    const ids = [...draftSelected];
    if (!confirm(`Delete ${ids.length} question${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    await api.delete('/teacher/questions/bulk', { data: { ids } });
    removeDrafts(ids);
  };

  const publishAllDrafts = async () => {
    if (!confirm(`Publish all ${drafts.length} visible drafts?`)) return;
    const ids = drafts.map((q) => q.id);
    await api.post('/teacher/questions/publish/bulk', { ids });
    removeDrafts(ids);
  };

  // ── Flagged handlers ───────────────────────────────────────
  const removeFlagged = useCallback((ids) => {
    setFlagged((prev) => prev.filter((q) => !ids.includes(q.id)));
    setFlaggedTotal((t) => Math.max(0, t - ids.length));
    setFlaggedSelected((prev) => { const s = new Set(prev); ids.forEach((id) => s.delete(id)); return s; });
  }, []);

  const handleFlaggedDelete = useCallback((ids) => removeFlagged(ids), [removeFlagged]);

  const handleFlaggedApprove = useCallback((ids) => {
    const approved = flagged.filter((q) => ids.includes(q.id))
      .map((q) => ({ ...q, import_status: 'ok', import_issue: null }));
    removeFlagged(ids);
    setDrafts((prev) => [...approved, ...prev]);
    setDraftTotal((t) => t + approved.length);
  }, [flagged, removeFlagged]);

  // ── Batch flagged actions ──────────────────────────────────
  const batchApproveFlagged = async () => {
    const ids = [...flaggedSelected];
    if (!confirm(`Move ${ids.length} question${ids.length !== 1 ? 's' : ''} to drafts?`)) return;
    await Promise.all(ids.map((id) => api.patch(`/teacher/questions/${id}/approve`)));
    handleFlaggedApprove(ids);
  };

  const batchDeleteFlagged = async () => {
    const ids = [...flaggedSelected];
    if (!confirm(`Delete ${ids.length} question${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    await api.delete('/teacher/questions/flagged/bulk', { data: { ids } });
    removeFlagged(ids);
  };

  const deleteAllFlagged = async () => {
    if (!confirm(`Delete all ${flagged.length} improper-format questions?`)) return;
    await api.delete('/teacher/questions/flagged/bulk', { data: { ids: flagged.map((q) => q.id) } });
    setFlagged([]);
    setFlaggedTotal(0);
    setFlaggedSelected(new Set());
  };

  // ── Selection helpers ──────────────────────────────────────
  const toggleDraftSelect = (id) => setDraftSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleFlaggedSelect = (id) => setFlaggedSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectAllDrafts = () => setDraftSelected(new Set(drafts.map((q) => q.id)));
  const deselectAllDrafts = () => setDraftSelected(new Set());
  const selectAllFlagged = () => setFlaggedSelected(new Set(flagged.map((q) => q.id)));
  const deselectAllFlagged = () => setFlaggedSelected(new Set());

  const draftSelectedCount = draftSelected.size;
  const flaggedSelectedCount = flaggedSelected.size;

  // Server-side remaining (not yet fetched)
  const draftRemaining = Math.max(0, draftTotal - drafts.length);
  const flaggedRemaining = Math.max(0, flaggedTotal - flagged.length);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-aws-navy shadow-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => nav('/teacher')}
            className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm transition">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <span className="text-white font-semibold ml-2">Review Questions</span>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('drafts')}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition flex items-center gap-2 ${
              activeTab === 'drafts'
                ? 'bg-white dark:bg-gray-900 border border-b-white dark:border-gray-700 dark:border-b-gray-900 text-aws-orange border-b-0 -mb-px'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Draft Questions
            {draftTotal > 0 && (
              <span className="bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {draftTotal}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('flagged')}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition flex items-center gap-2 ${
              activeTab === 'flagged'
                ? 'bg-white dark:bg-gray-900 border border-b-white dark:border-gray-700 dark:border-b-gray-900 text-red-500 border-b-0 -mb-px'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Improper Format
            {flaggedTotal > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {flaggedTotal}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 flex flex-col items-center gap-3">
            <Loader size={28} className="animate-spin" />
            Loading questions…
          </div>
        ) : activeTab === 'drafts' ? (
          /* ── DRAFTS TAB ── */
          <>
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Draft Questions
                  <span className="text-gray-400 text-base font-normal">({draftTotal} total)</span>
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Showing {drafts.length} of {draftTotal}.
                  {draftRemaining > 0 && ` ${draftRemaining} more will load automatically as you review.`}
                </p>
              </div>
              <div className="ml-auto flex gap-2 flex-wrap">
                <button onClick={() => setShowSample((v) => !v)}
                  className="btn-secondary py-2 text-sm flex items-center gap-2">
                  <BookOpen size={14} /> {showSample ? 'Hide' : 'Show'} Format
                </button>
                {drafts.length > 0 && draftSelectedCount === 0 && (
                  <button onClick={publishAllDrafts}
                    className="btn-primary py-2 text-sm flex items-center gap-2">
                    <CheckCircle size={14} /> Publish All ({drafts.length})
                  </button>
                )}
              </div>
            </div>

            {/* Sample format */}
            {showSample && (
              <div className="card p-5 mb-5 border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-900/10">
                <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <BookOpen size={16} /> Expected CSV/Text Format
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 font-mono text-xs space-y-1">
                  <p className="text-gray-500">1. Which service allows serverless compute? (Choose one.)</p>
                  <p className="ml-4">A. EC2</p><p className="ml-4">B. Lambda</p>
                  <p className="ml-4">C. RDS</p><p className="ml-4">D. Beanstalk</p>
                  <p className="text-green-600">Answer: B</p>
                </div>
                <p className="text-xs text-gray-500 mt-2">Multi-select: Answer: A, E &nbsp;|&nbsp; Answer: AE &nbsp;|&nbsp; Answer: A and E</p>
              </div>
            )}

            {/* Batch toolbar */}
            <BatchToolbar
              selectedCount={draftSelectedCount}
              totalVisible={drafts.length}
              onSelectAll={selectAllDrafts}
              onDeselectAll={deselectAllDrafts}
              onBatchPublish={batchPublishDrafts}
              onBatchDelete={batchDeleteDrafts}
              mode="drafts"
            />

            {/* Select-all header row */}
            {drafts.length > 0 && draftSelectedCount === 0 && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <button onClick={selectAllDrafts}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5">
                  <Square size={14} /> Select all {drafts.length} visible
                </button>
              </div>
            )}

            {drafts.length === 0 ? (
              <div className="card p-12 text-center">
                <CheckCircle size={36} className="text-green-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-700 dark:text-gray-300">No draft questions</p>
                <p className="text-sm text-gray-400 mt-1">All questions have been published or deleted.</p>
                {flaggedTotal > 0 && (
                  <p className="text-sm text-red-500 mt-2">
                    {flaggedTotal} question{flaggedTotal !== 1 ? 's' : ''} need attention in the Improper Format tab.
                  </p>
                )}
                <button onClick={() => nav('/teacher')} className="mt-4 btn-primary py-2 text-sm">
                  Back to Dashboard
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {drafts.map((q) => (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      examTypes={examTypes}
                      domainsByExamType={domainsByExamType}
                      onUpdate={handleDraftUpdate}
                      onPublish={handleDraftPublish}
                      onDelete={handleDraftDelete}
                      selected={draftSelected.has(q.id)}
                      onToggleSelect={toggleDraftSelect}
                    />
                  ))}
                </div>

                {/* Load more / progress footer */}
                <div className="mt-5 text-center">
                  {draftLoadingMore ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                      <Loader size={16} className="animate-spin" /> Loading more questions…
                    </div>
                  ) : draftRemaining > 0 ? (
                    <button onClick={loadMoreDrafts}
                      className="btn-secondary py-2 text-sm">
                      Load more ({draftRemaining} remaining)
                    </button>
                  ) : (
                    <p className="text-xs text-gray-400">All {draftTotal} questions loaded</p>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          /* ── IMPROPER FORMAT TAB ── */
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Improper Format
                  <span className="text-gray-400 text-base font-normal">({flaggedTotal} total)</span>
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  These questions failed format validation during upload. Review and decide.
                </p>
              </div>
              {flagged.length > 0 && flaggedSelectedCount === 0 && (
                <button onClick={deleteAllFlagged}
                  className="ml-auto btn-secondary py-2 text-sm flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50">
                  <Trash2 size={14} /> Delete All ({flagged.length})
                </button>
              )}
            </div>

            {/* Info banner */}
            <div className="mb-5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-1 flex items-center gap-2">
                <AlertTriangle size={14} /> Why were these flagged?
              </p>
              <ul className="text-xs space-y-0.5 list-disc list-inside text-amber-700 dark:text-amber-400">
                <li>Answer letter not found among the question's options</li>
                <li>Option text starts with "and/or" — sign of a comma inside a field breaking CSV parsing</li>
                <li>Question says "(Choose two)" but only 1 answer letter provided</li>
                <li>Fewer than 2 valid options parsed from the CSV row</li>
              </ul>
            </div>

            {/* Batch toolbar */}
            <BatchToolbar
              selectedCount={flaggedSelectedCount}
              totalVisible={flagged.length}
              onSelectAll={selectAllFlagged}
              onDeselectAll={deselectAllFlagged}
              onBatchApprove={batchApproveFlagged}
              onBatchDelete={batchDeleteFlagged}
              mode="flagged"
            />

            {flagged.length > 0 && flaggedSelectedCount === 0 && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <button onClick={selectAllFlagged}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5">
                  <Square size={14} /> Select all {flagged.length} visible
                </button>
              </div>
            )}

            {flagged.length === 0 ? (
              <div className="card p-12 text-center">
                <CheckCircle size={36} className="text-green-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-700 dark:text-gray-300">No improper-format questions</p>
                <p className="text-sm text-gray-400 mt-1">All uploaded questions passed format validation.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {flagged.map((q) => (
                  <FlaggedCard
                    key={q.id}
                    q={q}
                    examTypes={examTypes}
                    domainsByExamType={domainsByExamType}
                    onDelete={handleFlaggedDelete}
                    onApprove={handleFlaggedApprove}
                    selected={flaggedSelected.has(q.id)}
                    onToggleSelect={toggleFlaggedSelect}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
