'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrgFetch } from '@/lib/use-org-fetch';
import { useToast } from '@/components/ui/toast';
import type { Skill } from '@clawhuddle/shared';

interface SkillWithStatus extends Skill {
  assigned: boolean;
}

export default function UserSkillsPage() {
  const { orgFetch, ready } = useOrgFetch();
  const { toast } = useToast();
  const [skills, setSkills] = useState<SkillWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  const [saving, setSaving] = useState(false);

  const fetchSkills = useCallback(async () => {
    if (!orgFetch) return;
    try {
      const res = await orgFetch<{ data: SkillWithStatus[] }>('/me/skills');
      setSkills(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [orgFetch]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const getEffectiveAssigned = useCallback(
    (skill: SkillWithStatus) => {
      if (pendingChanges.has(skill.id)) return pendingChanges.get(skill.id)!;
      return skill.assigned;
    },
    [pendingChanges],
  );

  const hasPendingChanges = pendingChanges.size > 0;

  const optionalSkills = useMemo(
    () => skills.filter((s) => s.type === 'optional'),
    [skills],
  );

  const toggle = (skill: SkillWithStatus) => {
    if (skill.type === 'mandatory') return;
    const newValue = !getEffectiveAssigned(skill);
    setPendingChanges((prev) => {
      const next = new Map(prev);
      if (newValue === skill.assigned) {
        next.delete(skill.id);
      } else {
        next.set(skill.id, newValue);
      }
      return next;
    });
  };

  const toggleAll = () => {
    const effectiveOnCount = optionalSkills.filter((s) => getEffectiveAssigned(s)).length;
    const targetState = effectiveOnCount <= optionalSkills.length / 2;
    setPendingChanges((prev) => {
      const next = new Map(prev);
      for (const skill of optionalSkills) {
        if (skill.assigned !== targetState) {
          next.set(skill.id, targetState);
        } else {
          next.delete(skill.id);
        }
      }
      return next;
    });
  };

  const save = async () => {
    if (!orgFetch || !hasPendingChanges) return;
    setSaving(true);
    try {
      const updates = Array.from(pendingChanges.entries()).map(([id, enabled]) => ({
        id,
        enabled,
      }));
      await orgFetch('/me/skills', {
        method: 'PUT',
        body: JSON.stringify({ skills: updates }),
      });
      await fetchSkills();
      setPendingChanges(new Map());
      toast('Skills updated successfully', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = (type: string) => {
    if (type === 'mandatory') return { text: 'Always on', color: 'var(--red)', bg: 'var(--red-muted)' };
    if (type === 'restricted') return { text: 'Restricted', color: 'var(--yellow)', bg: 'var(--yellow-muted)' };
    return null;
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-1">
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Skills
          </h1>
          <div className="flex items-center gap-2">
            {!loading && ready && optionalSkills.length > 0 && (
              <button
                onClick={toggleAll}
                disabled={saving}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-tertiary)',
                }}
              >
                Toggle All
              </button>
            )}
            <button
              onClick={save}
              disabled={!hasPendingChanges || saving}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              style={{
                color: hasPendingChanges ? 'white' : 'var(--text-tertiary)',
                background: hasPendingChanges ? 'var(--accent)' : 'var(--bg-tertiary)',
                opacity: !hasPendingChanges ? 0.6 : 1,
              }}
            >
              {saving && (
                <span
                  className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: 'transparent' }}
                />
              )}
              Save
              {hasPendingChanges && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  {pendingChanges.size}
                </span>
              )}
            </button>
          </div>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
          Toggle skills and click Save to apply.
        </p>

        {loading || !ready ? (
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
              const effectiveAssigned = getEffectiveAssigned(skill);
              const isPending = pendingChanges.has(skill.id);

              return (
                <div
                  key={skill.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderLeftWidth: isPending ? '3px' : '1px',
                    borderLeftColor: isPending ? 'var(--accent)' : 'var(--border-subtle)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)'; if (isPending) e.currentTarget.style.borderLeftColor = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; if (isPending) e.currentTarget.style.borderLeftColor = 'var(--accent)'; }}
                >
                  <button
                    onClick={() => toggle(skill)}
                    disabled={isMandatory || saving}
                    className="shrink-0 w-10 h-6 rounded-full transition-colors relative disabled:cursor-not-allowed"
                    style={{
                      background: effectiveAssigned ? 'var(--accent)' : 'var(--bg-tertiary)',
                      opacity: isMandatory ? 0.6 : 1,
                    }}
                    title={isMandatory ? 'Mandatory skill, always enabled' : undefined}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full transition-all"
                      style={{
                        background: 'white',
                        left: effectiveAssigned ? '22px' : '4px',
                      }}
                    />
                  </button>

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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
