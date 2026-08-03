'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import PracticePlayer, { PracticeQuestionItem } from '@/components/practice-player';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function PracticeSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;
  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [concept, setConcept] = useState<string>('');
  const [masteryBefore, setMasteryBefore] = useState<number>(0);
  const [questions, setQuestions] = useState<PracticeQuestionItem[]>([]);

  useEffect(() => {
    async function loadPracticeSession() {
      try {
        // Fetch safe practice session & questions from authenticated server API endpoint
        const res = await fetch(`/api/adaptive/practice/session?sessionId=${encodeURIComponent(sessionId)}`);
        const result = await res.json();

        if (!res.ok || !result.success || !result.data) {
          setError(result.error || 'Failed to load practice session.');
          setLoading(false);
          return;
        }

        setConcept(result.data.concept);
        setMasteryBefore(result.data.masteryBefore);
        setQuestions(result.data.questions || []);
      } catch (err: any) {
        console.error('[PRACTICE PAGE] Error loading session:', err);
        setError('An unexpected error occurred while loading the practice session.');
      } finally {
        setLoading(false);
      }
    }

    if (sessionId) {
      loadPracticeSession();
    }
  }, [sessionId]);

  const handleExit = () => {
    router.push('/progress');
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-xs text-zinc-400 font-mono">Loading targeted practice session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto p-8 glass-panel border border-zinc-800 rounded-2xl text-center space-y-4 my-12">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <h3 className="text-sm font-bold text-white">Practice Session Error</h3>
        <p className="text-xs text-zinc-400">{error}</p>
        <button
          onClick={handleExit}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return to Progress
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto w-full">
      <PracticePlayer
        sessionId={sessionId}
        concept={concept}
        masteryBefore={masteryBefore}
        questions={questions}
        onExit={handleExit}
      />
    </div>
  );
}
