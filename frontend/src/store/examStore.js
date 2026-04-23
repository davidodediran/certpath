import { create } from 'zustand';

export const useExamStore = create((set, get) => ({
  // Session
  sessionId: null,
  mode: null,
  examType: null,
  questions: [],
  startedAt: null,

  // Navigation
  currentIndex: 0,
  answers: {},       // { questionId: 'B' }
  flagged: new Set(),

  // Status
  submitted: false,
  result: null,
  strikes: 0,
  cancelled: false,
  cancelMessage: '',

  // Actions
  initSession: (sessionId, mode, examType, questions) => set({
    sessionId,
    mode,
    examType,
    questions,
    startedAt: Date.now(),
    currentIndex: 0,
    answers: {},
    flagged: new Set(),
    submitted: false,
    result: null,
    strikes: 0,
    cancelled: false,
    cancelMessage: '',
  }),

  setAnswer: (questionId, answer) => set((s) => ({
    answers: { ...s.answers, [questionId]: answer },
  })),

  toggleFlag: (questionId) => set((s) => {
    const f = new Set(s.flagged);
    f.has(questionId) ? f.delete(questionId) : f.add(questionId);
    return { flagged: f };
  }),

  goTo: (index) => set({ currentIndex: index }),
  next: () => set((s) => ({ currentIndex: Math.min(s.currentIndex + 1, s.questions.length - 1) })),
  prev: () => set((s) => ({ currentIndex: Math.max(s.currentIndex - 1, 0) })),

  recordStrike: (strikes, message) => set({ strikes }),

  cancelExam: (message) => set({ cancelled: true, cancelMessage: message }),

  setResult: (result) => set({ result, submitted: true }),

  reset: () => set({
    sessionId: null, mode: null, examType: null, questions: [],
    currentIndex: 0, answers: {}, flagged: new Set(),
    submitted: false, result: null, strikes: 0,
    cancelled: false, cancelMessage: '',
  }),
}));
