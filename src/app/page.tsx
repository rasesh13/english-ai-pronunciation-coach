"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import OrbitWorld from "@/components/orbit-world";

type OrbitState = "IDLE" | "LISTENING" | "THINKING" | "ACTING" | "SPEAKING" | "INTERRUPTED" | "RECOVERING" | "COMPLETE";
type Particle = { u: number; v: number; seed: number; size: number };
type Vector3 = [number, number, number];
type LogEvent = { label: string; time: string; tone: "normal" | "live" | "warning" };
type OrbitNote = { id: string; content: string; createdAt: string };
type OrbitTimer = { id: string; durationSeconds: number; endsAt: string; status: "active" | "completed" | "cancelled"; createdAt: string };
type OrbitRun = { id: string; tool: string; query: string; answer?: string; error?: string; elapsedMs: number; status: "success" | "failed" | "cancelled" | "stale"; createdAt: string };
type RecognitionResult = { results: ArrayLike<{ 0: { transcript: string } }> };
type RecognitionEngine = { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; onresult: ((event: RecognitionResult) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
type RecognitionConstructor = new () => RecognitionEngine;
type PracticeItem = { id: string; category: string; phrase: string; focus: string; ipa: string; tip: string };
type PronunciationIssue = { word: string; heardAs: string; category: string; tip: string };
type PronunciationAttempt = { id: string; targetPhrase: string; transcript: string; category: string; score: number; contentScore: number; deliveryScore: number; durationMs: number; source: string; issues: PronunciationIssue[]; summary: string; improvement: number; createdAt: string };
type LearnerMistake = { id: string; word: string; category: string; heardAs: string; tip: string; count: number; lastSeenAt: string };
type LearnerState = { attempts: PronunciationAttempt[]; mistakes: LearnerMistake[]; stats: { attempts: number; recurringMistakes: number; bestScore: number; averageScore: number } };
type EvaluationResponse = { ok?: boolean; evaluation?: PronunciationAttempt & { correction: string; focus: string; phoneticCue: string; coachingTip: string }; state?: LearnerState; providers?: { transcription: string; rime: boolean }; detail?: string };

declare global { interface Window { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor } }

const stages = [
  { code: "00", short: "SIGNAL", eyebrow: "REALTIME VOICE / 00", title: <>Voice is not<br />a command line.</>, note: "It is a living signal—continuous, interruptible, and always moving." },
  { code: "01", short: "INTENT", eyebrow: "SIGNAL ACQUISITION / 01", title: <>Before the words,<br /><em>there is intent.</em></>, note: "ORBIT listens to meaning while you speak, not after you finish." },
  { code: "02", short: "ACTION", eyebrow: "AGENT NETWORK / 02", title: <>Intent becomes<br /><em>action.</em></>, note: "Tools activate inside one synchronized realtime field." },
  { code: "03", short: "INTERRUPT", eyebrow: "BARGE-IN CONTROL / 03", title: <>Change your mind.<br /><em>Mid-sentence.</em></>, note: "Obsolete speech stops. Stale tool results are fenced before they can return." },
  { code: "04", short: "RECOVER", eyebrow: "CONTEXT RECOVERY / 04", title: <>The conversation<br /><em>keeps moving.</em></>, note: "ORBIT preserves context, follows the new direction, and answers only the latest intent." },
];

const toolNames = ["VOWELS", "STRESS", "RHYTHM", "NAMES", "NUMBERS"];
const toolExamples = ["Thirty-three thoughtful thinkers.", "I would like to develop a comfortable routine.", "Could you schedule the meeting for Thursday?", "Saoirse and Joaquin joined the presentation.", "The total is thirteen thousand three hundred thirty-three."];
function inferTool(query: string, fallback: number) { const value = query.toLowerCase(); if (/number|\d|percent|total|thirteen|thirty/.test(value)) return 4; if (/saoirse|joaquin|nguyen|siobhan|hermione|worcestershire|entrepreneur/.test(value)) return 3; if (/schedule|meeting|want to|should have|morning|rhythm/.test(value)) return 2; if (/develop|comfortable|economic|opportunity|preparation|photograph|stress/.test(value)) return 1; if (/thought|ship|green|sheet|seat|vowel|thirty-three/.test(value)) return 0; return fallback; }
const stateCopy: Record<OrbitState, string> = {
  IDLE: "READY", LISTENING: "LISTENING", THINKING: "RESOLVING INTENT", ACTING: "TOOL RUNNING", SPEAKING: "SPEAKING", INTERRUPTED: "REQUEST FENCED", RECOVERING: "RECOVERING", COMPLETE: "COMPLETE",
};

export default function Home() {
  const [progress, setProgress] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [state, setState] = useState<OrbitState>("IDLE");
  const [soundOn, setSoundOn] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [command, setCommand] = useState(toolExamples[0]);
  const [response, setResponse] = useState("Choose a phrase, listen to the model, then record your attempt.");
  const [resultMeta, setResultMeta] = useState("");
  const [activeTool, setActiveTool] = useState(0);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [metrics, setMetrics] = useState({ audio: "--", interrupt: "--", cancelled: "0" });
  const [backendStatus, setBackendStatus] = useState<"READY" | "CONNECTED" | "OFFLINE">("READY");
  const [isListening, setIsListening] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [notes, setNotes] = useState<OrbitNote[]>([]);
  const [history, setHistory] = useState<OrbitRun[]>([]);
  const [activeTimer, setActiveTimer] = useState<OrbitTimer | null>(null);
  const [voiceConfigured, setVoiceConfigured] = useState(false);
  const [voiceEvidence, setVoiceEvidence] = useState("");
  const [whisperConfigured, setWhisperConfigured] = useState(false);
  const [catalog, setCatalog] = useState<PracticeItem[]>([]);
  const [learnerState, setLearnerState] = useState<LearnerState>({ attempts: [], mistakes: [], stats: { attempts: 0, recurringMistakes: 0, bestScore: 0, averageScore: 0 } });
  const targetProgressRef = useRef(0);
  const progressRef = useRef(0);
  const requestRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const recognitionRef = useRef<RecognitionEngine | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef("");
  const sessionIdRef = useRef("");
  const backendRequestRef = useRef("");
  const soundOnRef = useRef(soundOn);
  const voiceConfiguredRef = useRef(voiceConfigured);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef("");
  const recordingStartedRef = useRef(0);
  const discardRecordingRef = useRef(false);
  const journeyRef = useRef<HTMLDivElement>(null);
  const scrollSnapRef = useRef<number | null>(null);
  const ticks = useMemo(() => Array.from({ length: 49 }, (_, index) => index), []);

  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  useEffect(() => { voiceConfiguredRef.current = voiceConfigured; }, [voiceConfigured]);

  useEffect(() => {
    let active = true;
    const connect = async () => {
      try {
        const sessionId = ensureSession();
        const [healthResponse, catalogResponse, stateResponse] = await Promise.all([
          fetch("/api/english/health", { cache: "no-store" }),
          fetch("/api/english/catalog", { cache: "no-store" }),
          fetch(`/api/english/state?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }),
        ]);
        const health = await healthResponse.json() as { status?: string; providers?: { whisper?: boolean; rime?: boolean } };
        const practice = await catalogResponse.json() as { items?: PracticeItem[] };
        const result = await stateResponse.json() as { state?: LearnerState };
        if (!active || !healthResponse.ok || !catalogResponse.ok || !stateResponse.ok || health.status !== "ok" || !result.state) throw new Error("Backend unavailable");
        setBackendStatus("CONNECTED");
        setVoiceConfigured(Boolean(health.providers?.rime));
        setWhisperConfigured(Boolean(health.providers?.whisper));
        setCatalog(practice.items || []);
        applyLearnerState(result.state);
      } catch {
        if (active) setBackendStatus("OFFLINE");
      }
    };
    void connect();
    return () => { active = false; };
    // The backend bootstrap is intentionally one-shot for this browser session.
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      const requestedStage = ["ArrowDown", "ArrowRight", "PageDown"].includes(event.key) ? Math.min(4, activeStage + 1) : ["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key) ? Math.max(0, activeStage - 1) : null;
      if (requestedStage !== null) { const value = requestedStage / 4; targetProgressRef.current = value; progressRef.current = value; setProgress(value); setActiveStage(requestedStage); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeStage]);

  useEffect(() => () => {
    controllerRef.current?.abort();
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (timerIntervalRef.current !== null) window.clearInterval(timerIntervalRef.current);
    if (scrollSnapRef.current !== null) window.clearTimeout(scrollSnapRef.current);
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    const syncJourney = () => {
      const journey = journeyRef.current;
      if (!journey) return;
      const travel = Math.max(1, journey.offsetHeight - window.innerHeight);
      const value = Math.min(1, Math.max(0, (window.scrollY - journey.offsetTop) / travel));
      targetProgressRef.current = value;
      progressRef.current = value;
      setProgress(value);
      setActiveStage(Math.min(4, Math.max(0, Math.round(value * 4))));
      if (scrollSnapRef.current !== null) window.clearTimeout(scrollSnapRef.current);
      if (!menuOpen && value > 0.015 && value < 0.985) {
        scrollSnapRef.current = window.setTimeout(() => {
          const nearest = Math.round(value * 4) / 4;
          window.scrollTo({ top: journey.offsetTop + nearest * travel, behavior: "smooth" });
        }, 180);
      }
    };
    syncJourney();
    window.addEventListener("scroll", syncJourney, { passive: true });
    window.addEventListener("resize", syncJourney);
    return () => {
      window.removeEventListener("scroll", syncJourney);
      window.removeEventListener("resize", syncJourney);
      if (scrollSnapRef.current !== null) window.clearTimeout(scrollSnapRef.current);
      scrollSnapRef.current = null;
    };
  }, [menuOpen]);

  function ensureSession() {
    if (sessionIdRef.current) return sessionIdRef.current;
    const stored = window.localStorage.getItem("english-ai-session-id");
    sessionIdRef.current = stored || crypto.randomUUID();
    window.localStorage.setItem("english-ai-session-id", sessionIdRef.current);
    return sessionIdRef.current;
  }
  function stopAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = "";
    window.speechSynthesis?.cancel();
  }
  function clearRun() {
    requestRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    recognitionRef.current?.stop();
    discardRecordingRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setIsListening(false);
    stopAudio();
    backendRequestRef.current = "";
  }
  function pushEvent(label: string, tone: LogEvent["tone"] = "normal", time = "NOW") { setEvents((current) => [...current, { label, tone, time }].slice(-5)); }
  function browserSpeak(text: string, speed: "slow" | "normal") {
    return new Promise<void>((resolve, reject) => {
      if (!soundOnRef.current || !("speechSynthesis" in window)) { resolve(); return; }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = speed === "slow" ? 0.7 : 1;
      utterance.pitch = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error("Browser voice playback failed."));
      window.speechSynthesis.speak(utterance);
    });
  }
  async function speak(text: string, speed: "slow" | "normal", signal?: AbortSignal) {
    if (!soundOnRef.current || signal?.aborted) return;
    stopAudio();
    if (voiceConfiguredRef.current) {
      try {
        const response = await fetch("/api/english/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, speed }), signal });
        if (!response.ok) throw new Error("Voice provider unavailable");
        const provider = response.headers.get("x-voice-provider");
        const model = response.headers.get("x-rime-model");
        const speaker = response.headers.get("x-rime-speaker");
        if (provider === "Rime" && model && speaker) setVoiceEvidence(`${provider.toUpperCase()} · ${model.toUpperCase()} · ${speaker.toUpperCase()}`);
        const blob = await response.blob();
        if (signal?.aborted || !soundOnRef.current) return;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audioUrlRef.current = url;
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => { if (audioUrlRef.current === url) { URL.revokeObjectURL(url); audioUrlRef.current = ""; audioRef.current = null; } resolve(); };
          audio.onerror = () => reject(new Error("Rime audio playback failed."));
          void audio.play().catch(reject);
        });
        return;
      } catch {
        if (signal?.aborted) return;
      }
    }
    await browserSpeak(text, speed).catch(() => undefined);
  }
  async function playCorrection(text: string, signal?: AbortSignal) {
    setState("SPEAKING");
    pushEvent("CORRECTION PLAYING · 0.7×", "live");
    await speak(text, "slow", signal);
    if (signal?.aborted) return;
    pushEvent("CORRECTION PLAYING · 1.0×", "live");
    await speak(text, "normal", signal);
  }
  function applyLearnerState(next: LearnerState) {
    setLearnerState(next);
    setNotes(next.mistakes.map((mistake) => ({ id: mistake.id, content: `${mistake.word} → ${mistake.heardAs} · ${mistake.count}×`, createdAt: mistake.lastSeenAt })));
    setHistory(next.attempts.map((attempt) => ({ id: attempt.id, tool: attempt.category, query: attempt.targetPhrase, answer: attempt.transcript, elapsedMs: attempt.durationMs, status: "success", createdAt: attempt.createdAt })));
    setMetrics((value) => ({ ...value, cancelled: String(next.stats.recurringMistakes) }));
    setActiveTimer(null);
    setTimerRemaining(0);
  }
  async function deleteResource(resource: "note" | "history", id?: string) {
    try {
      const response = await fetch("/api/english/state", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: ensureSession(), resource: resource === "note" ? "mistake" : "attempts", id }) });
      const value = await response.json() as { state?: LearnerState };
      if (value.state) applyLearnerState(value.state);
    } catch { setBackendStatus("OFFLINE"); }
  }
  async function updateTimer(_id?: string, _action?: "complete" | "cancel") { void _id; void _action; setActiveTimer(null); setTimerRemaining(0); }
  async function runExperience(query = command, tool = activeTool) {
    clearRun();
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setCommand(query);
    setActiveTool(tool);
    setMenuOpen(false);
    setEvents([{ label: "TARGET PHRASE READY", time: "NOW", tone: "live" }]);
    setResponse(`Listen to the model for “${query}”, then use the microphone and repeat it.`);
    setResultMeta(`${toolNames[tool]} · SLOW 0.7× → NATURAL 1.0×`);
    try {
      await playCorrection(query, controller.signal);
      if (requestRef.current !== requestId) return;
      setState("COMPLETE");
      setMenuOpen(true);
      pushEvent("MODEL COMPLETE · YOUR TURN", "live", "READY");
    } catch (error) {
      if (controller.signal.aborted || requestRef.current !== requestId) return;
      setResponse(error instanceof Error ? error.message : "The correction could not be played."); setState("COMPLETE"); pushEvent("VOICE ERROR", "warning", "ERROR");
    }
  }
  async function evaluateAttempt(audio: Blob, transcript: string, durationMs: number) {
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setState("THINKING");
    pushEvent("WHISPER TRANSCRIPTION", "live");
    const startedAt = performance.now();
    try {
      const body = new FormData();
      body.set("sessionId", ensureSession());
      body.set("targetPhrase", command.trim());
      body.set("transcript", transcript);
      body.set("durationMs", String(durationMs));
      if (audio.size > 0) body.set("audio", audio, "attempt.webm");
      const serverResponse = await fetch("/api/english/evaluate", { method: "POST", body, signal: controller.signal });
      const result = await serverResponse.json() as EvaluationResponse;
      if (requestRef.current !== requestId) return;
      if (!serverResponse.ok || !result.ok || !result.evaluation) throw new Error(result.detail || "The attempt could not be evaluated.");
      setBackendStatus("CONNECTED");
      if (result.state) applyLearnerState(result.state);
      const evaluation = result.evaluation;
      const issue = evaluation.issues[0];
      const improvement = evaluation.improvement > 0 ? ` · +${evaluation.improvement} improvement` : evaluation.improvement < 0 ? ` · ${evaluation.improvement} change` : "";
      setResponse(`${evaluation.score}/100 — ${evaluation.summary}${improvement}`);
      setResultMeta(`HEARD: “${evaluation.transcript}” · CONTENT ${evaluation.contentScore} · DELIVERY ${evaluation.deliveryScore}${issue ? ` · ${issue.tip}` : ""}`);
      setMetrics((value) => ({ ...value, audio: `${Math.round(performance.now() - startedAt)}ms` }));
      pushEvent(`${result.providers?.transcription === "whisper-1" ? "WHISPER" : "BROWSER"} TRANSCRIPT VERIFIED`, "live");
      await playCorrection(evaluation.correction, controller.signal);
      if (requestRef.current !== requestId) return;
      setState("COMPLETE");
      goToStage(4);
      setMenuOpen(true);
      pushEvent("TRY AGAIN · COMPARISON ARMED", "live", "READY");
    } catch (error) {
      if (controller.signal.aborted || requestRef.current !== requestId) return;
      setResponse(error instanceof Error ? error.message : "The attempt could not be evaluated.");
      setResultMeta("");
      setState("COMPLETE");
      setMenuOpen(true);
      pushEvent("EVALUATION ERROR", "warning", "ERROR");
    }
  }
  function stopListening() {
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }
  async function startListening() {
    if (isListening) { stopListening(); return; }
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setMenuOpen(true); setResponse("Microphone recording is not supported in this browser."); return; }
    if (!Constructor && !whisperConfigured) { setMenuOpen(true); setResponse("Speech recognition is unavailable. Configure OPENAI_API_KEY or STT_API_KEY to enable Whisper."); return; }
    try {
      clearRun();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      mediaStreamRef.current = stream;
      discardRecordingRef.current = false;
      audioChunksRef.current = [];
      transcriptRef.current = "";
      recordingStartedRef.current = performance.now();
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) audioChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const durationMs = Math.round(performance.now() - recordingStartedRef.current);
        const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsListening(false);
        if (discardRecordingRef.current) { discardRecordingRef.current = false; return; }
        void evaluateAttempt(audio, transcriptRef.current, durationMs);
      };
      recorder.start(250);
      setIsListening(true);
      setState("LISTENING");
      setResponse(`Recording “${command}”. Speak clearly${Constructor ? " — recording stops when you finish." : " — press the microphone again to stop."}`);
      setResultMeta("TARGET ACCENT · EN-US");
      pushEvent("VOICE ATTEMPT RECORDING", "live", "NOW");
      if (Constructor) {
        const recognition = new Constructor();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";
        recognition.onresult = (event) => { transcriptRef.current = event.results[0]?.[0]?.transcript?.trim() || ""; };
        recognition.onerror = () => { if (!whisperConfigured) transcriptRef.current = ""; };
        recognition.onend = () => { recognitionRef.current = null; if (recorder.state === "recording") window.setTimeout(() => recorder.stop(), 200); };
        recognition.start();
      }
    } catch {
      setIsListening(false);
      setMenuOpen(true);
      setResponse("Microphone permission is required to evaluate pronunciation.");
      setState("COMPLETE");
    }
  }
  function interrupt() {
    if (["IDLE", "COMPLETE"].includes(state)) { void runExperience(command); return; }
    clearRun(); setState("INTERRUPTED"); goToStage(3); setResponse("Attempt cancelled. EnglishAI is ready when you are."); setMetrics((value) => ({ ...value, interrupt: "<80ms" })); pushEvent("ATTEMPT CANCELLED", "warning");
  }
  function reset() { clearRun(); setState("IDLE"); setResponse("Choose a phrase, listen to the model, then record your attempt."); setResultMeta(""); setCommand(toolExamples[0]); setActiveTool(0); setMetrics((value) => ({ audio: "--", interrupt: "--", cancelled: value.cancelled })); setEvents([]); setMenuOpen(false); goToStage(0); }
  function setJourney(next: number) { const value = Math.min(1, Math.max(0, next)); targetProgressRef.current = value; progressRef.current = value; setProgress(value); setActiveStage(Math.min(4, Math.max(0, Math.round(value * 4)))); }
  function goToStage(index: number) {
    const next = Math.min(4, Math.max(0, index));
    setJourney(next / 4);
    const journey = journeyRef.current;
    if (journey) {
      const travel = Math.max(1, journey.offsetHeight - window.innerHeight);
      window.scrollTo({ top: journey.offsetTop + (next / 4) * travel, behavior: "smooth" });
    }
  }
  function phraseForCategory(index: number) { return catalog.find((item) => item.category === toolNames[index])?.phrase || toolExamples[index]; }

  const stageProgress = progress * 4;
  return (
    <main className="orbit-page">
      <div className="orbit-journey" ref={journeyRef}>
      <section className={`zero-orbit scene-${activeStage} state-${state.toLowerCase()} has-entered`}>
      <svg className="svg-filters" aria-hidden="true"><defs><filter id="liquid-edge" x="-35%" y="-20%" width="170%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.009 0.026" numOctaves="2" seed="17" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="48" xChannelSelector="R" yChannelSelector="B" /><feGaussianBlur stdDeviation="1.8" /></filter></defs></svg>
      <div className="world-frame" aria-hidden="true">
        <div className="world-light" />
        <OrbitCanvas progressRef={progressRef} state={state} />
        <div className="world-type"><span>DATA FORGE</span><b>{stages[activeStage].short}</b><small>ORBIT / {stages[activeStage].code}</small></div>
        <div className="orbit-relic"><i /><i /><i /><i /><i /></div>
        <div className="paper-noise" />
      </div>
      <div className="interface">
        <button className="glass-circle audio-toggle" onClick={() => { setSoundOn((value) => !value); stopAudio(); }} aria-label="Toggle audio" aria-pressed={soundOn}><span className={soundOn ? "wave-on" : ""}>⌁</span></button>
        <div className="stage-ruler" aria-label="Experience timeline"><div className="ruler-labels">{stages.map((stage, index) => <button className={activeStage === index ? "active" : ""} onClick={() => goToStage(index)} key={stage.code}>{index * 25 - 100} OZ</button>)}</div><div className="ruler-cursor" /><div className="ruler-track" style={{ transform: `translateX(${-progress * 52}%)` }}>{ticks.map((tick) => <i className={tick % 12 === 0 ? "major" : ""} key={tick} />)}</div><b>{activeStage * 25 - 100} OZ / {stages[activeStage].short}</b></div>
        <div className={`glass-pill latency-badge backend-${backendStatus.toLowerCase()}`}><i>✦</i> {timerRemaining > 0 ? `${timerRemaining}s` : metrics.audio === "--" ? backendStatus : metrics.audio}</div>
        <div className="stage-deck">{stages.map((stage, index) => { const distance = index - stageProgress; const offset = Math.abs(distance); return <section className={`story-stage ${offset < 0.55 ? "active" : ""}`} style={{ transform: `translate3d(${distance * 45}vw, calc(-50% + ${distance * 8}vh), ${distance * -220}px) rotateY(${distance * -18}deg)`, opacity: Math.max(0, 1 - offset), filter: `blur(${offset * 8}px)` }} key={stage.code} aria-hidden={offset >= 0.55}><span>{stage.eyebrow}</span><h1>{stage.title}</h1><p>{stage.note}</p>{index === 2 && <div className="mini-tools">{toolNames.map((tool, toolIndex) => <button className={activeTool === toolIndex && state === "SPEAKING" ? "active" : ""} onClick={() => void runExperience(phraseForCategory(toolIndex), toolIndex)} key={tool}><i />{tool}<small>{activeTool === toolIndex && state === "SPEAKING" ? "COACHING" : "READY"}</small></button>)}</div>}{index === 3 && <button className="stage-action danger" onClick={interrupt}>{state === "INTERRUPTED" ? "ATTEMPT STOPPED" : "STOP ATTEMPT"}</button>}{index === 4 && <div className="metric-strip"><span><b>{metrics.audio}</b>EVALUATION</span><span><b>{learnerState.stats.bestScore}</b>BEST SCORE</span><span><b>{metrics.cancelled}</b>RECURRING ISSUES</span></div>}</section>; })}</div>
        <div className="event-feed" aria-live="polite"><b>{stateCopy[state]}</b>{events.slice(-3).map((event) => <span className={event.tone} key={`${event.time}-${event.label}`}><time>{event.time}</time>{event.label}</span>)}</div><div className="scroll-cue">{activeStage === 4 ? "SCROLL TO EXPLORE THE SYSTEM" : `${stages[activeStage].eyebrow} · SCROLL TO TRAVEL`}</div>
        <div className="stage-dots">{stages.map((stage, index) => <button className={activeStage === index ? "active" : ""} onClick={() => goToStage(index)} aria-label={`Go to ${stage.short}`} key={stage.code}><i /><span>{stage.short}</span></button>)}</div>
        <div className="control-dock"><button className={`orbit-mark ${isListening ? "listening" : ""}`} onClick={() => void startListening()} aria-label={isListening ? "Stop pronunciation recording" : "Record pronunciation attempt"}>{isListening ? "●" : "O"}</button><button className="dock-primary" onClick={() => state === "INTERRUPTED" ? setMenuOpen(true) : state === "IDLE" || state === "COMPLETE" ? void runExperience(command, inferTool(command, activeTool)) : interrupt()}>{state === "IDLE" ? "HEAR MODEL" : state === "COMPLETE" ? "PLAY AGAIN" : state === "INTERRUPTED" ? "NEW ATTEMPT" : "STOP"}</button><button className="menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Menu" aria-expanded={menuOpen}><i /><i /><i /></button></div>
        {menuOpen && <div className="command-panel">
          <div><span>ENGLISHAI COACH</span><button onClick={() => setMenuOpen(false)} aria-label="Close controls">×</button></div>
          <div className="server-line"><i /> SERVER {backendStatus}<small>{voiceEvidence || (voiceConfigured ? "RIME READY" : "BROWSER VOICE")}</small><b>{whisperConfigured ? "WHISPER" : "BROWSER STT"}</b></div>
          <p>Choose or type a target phrase. Hear it slowly and naturally, then record your attempt.</p>
          <form onSubmit={(event) => { event.preventDefault(); if (command.trim()) { const tool = inferTool(command, activeTool); setActiveTool(tool); void runExperience(command.trim(), tool); } }}><input value={command} onChange={(event) => setCommand(event.target.value)} aria-label="Target English phrase" maxLength={500} /><button type="submit">HEAR</button></form>
          <div className="panel-tools">{toolNames.map((tool, index) => <button type="button" className={activeTool === index ? "active" : ""} onClick={() => { setActiveTool(index); setCommand(phraseForCategory(index)); }} key={tool}>{tool}</button>)}</div>
          <div className="panel-response"><span>ENGLISHAI / {stateCopy[state]}</span><p>{response}</p>{resultMeta && <small>{resultMeta}</small>}{notes.length > 0 && <small>{notes.length} PRONUNCIATION ISSUE{notes.length === 1 ? "" : "S"} SAVED</small>}</div>
          {activeTimer && <div className="panel-active-timer"><span>ACTIVE TIMER</span><b>{timerRemaining}s</b><button onClick={() => void updateTimer(activeTimer.id, "cancel")}>STOP</button></div>}
          <div className="panel-memory">
            <div><span>RECURRING MISTAKES</span><small>{notes.length} TRACKED</small></div>
            {notes.length ? notes.slice(0, 4).map((note) => <article key={note.id}><p>{note.content}</p><button onClick={() => void deleteResource("note", note.id)} aria-label={`Delete pronunciation issue ${note.content}`}>×</button></article>) : <p className="panel-empty">Your recurring pronunciation and delivery issues will appear here.</p>}
          </div>
          <div className="panel-history">
            <div><span>BEFORE / AFTER ATTEMPTS</span>{history.length > 0 && <button onClick={() => void deleteResource("history")}>CLEAR</button>}</div>
            {history.length ? history.slice(0, 3).map((run) => <button className={`history-${run.status}`} onClick={() => { const tool = Math.max(0, toolNames.indexOf(run.tool)); setActiveTool(tool); setCommand(run.query); }} key={run.id}><span>{run.tool}</span><p>{run.query}</p><small>{learnerState.attempts.find((attempt) => attempt.id === run.id)?.score ?? 0}/100 · {learnerState.attempts.find((attempt) => attempt.id === run.id)?.improvement ?? 0} CHANGE</small></button>) : <p className="panel-empty">Your attempts and improvement evidence will appear here.</p>}
          </div>
          <button className="panel-voice" onClick={() => void startListening()}>{isListening ? "STOP & EVALUATE" : "RECORD MY ATTEMPT"}</button>
          {!["IDLE", "COMPLETE", "INTERRUPTED"].includes(state) && <button className="panel-interrupt" onClick={interrupt}>CANCEL ACTIVE ATTEMPT</button>}
          <button className="panel-reset" onClick={reset}>RESET PRACTICE</button>
        </div>}
      </div>
      </section>
      </div>
      <ProjectStory onLaunch={(toolIndex = activeTool) => { setActiveTool(toolIndex); setCommand(toolExamples[toolIndex]); setMenuOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
    </main>
  );
}

function ProjectStory({ onLaunch }: { onLaunch: (toolIndex?: number) => void }) {
  const storyRef = useRef<HTMLDivElement>(null);
  const storyStageRef = useRef(0);
  const [storyStage, setStoryStage] = useState(0);
  const storySections = ["OVERVIEW", "SYSTEM", "INTERRUPT", "TOOLS", "CODE", "FIELD"];
  const flow = [
    ["01", "SIGNAL", "Continuous speech is captured as a live stream instead of a finished command."],
    ["02", "INTENT", "Meaning is resolved while the speaker is still talking."],
    ["03", "ACTION", "The right server tool runs inside the current request boundary."],
    ["04", "FENCE", "An interruption immediately invalidates stale speech and tool work."],
    ["05", "RECOVER", "Only the newest intent is allowed to reach the conversation."],
  ];
  const toolGlyphs = ["☁", "⌕", "÷", "◴", "✎"];
  const toolRoutes = ["LOCATION → FORECAST", "QUERY → VERIFIED WEB", "EXPRESSION → RESULT", "DURATION → COUNTDOWN", "MEMORY → SERVER STORE"];
  const trace = [
    ["0.00s", "VOICE SIGNAL ACQUIRED", "complete"],
    ["0.32s", "INTENT RESOLVED", "complete"],
    ["0.68s", "SERVER TOOL STARTED", "live"],
    ["NOW", "USER INTERRUPTED", "cancelled"],
    ["<80ms", "REQUEST FENCED", "cancelled"],
    ["NEXT", "NEW INTENT READY", "complete"],
  ];
  const principles = [
    ["01", "CONTINUOUS", "THE SIGNAL NEVER FREEZES", "Meaning keeps resolving while the speaker is still shaping the thought."],
    ["02", "INTERRUPTIBLE", "CONTROL STAYS HUMAN", "Every active task can be stopped without damaging the conversation around it."],
    ["03", "CURRENT", "STALE WORK NEVER SPEAKS", "Only the latest verified intent is allowed to reach the user."],
  ];

  useEffect(() => {
    const root = storyRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-forge-section]"));
    const revealItems = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    root.classList.add("is-enhanced");
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add("is-visible"); });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealItems.forEach((item) => revealObserver.observe(item));
    let frame = 0;
    const syncStory = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = root.getBoundingClientRect();
        const travel = Math.max(1, root.offsetHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, -rect.top / travel));
        root.style.setProperty("--story-progress", String(progress));
        root.classList.toggle("is-story-active", rect.top <= 0 && rect.bottom >= window.innerHeight);
        const focusLine = window.innerHeight * 0.46;
        let nextStage = 0;
        let closest = Number.POSITIVE_INFINITY;
        sections.forEach((section, index) => {
          const sectionRect = section.getBoundingClientRect();
          const distance = Math.abs(sectionRect.top + sectionRect.height * 0.34 - focusLine);
          if (distance < closest) { closest = distance; nextStage = index; }
        });
        if (nextStage !== storyStageRef.current) {
          storyStageRef.current = nextStage;
          setStoryStage(nextStage);
        }
      });
    };
    const moveLight = (event: PointerEvent) => {
      root.style.setProperty("--story-x", `${event.clientX}px`);
      root.style.setProperty("--story-y", `${event.clientY}px`);
    };
    syncStory();
    window.addEventListener("scroll", syncStory, { passive: true });
    window.addEventListener("resize", syncStory);
    root.addEventListener("pointermove", moveLight, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", syncStory);
      window.removeEventListener("resize", syncStory);
      root.removeEventListener("pointermove", moveLight);
      revealObserver.disconnect();
    };
  }, []);

  function goToStorySection(index: number) {
    storyRef.current?.querySelectorAll<HTMLElement>("[data-forge-section]")[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="project-story forge-story" ref={storyRef}>
      <div className="forge-pointer-light" aria-hidden="true" />
      <div className="forge-story-progress" aria-hidden="true"><i /></div>
      <nav className="forge-story-nav" aria-label="Explore ORBIT system story">{storySections.map((label, index) => <button className={storyStage === index ? "active" : ""} onClick={() => goToStorySection(index)} aria-label={`Go to ${label}`} aria-current={storyStage === index ? "step" : undefined} key={label}><span>0{index + 1}</span><i /><b>{label}</b></button>)}</nav>
      <section className="forge-overview" data-forge-section>
        <div className="forge-shell">
          <div className="forge-topline"><span>DATA FORGE / ORBIT 05</span><span><i /> SYSTEM ONLINE</span></div>
          <div className="forge-overview-grid">
            <div className="forge-overview-copy" data-reveal>
              <div className="forge-kicker"><span>REALTIME VOICE SYSTEM</span><b>01 / OVERVIEW</b></div>
              <h2>Voice intelligence<br /><em>that survives</em><br />a change of mind.</h2>
              <div className="forge-overview-bottom"><p>ORBIT is built for the messy, human middle of a sentence—where intent moves, requests overlap, and control must stay with the speaker.</p><button onClick={() => onLaunch()}>ENTER LIVE ORBIT <span>↗</span></button></div>
            </div>
            <div className="forge-signal-card" data-reveal>
              <header><span>LIVE SIGNAL / CH-01</span><b><i /> RECEIVING</b></header>
              <div className="forge-signal-visual" aria-hidden="true">
                <div className="forge-radar"><i /><i /><i /><b>O</b><span>INTENT LOCKED</span></div>
                <div className="forge-wave">{Array.from({ length: 29 }, (_, index) => <i style={{ height: `${18 + ((index * 19) % 68)}%` }} key={index} />)}</div>
              </div>
              <div className="forge-signal-readout"><span><small>REQUEST</small><b>RQ-2048</b></span><span><small>BOUNDARY</small><b>GUARDED</b></span><span><small>LATENCY</small><b>&lt;80MS</b></span></div>
            </div>
          </div>
          <div className="forge-stats" data-reveal><article><span>01</span><div><b>&lt;80ms</b><small>INTERRUPTION TARGET</small></div></article><article><span>02</span><div><b>05</b><small>CONNECTED TOOLS</small></div></article><article><span>03</span><div><b>01</b><small>ACTIVE INTENT</small></div></article><article><span>04</span><div><b>0</b><small>STALE RESPONSES</small></div></article></div>
        </div>
      </section>

      <section className="forge-architecture" data-forge-section>
        <div className="forge-shell">
          <header className="forge-section-head" data-reveal><div><span>ARCHITECTURE / 06</span><b>02 / REQUEST LOGIC</b></div><h2>One signal.<br /><em>Five guarded states.</em></h2><p>Every transition is observable. Every active state can be interrupted. Every late result has to prove it still belongs.</p></header>
          <div className="forge-state-system" data-reveal>
            <svg className="forge-state-lines" viewBox="0 0 1200 780" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="600" cy="365" rx="462" ry="286" /><ellipse cx="600" cy="365" rx="305" ry="188" /><line x1="600" y1="365" x2="230" y2="145" /><line x1="600" y1="365" x2="150" y2="515" /><line className="active" x1="600" y1="365" x2="600" y2="700" /><line x1="600" y1="365" x2="1050" y2="515" /><line x1="600" y1="365" x2="970" y2="145" /><circle cx="600" cy="365" r="8" /></svg>
            <div className="forge-system-core">
              <span>LIVE REQUEST BOUNDARY</span>
              <div className="forge-system-core-orbit" aria-hidden="true"><i /><i /><i /><b>RQ</b><small>2048</small></div>
              <h3>Latest intent only.</h3>
              <div><span><small>POLICY</small><b>GUARDED</b></span><span><small>FENCE</small><b>ARMED</b></span></div>
            </div>
            {flow.map(([code, title, copy], index) => <article className={`forge-state-node forge-state-${index + 1} ${index === 2 ? "is-active" : ""}`} data-code={code} key={code}><header><span>STATE / {code}</span><b><i /> {index === 2 ? "RUNNING" : "VERIFIED"}</b></header><div className="forge-state-node-copy"><span>{code}</span><div><h3>{title}</h3><p>{copy}</p></div></div><footer><span>REQUEST BOUNDARY</span><b>{index === 2 ? "LIVE" : "SECURE"}</b></footer></article>)}
          </div>
        </div>
      </section>

      <section className="forge-interruption" data-forge-section>
        <div className="forge-interrupt-glow" aria-hidden="true"><i /><i /><i /></div>
        <div className="forge-rupture-wave" aria-hidden="true">{Array.from({ length: 43 }, (_, index) => <i style={{ height: `${8 + ((index * 31) % 90)}%` }} key={index} />)}</div>
        <div className="forge-shell forge-interruption-grid">
          <div className="forge-interrupt-copy" data-reveal><div className="forge-light-kicker"><span>BARGE-IN LAB / 07</span><b>03 / HUMAN CONTROL</b></div><h2>Change direction.<br /><em>Mid-sentence.</em></h2><p>Audio stops, the network request is aborted, and stale results lose permission to touch the session—before they can speak.</p><div className="forge-latency"><b>&lt;80</b><span>MS<small>VOICE → FENCE</small></span></div></div>
          <div className="forge-trace-console" data-reveal>
            <header><span>REQUEST TRACE / RQ-2048</span><b><i /> LIVE</b></header>
            <div className="forge-trace-list">{trace.map(([time, label, status]) => <div className={`trace-${status}`} key={label}><time>{time}</time><span>{label}</span><i /><b>{status === "cancelled" ? "FENCED" : status === "live" ? "ACTIVE" : "DONE"}</b></div>)}</div>
            <footer><span>STALE OUTPUT</span><b>BLOCKED BEFORE SPEECH</b></footer>
          </div>
        </div>
      </section>

      <section className="forge-tools" data-forge-section>
        <div className="forge-shell">
          <header className="forge-section-head forge-tools-head" data-reveal><div><span>TOOL NETWORK / 08</span><b>04 / CAPABILITIES</b></div><h2>Real work.<br /><em>One live boundary.</em></h2><p>Five server-backed capabilities, synchronized by the same realtime state machine.</p></header>
          <div className="forge-tool-grid">{toolNames.map((tool, index) => <button className={`forge-tool-card forge-tool-${index + 1}`} data-reveal onClick={() => onLaunch(index)} key={tool}><header><span>0{index + 1}</span><b><i /> CONNECTED</b></header><div className="forge-tool-glyph" aria-hidden="true">{toolGlyphs[index]}</div><div><small>{toolRoutes[index]}</small><h3>{tool}</h3><p>{toolExamples[index]}</p></div><footer><span>OPEN IN ORBIT</span><b>↗</b></footer></button>)}</div>
        </div>
      </section>

      <section className="forge-principles" data-forge-section>
        <div className="forge-shell forge-principles-grid">
          <div className="forge-principles-title" data-reveal><div className="forge-dark-kicker"><span>DESIGN PRINCIPLES / 09</span><b>05 / OPERATING CODE</b></div><h2>Built around the<br /><em>conversation.</em><br />Not the box.</h2><div className="forge-principle-mark" aria-hidden="true"><i /><i /><b>O</b></div></div>
          <div className="forge-principle-list" data-reveal>{principles.map(([code, title, note, copy]) => <article key={code}><span>{code}</span><div><small>{note}</small><h3>{title}</h3></div><p>{copy}</p><b>↗</b></article>)}</div>
        </div>
        <div className="forge-manifesto" aria-hidden="true"><span>ALWAYS CURRENT · ALWAYS HUMAN · </span><span>ALWAYS CURRENT · ALWAYS HUMAN · </span></div>
      </section>

      <section className="forge-field-entry" data-forge-section>
        <div className="forge-field-lines" aria-hidden="true"><i /><i /><i /><b /></div>
        <div className="forge-shell" data-reveal><div className="forge-light-kicker"><span>DATA FORGE / FIELD 11</span><b>FINAL / EXPLORE</b></div><h2>The system is not<br />a diagram. <em>It is a place.</em></h2><div><p>Enter the ORBIT control field and inspect how signal, tools, interruption, recovery, and silence work together.</p><span>SCROLL TO ENTER THE FIELD <i>↓</i></span></div></div>
      </section>

      <OrbitWorld onLaunchOrbit={() => onLaunch()} />
      <footer className="forge-footer"><div><span>DATA FORGE / ORBIT</span><b>VOICE, WITH<br />A SENSE OF NOW.</b></div><button onClick={() => onLaunch()}>RETURN TO LIVE ORBIT <span>↑</span></button><small>REALTIME VOICE · INTERRUPTION · RECOVERY / 2026</small></footer>
    </div>
  );
}

function OrbitCanvas({ progressRef, state }: { progressRef: { current: number }; state: OrbitState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null), stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => {
    const canvas = canvasRef.current, context = canvas?.getContext("2d"); if (!canvas || !context) return;
    let width = 0, height = 0, dpr = 1, frame = 0, pointerX = 0, pointerY = 0, pointerTargetX = 0, pointerTargetY = 0, visualProgress = progressRef.current; let particles: Particle[] = [];
    const resize = () => { width = window.innerWidth; height = window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 1.5); canvas.width = width * dpr; canvas.height = height * dpr; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; context.setTransform(dpr, 0, 0, dpr, 0, 0); const count = width < 700 ? 620 : 1550; particles = Array.from({ length: count }, (_, index) => ({ u: index / count, v: (index * 0.61803398875) % 1, seed: ((index * 47) % 101) / 101, size: 0.55 + ((index * 29) % 13) / 11 })); };
    const pointAt = (stage: number, particle: Particle, time: number): Vector3 => { const tau = Math.PI * 2, theta = particle.u * tau, phi = Math.acos(1 - 2 * particle.v), base = Math.min(width, height); if (stage === 0) { const r = base * (0.22 + particle.seed * 0.025); return [Math.sin(phi) * Math.cos(theta) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(theta) * r]; } if (stage === 1) { const x = (particle.u - 0.5) * width * 1.08; return [x, Math.sin(particle.u * tau * 2.3 + time * 0.00035) * base * 0.16 + (particle.v - 0.5) * 60, Math.cos(particle.u * tau * 2.3) * 190]; } if (stage === 2) { const major = base * 0.25, minor = base * (0.05 + particle.seed * 0.025), ring = particle.v * tau; return [(major + minor * Math.cos(ring)) * Math.cos(theta), minor * Math.sin(ring), (major + minor * Math.cos(ring)) * Math.sin(theta)]; } if (stage === 3) { const side = particle.seed > 0.5 ? 1 : -1, radius = base * (0.12 + particle.v * 0.17); return [Math.cos(theta) * radius + side * base * 0.25, Math.sin(theta) * radius, (particle.v - 0.5) * 350 + side * 80]; } const radius = base * (0.05 + particle.u * 0.34); return [Math.cos(theta * 7) * radius, Math.sin(theta * 7) * radius, (particle.u - 0.5) * 900]; };
    const render = (time: number) => { visualProgress += (progressRef.current - visualProgress) * 0.075; pointerX += (pointerTargetX - pointerX) * 0.04; pointerY += (pointerTargetY - pointerY) * 0.04; context.clearRect(0, 0, width, height); context.globalCompositeOperation = "lighter"; const journey = visualProgress * 4, stage = Math.min(3, Math.floor(journey)), fraction = journey - stage, blend = fraction * fraction * (3 - 2 * fraction), rotationY = visualProgress * Math.PI * 1.7 + pointerX * 0.4, rotationX = -0.12 + pointerY * 0.25, cosY = Math.cos(rotationY), sinY = Math.sin(rotationY), cosX = Math.cos(rotationX), sinX = Math.sin(rotationX), centerX = width < 760 ? width * 0.5 : width * 0.68, centerY = width < 760 ? height * 0.28 : height * 0.49, warning = stateRef.current === "INTERRUPTED"; for (const particle of particles) { const from = pointAt(stage, particle, time), to = pointAt(stage + 1, particle, time); let x = from[0] + (to[0] - from[0]) * blend, y = from[1] + (to[1] - from[1]) * blend, z = from[2] + (to[2] - from[2]) * blend; const rx = x * cosY - z * sinY; z = x * sinY + z * cosY; x = rx; const ry = y * cosX - z * sinX; z = y * sinX + z * cosX; y = ry; const perspective = 620 / Math.max(190, 720 + z), px = centerX + x * perspective, py = centerY + y * perspective; if (px < -10 || px > width + 10 || py < -10 || py > height + 10) continue; const alpha = 0.16 + Math.min(1, perspective) * 0.58; context.fillStyle = warning ? `rgba(255,92,92,${alpha})` : particle.seed > 0.78 ? `rgba(111,98,255,${alpha})` : `rgba(80,225,203,${alpha})`; const size = Math.max(0.55, particle.size * perspective); context.fillRect(px, py, size, size); } context.globalCompositeOperation = "source-over"; frame = window.requestAnimationFrame(render); };
    const move = (event: PointerEvent) => { pointerTargetX = event.clientX / Math.max(1, width) - 0.5; pointerTargetY = event.clientY / Math.max(1, height) - 0.5; };
    resize(); window.addEventListener("resize", resize); window.addEventListener("pointermove", move, { passive: true }); frame = window.requestAnimationFrame(render); return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move); };
  }, [progressRef]);
  return <canvas ref={canvasRef} className="orbit-canvas" aria-label="ORBIT interactive 3D experience" />;
}
