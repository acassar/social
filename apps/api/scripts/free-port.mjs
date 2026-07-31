// Libère le port de l'API avant `start:dev`.
//
// `node --watch` lance le serveur dans un process enfant. Tuer l'écouteur ne
// suffit donc pas : le watcher parent survit et relance un enfant au premier
// changement de fichier, qui reprend le port. À l'inverse, interrompre le
// terminal laisse parfois l'enfant vivant. Dans les deux cas on retombe sur
// EADDRINUSE, avec un message qui n'indique pas quoi tuer.
//
// Ce script ne tue que des process qu'il a formellement identifiés comme étant
// cette API (ligne de commande pointant vers ce dépôt). Si le port est occupé
// par autre chose, il s'arrête et le dit plutôt que d'aller au hasard.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? readPortFromEnvFile() ?? 3000);
const IS_WINDOWS = process.platform === 'win32';

function readPortFromEnvFile() {
  try {
    const match = readFileSync(resolve(API_DIR, '.env'), 'utf8').match(/^\s*PORT\s*=\s*(\d+)/m);
    return match?.[1];
  } catch {
    return null;
  }
}

// PowerShell est résolu par chemin absolu : selon la façon dont le terminal a
// été lancé, System32 n'est pas toujours dans le PATH, et un `powershell`
// introuvable ferait échouer la détection en silence.
const POWERSHELL = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;

function sh(file, args) {
  try {
    return execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

/** Exécute une commande PowerShell, en retombant sur le PATH si besoin. */
function powershell(command) {
  const args = ['-NoProfile', '-NonInteractive', '-Command', command];
  return sh(POWERSHELL, args) || sh('powershell', args);
}

function isPortFree() {
  return new Promise((done) => {
    const server = createServer();
    server.once('error', () => done(false));
    server.once('listening', () => server.close(() => done(true)));
    // Sans hôte explicite, comme `app.listen(port)` de Nest : Node se lie sur
    // `::`. Sonder `0.0.0.0` à la place donnerait un faux « libre », Windows
    // laissant cohabiter une écoute IPv4 et une écoute IPv6 sur le même port.
    server.listen(PORT);
  });
}

/** PIDs qui écoutent sur le port. */
function listeners() {
  if (IS_WINDOWS) {
    // Get-NetTCPConnection plutôt qu'un parsing de `netstat` : sa sortie est
    // localisée (l'état « LISTENING » se traduit), le cmdlet non.
    const raw = powershell(
      `(Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue).OwningProcess`,
    );
    return [
      ...new Set(
        raw
          .split('\n')
          .map((line) => line.trim())
          .filter((pid) => /^\d+$/.test(pid) && pid !== '0'),
      ),
    ];
  }
  return sh('lsof', ['-ti', `tcp:${PORT}`, '-sTCP:LISTEN'])
    .split('\n')
    .filter(Boolean);
}

/** { commandLine, parentPid } d'un PID, ou null s'il n'existe plus. */
function describe(pid) {
  if (IS_WINDOWS) {
    const raw = powershell(
      `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; if ($p) { "$($p.ParentProcessId)|$($p.CommandLine)" }`,
    ).trim();
    if (!raw) return null;
    const [parentPid, ...rest] = raw.split('|');
    return { parentPid, commandLine: rest.join('|') };
  }
  const commandLine = sh('ps', ['-o', 'command=', '-p', pid]).trim();
  if (!commandLine) return null;
  const parentPid = sh('ps', ['-o', 'ppid=', '-p', pid]).trim();
  return { parentPid, commandLine };
}

/** Ne reconnaît que les process de CE dépôt, pour ne jamais tuer à l'aveugle. */
function isOurs(commandLine) {
  if (!commandLine) return false;
  const normalized = commandLine.replace(/\\/g, '/').toLowerCase();
  const here = API_DIR.replace(/\\/g, '/').toLowerCase();
  return (
    normalized.includes('src/main.ts') ||
    normalized.includes(`${here}/src/main`) ||
    (normalized.includes('start:dev') && normalized.includes('api'))
  );
}

function kill(pid, label) {
  try {
    process.kill(Number(pid), 'SIGKILL');
    console.log(`  arrêté  PID ${pid}  (${label})`);
  } catch {
    /* déjà mort */
  }
}

if (await isPortFree()) {
  console.log(`Port ${PORT} libre.`);
  process.exit(0);
}

console.log(`Port ${PORT} occupé, recherche du process...`);

const seen = new Set();
let killedSomething = false;

for (const pid of listeners()) {
  // On remonte la chaîne des parents : l'écouteur est l'enfant de `node
  // --watch`, lui-même enfant du wrapper pnpm. Tuer le seul écouteur laisse le
  // watcher relancer un serveur.
  let current = pid;
  for (let depth = 0; current && depth < 5 && !seen.has(current); depth++) {
    seen.add(current);
    const info = describe(current);
    if (!info || !isOurs(info.commandLine)) {
      if (depth === 0) {
        console.error(
          `\nLe port ${PORT} est occupé par un process qui n'est pas cette API :\n` +
            `  PID ${current} — ${info?.commandLine ?? '(inconnu)'}\n\n` +
            `Arrête-le toi-même, ou change PORT dans apps/api/.env.`,
        );
        process.exit(1);
      }
      break;
    }
    kill(current, info.commandLine.slice(0, 60));
    killedSomething = true;
    current = info.parentPid;
  }
}

if (!killedSomething) {
  console.error(`Port ${PORT} occupé mais aucun process identifiable. Vérifie manuellement.`);
  process.exit(1);
}

for (let i = 0; i < 20; i++) {
  if (await isPortFree()) {
    console.log(`Port ${PORT} libéré.`);
    process.exit(0);
  }
  await new Promise((done) => setTimeout(done, 250));
}

console.error(`Port ${PORT} toujours occupé après nettoyage.`);
process.exit(1);
