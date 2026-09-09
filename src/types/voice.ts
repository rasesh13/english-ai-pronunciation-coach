export type AgentState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "TOOL_RUNNING"
  | "SPEAKING"
  | "INTERRUPTED"
  | "RECOVERING"
  | "ERROR";

export type OperationStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "INTERRUPTED"
  | "CANCELLED"
  | "STALE"
  | "FAILED";

export type ToolStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "CANCELLED"
  | "STALE"
  | "FAILED";

export type VoiceEventName =
  | "SESSION_STARTED"
  | "USER_SPEECH_STARTED"
  | "USER_SPEECH_ENDED"
  | "STT_PARTIAL"
  | "STT_FINAL"
  | "LLM_STARTED"
  | "LLM_FIRST_TOKEN"
  | "TOOL_STARTED"
  | "TOOL_COMPLETED"
  | "TOOL_CANCELLED"
  | "TOOL_STALE"
  | "TTS_STARTED"
  | "TTS_FIRST_AUDIO"
  | "ASSISTANT_SPEAKING"
  | "USER_INTERRUPTED"
  | "AUDIO_CANCELLED"
  | "TURN_RECONCILED"
  | "RESPONSE_COMPLETED"
  | "ERROR";

export type VoiceEvent = {
  name: VoiceEventName;
  timestamp: string;
  conversationId: string;
  turnId?: string;
  requestId?: string;
  toolCallId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type RequestContext = {
  conversationId: string;
  turnId: string;
  requestId: string;
};