'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  Sparkles, 
  HelpCircle, 
  MessageSquare,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { ChatMessage, mockChatMessages } from '@/data/mockData';

interface TutorTabProps {
  initialContext?: string; // Pre-populated search query or note topic
}

export default function TutorTab({ initialContext }: TutorTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested quick prompts
  const suggestedPrompts = [
    "Explain Page Faults simply",
    "What is Belady's anomaly?",
    "Give me an example of a deadlock condition",
    "Compare mutexes vs semaphores"
  ];

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Set initial context if provided
  useEffect(() => {
    if (initialContext) {
      setInputValue(`I am studying the section on "${initialContext}". Can you explain it in more detail?`);
    }
  }, [initialContext]);

  const handleSendMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `m-usr-${Date.now()}`,
      sender: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI thinking and replying
    setTimeout(() => {
      let aiContent = "That's an interesting question about Operating Systems! Let me break it down for you. In OS design, we balance performance, complexity, and hardware safety. Would you like me to generate a summary or a quiz question on this topic?";
      
      const query = textToSend.toLowerCase();
      if (query.includes('page fault') || query.includes('paging')) {
        aiContent = "A **Page Fault** is an interrupt raised by the hardware MMU when a program tries to access a virtual page that is not currently mapped into physical RAM (its 'present bit' in the Page Table Entry is 0).\n\nWhen this occurs:\n1. The CPU traps into the kernel Page Fault Handler.\n2. The OS allocates a physical frame, reads the missing page from disk swap space into RAM.\n3. The OS updates the page table entry (sets present bit to 1).\n4. The OS restarts the instruction that caused the fault.";
      } else if (query.includes('belady') || query.includes('anomaly')) {
        aiContent = "**Belady's Anomaly** is a famous phenomenon where allocating more physical page frames results in *more* page faults for certain access patterns.\n\nIt occurs primarily in the **FIFO (First-In, First-Out)** page replacement algorithm. Because FIFO simply evicts the oldest page without checking access frequency, adding memory frames can shift the page queue state in a way that evicts highly needed pages. Stack algorithms like **LRU (Least Recently Used)** do not suffer from Belady's Anomaly.";
      } else if (query.includes('deadlock')) {
        aiContent = "A **Deadlock** is a state where a set of processes are blocked because each process holds a resource and waits for another resource held by another process.\n\nFor a deadlock to occur, **Coffman's Four Conditions** must hold simultaneously:\n1. **Mutual Exclusion**: Resources cannot be shared.\n2. **Hold and Wait**: Processes holding resources can request new ones.\n3. **No Preemption**: Resources cannot be forcibly taken.\n4. **Circular Wait**: A closed loop of processes waiting for each other.";
      } else if (query.includes('mutex') || query.includes('semaphore')) {
        aiContent = "Here is the core difference between **Mutexes** and **Semaphores**:\n\n- **Mutex (Mutual Exclusion Lock)**: Has an ownership model. Only the thread that locked the mutex can unlock it. It is binary (locked/unlocked) and used to protect critical sections.\n- **Semaphore**: A generalized counter variable. It does not have an ownership model (any thread can signal/post a semaphore). Can be binary (0 or 1) or counting (0 to N), allowing up to N threads to access a resource concurrently.";
      }

      const aiMsg: ChatMessage = {
        id: `m-ai-${Date.now()}`,
        sender: 'assistant',
        content: aiContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setIsTyping(false);
      setMessages(prev => [...prev, aiMsg]);
    }, 1500);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  return (
    <div className="flex flex-col h-[520px] rounded-2xl glass-panel border border-zinc-800/80 overflow-hidden shadow-xl">
      {/* Tutor Banner */}
      <div className="p-4 bg-zinc-950/40 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              CYRA AI Tutor
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            </span>
            <p className="text-[9px] text-zinc-500 font-mono">Model: Gemini 1.5 Flash (Synthesizer Context)</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-500">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Active Context: Memory & Paging</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-zinc-950/10 scrollbar">
        {messages.map((msg) => {
          const isAi = msg.sender === 'assistant';
          return (
            <div 
              key={msg.id}
              className={`flex items-start gap-3 max-w-[85%] ${isAi ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
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
                    ? 'bg-zinc-900/60 border border-zinc-900 text-zinc-300 rounded-tl-sm' 
                    : 'bg-indigo-600 text-white rounded-tr-sm'
                }`}>
                  {/* Parse markdown-like content blocks in responses */}
                  {msg.content.split('\n\n').map((para, pIdx) => {
                    // Check if it is a list block
                    if (para.startsWith('1. ') || para.startsWith('- ') || para.includes('\n1. ') || para.includes('\n- ')) {
                      return (
                        <div key={pIdx} className="my-1.5 space-y-1">
                          {para.split('\n').map((line, lIdx) => {
                            if (line.startsWith('1. ') || /^\d+\.\s/.test(line)) {
                              return <div key={lIdx} className="pl-3 text-[11px] text-zinc-300">{line}</div>;
                            }
                            if (line.startsWith('- ') || line.startsWith('* ')) {
                              return <div key={lIdx} className="pl-3 text-[11px] text-zinc-300">• {line.substring(2)}</div>;
                            }
                            return <div key={lIdx} className="text-zinc-300 font-bold mt-1 text-[11px]">{line}</div>;
                          })}
                        </div>
                      );
                    }
                    return (
                      <p key={pIdx} className="mb-2 last:mb-0">
                        {para.split('**').map((part, partIdx) => {
                          return partIdx % 2 === 1 ? <strong key={partIdx} className="font-bold text-white">{part}</strong> : part;
                        })}
                      </p>
                    );
                  })}
                </div>
                <div className={`text-[8px] font-mono text-zinc-500 ${!isAi ? 'text-right' : ''}`}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking / Typing indicator */}
        {isTyping && (
          <div className="flex items-start gap-3 mr-auto">
            <div className="w-7 h-7 rounded-full flex-shrink-0 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
              C
            </div>
            <div className="p-3 bg-zinc-900/60 border border-zinc-900 rounded-2xl rounded-tl-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Question Row (only show when chat isn't busy) */}
      {!isTyping && (
        <div className="px-4 py-2 border-t border-zinc-900 bg-zinc-950/20 flex gap-2 overflow-x-auto select-none scrollbar-none whitespace-nowrap">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSendMessage(prompt)}
              className="text-[10px] px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors inline-block whitespace-nowrap"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Message Input Form */}
      <form onSubmit={handleFormSubmit} className="p-3 bg-zinc-950/40 border-t border-zinc-900 flex items-center gap-2">
        <input 
          type="text" 
          placeholder="Ask CYRA AI tutor a question about this course..." 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
        />
        <button 
          type="submit"
          disabled={!inputValue.trim() || isTyping}
          className="p-2.5 rounded-xl bg-indigo-500 text-white disabled:opacity-50 disabled:pointer-events-none hover:bg-indigo-600 transition-colors shadow-md shadow-indigo-500/10"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
