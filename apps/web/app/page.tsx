import Link from 'next/link';

/* ─── Page ─── */

export default function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: '#07080A',
        /* subtle noise grain overlay */
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
      }}
    >
      {/* ─── Nav ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 mix-blend-normal">
        <div className="max-w-6xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-[15px] font-medium tracking-tight"
            style={{ color: '#C7944A' }}
          >
            ClawTeam
          </Link>
          <div className="flex items-center gap-6">
            <a
              href="#pricing"
              className="text-[13px] transition-colors hidden sm:block"
              style={{ color: '#556178' }}
            >
              Pricing
            </a>
            <Link
              href="/login"
              className="text-[13px] transition-colors"
              style={{ color: '#8893A7' }}
            >
              Log in
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="min-h-[85vh] flex items-center relative">
        {/* warm ambient light — very subtle */}
        <div
          className="absolute top-[10%] right-[15%] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(199,148,74,0.06) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div className="max-w-6xl mx-auto px-6 md:px-10 w-full relative z-10">
          <div className="max-w-2xl">
            <p
              className="text-[13px] tracking-[0.15em] uppercase mb-6"
              style={{ color: '#556178' }}
            >
              Managed OpenClaw for teams
            </p>

            <h1
              className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] tracking-[-0.02em] mb-8"
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                color: '#E4E8F0',
              }}
            >
              Give every person
              <br />
              on your team{' '}
              <em style={{ color: '#C7944A', fontStyle: 'italic' }}>
                their own
              </em>
              <br />
              AI assistant.
            </h1>

            <p
              className="text-[17px] leading-[1.7] max-w-md mb-10"
              style={{ color: '#6B7A90' }}
            >
              Each team member gets an isolated OpenClaw instance —
              no servers, no Docker, no&nbsp;maintenance. You add
              people, we handle the&nbsp;rest.
            </p>

            <div className="flex items-center gap-5">
              <Link
                href="/login"
                className="text-[14px] font-medium px-5 py-2.5 transition-colors"
                style={{
                  background: '#C7944A',
                  color: '#07080A',
                  borderRadius: '6px',
                }}
              >
                Start for free
              </Link>
              <a
                href="#how-it-works"
                className="text-[14px] transition-colors"
                style={{ color: '#556178' }}
              >
                See how it works &darr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* ─── What you get ─── */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-y-16 md:gap-x-16">
          <div className="md:col-span-4">
            <p
              className="text-[13px] tracking-[0.15em] uppercase mb-4"
              style={{ color: '#556178' }}
            >
              What you get
            </p>
            <h2
              className="text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.2] tracking-[-0.01em]"
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                color: '#E4E8F0',
              }}
            >
              Everything to run
              <br />
              AI across your
              <br />
              organization.
            </h2>
          </div>

          <div className="md:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
              <Feature
                title="Isolated instances"
                text="Every team member gets their own workspace, conversation history, and config. Nothing is shared."
              />
              <Feature
                title="Managed skills"
                text="Build a library of custom skills. Assign them to individuals or the whole team from one dashboard."
              />
              <Feature
                title="Admin controls"
                text="Invite members, manage API keys, monitor deployments. One place for everything."
              />
              <Feature
                title="Zero-touch deploy"
                text="Add someone to your org. Their AI assistant is running within seconds. No SSH, no Docker."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="py-24" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <p
            className="text-[13px] tracking-[0.15em] uppercase mb-12"
            style={{ color: '#556178' }}
          >
            How it works
          </p>

          <div className="space-y-0">
            {[
              { n: '01', title: 'Create a workspace', desc: 'Sign up, name your organization. Thirty seconds.' },
              { n: '02', title: 'Invite your team', desc: 'Send email invites. Members join with one click.' },
              { n: '03', title: 'They\'re ready', desc: 'Each person gets a running AI assistant, automatically deployed and configured.' },
            ].map((step) => (
              <div
                key={step.n}
                className="flex items-baseline gap-6 md:gap-10 py-6"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span
                  className="text-[13px] font-mono shrink-0 w-8"
                  style={{ color: '#C7944A' }}
                >
                  {step.n}
                </span>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-8">
                  <h3
                    className="text-[18px] md:text-[22px] shrink-0"
                    style={{
                      fontFamily: 'var(--font-display), Georgia, serif',
                      color: '#E4E8F0',
                    }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-[14px] sm:text-right max-w-xs" style={{ color: '#556178' }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── The alternative ─── */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-5">
            <p
              className="text-[13px] tracking-[0.15em] uppercase mb-4"
              style={{ color: '#556178' }}
            >
              The alternative
            </p>
            <h2
              className="text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.2] tracking-[-0.01em] mb-4"
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                color: '#E4E8F0',
              }}
            >
              60+ minutes of setup.
              <br />
              <em style={{ fontStyle: 'italic', color: '#C7944A' }}>Per person.</em>
            </h2>
            <p className="text-[14px] leading-[1.7]" style={{ color: '#556178' }}>
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
                ['Ongoing maintenance', '&infin;'],
              ].map(([task, time]) => (
                <div
                  key={task}
                  className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span className="text-[14px]" style={{ color: '#6B7A90' }}>{task}</span>
                  <span
                    className="font-mono text-[13px] tabular-nums"
                    style={{ color: '#F87171' }}
                    dangerouslySetInnerHTML={{ __html: time }}
                  />
                </div>
              ))}
            </div>

            <div
              className="mt-8 inline-block px-4 py-2 rounded-md text-[13px] font-medium"
              style={{
                color: '#34D399',
                background: 'rgba(52, 211, 153, 0.08)',
                border: '1px solid rgba(52, 211, 153, 0.12)',
              }}
            >
              With ClawTeam: under 2 minutes, zero maintenance
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section
        id="pricing"
        className="py-24"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-5">
              <p
                className="text-[13px] tracking-[0.15em] uppercase mb-4"
                style={{ color: '#556178' }}
              >
                Pricing
              </p>
              <h2
                className="text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.2] tracking-[-0.01em] mb-4"
                style={{
                  fontFamily: 'var(--font-display), Georgia, serif',
                  color: '#E4E8F0',
                }}
              >
                Free up to five.
                <br />
                <em style={{ fontStyle: 'italic', color: '#C7944A' }}>
                  $10/mo after that.
                </em>
              </h2>
              <p className="text-[14px] leading-[1.7] mb-6" style={{ color: '#556178' }}>
                Your first five team members are on us, forever.
                Once you go beyond five, it&apos;s a flat $10 per month —
                not per seat, just $10 total. No surprises.
              </p>
              <Link
                href="/login"
                className="inline-block text-[14px] font-medium px-5 py-2.5 transition-colors"
                style={{
                  background: '#C7944A',
                  color: '#07080A',
                  borderRadius: '6px',
                }}
              >
                Start for free
              </Link>
            </div>

            <div className="md:col-span-7 md:pl-8">
              <div
                className="rounded-lg p-6"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-baseline gap-3 mb-1">
                  <span
                    className="text-[48px] leading-none font-light"
                    style={{
                      fontFamily: 'var(--font-display), Georgia, serif',
                      color: '#E4E8F0',
                    }}
                  >
                    $0
                  </span>
                  <span className="text-[14px]" style={{ color: '#556178' }}>
                    / month
                  </span>
                </div>
                <p className="text-[14px] mb-6" style={{ color: '#6B7A90' }}>
                  For teams of 1&ndash;5
                </p>

                <div className="space-y-2.5 mb-8">
                  {[
                    'Per-user AI assistant instances',
                    'Skill library & management',
                    'Admin dashboard & controls',
                    'Email invitations',
                    'Automatic deployment',
                  ].map((feature) => (
                    <div key={feature} className="flex items-start gap-3 text-[13px]">
                      <span className="mt-0.5" style={{ color: '#556178' }}>&mdash;</span>
                      <span style={{ color: '#8893A7' }}>{feature}</span>
                    </div>
                  ))}
                </div>

                <div
                  className="pt-5"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-baseline gap-3 mb-1">
                    <span
                      className="text-[32px] leading-none font-light"
                      style={{
                        fontFamily: 'var(--font-display), Georgia, serif',
                        color: '#C7944A',
                      }}
                    >
                      $10
                    </span>
                    <span className="text-[14px]" style={{ color: '#556178' }}>
                      / month &middot; flat
                    </span>
                  </div>
                  <p className="text-[13px]" style={{ color: '#556178' }}>
                    For teams beyond 5 members. Same features, no per-seat fees.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-24">
        <p
          className="text-[13px] tracking-[0.15em] uppercase mb-12"
          style={{ color: '#556178' }}
        >
          Questions
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
          <FaqItem
            q="What is OpenClaw?"
            a="An open-source AI assistant framework. Personal, extensible, tool-using. ClawTeam manages the hosting so your team doesn't have to."
          />
          <FaqItem
            q="Do I bring my own API keys?"
            a="Yes. You provide keys for Anthropic, OpenAI, or whichever provider you use. Your keys, your control."
          />
          <FaqItem
            q="What happens past 5 members?"
            a="You pay $10/month total — not per seat. Add 6 people or 60, same price. We may introduce tiers later, but early users keep this rate."
          />
          <FaqItem
            q="Is data shared between users?"
            a="No. Each member has a fully isolated instance. Conversations, files, and settings are private to each user."
          />
          <FaqItem
            q="Can I self-host?"
            a="Absolutely. OpenClaw is open-source. ClawTeam exists for teams that want managed infrastructure without the overhead."
          />
          <FaqItem
            q="What about uptime?"
            a="Instances run on dedicated containers. If one goes down, it doesn't affect others. We monitor and auto-restart."
          />
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <div
            style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }}
            className="mb-24"
          />
          <h2
            className="text-[clamp(1.8rem,4vw,3rem)] leading-[1.1] tracking-[-0.02em] mb-6"
            style={{
              fontFamily: 'var(--font-display), Georgia, serif',
              color: '#E4E8F0',
            }}
          >
            Your team is waiting.
          </h2>
          <div className="flex items-center gap-5">
            <Link
              href="/login"
              className="text-[14px] font-medium px-5 py-2.5 transition-colors"
              style={{
                background: '#C7944A',
                color: '#07080A',
                borderRadius: '6px',
              }}
            >
              Get started
            </Link>
            <span className="text-[13px]" style={{ color: '#3A4456' }}>
              Free for up to 5 members
            </span>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="pb-8 pt-16">
        <div className="max-w-6xl mx-auto px-6 md:px-10 flex items-center justify-between">
          <span className="text-[13px]" style={{ color: '#2A3344' }}>
            ClawTeam
          </span>
          <span className="text-[12px]" style={{ color: '#2A3344' }}>
            Built on OpenClaw
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ─── Feature ─── */

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="text-[15px] font-medium mb-2" style={{ color: '#E4E8F0' }}>
        {title}
      </h3>
      <p className="text-[13px] leading-[1.7]" style={{ color: '#556178' }}>
        {text}
      </p>
    </div>
  );
}

/* ─── FAQ Item ─── */

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h3 className="text-[14px] font-medium mb-1.5" style={{ color: '#8893A7' }}>
        {q}
      </h3>
      <p className="text-[13px] leading-[1.7]" style={{ color: '#556178' }}>
        {a}
      </p>
    </div>
  );
}
