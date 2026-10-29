// agsbx-min-bot launcher: supervises start.sh, restarts it if it exits.
// Deliberately tiny, zero dependencies — the same pattern as zvps-mws.
const { spawn } = require('child_process');

let child = null;
let stopping = false;

function start() {
  child = spawn('bash', ['start.sh'], { stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    console.log(`[agsbx-min] start.sh exited (code=${code}, signal=${signal})`);
    if (!stopping) {
      console.log('[agsbx-min] restarting in 5s');
      setTimeout(start, 5000);
    }
  });
  child.on('error', (err) => {
    console.error('[agsbx-min] failed to spawn start.sh:', err.message);
    if (!stopping) setTimeout(start, 5000);
  });
}

process.on('SIGTERM', () => { stopping = true; if (child) child.kill('SIGTERM'); });
process.on('SIGINT', () => { stopping = true; if (child) child.kill('SIGINT'); });

start();
