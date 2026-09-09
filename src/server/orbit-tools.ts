import "server-only";

import type { OrbitTool } from "@/server/orbit-store";

export type ToolExecution = {
  answer: string;
  meta?: string;
  timerSeconds?: number;
  noteContent?: string;
};

const weatherDescriptions: Record<number, string> = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "foggy", 48: "foggy", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow",
  75: "heavy snow", 80: "rain showers", 81: "rain showers", 82: "heavy showers",
  95: "thunderstorms", 96: "thunderstorms with hail", 99: "thunderstorms with hail",
};

export const orbitTools: OrbitTool[] = ["WEATHER", "SEARCH", "CALCULATOR", "TIMER", "NOTES"];

export function inferOrbitTool(query: string): OrbitTool {
  const value = query.toLowerCase();
  if (/weather|temperature|forecast/.test(value)) return "WEATHER";
  if (/calculate|math|\d\s*[+*/-]/.test(value)) return "CALCULATOR";
  if (/timer|countdown|seconds?|minutes?|hours?/.test(value)) return "TIMER";
  if (/remember|note|save this|write down/.test(value)) return "NOTES";
  return "SEARCH";
}

function requestSignal(parent: AbortSignal) {
  return AbortSignal.any([parent, AbortSignal.timeout(8_000)]);
}

function locationFrom(query: string) {
  const match = query.match(/(?:in|for|at)\s+([a-z][a-z\s.-]{1,60})/i);
  return (match?.[1] || query).replace(/[?.!,].*$/, "").trim();
}

async function weather(query: string, signal: AbortSignal): Promise<ToolExecution> {
  const requested = locationFrom(query) || "Delhi";
  const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(requested)}&count=1&language=en&format=json`, { signal: requestSignal(signal) });
  if (!geoResponse.ok) throw new Error("The location service is unavailable.");
  const geo = await geoResponse.json() as { results?: Array<{ name: string; country?: string; latitude: number; longitude: number }> };
  const place = geo.results?.[0];
  if (!place) throw new Error(`I could not find “${requested}”.`);
  const forecastResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`, { signal: requestSignal(signal) });
  if (!forecastResponse.ok) throw new Error("The weather service is unavailable.");
  const forecast = await forecastResponse.json() as { current?: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number }; current_units?: { temperature_2m?: string; wind_speed_10m?: string } };
  if (!forecast.current) throw new Error("No current weather was returned.");
  const current = forecast.current;
  const name = `${place.name}${place.country ? `, ${place.country}` : ""}`;
  return { answer: `${name} is ${Math.round(current.temperature_2m)}${forecast.current_units?.temperature_2m || "°C"} with ${weatherDescriptions[current.weather_code] || "mixed conditions"}. It feels like ${Math.round(current.apparent_temperature)}°C, with wind at ${Math.round(current.wind_speed_10m)} ${forecast.current_units?.wind_speed_10m || "km/h"}.`, meta: name };
}

async function search(query: string, signal: AbortSignal): Promise<ToolExecution> {
  const cleaned = query.replace(/^(search|find|look up|tell me about)\s+/i, "").trim() || query;
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleaned)}&gsrlimit=1&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&origin=*`;
  const response = await fetch(url, { signal: requestSignal(signal), headers: { "User-Agent": "ORBIT educational project" } });
  if (!response.ok) throw new Error("Search is temporarily unavailable.");
  const data = await response.json() as { query?: { pages?: Record<string, { title: string; extract?: string; fullurl?: string }> } };
  const page = Object.values(data.query?.pages || {})[0];
  if (!page) throw new Error(`No result was found for “${cleaned}”.`);
  const summary = (page.extract || "A result was found, but it has no summary.").replace(/\s+/g, " ").slice(0, 420);
  return { answer: `${page.title}: ${summary}${summary.length >= 420 ? "…" : ""}`, meta: page.fullurl || "Wikipedia" };
}

class MathParser {
  private index = 0;
  constructor(private readonly source: string) {}
  parse() { const value = this.expression(); this.space(); if (this.index !== this.source.length || !Number.isFinite(value)) throw new Error("Invalid calculation."); return value; }
  private space() { while (/\s/.test(this.source[this.index] || "")) this.index++; }
  private expression() { let value = this.term(); for (;;) { this.space(); const op = this.source[this.index]; if (op !== "+" && op !== "-") return value; this.index++; const right = this.term(); value = op === "+" ? value + right : value - right; } }
  private term() { let value = this.factor(); for (;;) { this.space(); const op = this.source[this.index]; if (op !== "*" && op !== "/") return value; this.index++; const right = this.factor(); if (op === "/" && right === 0) throw new Error("Division by zero is undefined."); value = op === "*" ? value * right : value / right; } }
  private factor(): number { this.space(); if (this.source[this.index] === "+" || this.source[this.index] === "-") { const sign = this.source[this.index++] === "-" ? -1 : 1; return sign * this.factor(); } if (this.source[this.index] === "(") { this.index++; const value = this.expression(); this.space(); if (this.source[this.index++] !== ")") throw new Error("A closing bracket is missing."); return value; } const match = this.source.slice(this.index).match(/^\d+(?:\.\d+)?/); if (!match) throw new Error("Enter a calculation such as 24 * (8 + 2)."); this.index += match[0].length; return Number(match[0]); }
}

function calculate(query: string): ToolExecution {
  const expression = query.replace(/\.(?!\d)/g, " ").replace(/[^0-9+\-*/().\s]/g, " ").trim();
  if (!expression || expression.length > 120) throw new Error("Enter a shorter calculation.");
  const result = new MathParser(expression).parse();
  return { answer: `${expression} = ${Number.isInteger(result) ? result : Number(result.toFixed(6))}`, meta: "Validated on the ORBIT server" };
}

function timer(query: string): ToolExecution {
  const match = query.match(/(\d+(?:\.\d+)?)\s*(second|sec|minute|min|hour|hr)s?/i);
  if (!match) throw new Error("Say a duration, for example “set a timer for 30 seconds”.");
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const seconds = Math.round(amount * (unit.startsWith("h") ? 3600 : unit.startsWith("m") ? 60 : 1));
  if (seconds < 1 || seconds > 86_400) throw new Error("Timers can run from 1 second to 24 hours.");
  return { answer: `Timer started for ${seconds >= 3600 ? `${seconds / 3600} hour(s)` : seconds >= 60 ? `${seconds / 60} minute(s)` : `${seconds} seconds`}.`, meta: "Persisted by the ORBIT server", timerSeconds: seconds };
}

function note(query: string): ToolExecution {
  const content = query.replace(/^remember\s+(?:to\s+)?/i, "").replace(/^(save|add|write|note)(\s+(a|this))?(\s+note)?[:\s-]*/i, "").trim();
  if (!content) throw new Error("Tell me what you want to save.");
  const noteContent = content.slice(0, 500);
  return { answer: `Saved to ORBIT memory: “${noteContent.slice(0, 180)}”`, meta: "Stored by the ORBIT server", noteContent };
}

export async function executeOrbitTool(tool: OrbitTool, query: string, signal: AbortSignal) {
  if (tool === "WEATHER") return weather(query, signal);
  if (tool === "SEARCH") return search(query, signal);
  if (tool === "CALCULATOR") return calculate(query);
  if (tool === "TIMER") return timer(query);
  return note(query);
}
