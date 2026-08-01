export interface UserStats {
  name: string;
  avatarUrl?: string;
  level: number;
  levelTitle: string;
  xp: number;
  xpNextLevel: number;
  streakDays: number;
  streakActive: boolean;
  studyHoursThisWeek: number;
}

export interface DailyTask {
  id: string;
  title: string;
  xpReward: number;
  completed: boolean;
  category: 'quiz' | 'reading' | 'tutor' | 'research';
}

export interface VideoResource {
  id: string;
  title: string;
  duration: string;
  youtubeId: string;
  author: string;
}

export interface TextResource {
  id: string;
  title: string;
  url: string;
  source: string;
  type: 'article' | 'book' | 'documentation';
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  durationMinutes: number;
  questions: QuizQuestion[];
  score?: number;
}

export interface RoadmapNode {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'locked';
  estimatedMinutes: number;
  topics: string[];
}

export interface Module {
  id: string;
  title: string;
  description: string;
  progress: number; // 0 to 100
  status: 'completed' | 'in_progress' | 'locked';
  nodes: RoadmapNode[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  progress: number; // 0 to 100
  activeModuleId: string;
  activeModuleName: string;
  xpReward: number;
  modules: Module[];
  notes: {
    [nodeId: string]: {
      title: string;
      content: string;
    };
  };
  resources: {
    videos: VideoResource[];
    texts: TextResource[];
  };
  quizzes: Quiz[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ----------------------------------------------------
// Mock Data Implementation
// ----------------------------------------------------

export const mockUserStats: UserStats = {
  name: "Aarna",
  level: 4,
  levelTitle: "Kernel Architect",
  xp: 850,
  xpNextLevel: 1200,
  streakDays: 5,
  streakActive: true,
  studyHoursThisWeek: 12.4
};

export const mockDailyTasks: DailyTask[] = [
  {
    id: "task-1",
    title: "Complete the CPU Scheduling Quiz",
    xpReward: 50,
    completed: true,
    category: "quiz"
  },
  {
    id: "task-2",
    title: "Read notes on Demand Paging and Page Faults",
    xpReward: 30,
    completed: false,
    category: "reading"
  },
  {
    id: "task-3",
    title: "Ask the CYRA AI Tutor about Kernel Semaphores",
    xpReward: 20,
    completed: false,
    category: "tutor"
  },
  {
    id: "task-4",
    title: "Research paper on Mach microkernel architecture",
    xpReward: 40,
    completed: false,
    category: "research"
  }
];

export const mockCourses: Omit<Course, 'modules' | 'notes' | 'resources' | 'quizzes'>[] = [
  {
    id: "operating-systems",
    title: "Operating Systems",
    description: "Master process management, virtual memory mechanisms, caching architectures, and concurrency primitives.",
    progress: 42,
    activeModuleId: "mod-2",
    activeModuleName: "Memory Management & Virtual Memory",
    xpReward: 500
  },
  {
    id: "machine-learning",
    title: "Understand Machine Learning",
    description: "Deep dive into linear algebra, supervised models, neural network architectures, and optimizers.",
    progress: 15,
    activeModuleId: "ml-mod-1",
    activeModuleName: "Mathematical Foundations & Regression",
    xpReward: 650
  },
  {
    id: "web-development",
    title: "Master Next.js & React Core",
    description: "React Server Components, server-side rendering, layout patterns, and hydration concepts.",
    progress: 80,
    activeModuleId: "web-mod-3",
    activeModuleName: "Performance Optimization & Hydration",
    xpReward: 400
  }
];

export const mockOSCourseDetail: Course = {
  id: "operating-systems",
  title: "Operating Systems",
  description: "Master process management, virtual memory mechanisms, caching architectures, and concurrency primitives.",
  progress: 42,
  activeModuleId: "mod-2",
  activeModuleName: "Memory Management & Virtual Memory",
  xpReward: 500,
  modules: [
    {
      id: "mod-1",
      title: "Module 1: Processes and Concurrency",
      description: "Understand process states, CPU scheduling, thread synchronization, and deadlocks.",
      progress: 100,
      status: "completed",
      nodes: [
        {
          id: "node-1-1",
          title: "Processes and Threads",
          description: "Introduction to processes, PCBs, thread contexts, and state transitions.",
          status: "completed",
          estimatedMinutes: 45,
          topics: ["Process Control Block (PCB)", "Context Switching", "User vs Kernel Threads"]
        },
        {
          id: "node-1-2",
          title: "CPU Scheduling Algorithms",
          description: "Analyzing FIFO, SJF, Round Robin, and Multi-Level Feedback Queues.",
          status: "completed",
          estimatedMinutes: 60,
          topics: ["Throughput", "Turnaround Time", "Response Time", "MLFQ Scheduling"]
        },
        {
          id: "node-1-3",
          title: "Synchronization and Mutexes",
          description: "Critical section problems, semaphores, mutex variables, and lock safety.",
          status: "completed",
          estimatedMinutes: 90,
          topics: ["Race Conditions", "Peterson's Solution", "Semaphores", "Dining Philosophers"]
        }
      ]
    },
    {
      id: "mod-2",
      title: "Module 2: Memory Management & Virtual Memory",
      description: "Dive deep into hardware address translation, paging, and replacement policies.",
      progress: 25,
      status: "in_progress",
      nodes: [
        {
          id: "node-2-1",
          title: "Address Spaces & Paging",
          description: "Physical vs virtual addressing, page tables, and hardware MMU translation.",
          status: "completed",
          estimatedMinutes: 50,
          topics: ["MMU Translation", "Base & Bounds", "Multi-Level Paging", "Page Table Entries"]
        },
        {
          id: "node-2-2",
          title: "Translation Lookaside Buffer (TLB)",
          description: "Improving translation speeds through caching, TLB hits, misses, and flushes.",
          status: "in_progress",
          estimatedMinutes: 45,
          topics: ["TLB Hits & Misses", "Fully Associative Caches", "Global Page Table Pages"]
        },
        {
          id: "node-2-3",
          title: "Page Replacement Policies",
          description: "Handling page faults and choosing which page to evict (FIFO, LRU, Clock, Optimal).",
          status: "locked",
          estimatedMinutes: 60,
          topics: ["Belady's Anomaly", "LRU Cache Replacement", "Clock Algorithm", "Page Fault Handler"]
        }
      ]
    },
    {
      id: "mod-3",
      title: "Module 3: Storage & File Systems",
      description: "Explore disk interfaces, RAID levels, file descriptors, and consistency constraints.",
      progress: 0,
      status: "locked",
      nodes: [
        {
          id: "node-3-1",
          title: "I/O Devices & Drivers",
          description: "Bus architectures, polling, interrupts, and Direct Memory Access (DMA).",
          status: "locked",
          estimatedMinutes: 40,
          topics: ["DMA Controller", "Interrupt Handling", "Device Registers", "OS Device Abstraction"]
        },
        {
          id: "node-3-2",
          title: "File System Implementation",
          description: "Inodes, directory entries, blocks, caching layers, and system calls.",
          status: "locked",
          estimatedMinutes: 80,
          topics: ["Inodes", "Hard vs Soft Links", "VFS (Virtual File System)", "Buffer Cache"]
        }
      ]
    }
  ],
  notes: {
    "node-2-1": {
      title: "Address Spaces & Paging Notes",
      content: `### 1. Introduction to Address Translation

The fundamental problem of memory virtualization is: how do we run multiple programs concurrently without them stepping on each other's memory? 

The OS achieves this by providing each process with a illusion of a large, private, contiguous address space. The CPU and Memory Management Unit (MMU) cooperate to translate virtual addresses (generated by the running program) into physical addresses (the actual location in RAM).

### 2. Paging and Page Tables

Rather than partitioning memory into variable-sized segments (which leads to **external fragmentation**), modern operating systems partition memory into fixed-sized blocks:
- **Virtual Page**: A block of the virtual address space (typically 4KB).
- **Physical Page Frame**: A corresponding block of physical memory.

To translate virtual pages to physical frames, the operating system maintains a **Page Table** for each process.

#### Page Table Entry (PTE) Structure
A typical page table entry contains:
- **PFN (Physical Frame Number)**: The destination physical address block.
- **Valid Bit**: Indicates whether the page is allocated in the virtual address space.
- **Present Bit**: Indicates whether the page is currently in physical RAM or swapped to disk.
- **Dirty Bit**: Set if the page has been modified since loading.
- **Access Bits (R/W/X)**: Define permissions (Read, Write, Execute).

### 3. Multi-Level Page Tables

A linear page table for a 32-bit system with 4KB pages requires $2^{20}$ entries. If each entry is 4 bytes, that's **4MB of memory per process** just for the page table. On 64-bit systems, this becomes astronomically larger.

To solve this, we use **Multi-Level Page Tables**, which turn the page table into a tree structure. By adding a Page Directory, we only allocate page tables for active regions of the address space, drastically reducing memory overhead.`
    },
    "node-2-2": {
      title: "Translation Lookaside Buffer (TLB) Notes",
      content: `### 1. The Cost of Address Translation

Paging requires looking up translations in memory. This means for every memory access (e.g., loading an instruction, reading a variable), the CPU must perform:
1. A read from the **Page Table** (which resides in physical RAM).
2. A read from the **Actual Target Address**.

This doubles the cost of every memory access, causing a **50% performance degradation**!

### 2. What is the TLB?

To solve this issue, computer architects introduced the **Translation Lookaside Buffer (TLB)**. The TLB is a small, hardware cache inside the CPU's Memory Management Unit (MMU). It stores recent virtual-to-physical address translations.

Because it is built into the CPU core using SRAM, TLB lookups are extremely fast—usually taking less than a single clock cycle.

### 3. TLB Hit vs. TLB Miss

When the CPU requests a virtual address:
- **TLB Hit**: The translation is present in the TLB cache. The MMU instantly translates the address and fetches the data. Time penalty: **~0ns**.
- **TLB Miss**: The translation is not in the TLB. The MMU (or the OS) must perform a **page table walk** to load the translation from RAM into the TLB, and then restart the instruction. Time penalty: **~10-50ns**.

### 4. Handling Context Switches

When the OS context switches from Process A to Process B, the cached translations in the TLB become invalid (as Process B has its own page table). The OS must address this using one of two strategies:
- **TLB Flush**: Clear all TLB entries on context switch. (High overhead, as the next process starts with a cold cache).
- **Address Space Identifier (ASID)**: Append an identifier (like a PID) to TLB entries, allowing translations for multiple processes to coexist.`
    }
  },
  resources: {
    videos: [
      {
        id: "v-1",
        title: "Operating Systems Lecture 8: Address Translation & Paging",
        duration: "45:12",
        youtubeId: "Y8Ea6K64t88", // Mock ID
        author: "Prof. John Doe, Tech University"
      },
      {
        id: "v-2",
        title: "Translation Lookaside Buffer (TLB) Explained",
        duration: "18:45",
        youtubeId: "WnC2E4O_N4s",
        author: "Cyber Academy"
      },
      {
        id: "v-3",
        title: "Page Replacement Algorithms (FIFO, LRU, Optimal)",
        duration: "25:30",
        youtubeId: "8co8_7vJ2yM",
        author: "Gate Smasher Education"
      }
    ],
    texts: [
      {
        id: "t-1",
        title: "Operating Systems: Three Easy Pieces (OSTEP) - Chapter 18: Paging",
        url: "https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf",
        source: "University of Wisconsin-Madison",
        type: "book"
      },
      {
        id: "t-2",
        title: "An Introduction to Virtual Memory Management",
        url: "https://example.com/virtual-memory-intro",
        source: "Red Hat Developer Blog",
        type: "article"
      },
      {
        id: "t-3",
        title: "TLB Hardware Specifications and Coherency Protocols",
        url: "https://example.com/tlb-spec",
        source: "Intel Architecture Manual",
        type: "documentation"
      }
    ]
  },
  quizzes: [
    {
      id: "quiz-os-1",
      title: "Memory Management & Paging Quiz",
      durationMinutes: 10,
      questions: [
        {
          id: "q-1",
          question: "What is the primary purpose of the Translation Lookaside Buffer (TLB)?",
          options: [
            "To cache physical data values for rapid CPU registers access.",
            "To cache virtual-to-physical address translations to bypass page-table walks.",
            "To schedule operations inside the CPU pipeline.",
            "To store virtual pages that have been swapped out to disk."
          ],
          correctIndex: 1,
          explanation: "The TLB is a fast hardware cache in the MMU that stores recent page translations, avoiding the need to traverse multi-level page tables in physical memory for every memory access."
        },
        {
          id: "q-2",
          question: "Which bit in a Page Table Entry (PTE) determines if the page is currently in physical memory (RAM) or swap space?",
          options: [
            "Dirty bit",
            "Valid bit",
            "Present bit",
            "Reference bit"
          ],
          correctIndex: 2,
          explanation: "The present bit indicates whether a virtual page is mapped to a physical frame in RAM (present = 1) or needs to be loaded from disk via a page fault (present = 0)."
        },
        {
          id: "q-3",
          question: "What is Belady's Anomaly in page replacement?",
          options: [
            "LRU replacement has poor cache coherence under sequential scans.",
            "Increasing the number of page frames leads to an increase in page faults under FIFO replacement.",
            "Optimal replacement algorithms cannot be implemented in hardware.",
            "Operating systems crash when virtual memory limits are reached."
          ],
          correctIndex: 1,
          explanation: "Belady's Anomaly is a counter-intuitive behavior observed in the First-In, First-Out (FIFO) algorithm where allocating more physical page frames results in more page faults for certain access patterns."
        }
      ]
    }
  ]
};

export const mockChatMessages: ChatMessage[] = [
  {
    id: "m-1",
    sender: "assistant",
    content: "Hello! I am your CYRA AI study tutor. I have loaded your workspace for Operating Systems. We are currently working through Module 2: Memory Management. What questions do you have about address translation or TLBs today?",
    timestamp: "10:15 AM"
  },
  {
    id: "m-2",
    sender: "user",
    content: "Why do we need a Multi-Level Page Table instead of a simple flat one?",
    timestamp: "10:16 AM"
  },
  {
    id: "m-3",
    sender: "assistant",
    content: "Great question! A simple flat (linear) page table requires an entry for every virtual page in the address space. On a 32-bit system with 4KB pages, that is 1 million pages. If each Page Table Entry (PTE) is 4 bytes, that requires 4MB of RAM per process.\n\nNow, imagine a process that only uses 100KB of heap and 50KB of stack. A linear page table still forces the OS to allocate the full 4MB, most of which is empty (marked 'invalid').\n\nMulti-Level Page Tables solve this by introducing a directory layer. They break the table into chunks. If a large range of address space is invalid, the OS does not allocate page tables for that range at all. This saves an enormous amount of physical RAM, especially for sparse address spaces typical in modern programs.",
    timestamp: "10:17 AM"
  }
];
