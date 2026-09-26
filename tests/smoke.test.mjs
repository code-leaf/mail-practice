// 主要ページが正しく開けるかを確かめる簡易テスト
// node:test と fetch だけを使い、追加のパッケージは使わない
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEXT_BIN = path.join(__dirname, '..', 'node_modules', '.bin', 'next');

const PORT = process.env.SMOKE_TEST_PORT || '4370';
const BASE_URL = `http://localhost:${PORT}`;

let serverProcess;
let serverOutput = '';

// next start でアプリを起動し、応答が返るまで待つ
async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // まだ起動していない
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `サーバーが ${timeoutMs}ms 以内に起動しませんでした\n--- サーバーの出力 ---\n${serverOutput}`
  );
}

before(async () => {
  serverProcess = spawn(NEXT_BIN, ['start', '-p', PORT], {
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', (d) => {
    serverOutput += d.toString();
  });
  serverProcess.stderr.on('data', (d) => {
    serverOutput += d.toString();
  });
  await waitForServer(BASE_URL);
});

after(() => {
  if (serverProcess) serverProcess.kill('SIGTERM');
});

// どのページにも共通のヘッダー（アプリ名 "Mail"）が表示されるかを確認する
const pages = ['/', '/adress', '/createEmail', '/set'];

for (const p of pages) {
  test(`${p} が正常に表示される`, async () => {
    const res = await fetch(`${BASE_URL}${p}`);
    assert.equal(res.status, 200, `${p} は200を返すべき`);
    const html = await res.text();
    assert.ok(html.includes('Mail'), `${p} のHTMLにヘッダーの "Mail" が含まれているべき`);
  });
}
