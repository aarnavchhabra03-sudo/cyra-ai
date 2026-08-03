import { SafeQuizQuestion, QuizQuestionRecord } from '@/types/quiz';

export interface SubmittedAnswerItem {
  questionId: string;
  selectedAnswer: any;
}

export interface GradedQuestionResult {
  questionId: string;
  questionOrder: number;
  questionType: string;
  questionText: string;
  options: any[];
  selectedAnswer: any;
  correctAnswer: any;
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
  explanation: string;
  concept?: string | null;
}

export interface QuizGradingSummary {
  totalQuestions: number;
  correctAnswers: number;
  earnedPoints: number;
  totalPossiblePoints: number;
  percentage: number;
  passed: boolean;
  xpAwarded: number;
  results: GradedQuestionResult[];
}

/**
 * Normalizes answer string for case and whitespace insensitive comparison
 */
function normalizeString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Server-side deterministic grading function.
 * Evaluates objective question types (multiple_choice, true_false, multiple_select, fill_blank, short_answer).
 */
export function gradeQuizSubmission(
  dbQuestions: QuizQuestionRecord[],
  submittedAnswers: SubmittedAnswerItem[],
  passingScorePercent: number = 70,
  hasPassedPreviously: boolean = false
): QuizGradingSummary {
  const answerMap = new Map<string, any>();
  for (const item of submittedAnswers) {
    if (item && item.questionId) {
      answerMap.set(item.questionId, item.selectedAnswer);
    }
  }

  let totalPossiblePoints = 0;
  let earnedPoints = 0;
  let correctAnswersCount = 0;

  const results: GradedQuestionResult[] = dbQuestions.map((q) => {
    const maxPoints = q.points || 1;
    totalPossiblePoints += maxPoints;

    const selectedRaw: any = answerMap.get(q.id);
    const correctRaw: any = q.correct_answer;

    let isCorrect = false;

    switch (q.question_type) {
      case 'multiple_choice': {
        // Handle { option_id: 'A' } or string 'A'
        const selectedId = typeof selectedRaw === 'object' && selectedRaw?.option_id
          ? selectedRaw.option_id
          : selectedRaw;
        const correctId = typeof correctRaw === 'object' && correctRaw?.option_id
          ? correctRaw.option_id
          : correctRaw;

        isCorrect = normalizeString(selectedId) === normalizeString(correctId) && normalizeString(selectedId) !== '';
        break;
      }

      case 'true_false': {
        // Handle { option_id: 'true' }, boolean true, or string 'true'
        const selectedVal = typeof selectedRaw === 'object' && selectedRaw?.option_id
          ? selectedRaw.option_id
          : selectedRaw;
        const correctVal = typeof correctRaw === 'object' && correctRaw?.option_id
          ? correctRaw.option_id
          : correctRaw;

        isCorrect = normalizeString(selectedVal) === normalizeString(correctVal) && normalizeString(selectedVal) !== '';
        break;
      }

      case 'multiple_select': {
        // Handle { option_ids: ['A', 'B'] } or array ['A', 'B']
        const selectedArr: string[] = Array.isArray(selectedRaw?.option_ids)
          ? selectedRaw.option_ids
          : Array.isArray(selectedRaw)
          ? selectedRaw
          : [];
        const correctArr: string[] = Array.isArray(correctRaw?.option_ids)
          ? correctRaw.option_ids
          : Array.isArray(correctRaw)
          ? correctRaw
          : [];

        const selectedSet = new Set(selectedArr.map(normalizeString));
        const correctSet = new Set(correctArr.map(normalizeString));

        if (selectedSet.size === correctSet.size && selectedSet.size > 0) {
          isCorrect = Array.from(selectedSet).every((val) => correctSet.has(val));
        }
        break;
      }

      case 'fill_blank':
      case 'short_answer': {
        // Handle { answer_text: 'cell wall' } or string 'cell wall'
        const selectedText = typeof selectedRaw === 'object' && selectedRaw?.answer_text !== undefined
          ? selectedRaw.answer_text
          : selectedRaw;
        const correctText = typeof correctRaw === 'object' && correctRaw?.answer_text !== undefined
          ? correctRaw.answer_text
          : typeof correctRaw === 'object' && correctRaw?.text !== undefined
          ? correctRaw.text
          : correctRaw;

        isCorrect = normalizeString(selectedText) === normalizeString(correctText) && normalizeString(selectedText) !== '';
        break;
      }

      default: {
        // Fallback exact equality check
        isCorrect = JSON.stringify(selectedRaw) === JSON.stringify(correctRaw);
        break;
      }
    }

    const pointsEarned = isCorrect ? maxPoints : 0;
    if (isCorrect) {
      correctAnswersCount++;
      earnedPoints += maxPoints;
    }

    return {
      questionId: q.id,
      questionOrder: q.question_order,
      questionType: q.question_type,
      questionText: q.question_text,
      options: Array.isArray(q.options) ? q.options : [],
      selectedAnswer: selectedRaw || null,
      correctAnswer: q.correct_answer,
      isCorrect,
      pointsEarned,
      maxPoints,
      explanation: q.explanation,
      concept: q.concept || null,
    };
  });

  const percentage = totalPossiblePoints > 0 
    ? Math.round((earnedPoints / totalPossiblePoints) * 100) 
    : 0;

  const passed = percentage >= passingScorePercent;

  // XP System Calculation Rules:
  // Completed quiz: +10 XP
  // Passed quiz:     +10 XP
  // Perfect score:   +10 XP
  // (Failed = 10 XP, Passed = 20 XP, 100% = 30 XP)
  let xpAwarded = 10; // Completion base reward
  if (passed) xpAwarded += 10;
  if (percentage === 100) xpAwarded += 10;

  // Idempotency rule: if user has already passed this quiz before, do not award repeat pass XP
  if (hasPassedPreviously) {
    xpAwarded = 0;
  }

  return {
    totalQuestions: dbQuestions.length,
    correctAnswers: correctAnswersCount,
    earnedPoints,
    totalPossiblePoints,
    percentage,
    passed,
    xpAwarded,
    results,
  };
}
