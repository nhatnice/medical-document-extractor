export type Config = {
  apiKey: string;
  baseURL: string;
  model: string;
  port: number;
  maxPages: number;
};

function required(name: string): string {
  const value = Bun.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var ${name}. See server/.env.example.`);
  return value;
}

export function loadConfig(): Config {
  return {
    apiKey: required("LLM_API_KEY"),
    baseURL: required("LLM_BASE_URL"),
    model: required("LLM_MODEL"),
    port: Number(Bun.env.PORT ?? 3000),
    maxPages: Number(Bun.env.MAX_PAGES ?? 10),
  };
}
