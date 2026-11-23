// 전체 랭킹 API (Vercel Function)
import { createRankingService, parseAllowedOrigins } from './_lib/service.js';
import { createUpstashStore, upstashConfigFromEnv } from './_lib/upstash-store.js';

const config = upstashConfigFromEnv(process.env);
const service = createRankingService({
  store: config ? createUpstashStore(config) : null,
  allowedOrigins: parseAllowedOrigins(process.env.RANKING_ALLOWED_ORIGINS),
});

export function GET(request: Request): Promise<Response> {
  return service.handle(request);
}

export function POST(request: Request): Promise<Response> {
  return service.handle(request);
}

export function OPTIONS(request: Request): Promise<Response> {
  return service.handle(request);
}
