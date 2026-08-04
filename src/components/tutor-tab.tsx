'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  Sparkles, 
  HelpCircle, 
  MessageSquare,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  BookOpen,
  Zap,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Brain
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface LearnerContextSummary {
  lessonTitle: string;
  primaryWeakConcept?: string | null;
  primaryWeakConceptScore?: number | null;
  primaryTargetConcept?: string | null;
  primaryTargetLevel?: string | null;
  masteryScore?: number | null;
  hasActiveAssessment?: boolean;
  weakConcepts?: Array<{ concept: string; masteryScore: number }>;
  masteredConcepts?: Array<{ concept: string; masteryScore: number }>;
  memoryCount?: number;
  memoryEnabled?: boolean;
  tutorMemories?: Array<{
    id?: string;
    concept: string;
    memoryType: string;
    content: string;
    confidence: number;
    occurrenceCount: number;
    resolvedAt?: string | null;
  }>;
}

interface TutorTabProps {
  lessonId?: string;
  initialContext?: string;
}

export default function TutorTab({ lessonId, initialContext }: TutorTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [learnerContext, setLearnerContext] = useState<LearnerContextSummary | null>(null);
  const [showIntelligence, setShowIntelligence] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested quick prompts & modes
  const suggestedPrompts = [
    { label: "Explain this simply", mode: "SIMPLIFY" },
    { label: "Give me an analogy", mode: "ANALOGY" },
    { label: "Review my weak concepts", mode: "REVIEW_WEAKNESS" },
    { label: "Quiz me on this", mode: "QUIZ_ME" },
    { label: "Socratic guidance", mode: "SOCRATIC" },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load existing conversation & context on mount
  useEffect(() => {
    async function loadInitialTutorData() {
      try {
        const query = lessonId ? `?lessonId=${encodeURIComponent(lessonId)}` : '';
        const res = await fetch(`/api/ai/tutor${query}`);
        const result = await res.json();

        if (res.ok && result.success && result.data) {
          if (result.data.conversationId) {
            setConversationId(result.data.conversationId);
          }

          if (result.data.context) {
            setLearnerContext(result.data.context);
          }

          if (Array.isArray(result.data.messages) && result.data.messages.length > 0) {
            const formatted: ChatMessage[] = result.data.messages.map((m: any) => ({
              id: m.id || `m-${Date.now()}-${Math.random()}`,
              sender: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content,
              timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            }));
            setMessages(formatted);
          } else {
            // Context-Aware Personalized Starter Welcome Message
            const targetConcept = result.data.context?.primaryTargetConcept || result.data.context?.primaryWeakConcept;
            const score = result.data.context?.primaryWeakConceptScore ?? result.data.context?.masteryScore;
            const lTitle = result.data.context?.lessonTitle || 'this course';

            let welcomeText = `Hello! I am your **CYRA AI Tutor**. I'm here to help you study **${lTitle}**.`;
            if (targetConcept) {
              welcomeText += `\n\nI noticed you currently have **${score ?? 0}% mastery** in **${targetConcept}**. Would you like me to explain this concept simply, offer an analogy, or review your weak areas?`;
            } else {
              welcomeText += `\n\nAsk me any question about the lesson, concepts, or practice problems to get started!`;
            }

            setMessages([
              {
                id: 'welcome-msg',
                sender: 'assistant',
                content: welcomeText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }
        }
      } catch (err) {
        console.error('[TUTOR TAB] Error loading initial tutor session:', err);
      }
    }

    loadInitialTutorData();
  }, [lessonId]);

  // Set initial context if provided via props
  useEffect(() => {
    if (initialContext) {
      setInputValue(`I am studying "${initialContext}". Can you explain it in more detail?`);
    }
  }, [initialContext]);

  const handleSendMessage = async (textToSend: string, modeHint?: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isTyping) return;

    setErrorMsg(null);

    // Format User Message for Quick Actions using resolved primary target concept if available
    let displayText = trimmed;
    const activeTarget = learnerContext?.primaryTargetConcept || learnerContext?.primaryWeakConcept;

    if (modeHint && activeTarget) {
      if (modeHint === 'SIMPLIFY') {
        displayText = `Explain "${activeTarget}" simply`;
      } else if (modeHint === 'ANALOGY') {
        displayText = `Give me an analogy for "${activeTarget}"`;
      } else if (modeHint === 'REVIEW_WEAKNESS') {
        displayText = `Review my weak concepts starting with "${activeTarget}"`;
      } else if (modeHint === 'QUIZ_ME') {
        displayText = `Quiz me on "${activeTarget}"`;
      } else if (modeHint === 'SOCRATIC') {
        displayText = `Provide Socratic guidance on "${activeTarget}"`;
      }
    }

    const userMsg: ChatMessage = {
      id: `m-usr-${Date.now()}`,
      sender: 'user',
      content: displayText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          conversationId,
          message: displayText,
          mode: modeHint,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to get tutor response.');
      }

      if (result.data.conversationId) {
        setConversationId(result.data.conversationId);
      }

      if (result.data.context) {
        setLearnerContext(prev => ({
          ...prev,
          ...result.data.context,
        }));
      }

      const aiMsg: ChatMessage = {
        id: `m-ai-${Date.now()}`,
        sender: 'assistant',
        content: result.data.message.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('[TUTOR TAB] Error sending message:', err);
      setErrorMsg(err.message || 'Tutor connection failed. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  const activeWeakConcept = learnerContext?.primaryTargetConcept || learnerContext?.primaryWeakConcept;
  const activeWeakScore = learnerContext?.primaryWeakConceptScore ?? learnerContext?.masteryScore;

  return (
    <div className="flex flex-col h-[620px] rounded-2xl glass-panel border border-zinc-800/80 overflow-hidden shadow-xl relative">
      {/* 1. TUTOR HEADER BANNER */}
      <div className="p-4 bg-zinc-950/60 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              CYRA AI Tutor
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            </span>
            <p className="text-[10px] text-zinc-400 font-mono">
              {learnerContext?.lessonTitle ? `Active Lesson: ${learnerContext.lessonTitle}` : 'General Educational Assistant'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIntelligence(prev => !prev)}
            className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-md border border-cyan-500/30 flex items-center gap-1 hover:bg-cyan-900/40 transition-colors"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>CYRA KNOWS</span>
            {showIntelligence ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 2. COLLAPSIBLE LEARNER INTELLIGENCE PANEL */}
      {showIntelligence && learnerContext && (
        <div className="bg-zinc-950/90 border-b border-zinc-800/80 p-3.5 space-y-2.5 text-xs animate-fade-in">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 uppercase border-b border-zinc-900 pb-1">
            <span>Adaptive Learner Profile</span>
            {learnerContext.hasActiveAssessment && (
              <span className="text-amber-400 flex items-center gap-1 font-bold">
                <AlertCircle className="w-3 h-3" /> Active Assessment Mode
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-zinc-900/50 border border-zinc-850 space-y-0.5">
              <span className="text-[9px] font-mono text-amber-400 uppercase font-bold block">Needs Review:</span>
              <p className="text-zinc-200 font-medium truncate">
                {activeWeakConcept 
                  ? `${activeWeakConcept} (${activeWeakScore ?? 0}%)` 
                  : 'No critical weak concepts'}
              </p>
            </div>

            <div className="p-2 rounded bg-zinc-900/50 border border-zinc-850 space-y-0.5">
              <span className="text-[9px] font-mono text-emerald-400 uppercase font-bold block">Strong Concepts:</span>
              <p className="text-zinc-200 font-medium truncate">
                {learnerContext.masteredConcepts && learnerContext.masteredConcepts.length > 0
                  ? `${learnerContext.masteredConcepts[0].concept} (${learnerContext.masteredConcepts[0].masteryScore}%)`
                  : 'Building mastery baseline...'}
              </p>
            </div>
          </div>

          {/* LEARNING MEMORY SUMMARY AREA */}
          {learnerContext.tutorMemories && learnerContext.tutorMemories.length > 0 && (
            <div className="pt-1 border-t border-zinc-900 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-cyan-400 font-bold uppercase flex items-center gap-1">
                  <Brain className="w-3 h-3 text-cyan-400" />
                  Learning Memory ({learnerContext.tutorMemories.length}):
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {learnerContext.tutorMemories.slice(0, 3).map((mem, idx) => (
                  <span
                    key={mem.id || idx}
                    className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1"
                    title={mem.content}
                  >
                    <span className="text-indigo-400 font-semibold uppercase">{mem.memoryType.replace('_', ' ')}:</span>
                    <span className="text-zinc-200">{mem.concept}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="p-3 bg-red-950/60 border-b border-red-900/50 text-red-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-[10px] text-red-400 hover:text-white underline">
            Dismiss
          </button>
        </div>
      )}

      {/* 3. MESSAGES SCROLL AREA */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-zinc-950/20 scrollbar">
        {messages.map((msg) => {
          const isAi = msg.sender === 'assistant';
          return (
            <div 
              key={msg.id}
              className={`flex items-start gap-3 max-w-[88%] ${isAi ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs border ${
                isAi 
                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                  : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
              }`}>
                {isAi ? 'C' : 'U'}
              </div>

              {/* Message Bubble */}
              <div className="space-y-1">
                <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  isAi 
                    ? 'bg-zinc-900/70 border border-zinc-800 text-zinc-200 rounded-tl-sm shadow-md' 
                    : 'bg-indigo-600 text-white rounded-tr-sm shadow-md'
                }`}>
                  {/* Parse markdown-like paragraphs & bold syntax */}
                  {msg.content.split('\n\n').map((para, pIdx) => (
                    <p key={pIdx} className="mb-2 last:mb-0">
                      {para.split('**').map((part, partIdx) => 
                        partIdx % 2 === 1 ? <strong key={partIdx} className="font-bold text-white">{part}</strong> : part
                      )}
                    </p>
                  ))}
                </div>
                {msg.timestamp && (
                  <div className={`text-[8px] font-mono text-zinc-500 ${!isAi ? 'text-right' : ''}`}>
                    {msg.timestamp}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking / Typing indicator */}
        {isTyping && (
          <div className="flex items-start gap-3 mr-auto">
            <div className="w-7 h-7 rounded-full flex-shrink-0 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
              C
            </div>
            <div className="p-3 bg-zinc-900/60 border border-zinc-900 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. SUGGESTED TEACHING MODES & QUICK ACTION PILLS */}
      {!isTyping && (
        <div className="px-4 py-2 border-t border-zinc-900 bg-zinc-950/40 flex gap-2 overflow-x-auto select-none scrollbar-none whitespace-nowrap">
          {suggestedPrompts.map((p) => (
            <button
              key={p.label}
              onClick={() => handleSendMessage(p.label, p.mode)}
              className="text-[10px] px-3 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors inline-flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-cyan-400" />
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* 5. MESSAGE INPUT FORM */}
      <form onSubmit={handleFormSubmit} className="p-3 bg-zinc-950/60 border-t border-zinc-900 flex items-center gap-2">
        <textarea 
          rows={1}
          placeholder="Ask CYRA AI tutor a question about this course..." 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60 resize-none"
        />
        <button 
          type="submit"
          disabled={!inputValue.trim() || isTyping}
          className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-md flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
