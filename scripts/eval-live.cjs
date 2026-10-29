const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

const config = process.env.PAGEWISE_AI_CONFIG;
if (!config || !existsSync(config)) {
  process.stderr.write(
    '请设置 PAGEWISE_AI_CONFIG 为本机凭据 JSON 路径（baseUrl/model/key/protocol/effort）。\n',
  );
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  [
    resolve(__dirname, '../node_modules/jest/bin/jest.js'),
    '--runInBand',
    '--testMatch',
    '**/scripts/eval-live.test.ts',
  ],
  { stdio: 'inherit', env: process.env, cwd: resolve(__dirname, '..') },
);
process.exit(result.status ?? 1);
