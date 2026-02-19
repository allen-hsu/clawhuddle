'use client';

import { useState } from 'react';
import type { Skill, ScanRepoResult } from '@clawteam/shared';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';

type FetchFn = <T>(path: string, options?: RequestInit) => Promise<T>;

interface Props {
  initialSkills: Skill[];
  fetchFn: FetchFn;
}

function Badge({ color, children }: { color: 'green' | 'red' | 'yellow' | 'blue' | 'gray'; children: React.ReactNode }) {
  const styles: Record<string, { bg: string; text: string }> = {
    green:  { bg: 'var(--green-muted)',  text: 'var(--green)' },
    red:    { bg: 'var(--red-muted)',    text: 'var(--red)' },
    yellow: { bg: 'var(--yellow-muted)', text: 'var(--yellow)' },
    blue:   { bg: 'var(--blue-muted)',   text: 'var(--blue)' },
    gray:   { bg: 'var(--bg-tertiary)',  text: 'var(--text-tertiary)' },
  };
  const s = styles[color];
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ background: s.bg, color: s.text }}
    >
      {children}
    </span>
  );
}

function ActionBtn({ onClick, color = 'default', children }: { onClick: () => void; color?: 'default' | 'danger'; children: React.ReactNode }) {
  const colorMap = {
    default: { normal: 'var(--accent)', hover: 'var(--accent-hover)' },
    danger:  { normal: 'var(--red)',    hover: '#fca5a5' },
  };
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      className="text-xs font-medium transition-colors"
      style={{ color: c.normal }}
      onMouseEnter={(e) => { e.currentTarget.style.color = c.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = c.normal; }}
    >
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-primary)',
  color: 'var(--text-primary)',
};

export function SkillTable({ initialSkills, fetchFn }: Props) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [skills, setSkills] = useState(initialSkills);
  const [showForm, setShowForm] = useState(false);
  const [gitUrl, setGitUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [scannedSkills, setScannedSkills] = useState<ScanRepoResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const refresh = async () => {
    const res = await fetchFn<{ data: Skill[] }>('/skills');
    setSkills(res.data);
  };

  const resetForm = () => {
    setGitUrl('');
    setScannedSkills([]);
    setSelected(new Set());
    setError('');
    setScanning(false);
    setImporting(false);
  };

  const scanRepo = async () => {
    const trimmed = gitUrl.trim();
    if (!trimmed) { setError('Git URL is required'); return; }
    setScanning(true);
    setError('');
    setScannedSkills([]);
    setSelected(new Set());
    try {
      const res = await fetchFn<{ data: ScanRepoResult[] }>('/skills/scan', {
        method: 'POST',
        body: JSON.stringify({ git_url: trimmed }),
      });
      if (res.data.length === 0) {
        setError('No skills found (no directories containing SKILL.md)');
      } else {
        setScannedSkills(res.data);
        setSelected(new Set(res.data.map((s) => s.git_path)));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const importSelected = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    setError('');
    try {
      const toImport = scannedSkills.filter((s) => selected.has(s.git_path));
      await fetchFn('/skills/import', {
        method: 'POST',
        body: JSON.stringify({ git_url: gitUrl.trim(), skills: toImport }),
      });
      resetForm();
      setShowForm(false);
      await refresh();
      toast(`Imported ${toImport.length} skill${toImport.length !== 1 ? 's' : ''}`, 'success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const toggleSelection = (gitPath: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(gitPath)) next.delete(gitPath);
      else next.add(gitPath);
      return next;
    });
  };

  const toggleEnabled = async (skill: Skill) => {
    await fetchFn(`/skills/${skill.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !skill.enabled }),
    });
    await refresh();
  };

  const changeType = async (skill: Skill, newType: string) => {
    await fetchFn(`/skills/${skill.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ type: newType }),
    });
    await refresh();
  };

  const deleteSkill = async (skill: Skill) => {
    const ok = await confirm({
      title: `Delete "${skill.name}"?`,
      description: 'This will remove the skill from all members. This action cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await fetchFn(`/skills/${skill.id}`, { method: 'DELETE' });
    await refresh();
  };

  const typeColors: Record<string, 'red' | 'blue' | 'yellow'> = {
    mandatory: 'red',
    optional: 'blue',
    restricted: 'yellow',
  };

  return (
    <div>
      {/* Import from Git */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
        >
          + Import from Git
        </button>
      ) : (
        <div
          className="mb-6 p-4 rounded-xl"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Import Skills from Git
            </span>
            <button
              onClick={() => { setShowForm(false); resetForm(); }}
              className="text-xs"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Cancel
            </button>
          </div>

          {/* Step 1: Scan */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="block text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Repository URL
              </label>
              <input
                value={gitUrl}
                onChange={(e) => { setGitUrl(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !scanning) scanRepo(); if (e.key === 'Escape') { setShowForm(false); resetForm(); } }}
                placeholder="https://github.com/org/repo"
                autoFocus
                disabled={scanning}
                className="w-full px-3 py-2 text-sm rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                style={inputStyle}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={scanRepo}
                disabled={scanning}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
              >
                {scanning ? 'Scanning...' : 'Scan'}
              </button>
            </div>
          </div>

          {/* Step 2: Select & Import */}
          {scannedSkills.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Found {scannedSkills.length} skill{scannedSkills.length !== 1 ? 's' : ''} — {selected.size} selected
                </span>
                <button
                  onClick={() => {
                    if (selected.size === scannedSkills.length) setSelected(new Set());
                    else setSelected(new Set(scannedSkills.map((s) => s.git_path)));
                  }}
                  className="text-xs font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  {selected.size === scannedSkills.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div
                className="rounded-lg overflow-hidden divide-y"
                style={{ border: '1px solid var(--border-primary)', borderColor: 'var(--border-primary)' }}
              >
                {scannedSkills.map((s) => (
                  <label
                    key={s.git_path}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                    style={{ background: selected.has(s.git_path) ? 'var(--bg-hover)' : 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = selected.has(s.git_path) ? 'var(--bg-hover)' : 'transparent'; }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(s.git_path)}
                      onChange={() => toggleSelection(s.git_path)}
                      className="rounded"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                      <div className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>{s.git_path}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs mb-3" style={{ color: 'var(--red)' }}>{error}</p>
          )}

          {scannedSkills.length > 0 && (
            <button
              onClick={importSelected}
              disabled={importing || selected.size === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
            >
              {importing ? 'Importing...' : `Import ${selected.size} Skill${selected.size !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {['Name', 'Git URL', 'Git Path', 'Type', 'Status', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skills.map((skill, i) => (
              <tr
                key={skill.id}
                className="transition-colors"
                style={{
                  borderBottom: i < skills.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                  <div className="font-medium">{skill.name}</div>
                  {skill.description && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {skill.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }} title={skill.git_url || ''}>
                  {skill.git_url || '-'}
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {skill.git_path || skill.path}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={skill.type}
                    onChange={(e) => changeType(skill, e.target.value)}
                    className="text-[11px] font-medium rounded px-1.5 py-0.5 border-none cursor-pointer focus:outline-none"
                    style={{
                      background: typeColors[skill.type] === 'red' ? 'var(--red-muted)' : typeColors[skill.type] === 'blue' ? 'var(--blue-muted)' : 'var(--yellow-muted)',
                      color: typeColors[skill.type] === 'red' ? 'var(--red)' : typeColors[skill.type] === 'blue' ? 'var(--blue)' : 'var(--yellow)',
                    }}
                  >
                    <option value="optional">optional</option>
                    <option value="mandatory">mandatory</option>
                    <option value="restricted">restricted</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Badge color={skill.enabled ? 'green' : 'gray'}>
                    {skill.enabled ? 'enabled' : 'disabled'}
                  </Badge>
                </td>
                <td className="px-4 py-3 space-x-3">
                  <ActionBtn onClick={() => toggleEnabled(skill)}>
                    {skill.enabled ? 'Disable' : 'Enable'}
                  </ActionBtn>
                  <ActionBtn onClick={() => deleteSkill(skill)} color="danger">
                    Delete
                  </ActionBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {skills.length === 0 && (
          <p
            className="text-center py-12 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            No skills configured
          </p>
        )}
      </div>
    </div>
  );
}
