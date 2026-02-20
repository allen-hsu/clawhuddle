import Link from 'next/link';
import { LandingNav } from '@/components/landing-nav';

/* ─── Page ─── */

export default function LandingPage() {
  return (
    <div className="min-h-screen relative" style={{ background: '#050810' }}>
      {/* Cosmic background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 20% 0%, rgba(255, 77, 77, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(0, 229, 204, 0.025) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 100%, rgba(255, 77, 77, 0.02) 0%, transparent 40%)
          `,
        }}
      />

      <div className="relative z-10">
        <LandingNav />

        {/* ─── Hero ─── */}
        <section className="min-h-[88vh] flex items-center justify-center text-center">
          <div className="max-w-3xl mx-auto px-6">
            <p
              className="text-[13px] tracking-[0.2em] uppercase font-medium mb-6"
              style={{ color: '#ff4d4d' }}
            >
              Managed OpenClaw for teams
            </p>

            <h1
              className="text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[1.08] tracking-[-0.025em] font-bold mb-8"
              style={{ color: '#f0f4ff' }}
            >
              Give every person on your team{' '}
              <span style={{ color: '#ff4d4d' }}>their own</span>{' '}
              AI&nbsp;assistant.
            </h1>

            <p
              className="text-[17px] leading-[1.7] max-w-lg mx-auto mb-10"
              style={{ color: '#8892b0' }}
            >
              Each team member gets an isolated OpenClaw instance —
              no servers, no Docker, no&nbsp;maintenance. You add
              people, we handle the&nbsp;rest.
            </p>

            <div className="flex items-center justify-center gap-5">
              <Link
                href="/login"
                className="text-[14px] font-semibold px-6 py-2.5 rounded-md transition-all"
                style={{
                  background: '#ff4d4d',
                  color: '#fff',
                  boxShadow: '0 0 20px rgba(255, 77, 77, 0.2)',
                }}
              >
                Start for free
              </Link>
              <a
                href="#features"
                className="text-[14px] transition-colors"
                style={{ color: '#5a6480' }}
              >
                Learn more &darr;
              </a>
            </div>
          </div>
        </section>

        {/* ─── Features ─── */}
        <section id="features" className="py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <h2
              className="text-[22px] font-bold mb-12"
              style={{ color: '#f0f4ff' }}
            >
              <span style={{ color: '#ff4d4d' }}>&#x276F;</span>{' '}
              What You Get
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                }
                title="Isolated instances"
                desc="Every team member gets their own workspace, conversation history, and config. Nothing is shared."
              />
              <FeatureCard
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                }
                title="Managed skills"
                desc="Build a library of custom skills. Assign them to individuals or the whole team from one dashboard."
              />
              <FeatureCard
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                }
                title="Admin controls"
                desc="Invite members, manage API keys, monitor deployments. One place for everything."
              />
              <FeatureCard
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                }
                title="Zero-touch deploy"
                desc="Add someone to your org. Their AI assistant is running within seconds. No SSH, no Docker."
              />
              <FeatureCard
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                }
                title="Private & secure"
                desc="Each instance is fully isolated. Conversations, files, and settings never leak between users."
              />
              <FeatureCard
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                }
                title="Built on OpenClaw"
                desc="The same open-source AI framework you know. We just handle the infrastructure."
              />
            </div>
          </div>
        </section>

        {/* ─── How it works ─── */}
        <section
          id="how-it-works"
          className="py-24"
          style={{ background: 'rgba(255,255,255,0.015)' }}
        >
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <h2
              className="text-[22px] font-bold mb-12"
              style={{ color: '#f0f4ff' }}
            >
              <span style={{ color: '#ff4d4d' }}>&#x276F;</span>{' '}
              How It Works
            </h2>

            <div className="space-y-0">
              {[
                { n: '01', title: 'Create a workspace', desc: 'Sign up, name your organization. Thirty seconds.' },
                { n: '02', title: 'Invite your team', desc: 'Send email invites. Members join with one click.' },
                { n: '03', title: 'They\'re ready', desc: 'Each person gets a running AI assistant, automatically deployed and configured.' },
              ].map((step) => (
                <div
                  key={step.n}
                  className="flex items-baseline gap-6 md:gap-10 py-6"
                  style={{ borderBottom: '1px solid rgba(136, 146, 176, 0.1)' }}
                >
                  <span
                    className="text-[13px] font-mono shrink-0 w-8"
                    style={{ color: '#ff4d4d' }}
                  >
                    {step.n}
                  </span>
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-8">
                    <h3
                      className="text-[18px] md:text-[22px] font-semibold shrink-0"
                      style={{ color: '#f0f4ff' }}
                    >
                      {step.title}
                    </h3>
                    <p className="text-[14px] sm:text-right max-w-xs" style={{ color: '#5a6480' }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── The alternative ─── */}
        <section className="py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <h2
              className="text-[22px] font-bold mb-12"
              style={{ color: '#f0f4ff' }}
            >
              <span style={{ color: '#ff4d4d' }}>&#x276F;</span>{' '}
              The Alternative
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
              <div className="md:col-span-5">
                <h3
                  className="text-[clamp(1.5rem,3vw,2rem)] leading-[1.2] tracking-[-0.01em] font-bold mb-4"
                  style={{ color: '#f0f4ff' }}
                >
                  60+ minutes of setup.
                  <br />
                  <span style={{ color: '#ff4d4d' }}>Per person.</span>
                </h3>
                <p className="text-[14px] leading-[1.7]" style={{ color: '#5a6480' }}>
                  Provisioning servers, configuring Docker, installing
                  dependencies, setting up auth — repeated for every
                  new hire. Or you could skip all that.
                </p>
              </div>

              <div className="md:col-span-7 md:pl-8">
                <div className="space-y-3">
                  {[
                    ['Provision servers', '15 min'],
                    ['Configure Docker & networking', '20 min'],
                    ['Install and configure OpenClaw', '10 min'],
                    ['Set up authentication', '15 min'],
                    ['Ongoing maintenance', '\u221E'],
                  ].map(([task, time]) => (
                    <div
                      key={task}
                      className="flex items-center justify-between py-2.5"
                      style={{ borderBottom: '1px solid rgba(136, 146, 176, 0.08)' }}
                    >
                      <span className="text-[14px]" style={{ color: '#8892b0' }}>{task}</span>
                      <span
                        className="font-mono text-[13px] tabular-nums"
                        style={{ color: '#F87171' }}
                      >
                        {time}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  className="mt-8 inline-block px-4 py-2 rounded-md text-[13px] font-medium"
                  style={{
                    color: '#00e5cc',
                    background: 'rgba(0, 229, 204, 0.08)',
                    border: '1px solid rgba(0, 229, 204, 0.15)',
                  }}
                >
                  With ClawHuddle: under 2 minutes, zero maintenance
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <h2
              className="text-[22px] font-bold mb-12"
              style={{ color: '#f0f4ff' }}
            >
              <span style={{ color: '#ff4d4d' }}>&#x276F;</span>{' '}
              Questions
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
              <FaqItem
                q="What is OpenClaw?"
                a="An open-source AI assistant framework. Personal, extensible, tool-using. ClawHuddle manages the hosting so your team doesn't have to."
              />
              <FaqItem
                q="Do I bring my own API keys?"
                a="Yes. You provide keys for Anthropic, OpenAI, or whichever provider you use. Your keys, your control."
              />
              <FaqItem
                q="Is there a member limit?"
                a="By default each organization supports up to 50 members. You can adjust this via the MAX_MEMBERS_PER_ORG environment variable."
              />
              <FaqItem
                q="Is data shared between users?"
                a="No. Each member has a fully isolated instance. Conversations, files, and settings are private to each user."
              />
              <FaqItem
                q="Can I self-host?"
                a="Absolutely. OpenClaw is open-source. ClawHuddle exists for teams that want managed infrastructure without the overhead."
              />
              <FaqItem
                q="What about uptime?"
                a="Instances run on dedicated containers. If one goes down, it doesn't affect others. We monitor and auto-restart."
              />
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div
              className="rounded-xl p-10 md:p-16 text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 77, 77, 0.05) 0%, rgba(10, 15, 26, 0.8) 50%, rgba(0, 229, 204, 0.03) 100%)',
                border: '1px solid rgba(136, 146, 176, 0.1)',
              }}
            >
              <h2
                className="text-[clamp(1.8rem,4vw,3rem)] leading-[1.1] tracking-[-0.02em] font-bold mb-4"
                style={{ color: '#f0f4ff' }}
              >
                Your team is waiting.
              </h2>
              <p className="text-[15px] mb-8" style={{ color: '#5a6480' }}>
                Open source &amp; self-hosted. Set up in under 2 minutes.
              </p>
              <Link
                href="/login"
                className="inline-block text-[14px] font-semibold px-8 py-3 rounded-md transition-all"
                style={{
                  background: '#ff4d4d',
                  color: '#fff',
                  boxShadow: '0 0 30px rgba(255, 77, 77, 0.2)',
                }}
              >
                Get started &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="pb-8 pt-16">
          <div className="max-w-6xl mx-auto px-6 md:px-10 flex items-center justify-between">
            <span className="text-[13px]" style={{ color: '#2a3350' }}>
              ClawHuddle
            </span>
            <div className="flex items-center gap-4">
              <a
                href="https://buymeacoffee.com/unless"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] transition-colors text-[#5a6480] hover:text-[#ffdd00]"
              >
                ☕ Buy me a coffee
              </a>
              <a
                href="https://openclaw.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] transition-colors"
                style={{ color: '#2a3350' }}
              >
                Built on OpenClaw
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ─── Feature Card ─── */

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: 'rgba(10, 15, 26, 0.65)',
        border: '1px solid rgba(136, 146, 176, 0.1)',
      }}
    >
      <div className="mb-4" style={{ color: '#ff4d4d' }}>
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold mb-2" style={{ color: '#f0f4ff' }}>
        {title}
      </h3>
      <p className="text-[13px] leading-[1.7]" style={{ color: '#5a6480' }}>
        {desc}
      </p>
    </div>
  );
}

/* ─── FAQ Item ─── */

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h3 className="text-[14px] font-medium mb-1.5" style={{ color: '#8892b0' }}>
        {q}
      </h3>
      <p className="text-[13px] leading-[1.7]" style={{ color: '#5a6480' }}>
        {a}
      </p>
    </div>
  );
}
