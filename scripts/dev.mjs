import { spawn } from 'node:child_process';

const commands = [
  ['npm', ['run', 'dev:server']],
  ['npm', ['run', 'dev:web']],
];

const children = commands.map(([command, args]) =>
  spawn(command, args, {
    stdio: 'inherit',
    shell: false,
  }),
);

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (!stopping && (code !== 0 || signal)) stop(code ?? 1);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
