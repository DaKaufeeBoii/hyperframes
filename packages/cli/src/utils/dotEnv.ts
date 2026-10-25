import { FEEDBACK_EMAIL_ENV } from "./feedbackSource.js";

export const CAPTURE_ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "HYPERFRAMES_VERTEX_PROJECT_ID",
  "HYPERFRAMES_VERTEX_SERVICE_ACCOUNT",
  "HYPERFRAMES_VERTEX_LOCATION",
  "HYPERFRAMES_VERTEX_MODEL",
  "HYPERFRAMES_OPENROUTER_MODEL",
  "HYPERFRAMES_GEMINI_MODEL",
  "HYPERFRAMES_VISION_TIMEOUT_MS",
];

function getUnescapedQuoteIndices(str: string, quote: string, fromIndex = 0): number[] {
  const indices: number[] = [];
  for (let i = fromIndex; i < str.length; i++) {
    if (str[i] === quote) {
      if (quote === '"' && i > 0 && str[i - 1] === "\\") {
        let backslashes = 0;
        let j = i - 1;
        while (j >= 0 && str[j] === "\\") {
          backslashes++;
          j--;
        }
        if (backslashes % 2 === 1) continue;
      }
      indices.push(i);
    }
  }
  return indices;
}

function parseDotEnvEntries(content: string): [string, string][] {
  const entries: [string, string][] = [];
  const lines = content.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    i++;
    if (rawLine === undefined) break;
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const rawVal = line.slice(eq + 1).trim();

    const quote = rawVal.charAt(0);
    if (quote === '"' || quote === "'") {
      const rawQuoteIndices = getUnescapedQuoteIndices(rawVal, quote, 1);
      const lastRawIdx = rawQuoteIndices.length > 0 ? rawQuoteIndices[rawQuoteIndices.length - 1] : undefined;
      const rawRemainder = lastRawIdx !== undefined ? rawVal.slice(lastRawIdx + 1).trim() : null;

      if (
        lastRawIdx !== undefined &&
        rawRemainder !== null &&
        (rawRemainder === "" || rawRemainder.startsWith("#")) &&
        rawQuoteIndices.length % 2 === 1
      ) {
        entries.push([key, rawVal.slice(1, lastRawIdx)]);
      } else {
        let val = rawVal.slice(1);
        while (i < lines.length) {
          const next = lines[i];
          i++;
          if (next === undefined) break;
          const nextQuoteIndices = getUnescapedQuoteIndices(next, quote, 0);
          if (nextQuoteIndices.length % 2 === 1) {
            const endIdx = nextQuoteIndices[nextQuoteIndices.length - 1];
            if (endIdx !== undefined) {
              const remainder = next.slice(endIdx + 1).trim();
              if (remainder === "" || remainder.startsWith("#")) {
                val += "\n" + next.slice(0, endIdx);
                break;
              }
            }
          }
          val += "\n" + next;
        }
        entries.push([key, val]);
      }
    } else {
      const comment = rawVal.match(/\s+#/);
      entries.push([key, comment?.index === undefined ? rawVal : rawVal.slice(0, comment.index).trim()]);
    }
  }
  return entries;
}

// Never over a key already set, and never the feedback email in any letter case (Windows env names are case-blind):
// only the launching app may attach it, and an agent can write a project `.env`.
// An optional exact-name allowlist narrows callers that load less-trusted project settings.
export function applyDotEnv(
  content: string,
  env: NodeJS.ProcessEnv,
  allowedKeys?: readonly string[],
): void {
  const allowed = allowedKeys === undefined ? undefined : new Set(allowedKeys);
  for (const [key, value] of parseDotEnvEntries(content)) {
    if (
      key &&
      key.toUpperCase() !== FEEDBACK_EMAIL_ENV &&
      (allowed === undefined || allowed.has(key)) &&
      !(key in env)
    )
      env[key] = value;
  }
}
