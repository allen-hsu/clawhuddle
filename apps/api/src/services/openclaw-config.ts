import type { Skill } from '@clawteam/shared';

export interface OpenClawConfig {
  meta: {
    lastTouchedVersion: string;
    lastTouchedAt: string;
  };
  commands: {
    native: string;
    nativeSkills: string;
  };
  gateway: {
    mode: string;
    port: number;
    auth: {
      mode: string;
      token: string;
    };
  };
  skills?: Array<{ path: string }>;
}

export function generateOpenClawConfig(options: {
  port: number;
  token: string;
  skills?: Skill[];
}): OpenClawConfig {
  const { port, token, skills } = options;

  const config: OpenClawConfig = {
    meta: {
      lastTouchedVersion: '2026.2.17',
      lastTouchedAt: new Date().toISOString(),
    },
    commands: {
      native: 'auto',
      nativeSkills: 'auto',
    },
    gateway: {
      mode: 'local',
      port,
      auth: {
        mode: 'token',
        token,
      },
    },
  };

  if (skills && skills.length > 0) {
    config.skills = skills.map((s) => ({ path: s.path }));
  }

  return config;
}
