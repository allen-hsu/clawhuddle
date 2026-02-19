'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api';
import { Header } from '@/components/header';
import type { Skill } from '@clawteam/shared';

interface SkillWithStatus extends Skill {
  assigned: boolean;
}

export default function SkillsPage() {
  const { data: session } = useSession();
  const [skills, setSkills] = useState<SkillWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const userId = (session?.user as any)?.id;

  const fetchSkills = async () => {
    if (!userId) return;
    try {
      const res = await apiFetch<{ data: SkillWithStatus[] }>('/api/me/skills', {
        headers: { 'x-user-id': userId },
      });
      setSkills(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, [userId]);

  const toggle = async (skill: SkillWithStatus) => {
    if (skill.type === 'mandatory') return;
    setToggling(skill.id);
    try {
      await apiFetch(`/api/me/skills/${skill.id}`, {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: JSON.stringify({ enabled: !skill.assigned }),
      });
      await fetchSkills();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setToggling(null);
    }
  };

  const typeLabel = (type: string) => {
    if (type === 'mandatory') return { text: 'Always on', color: 'var(--red)', bg: 'var(--red-muted)' };
    if (type === 'restricted') return { text: 'Restricted', color: 'var(--yellow)', bg: 'var(--yellow-muted)' };
    return null;
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <h1
            className="text-xl font-semibold tracking-tight mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            Skills
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
            Choose which skills to enable for your AI assistant. Changes are applied automatically.
          </p>

          {loading ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
          ) : skills.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                No skills available yet. Ask your admin to add some.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {skills.map((skill) => {
                const badge = typeLabel(skill.type);
                const isMandatory = skill.type === 'mandatory';
                const isToggling = toggling === skill.id;

                return (
                  <div
                    key={skill.id}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors"
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  >
                    {/* Toggle */}
                    <button
                      onClick={() => toggle(skill)}
                      disabled={isMandatory || isToggling}
                      className="shrink-0 w-10 h-6 rounded-full transition-colors relative disabled:cursor-not-allowed"
                      style={{
                        background: skill.assigned ? 'var(--accent)' : 'var(--bg-tertiary)',
                        opacity: isMandatory ? 0.6 : 1,
                      }}
                      title={isMandatory ? 'Mandatory skill, always enabled' : undefined}
                    >
                      <span
                        className="absolute top-1 w-4 h-4 rounded-full transition-all"
                        style={{
                          background: 'white',
                          left: skill.assigned ? '22px' : '4px',
                        }}
                      />
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {skill.name}
                        </span>
                        <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                          {skill.git_path ? skill.git_path.split('/').pop() : skill.path}
                        </span>
                        {badge && (
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{ color: badge.color, background: badge.bg }}
                          >
                            {badge.text}
                          </span>
                        )}
                      </div>
                      {skill.description && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {skill.description}
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    {isToggling && (
                      <span className="text-xs animate-pulse" style={{ color: 'var(--text-tertiary)' }}>
                        saving...
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
