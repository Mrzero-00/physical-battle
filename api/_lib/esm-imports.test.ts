// 서버 함수가 쓰는 모듈의 상대 import 확장자 검사 (Node ESM 런타임 호환)
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const ENTRY = resolve(ROOT, 'api/ranking.ts');
const IMPORT = /^\s*(?:import|export)[^'"]*from\s+['"](\.{1,2}\/[^'"]+)['"]/gm;

function relativeImports(file: string): string[] {
  const out: string[] = [];
  for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
    if (!/^\s*import\s+type\b/.test(m[0])) out.push(m[1]);
  }
  return out;
}

describe('api ESM imports', () => {
  it('서버가 실행하는 모든 상대 import는 .js 확장자를 쓴다', () => {
    const seen = new Set<string>();
    const queue = [ENTRY];
    const bad: string[] = [];
    while (queue.length) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const spec of relativeImports(file)) {
        if (!spec.endsWith('.js')) {
          bad.push(`${file.replace(ROOT + '/', '')} -> ${spec}`);
          continue;
        }
        queue.push(resolve(dirname(file), spec.replace(/\.js$/, '.ts')));
      }
    }
    expect(bad).toEqual([]);
    expect(seen.size).toBeGreaterThan(3);
  });
});
