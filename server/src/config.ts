export type Config = {
  apiKey: string;
  baseURL: string;
  model: string;
  port: number;
  maxPages: number;
  maxConcurrent: number;
};

function required(name: string): string {
  const value = Bun.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var ${name}. See server/.env.example.`);
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const raw = Bun.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer, got "${raw}".`);
  return value;
}

export function loadConfig(): Config {
  return {
    apiKey: required("LLM_API_KEY"),
    baseURL: required("LLM_BASE_URL"),
    model: required("LLM_MODEL"),
    port: positiveInt("PORT", 3000),
    maxPages: positiveInt("MAX_PAGES", 10),
    maxConcurrent: positiveInt("MAX_CONCURRENT", 4),
  };
}
