'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, BookOpen, Search, GraduationCap, TrendingUp, Bot, Settings, User, Zap, Flame, LogOut
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';

const mainNav = [
  { label: 'Home',       href: '/',                         icon: Home },
  { label: 'Learn',      href: '/course/operating-systems',  icon: BookOpen },
  { label: 'Research',   href: '/research',                  icon: Search },
  { label: 'My Courses', href: '/courses',                   icon: GraduationCap },
  { label: 'Progress',   href: '/progress',                  icon: TrendingUp },
  { label: 'AI Tutor',   href: '/tutor',                     icon: Bot },
];

const bottomNav = [
  { label: 'Profile',  href: '/profile',  icon: User },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  // If on login or signup pages, don't show sidebar
  if (pathname === '/login' || pathname === '/signup') {
    return null;
  }

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (data) {
            setProfile(data);
          } else {
            // Fallback profile if record creation was delayed
            setProfile({
              id: user.id,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Learner',
              xp: 0,
              current_streak: 1,
              longest_streak: 1,
            });
          }
        }
      } catch (err) {
        console.error('Error loading user profile:', err);
      }
    }

    loadProfile();
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const userName = profile?.full_name || 'CYRA User';
  const userXp = profile?.xp ?? 0;
  const userStreak = profile?.current_streak ?? 1;
  const level = Math.floor(userXp / 300) + 1;
  const xpNextLevel = level * 300;
  const xpPct = Math.min(100, Math.max(0, (userXp / xpNextLevel) * 100));

  return (
    <aside
      className="glass fixed left-0 top-0 z-40 flex h-screen flex-col"
      style={{ width: 'var(--sidebar-w)', borderRight: '1px solid var(--border)' }}
    >
      {/* ── Logo ── */}
      <div className="px-5 py-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow duration-300">
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 border-2 border-[var(--bg)] shadow-[0_0_6px_#22d3ee]" />
          </div>

          <div className="leading-none">
            <p className="text-[15px] font-bold tracking-tight text-white">
              CYRA <span className="text-gradient-brand">AI</span>
            </p>
            <p className="text-[9px] font-medium tracking-[0.12em] text-[var(--text-muted)] uppercase mt-[2px]">
              Learning System
            </p>
          </div>
        </Link>
      </div>

      {/* ── Main nav ── */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--text-muted)]">
          Navigation
        </p>
        {mainNav.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link key={label} href={href} className={`nav-item ${active ? 'active' : ''}`}>
              <Icon
                className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? 'text-cyan-400' : ''}`}
              />
              <span>{label}</span>
              {active && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--primary)', boxShadow: '0 0 6px var(--primary)' }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User block ── */}
      <div className="mt-auto px-3 pb-5 space-y-1">
        {/* Bottom nav */}
        {bottomNav.map(({ label, href, icon: Icon }) => (
          <Link key={label} href={href} className={`nav-item ${isActive(href) ? 'active' : ''}`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </Link>
        ))}

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="nav-item w-full text-left text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign Out</span>
        </button>

        <div className="divider-line my-3" />

        {/* User card */}
        <div
          className="p-3 rounded-xl flex items-center gap-3"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}
        >
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white uppercase"
            style={{ background: 'linear-gradient(135deg, #6366f1, #22d3ee)' }}
          >
            {userName[0]}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-white truncate">{userName}</span>
              <span
                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ml-1 flex-shrink-0"
                style={{
                  background: 'rgba(99,102,241,0.15)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99,102,241,0.25)'
                }}
              >
                Lv {level}
              </span>
            </div>

            {/* XP bar */}
            <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${xpPct}%`,
                  background: 'linear-gradient(90deg, var(--primary), var(--cyan))'
                }}
              />
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Flame className="w-3 h-3 text-amber-500" />
              <span className="text-[9px] text-[var(--text-muted)]">{userStreak} day streak</span>
              <span className="ml-auto text-[9px] font-mono text-[var(--text-muted)]">{userXp} XP</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
