// Optional placeholder web server on $PORT.
// Some bot-hosting panels expect the app to bind the assigned web port;
// the tunnel itself is outbound-only and does not need this server.
// It answers a plain "ok" so platform health checks have something to hit.
const http = require('http');
const port = parseInt(process.env.PORT || '3000', 10);
const srv = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok\n');
});
srv.on('error', (e) => {
  // Port already held by a previous instance after a supervisor restart:
  // not fatal — the tunnel processes are what matter.
  console.log(`[agsbx-min] web placeholder not started (${e.code || e.message})`);
});
srv.listen(port, '0.0.0.0', () => console.log(`[agsbx-min] web placeholder on :${port}`));
