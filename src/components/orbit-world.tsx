"use client";

import { useEffect, useRef, useState } from "react";

type DomeId = "signal" | "tools" | "interrupt" | "recovery" | "core";
type Dome = {
  id: DomeId;
  code: string;
  label: string;
  title: string;
  description: string;
  accent: string;
  glyph: string;
  status: string;
};
type WorldHealth = { status: "CHECKING" | "CONNECTED" | "OFFLINE"; persistence: boolean; toolCount: number; stale: number };

const domes: Dome[] = [
  { id: "signal", code: "01", label: "SIGNAL OBSERVATORY", title: "Hear the shape before the sentence.", description: "A live view of voice energy, partial speech, and the moment a useful signal becomes intent.", accent: "#8cf3ca", glyph: "〰", status: "STREAMING" },
  { id: "tools", code: "02", label: "TOOL FORGE", title: "Five capabilities. One guarded boundary.", description: "Explore how weather, search, calculation, timers, and notes are routed through the same agent state.", accent: "#c8ff76", glyph: "⬡", status: "5 ONLINE" },
  { id: "interrupt", code: "03", label: "INTERRUPT LAB", title: "Stop obsolete work before it returns.", description: "Inspect the cancellation path from barge-in to request fencing and immediate readiness for a new direction.", accent: "#ff7467", glyph: "×", status: "<80MS" },
  { id: "recovery", code: "04", label: "RECOVERY GARDEN", title: "Context survives. Stale intent does not.", description: "See how the conversation keeps its useful memory while committing only the newest verified request.", accent: "#7eddf0", glyph: "◎", status: "CURRENT" },
  { id: "core", code: "05", label: "QUIET CORE", title: "The small system behind the whole field.", description: "A hidden operations room for health, latency, active intent, and the live ORBIT controls.", accent: "#b8a5ff", glyph: "✦", status: "UNLOCKED" },
];

function BuildingStructure({ dome }: { dome: Dome }) {
  const facadeId = `building-facade-${dome.id}`;
  const sideId = `building-side-${dome.id}`;
  const roofId = `building-roof-${dome.id}`;
  const glassId = `building-glass-${dome.id}`;

  const structure = (() => {
    if (dome.id === "signal") return (
      <>
        <g className="building-wing">
          <path className="building-roof" d="M25 91 70 78l39 14-45 14Z" />
          <path className="building-facade" d="M25 91 64 106v23l-39-15Z" />
          <path className="building-side" d="m64 106 45-14v22l-45 15Z" />
          <path className="building-window-strip" d="m33 99 25 9v7l-25-9Zm39 10 28-9v7l-28 9Z" />
        </g>
        <g className="building-main">
          <path className="building-facade" d="M68 48 114 65v62L68 110Z" />
          <path className="building-side" d="m114 65 48-17v62l-48 17Z" />
          <path className="building-roof" d="m68 48 48-16 46 16-48 17Z" />
          <path className="building-glass" d="m76 58 31 11v45l-31-12Zm46 11 31-11v44l-31 12Z" />
          <g className="building-mullions"><path d="M86 62v44m11-40v44m36-44v44m10-47v43M76 77l31 11m-31 4 31 11m15-19 31-11m-31 27 31-11" /></g>
          <path className="building-entrance" d="m100 108 14 5v14l-14-5Z" />
        </g>
        <g className="roof-equipment signal-array">
          <path d="m102 34 24-8 18 6-24 8Z" /><path d="M121 30v17m0-9 15-11" />
          <path className="dish" d="M132 18c10 1 18 7 20 16-10 2-20-2-26-10Z" /><circle cx="140" cy="26" r="2.3" /><path d="M140 26v-11" />
        </g>
      </>
    );

    if (dome.id === "tools") return (
      <>
        <g className="building-main forge-building">
          <path className="building-facade" d="M30 73 105 99v34l-75-27Z" />
          <path className="building-side" d="m105 99 76-27v35l-76 26Z" />
          <path className="building-roof saw-roof" d="m30 73 18-16 18 9 18-17 20 9 18-16 20 9 17-15 22 9v27l-76 27Z" />
          <path className="building-window-strip" d="m40 79 55 20v8L40 87Zm75 22 55-20v8l-55 20Z" />
          <path className="factory-door" d="m47 94 22 8v17l-22-8Zm30 11 18 6v17l-18-6Zm40 7 30-11v20l-30 10Z" />
          <path className="building-service-line" d="m30 95 75 27 76-27" />
        </g>
        <g className="roof-equipment forge-stacks">
          <path d="m50 56 10-4v-23l-10 4Z" /><path d="m50 33 10-4 7 3-10 4Z" />
          <path d="m139 48 10-4V20l-10 4Z" /><path d="m139 24 10-4 7 3-10 4Z" />
          <path className="stack-smoke" d="M59 27c-8-7 4-10-3-18m92 9c-8-7 5-10-2-18" />
        </g>
        <g className="yard-details"><path d="m19 118 29 11 18-7-29-11Zm126 4 28 10 28-10-29-10Z" /><path d="M25 117v7m9-4v7m116-4v7m10-11v8m10-12v8" /></g>
      </>
    );

    if (dome.id === "interrupt") return (
      <>
        <g className="building-wing lab-wing-left">
          <path className="building-facade" d="m22 86 56 20v26l-56-20Z" /><path className="building-side" d="m78 106 32-12v26l-32 12Z" /><path className="building-roof" d="m22 86 33-12 55 20-32 12Z" /><path className="building-window-strip" d="m31 93 38 13v9l-38-14Z" />
        </g>
        <g className="building-wing lab-wing-right">
          <path className="building-facade" d="m109 94 49 17v26l-49-17Z" /><path className="building-side" d="m158 111 39-14v26l-39 14Z" /><path className="building-roof" d="m109 94 39-14 49 17-39 14Z" /><path className="building-window-strip" d="m119 101 30 10v9l-30-11Zm48 11 22-8v9l-22 8Z" />
        </g>
        <g className="building-main interrupt-tower">
          <path className="building-facade" d="m72 49 42 15v61l-42-15Z" /><path className="building-side" d="m114 64 40-15v62l-40 14Z" /><path className="building-roof" d="m72 49 40-14 42 14-40 15Z" /><path className="building-glass" d="m81 59 24 9v43l-24-9Zm42 9 22-8v43l-22 8Z" /><path className="interrupt-sash" d="m72 77 42 15 40-15" /><path className="building-entrance" d="m103 105 11 4v16l-11-4Z" />
        </g>
        <g className="roof-equipment alert-beacon"><path d="m99 39 13-5 14 5-13 5Z" /><path d="M113 34V21" /><circle cx="113" cy="18" r="3" /><path className="beacon-rays" d="m102 18-7-2m29 2 7-3m-18-5V4" /></g>
      </>
    );

    if (dome.id === "recovery") return (
      <>
        <g className="building-main garden-building">
          <path className="building-facade" d="M31 79 101 104v30l-70-25Z" /><path className="building-side" d="m101 104 78-28v31l-78 27Z" /><path className="building-roof green-roof" d="m31 79 78-27 70 24-78 28Z" /><path className="building-glass" d="m40 90 50 18v14l-50-18Zm71 18 57-21v14l-57 20Z" /><path className="building-entrance" d="m91 111 10 4v19l-10-4Z" />
        </g>
        <g className="greenhouse">
          <path className="greenhouse-glass" d="m70 66 39-14 37 13-38 14Z" /><path className="greenhouse-glass" d="m70 66 38 13v25L70 91Zm38 13 38-14v25l-38 14Z" /><path d="M82 62v33m13-38v43m26-42v41m13-37v33M70 78l38 13 38-13" />
        </g>
        <g className="landscape-trees">
          <g transform="translate(24 105)"><path d="M0 18V7" /><circle cy="4" r="7" /><circle cx="5" cy="9" r="5" /></g>
          <g transform="translate(184 103)"><path d="M0 18V6" /><circle cy="3" r="7" /><circle cx="-5" cy="9" r="5" /></g>
          <g transform="translate(164 118) scale(.8)"><path d="M0 18V7" /><circle cy="4" r="7" /></g>
        </g>
      </>
    );

    return (
      <>
        <g className="building-wing core-podium">
          <path className="building-facade" d="m39 97 72 25v18L39 114Z" /><path className="building-side" d="m111 122 70-25v18l-70 25Z" /><path className="building-roof" d="m39 97 70-25 72 25-70 25Z" /><path className="building-window-strip" d="m49 104 51 18v8l-51-18Zm73 18 49-18v8l-49 18Z" />
        </g>
        <g className="building-main core-tower">
          <path className="building-facade" d="m75 36 37 13v73l-37-13Z" /><path className="building-side" d="m112 49 34-12v73l-34 12Z" /><path className="building-roof" d="m75 36 34-12 37 13-34 12Z" /><path className="building-glass" d="m82 45 23 8v59l-23-8Zm37 8 20-7v58l-20 8Z" /><g className="tower-floors"><path d="m82 57 23 8 34-12m-57 17 23 8 34-12M82 83l23 8 34-12m-57 17 23 8 34-12" /></g><path className="building-entrance" d="m101 109 11 4v9l-11-4Z" />
        </g>
        <g className="roof-equipment core-crown"><path d="m91 29 18-6 20 7-18 6Z" /><path d="M110 23V10m-5 2 5-6 5 2" /><circle cx="110" cy="6" r="2.5" /></g>
      </>
    );
  })();

  return (
    <span className="dome-building" aria-hidden="true">
      <svg className={`dome-structure building-structure building-${dome.id}`} viewBox="0 0 220 150">
        <defs>
          <linearGradient id={facadeId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#273b34" /><stop offset=".58" stopColor="#142720" /><stop offset="1" stopColor="#091510" /></linearGradient>
          <linearGradient id={sideId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#172b23" /><stop offset="1" stopColor="#07110d" /></linearGradient>
          <linearGradient id={roofId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={dome.accent} stopOpacity=".38" /><stop offset=".42" stopColor="#273d34" /><stop offset="1" stopColor="#0a1712" /></linearGradient>
          <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dffff1" stopOpacity=".72" /><stop offset=".25" stopColor={dome.accent} stopOpacity=".48" /><stop offset="1" stopColor="#061712" stopOpacity=".92" /></linearGradient>
        </defs>
        <ellipse className="building-ground-shadow" cx="110" cy="136" rx="91" ry="10" />
        <path className="building-site" d="m12 119 98-35 99 35-99 35Z" />
        <path className="building-driveway" d="m88 143 24-22 20 7-16 25Z" />
        <g style={{ "--building-facade": `url(#${facadeId})`, "--building-side": `url(#${sideId})`, "--building-roof": `url(#${roofId})`, "--building-glass": `url(#${glassId})` } as React.CSSProperties}>{structure}</g>
        <g className="site-lights"><path d="M24 119v-12m171 12v-12M64 139v-10m94 9v-10" /><circle cx="24" cy="106" r="1.8" /><circle cx="195" cy="106" r="1.8" /><circle cx="64" cy="128" r="1.8" /><circle cx="158" cy="127" r="1.8" /></g>
        <g className="building-sign"><rect x="96" y="130" width="28" height="9" rx="1.5" /><text x="110" y="136.6">{dome.code}</text></g>
      </svg>
    </span>
  );
}

export default function OrbitWorld({ onLaunchOrbit }: { onLaunchOrbit: () => void }) {
  const worldRef = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);
  const [activeId, setActiveId] = useState<DomeId | null>(null);
  const [previewId, setPreviewId] = useState<DomeId>("signal");
  const [health, setHealth] = useState<WorldHealth>({ status: "CHECKING", persistence: false, toolCount: 0, stale: 0 });
  const activeIndex = domes.findIndex((dome) => dome.id === activeId);
  const activeDome = activeIndex >= 0 ? domes[activeIndex] : null;
  const previewDome = domes.find((dome) => dome.id === previewId) ?? domes[0];

  useEffect(() => {
    let mounted = true;
    void fetch("/api/health", { cache: "no-store" }).then(async (response) => {
      const value = await response.json() as { status?: string; persistence?: { ready?: boolean }; tools?: string[]; stats?: { stale?: number } };
      if (!mounted || !response.ok || value.status !== "ok") throw new Error("Health check failed");
      setHealth({ status: "CONNECTED", persistence: Boolean(value.persistence?.ready), toolCount: value.tools?.length || 0, stale: value.stats?.stale || 0 });
    }).catch(() => { if (mounted) setHealth({ status: "OFFLINE", persistence: false, toolCount: 0, stale: 0 }); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setEntered(true);
    }, { threshold: 0.22 });
    observer.observe(world);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveId(null); };
    window.addEventListener("keydown", onKey);
    document.body.classList.toggle("dome-open", activeId !== null);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("dome-open");
    };
  }, [activeId]);

  function enterWorld() {
    setEntered(true);
    window.requestAnimationFrame(() => worldRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function moveDome(direction: number) {
    const index = activeIndex < 0 ? 0 : (activeIndex + direction + domes.length) % domes.length;
    setActiveId(domes[index].id);
  }

  return (
    <>
      <section className="final-call content-shell world-transition">
        <div className="final-marquee" aria-hidden="true"><span>STAY CURRENT · STAY CURRENT · STAY CURRENT ·</span></div>
        <div className="final-entry-grid">
          <div className="final-entry-copy">
            <div className="section-index light">FIELD ENTRY / 10</div>
            <h2>The interface ends.<br /><em>The system stays alive.</em></h2>
            <p>Enter the working field behind ORBIT—five spaces connected to one live, interruptible conversation.</p>
            <button onClick={enterWorld}>ENTER THE CONTROL FIELD <span>↘</span></button>
          </div>
          <div className="final-system-card">
            <header><span>ORBIT / LIVE SYSTEM</span><b><i /> {health.status === "CONNECTED" ? "ALL PATHS NOMINAL" : health.status}</b></header>
            <div className="final-orbit" aria-hidden="true"><i /><i /><i /><b>O</b><span>REQUEST / 01</span></div>
            <div className="final-system-readout"><span><small>VOICE PATH</small><b>STREAMING</b></span><span><small>FENCE</small><b>ARMED</b></span><span><small>STALE OUTPUT</small><b>00</b></span></div>
          </div>
        </div>
      </section>

      <section className={`orbit-campus ${entered ? "is-entered" : ""}`} ref={worldRef} aria-label="ORBIT interactive field">
        <div className="campus-sky" aria-hidden="true"><i /><i /><i /><span /><span /></div>
        <header className="campus-header">
          <div><span>DATA FORGE / FIELD 11</span><b>ORBIT CONTROL FIELD</b></div>
          <p>Five spaces. One protected request boundary.</p>
          <small><i /> SYSTEM {health.status}</small>
        </header>

        <div className="campus-layout">
          <aside className="campus-legend">
            <span>FIELD DIRECTORY</span>
            {domes.map((dome) => <button className={previewId === dome.id ? "active" : ""} style={{ "--dome-accent": dome.accent } as React.CSSProperties} onMouseEnter={() => setPreviewId(dome.id)} onFocus={() => setPreviewId(dome.id)} onClick={() => setActiveId(dome.id)} key={dome.id}><small>{dome.code}</small><b>{dome.label}</b><i /></button>)}
          </aside>

          <div className="campus-scene">
            <div className="campus-ground" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="campus-core" aria-hidden="true"><i /><b>O</b><span /></div>
            <div className="campus-paths" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            {domes.map((dome) => (
              <button className={`world-dome dome-${dome.id} ${previewId === dome.id ? "is-previewed" : ""}`} style={{ "--dome-accent": dome.accent } as React.CSSProperties} onMouseEnter={() => setPreviewId(dome.id)} onFocus={() => setPreviewId(dome.id)} onClick={() => setActiveId(dome.id)} aria-label={`Enter ${dome.label}`} key={dome.id}>
                <BuildingStructure dome={dome} />
                <span className="dome-label"><small>{dome.code}</small><strong>{dome.label}</strong><em>{dome.status}</em></span>
              </button>
            ))}
          </div>

          <aside className="campus-preview" style={{ "--dome-accent": previewDome.accent } as React.CSSProperties}>
            <header><span>SELECTED SPACE / {previewDome.code}</span><i>{previewDome.glyph}</i></header>
            <small>{previewDome.status}</small>
            <h3>{previewDome.label}</h3>
            <p>{previewDome.description}</p>
            <div><span><small>CONNECTION</small><b>LIVE</b></span><span><small>BOUNDARY</small><b>GUARDED</b></span></div>
            <button onClick={() => setActiveId(previewDome.id)}>ENTER THIS SPACE <span>↗</span></button>
          </aside>
        </div>

        <nav className="campus-map" aria-label="Field map">
          <span>QUICK ACCESS</span>
          {domes.map((dome) => <button style={{ "--dome-accent": dome.accent } as React.CSSProperties} onClick={() => setActiveId(dome.id)} aria-label={`Open ${dome.label}`} key={dome.id}><i />{dome.code}</button>)}
        </nav>
        <div className="campus-help"><span>HOVER TO INSPECT</span><i /> <span>CLICK TO ENTER</span></div>
      </section>

      {activeDome && (
        <div className={`dome-overlay interior-${activeDome.id}`} style={{ "--dome-accent": activeDome.accent } as React.CSSProperties} role="dialog" aria-modal="true" aria-label={activeDome.label}>
          <div className="dome-interior">
            <header>
              <button onClick={() => setActiveId(null)} className="back-world">← BACK TO FIELD</button>
              <span>{activeDome.code} / {activeDome.label}</span>
              <button onClick={() => setActiveId(null)} className="close-dome" aria-label="Close dome">×</button>
            </header>
            <div className="interior-heading"><span>{activeDome.glyph}</span><div><small>{activeDome.status}</small><h2>{activeDome.title}</h2><p>{activeDome.description}</p></div></div>
            <DomeInterior dome={activeDome} health={health} onLaunchOrbit={() => {
              setActiveId(null);
              onLaunchOrbit();
            }} />
            <footer><button onClick={() => moveDome(-1)}>← {domes[(activeIndex - 1 + domes.length) % domes.length].label}</button><span>{String(activeIndex + 1).padStart(2, "0")} / {String(domes.length).padStart(2, "0")}</span><button onClick={() => moveDome(1)}>{domes[(activeIndex + 1) % domes.length].label} →</button></footer>
          </div>
        </div>
      )}
    </>
  );
}

function DomeInterior({ dome, health, onLaunchOrbit }: { dome: Dome; health: WorldHealth; onLaunchOrbit: () => void }) {
  if (dome.id === "signal") return (
    <div className="signal-room">
      <div className="signal-wave" aria-label="Live signal visualization">{Array.from({ length: 48 }, (_, index) => <i style={{ height: `${18 + ((index * 29) % 74)}%` }} key={index} />)}</div>
      <div className="signal-copy"><span>00:00.00 <b>VOICE ACQUIRED</b></span><span>00:00.18 <b>PARTIAL: “check the...”</b></span><span>00:00.32 <b>INTENT CONFIDENCE 94%</b></span></div>
    </div>
  );
  if (dome.id === "tools") return (
    <div className="forge-room">{["WEATHER", "SEARCH", "CALCULATOR", "TIMER", "NOTES"].map((tool, index) => <article key={tool}><span>0{index + 1}</span><i /><h3>{tool}</h3><small>SERVER READY</small></article>)}</div>
  );
  if (dome.id === "interrupt") return (
    <div className="interrupt-room"><div><span>ACTIVE REQUEST</span><b>SEARCH / ARTIFICIAL INTELLIGENCE</b><i /></div><div className="interrupt-cut"><span>USER BARGE-IN</span><strong>&lt;80ms</strong></div><div><span>FENCE COMMITTED</span><b>STALE RESULT BLOCKED</b><i className="blocked" /></div></div>
  );
  if (dome.id === "recovery") return (
    <div className="recovery-room"><div className="context-orbits"><i /><i /><i /><b>LATEST<br />INTENT</b></div><div className="context-stack"><span><small>CONTEXT 01</small><b>Conversation identity preserved</b></span><span><small>CONTEXT 02</small><b>Previous tool result retained</b></span><span className="current"><small>CURRENT</small><b>New direction committed</b></span></div></div>
  );
  return (
    <div className="core-room"><div className="core-status"><span><small>BACKEND</small><b>{health.status}</b></span><span><small>PERSISTENCE</small><b>{health.persistence ? "READY" : "WAITING"}</b></span><span><small>STALE REJECTED</small><b>{health.stale}</b></span><span><small>TOOLS</small><b>{String(health.toolCount).padStart(2, "0")} / 05</b></span></div><div className="core-terminal"><span>&gt; orbit.health()</span><p>{health.status === "CONNECTED" ? <>Signal path nominal.<br />Cancellation fence armed.<br />Persistent memory available.</> : <>Waiting for the ORBIT backend.<br />Open live controls to retry.<br />No false connected state shown.</>}</p><button onClick={onLaunchOrbit}>OPEN LIVE ORBIT ↗</button></div></div>
  );
}
