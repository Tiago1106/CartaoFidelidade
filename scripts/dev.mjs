// One command for development: `pnpm start:dev`.
// 1. creates .env from .env.example when there is none (and picks a free port for Postgres),
// 2. starts Postgres in Docker and waits until it is healthy,
// 3. applies the migrations and loads the sample data,
// 4. runs the API and the web app (`pnpm dev`).
// Running it again is safe: every step can be repeated.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const shell = process.platform === 'win32';

function run(command, args, label) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell });
  if (result.status !== 0) {
    console.error(`\nFailed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

/** True when something already listens on the port of this machine. */
function isBusy(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
  });
}

async function createEnv() {
  let port = 5432;
  while (await isBusy(port)) port += 1;
  let text = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  if (port !== 5432) {
    // Another Postgres owns 5432 (for example from another project): use the next free port.
    text = text.replaceAll('@localhost:5432/', `@localhost:${port}/`);
    console.log(`Port 5432 is taken by another program, so Postgres will use ${port}.`);
  }
  text += `\n# Port of Postgres on this machine (read by docker-compose.yml).\nPOSTGRES_PORT=${port}\n`;
  writeFileSync(new URL('../.env', import.meta.url), text);
  console.log('Created .env from .env.example.');
}

if (!existsSync(new URL('../.env', import.meta.url))) await createEnv();

run('docker', ['compose', 'up', '-d', '--wait', 'postgres'], 'Postgres (docker compose)');
run('pnpm', ['db:migrate'], 'Migrations');
run('pnpm', ['db:seed'], 'Sample data');

console.log(
  '\nWeb:  http://localhost:5173\nAPI:  http://localhost:3000  (docs at /docs)\n' +
    'The SMS codes are printed in this terminal, in lines that start with [OTP simulado].\n',
);
const dev = spawn('pnpm', ['dev'], { cwd: root, stdio: 'inherit', shell });
dev.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => dev.kill(signal));
