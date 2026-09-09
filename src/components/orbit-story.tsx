"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import OrbitWorld from "./orbit-world";
import styles from "./orbit-story.module.css";

type IconName = "signal" | "intent" | "action" | "fence" | "recover" | "weather" | "search" | "calculator" | "timer" | "notes" | "arrow";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    signal: <path d="M3 10v4m4-8v12m5-16v20m5-16v12m4-8v4" />,
    intent: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="m17.5 6.5 4-4M18 2h4v4" /></>,
    action: <><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10 9-5M12 12 3 7m9 5v10" /></>,
    fence: <><path d="m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5l8-3Z" /><path d="m9 9 6 6m0-6-6 6" /></>,
    recover: <><path d="M3 10a9 9 0 1 1 2 8M3 3v7h7" /><path d="m8 12 3 3 5-6" /></>,
    weather: <><path d="M7 18a4 4 0 1 1 1-7 5 5 0 0 1 9 2 3 3 0 1 1 1 5H7Z" /><path d="M14 2v2m6 1-2 2m5 3h-2" /></>,
    search: <><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></>,
    calculator: <><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M8 6h8M8 11h1m6 0h1m-8 4h1m6 0h1m-8 4h1m6 0h1" /></>,
    timer: <><circle cx="12" cy="14" r="8" /><path d="M9 2h6m-3 0v4m7 1 2-2m-9 5v5l3 2" /></>,
    notes: <><path d="M13 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8M7 12v5h5L22 7l-5-5L7 12Zm7-7 5 5" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  };
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const flow: { icon: IconName; title: string; copy: string; status: string; sample: string }[] = [
  { icon: "signal", title: "Pick up the signal.", copy: "Voice enters the conversation. The listening state makes every new request visible.", status: "LISTENING", sample: "“What’s the weather in Delhi?”" },
  { icon: "intent", title: "Find the meaning.", copy: "A request becomes a clear intent, routed to the capability that can help.", status: "RESOLVING INTENT", sample: "Intent → weather · Location → Delhi" },
  { icon: "action", title: "Make it happen.", copy: "The selected server tool runs within the active request boundary.", status: "TOOL RUNNING", sample: "Weather tool → request in progress" },
  { icon: "fence", title: "Let the human lead.", copy: "A change of direction cancels active work and blocks outdated results.", status: "REQUEST FENCED", sample: "Previous request → cancelled" },
  { icon: "recover", title: "Keep moving forward.", copy: "The conversation continues. Only the newest request can commit a response.", status: "READY FOR NEXT INTENT", sample: "“Actually, set a ten-second timer.”" },
];

const chapters = [
  { id: "orbit-system", label: "The system" },
  { id: "orbit-interruption", label: "Barge-in" },
  { id: "orbit-toolkit", label: "The toolkit" },
  { id: "orbit-principles", label: "Our principles" },
  { id: "orbit-field", label: "Control field" },
];

function Waveform({ stopped = false }: { stopped?: boolean }) {
  return <div className={`${styles.waveform} ${stopped ? styles.waveStopped : ""}`} aria-hidden="true">{Array.from({ length: 43 }, (_, i) => <i key={i} style={{ "--bar": `${16 + Math.sin(i * 1.9) ** 2 * 65}%`, "--delay": `${-i * 0.13}s` } as CSSProperties} />)}</div>;
}

function Architecture() {
  const [selected, setSelected] = useState(0);
  const stage = flow[selected];
  return (
    <section className={styles.section} id="orbit-system" data-chapter>
      <div className={styles.eyebrow}><span>01 / UNDER THE SURFACE</span><span>BUILT TO STAY IN SYNC</span></div>
      <header className={styles.sectionHeading}><h2>One signal.<br /><em>Everything in sync.</em></h2><p>From the first word to the next idea. Five carefully connected states keep the conversation moving with you.</p></header>
      <div className={styles.architecture}>
        <div className={styles.systemVisual}>
          <div className={styles.diagramHeader}><span><i /> ORBIT ENGINE</span><span>INTERACTIVE SYSTEM MAP ↗</span></div>
          <div className={styles.orbitMap}>
            <svg className={styles.orbitLines} viewBox="0 0 600 390" fill="none" aria-hidden="true"><ellipse cx="300" cy="191" rx="206" ry="145" /><ellipse cx="300" cy="191" rx="150" ry="106" /><path d="M300 46v290M94 191h412" strokeDasharray="3 8" /><path d="M300 64 474 142 408 305H192L126 142 300 64Z" strokeDasharray="3 8" /></svg>
            <div className={styles.orbitCenter}><span className={styles.orbitHalo} /><b>O</b><span>ORBIT</span></div>
            {flow.map((item, index) => <button key={item.icon} className={`${styles.mapNode} ${selected === index ? styles.nodeSelected : ""}`} style={{ "--node-x": [50, 79, 68, 32, 21][index] + "%", "--node-y": [16.4, 36.4, 78.2, 78.2, 36.4][index] + "%" } as CSSProperties} onClick={() => setSelected(index)} aria-label={`Inspect ${item.icon} stage`} aria-pressed={selected === index}><span><Icon name={item.icon} /></span><small>0{index + 1} / {item.icon.toUpperCase()}</small></button>)}
            <span className={styles.mapCoordinate}>28°36′ N / 77°12′ E</span>
          </div>
          <div className={styles.diagramReadout} aria-live="polite"><span><i /> {stage.status}</span><p>{stage.sample}</p></div>
          <div className={styles.diagramFooter}><span>ONE ACTIVE REQUEST</span><span>LATEST INTENT ONLY <Icon name="fence" /></span></div>
        </div>
        <div className={styles.flowList} aria-label="Explore system stages">{flow.map((item, index) => <button className={selected === index ? styles.flowSelected : ""} key={item.icon} aria-pressed={selected === index} onClick={() => setSelected(index)}><span className={styles.flowNumber}>0{index + 1}</span><div><h3>{item.title}</h3><p>{item.copy}</p></div><Icon name={selected === index ? "arrow" : item.icon} /></button>)}</div>
      </div>
      <div className={styles.sectionFootnote}><span><i /> EVERY TRANSITION HAS A BOUNDARY.</span><span>Choose a stage to see what happens.</span></div>
    </section>
  );
}

function InterruptionLab() {
  const [phase, setPhase] = useState<"speaking" | "fenced" | "recovered">("speaking");
  const interrupted = phase !== "speaking";
  return (
    <section id="orbit-interruption" className={styles.interruption} data-chapter>
      <div className={styles.labBackground} aria-hidden="true">↳</div>
      <div className={styles.eyebrow}><span>02 / THE ART OF LISTENING</span><span className={styles.coralDot}>HUMAN CONTROL, ALWAYS</span></div>
      <div className={styles.labGrid}>
        <div className={styles.labCopy}><span className={styles.pill}>BUILT FOR THE “ACTUALLY…”</span><h2>Go ahead.<br /><em>Cut us off.</em></h2><p>Good conversations change direction. ORBIT makes room for that. Interrupt a response, stop the old request, and pick up exactly where you want to.</p><div className={styles.labMetric}><strong>&lt;80<span>ms</span></strong><div>INTERRUPTION TARGET<small>From barge-in to a fenced request.</small></div></div></div>
        <div className={styles.labDemo}>
          <header><span><i /><i /><i /></span><span>TRY THE INTERRUPTION FLOW</span><small>SIMULATION</small></header>
          <div className={styles.conversation}>
            <div className={styles.humanMessage}><small>YOU</small><p>What’s the weather in Delhi?</p></div>
            <div className={`${styles.agentMessage} ${interrupted ? styles.messageCancelled : ""}`}><span className={styles.agentAvatar}>O</span><div><small>ORBIT <span>{interrupted ? "RESPONSE STOPPED" : "SPEAKING"}</span></small><p>Let me check the current weather in Delhi…</p><Waveform stopped={interrupted} /></div></div>
            <div className={styles.labOutcome} role="status">{phase === "speaking" ? <><span className={styles.listeningDot} /> A change of mind is all it takes.</> : phase === "fenced" ? <><Icon name="fence" /><span>Request fenced. Old response blocked.<small>Your next thought has the floor.</small></span></> : <><Icon name="recover" /><span>“Actually, set a ten-second timer.”<small>New intent accepted. Conversation recovered.</small></span></>}</div>
          </div>
          <button className={`${styles.interruptButton} ${interrupted ? styles.recoverButton : ""}`} onClick={() => setPhase(phase === "speaking" ? "fenced" : phase === "fenced" ? "recovered" : "speaking")}><Icon name={phase === "speaking" ? "fence" : "recover"} />{phase === "speaking" ? "Interrupt this response" : phase === "fenced" ? "Continue with a new intent" : "Replay the simulation"}<Icon name="arrow" /></button>
          <footer><span className={interrupted ? styles.doneStep : ""}>01 <b>STOP AUDIO</b></span><span className={interrupted ? styles.doneStep : ""}>02 <b>FENCE REQUEST</b></span><span className={phase === "recovered" ? styles.doneStep : ""}>03 <b>RECOVER</b></span></footer>
        </div>
      </div>
    </section>
  );
}

const tools = [
  { id: "WEATHER", icon: "weather", title: "A little clarity, outside.", copy: "Current conditions, wherever your day takes you.", query: "Check the weather in Delhi.", label: "Weather", tag: "REAL-WORLD CONTEXT" },
  { id: "SEARCH", icon: "search", title: "Follow your curiosity.", copy: "Find an answer. Keep the source in sight.", query: "Search for artificial intelligence.", label: "Search", tag: "ANSWERS WITH SOURCES" },
  { id: "CALCULATOR", icon: "calculator", title: "Think out loud.", copy: "Leave the numbers to ORBIT.", query: "Calculate 24 * (8 + 2).", label: "Calculator", tag: "A LITTLE LESS MENTAL MATH" },
  { id: "TIMER", icon: "timer", title: "Make time.", copy: "A countdown, one request away.", query: "Set a timer for 10 seconds.", label: "Timer", tag: "STAY IN YOUR FLOW" },
  { id: "NOTES", icon: "notes", title: "Keep that thought.", copy: "Save an idea before it slips away.", query: "Remember to review the ORBIT demo.", label: "Notes", tag: "YOUR IDEAS, REMEMBERED" },
] as const;

type ToolResult = { ok?: boolean; answer?: string; error?: string; elapsedMs?: number; meta?: string; timerSeconds?: number; note?: string };

function ToolPlayground() {
  const [selected, setSelected] = useState(2);
  const [query, setQuery] = useState<string>(tools[2].query);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { controllerRef.current?.abort(); if (timerRef.current) clearInterval(timerRef.current); }, []);

  function selectTool(index: number) {
    controllerRef.current?.abort();
    setLoading(false); setSelected(index); setQuery(tools[index].query); setResult(null);
  }

  async function runTool() {
    if (!query.trim()) return;
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    setLoading(true); setResult(null);
    try {
      const response = await fetch("/api/orbit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool: tools[selected].id, query: query.trim() }), signal: controller.signal });
      const data = await response.json() as ToolResult;
      if (controller.signal.aborted) return;
      if (!response.ok || !data.ok) throw new Error(data.error || "The tool is unavailable. Please try again.");
      if (data.note) {
        try {
          let previous: unknown;
          try { previous = JSON.parse(localStorage.getItem("orbit-notes") || "[]"); } catch { previous = []; }
          const notes = Array.isArray(previous) ? previous.filter((note): note is string => typeof note === "string") : [];
          localStorage.setItem("orbit-notes", JSON.stringify([data.note, ...notes].slice(0, 8)));
        } catch { throw new Error("This browser could not save your note. Allow local storage and try again."); }
      }
      if (data.timerSeconds) {
        if (timerRef.current) clearInterval(timerRef.current);
        const end = Date.now() + data.timerSeconds * 1000;
        setRemaining(data.timerSeconds);
        timerRef.current = setInterval(() => {
          const seconds = Math.max(0, Math.ceil((end - Date.now()) / 1000));
          setRemaining(seconds);
          if (seconds === 0 && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        }, 250);
      }
      setResult(data);
    } catch (error) { if (!controller.signal.aborted) setResult({ ok: false, error: error instanceof Error ? error.message : "Something went wrong. Try again." }); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }

  return (
    <section id="orbit-toolkit" className={styles.section} data-chapter>
      <div className={styles.eyebrow}><span>03 / A SMALL, CAPABLE TOOLKIT</span><span>FIVE WAYS TO MOVE THINGS FORWARD</span></div>
      <header className={styles.sectionHeading}><h2>Less asking.<br /><em>More happening.</em></h2><p>A useful answer. A quick calculation. An idea saved. Everyday capabilities, connected through one conversation.</p></header>
      <div className={styles.toolGrid}>{tools.map((tool, index) => <button key={tool.id} aria-pressed={selected === index} className={`${styles.toolCard} ${styles[`tool${index}`]} ${selected === index ? styles.toolSelected : ""}`} onClick={() => selectTool(index)}>
        <div className={styles.toolTop}><span><Icon name={tool.icon} />{tool.label}</span><span className={styles.toolArrow}>↗</span></div>
        <div className={styles.toolArt} aria-hidden="true">{index === 0 ? <div className={styles.weatherArt}><i className={styles.sun} /><i className={styles.cloud} /><span>DELHI, IN <small>YOUR DAY, IN FOCUS</small></span></div> : index === 1 ? <div className={styles.searchArt}><div><Icon name="search" /><span>What are you curious about?</span><b>↵</b></div><i /><i /><small>DISCOVER. VERIFY. UNDERSTAND.</small></div> : index === 2 ? <div className={styles.mathArt}>24 <span>×</span> (8 + 2)<b>= 240<span>↗</span></b></div> : index === 3 ? <div className={styles.timerArt}><span /><b>00:10</b><small>MAKE EVERY SECOND COUNT</small></div> : <div className={styles.noteArt}><i /><span>That next big idea.</span><small>Keep it close.</small><b>↗</b></div>}</div>
        <div className={styles.toolCopy}><small>{tool.tag}</small><h3>{tool.title}</h3><p>{tool.copy}</p></div>
        <span className={styles.toolBottom}>{selected === index ? "SELECTED · TRY BELOW" : "EXPLORE CAPABILITY"}<Icon name="arrow" /></span>
      </button>)}</div>
      <div className={styles.playground}>
        <div className={styles.playgroundLabel}><span><i /> YOUR TURN</span><h3>Take {tools[selected].label.toLowerCase()} for a spin.</h3><p>Real tools. Real results. Right here.</p></div>
        <div className={styles.playgroundControls}><form onSubmit={(event) => { event.preventDefault(); void runTool(); }}><label htmlFor="orbit-tool-query">{tools[selected].label} instruction</label><div className={styles.commandInput}><Icon name={tools[selected].icon} /><input id="orbit-tool-query" ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tools[selected].query} required maxLength={500} /><button type="submit" disabled={loading || !query.trim()} aria-label={`Run ${tools[selected].label.toLowerCase()} tool`}>{loading ? <span className={styles.spinner} /> : <Icon name="arrow" />}</button></div></form>
          <div className={styles.toolResult} aria-live="polite" aria-busy={loading}>{loading ? <span>Working on your request… <button onClick={() => { controllerRef.current?.abort(); setLoading(false); setResult({ error: "Request cancelled. Ready for your next instruction." }); }}>Cancel</button></span> : result ? <><span className={result.ok ? styles.resultSuccess : styles.resultError}>{result.ok ? "↳ ORBIT" : "↳ REQUEST UPDATE"}{result.ok && <small>{result.elapsedMs} ms · server time</small>}</span><p>{result.answer || result.error}</p>{result.meta?.startsWith("https://") && <a href={result.meta} target="_blank" rel="noreferrer">Read source ↗</a>}</> : <span>Choose a tool above, then send an instruction. <span aria-hidden="true">↵</span></span>}</div>
          {remaining !== null && <div className={styles.timerStatus} role="status"><Icon name="timer" />{remaining > 0 ? `Timer running · ${remaining}s remaining` : "Your timer is complete."}<button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; setRemaining(null); }}>{remaining > 0 ? "Stop" : "Dismiss"}</button></div>}
        </div>
      </div>
    </section>
  );
}

function Principles() {
  return <section id="orbit-principles" className={`${styles.section} ${styles.principles}`} data-chapter>
    <div className={styles.eyebrow}><span>04 / WHAT WE BELIEVE</span><span>DESIGNED AROUND YOU</span></div>
    <div className={styles.principlesGrid}><div><h2>Technology<br />that knows<br /><em>when to listen.</em></h2><div className={styles.principleSignature}><span>O</span><p>One conversation.<br /><b>Always in the present.</b></p></div></div>
      <div className={styles.principleList}>{[
        { title: "Stay continuous.", icon: "signal" as const, tag: "THE SIGNAL NEVER FREEZES", copy: "Conversation is a flow of ideas. The interface should make space for the next thought, even before the current one ends." },
        { title: "Stay interruptible.", icon: "fence" as const, tag: "CONTROL STAYS HUMAN", copy: "You set the direction. Every active request can be stopped, so changing your mind always feels natural." },
        { title: "Stay current.", icon: "recover" as const, tag: "ONLY THE LATEST INTENT SPEAKS", copy: "Old work should never get the last word. A protected request boundary keeps each response tied to what matters now." },
      ].map((item, index) => <article key={item.title}><div><span>0{index + 1}</span><Icon name={item.icon} /></div><small>{item.tag}</small><h3>{item.title}</h3><p>{item.copy}</p></article>)}</div>
    </div>
  </section>;
}

export default function OrbitStory({ onLaunch }: { onLaunch: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeChapter, setActiveChapter] = useState(chapters[0].id);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = root.querySelectorAll<HTMLElement>("[data-chapter]");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add(styles.revealed); setActiveChapter(entry.target.id); } });
    }, { rootMargin: "-12% 0px -28% 0px", threshold: 0 });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return <div className={styles.story} ref={rootRef}>
    <nav className={styles.chapterNav} aria-label="Explore ORBIT"><a className={styles.navBrand} href="#orbit-system"><span>O</span><b>THE ORBIT SYSTEM</b></a><div>{chapters.map((chapter, index) => <a href={`#${chapter.id}`} key={chapter.id} aria-current={activeChapter === chapter.id ? "location" : undefined}><small>0{index + 1}</small>{chapter.label}</a>)}</div><button onClick={onLaunch}>Try ORBIT <span>↗</span></button></nav>
    <Architecture />
    <InterruptionLab />
    <ToolPlayground />
    <Principles />
    <div id="orbit-field" className={styles.field} data-chapter><div className={styles.fieldLabel}><span>05 / STEP INSIDE THE SYSTEM</span><span>EXPLORE THE INTERACTIVE FIELD ↓</span></div><OrbitWorld onLaunchOrbit={onLaunch} /></div>
    <footer className={styles.footer}><div className={styles.footerTop}><div><span className={styles.eyebrow}>DATA FORGE / ORBIT</span><h2>Good conversations<br />don’t stand still.</h2></div><button onClick={onLaunch}>Let’s start one.<span>↗</span></button></div><div className={styles.footerWordmark} aria-hidden="true">ORBIT<span>®</span></div><div className={styles.footerBottom}><span>A LITTLE MORE HUMAN. ALWAYS CURRENT.</span><span>DESIGNED FOR THE NEXT CONVERSATION.</span><span>DATA FORGE © 2026</span></div></footer>
  </div>;
}
