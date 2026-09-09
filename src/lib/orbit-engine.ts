export type AgentState = "idle" | "listening" | "thinking" | "tool" | "speaking" | "interrupted" | "recovered";

export type EventKind = "info" | "success" | "warning" | "error";

export type OrbitEvent = {
  id: string;
  at: string;
  kind: EventKind;
  label: string;
  detail: string;
};

export type Operation = {
  requestId: string;
  turnId: number;
  query: string;
  status: "active" | "interrupted" | "completed" | "stale";
};

export type EngineSnapshot = {
  state: AgentState;
  active: Operation | null;
  cancelled: number;
  events: OrbitEvent[];
};

const wait = (duration: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, duration);
  signal.addEventListener("abort", () => {
    window.clearTimeout(timer);
    reject(new DOMException("Operation cancelled", "AbortError"));
  }, { once: true });
});

export class OrbitEngine {
  private controller: AbortController | null = null;
  private listeners = new Set<(snapshot: EngineSnapshot) => void>();
  private snapshot: EngineSnapshot = { state: "idle", active: null, cancelled: 0, events: [] };
  private turn = 0;

  subscribe(listener: (snapshot: EngineSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => { this.listeners.delete(listener); };
  }

  private emit(next: Partial<EngineSnapshot>, event?: Omit<OrbitEvent, "id" | "at">) {
    this.snapshot = {
      ...this.snapshot,
      ...next,
      events: event ? [{ ...event, id: crypto.randomUUID(), at: new Date().toISOString() }, ...this.snapshot.events].slice(0, 12) : this.snapshot.events,
    };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  beginListening() {
    this.emit({ state: "listening" }, { kind: "info", label: "USER_SPEECH_STARTED", detail: "Microphone is accepting a new instruction" });
  }

  async run(query: string) {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const requestId = `req_${crypto.randomUUID().slice(0, 8)}`;
    const operation: Operation = { requestId, turnId: ++this.turn, query, status: "active" };
    this.emit({ state: "thinking", active: operation }, { kind: "info", label: "REQUEST_ACTIVE", detail: `${requestId} · turn ${operation.turnId}` });

    try {
      await wait(850, controller.signal);
      if (this.snapshot.active?.requestId !== requestId) return;
      this.emit({ state: "tool" }, { kind: "info", label: "TOOL_STARTED", detail: `weather.lookup · ${query}` });
      await wait(1800, controller.signal);
      if (this.snapshot.active?.requestId !== requestId) {
        this.emit({}, { kind: "warning", label: "TOOL_STALE", detail: `${requestId} rejected at commit boundary` });
        return;
      }
      this.emit({ state: "speaking" }, { kind: "success", label: "TTS_FIRST_AUDIO", detail: "Rime stream boundary ready · playback may begin" });
      await wait(1700, controller.signal);
      if (this.snapshot.active?.requestId !== requestId) return;
      this.emit({ state: "recovered", active: { ...operation, status: "completed" } }, { kind: "success", label: "RESPONSE_COMPLETED", detail: `Only ${requestId} was allowed to speak` });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      this.emit({ state: "idle" }, { kind: "error", label: "ERROR", detail: "Operation failed before the commit boundary" });
    }
  }

  interrupt(nextQuery?: string) {
    const previous = this.snapshot.active;
    if (!previous) return;
    this.controller?.abort();
    this.controller = null;
    this.emit({ state: "interrupted", cancelled: this.snapshot.cancelled + 1, active: { ...previous, status: "interrupted" } }, { kind: "warning", label: "USER_INTERRUPTED", detail: `Audio queue flushed · ${previous.requestId} fenced` });
    this.emit({ state: "listening", active: null }, { kind: "info", label: "TURN_RECONCILED", detail: nextQuery ? `Listening for redirect: ${nextQuery}` : "Ready for a replacement instruction" });
  }
}