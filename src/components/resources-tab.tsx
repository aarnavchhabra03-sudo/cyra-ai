'use client';

import React, { useState } from 'react';
import { 
  Play, 
  ExternalLink, 
  BookOpen, 
  FileText, 
  Video, 
  PlayCircle, 
  Layers, 
  ChevronRight,
  X
} from 'lucide-react';
import { VideoResource, TextResource } from '@/data/mockData';

interface ResourcesTabProps {
  videos: VideoResource[];
  texts: TextResource[];
}

export default function ResourcesTab({ videos, texts }: ResourcesTabProps) {
  const [activeVideo, setActiveVideo] = useState<VideoResource | null>(null);

  return (
    <div className="space-y-10">
      
      {/* Simulation Overlay - Video Player Modal */}
      {activeVideo && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-3xl w-full rounded-2xl border border-zinc-800/80 overflow-hidden shadow-2xl animate-fade-in flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 bg-zinc-950/40 border-b border-zinc-900 flex justify-between items-center">
              <div className="flex items-center gap-2 text-zinc-400">
                <PlayCircle className="w-4 h-4 text-red-500" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">CYRA AI Video Companion</span>
              </div>
              <button 
                onClick={() => setActiveVideo(null)}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player Embed Frame */}
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {/* Check if video uses a valid embed, else fallback to a styled mockup placeholder */}
              {activeVideo.youtubeId ? (
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1`}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <Video className="w-12 h-12 text-zinc-700 mx-auto animate-pulse" />
                  <p className="text-xs text-zinc-500 font-mono">Stream URL not found, simulated player offline.</p>
                </div>
              )}
            </div>

            {/* Video Meta Info */}
            <div className="p-5 space-y-2">
              <h4 className="text-sm font-bold text-white leading-snug">{activeVideo.title}</h4>
              <div className="flex justify-between items-center text-[10px] text-zinc-500">
                <span>Presenter: <strong className="text-zinc-300 font-semibold">{activeVideo.author}</strong></span>
                <span className="font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{activeVideo.duration}</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* TEXT RESOURCES (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono">Textbooks & Core Articles</h3>
          </div>

          <div className="space-y-3.5">
            {texts.map((resource) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-4 rounded-xl border bg-zinc-900/20 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/40 flex justify-between items-center transition-all duration-200"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                    resource.type === 'book' 
                      ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                      : resource.type === 'article' 
                      ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' 
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}>
                    {resource.type === 'book' ? (
                      <Layers className="w-4 h-4" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-zinc-200 group-hover:text-cyan-400 transition-colors truncate block pr-2">
                      {resource.title}
                    </h4>
                    <span className="text-[9px] font-mono text-zinc-500 mt-0.5 block uppercase">
                      Source: {resource.source}
                    </span>
                  </div>
                </div>

                <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>

        {/* VIDEO RESOURCES (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Video className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono">Stream & Video Companion</h3>
          </div>

          <div className="space-y-3.5">
            {videos.map((video) => (
              <div
                key={video.id}
                onClick={() => setActiveVideo(video)}
                className="group p-4 rounded-xl border bg-zinc-900/20 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/40 flex justify-between items-center cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 relative group-hover:scale-105 transition-transform">
                    <Play className="w-4 h-4 fill-indigo-400/25" />
                  </div>
                  
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors truncate block pr-2">
                      {video.title}
                    </h4>
                    <span className="text-[9px] font-mono text-zinc-500 mt-0.5 block uppercase">
                      Channel: {video.author}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] font-mono text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-900">
                    {video.duration}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
