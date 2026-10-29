# agsbx-min-bot

Minimal [argosbx](https://github.com/yonggekkk/argosbx) runner for
**Discord-bot hosting rooms** (BotKeep, MWS, Bot-Hosting.net and similar
panels). It runs exactly two things — **xray** (VMess-WS) and **cloudflared**
(fixed Argo tunnel) — and nothing else: no SSH, no TTYD, no extra cores.

It is the bot-room counterpart of the `zvps-unikraft-autostart` Docker
image: same autostart idea, packaged for rooms that cannot run Docker.

## How it works

- `index.js` — zero-dependency Node launcher; spawns `start.sh` and
  restarts it if it exits (the pattern bot panels expect for a main file).
- `start.sh` — validates env, then runs the argosbx installer and
  supervises: if xray **and** cloudflared both vanish, it re-runs the
  installer to bring them back.
- **Offline-first**: the installer script is bundled in `vendor/`, and if
  you drop genuine `xray` / `cloudflared` binaries into `vendor/` too,
  `start.sh` seeds them into the install dir at boot — a constrained room
  never has to download ~40 MB binaries at runtime (in-room downloads are
  exactly what fails on small plans). Every seeded or pre-existing binary
  must pass a version probe; a truncated leftover from a killed download
  is deleted and replaced instead of being kept forever. Downloads remain
  only as a fallback when `vendor/` has no binary.
- `server.js` — optional placeholder web server on `$PORT`. Some panels
  expect the app to bind the assigned web port. The tunnel is
  outbound-only and does not use it.
- The tunnel carries the traffic: the provider only needs **outbound**
  internet. No inbound port is published or required.

## Deploy (any Discord-bot provider)

0. **Size the room first.** The stack needs roughly 512 MB RAM and
   ≥ 200 MB free disk to install and run comfortably. Some panels create
   servers with a tiny default slice (BotKeep defaulted to 64 MB RAM /
   64 MB storage): at that size the installer's downloads get OOM-killed
   mid-transfer. If the panel lets you adjust resource allocation, raise
   it to your plan's maximum **before** the first start.
1. Create a **Node.js** bot/app on the provider.
2. Upload `index.js`, `package.json`, `server.js`, `start.sh` and the
   `vendor/` folder (set the main/start file to `index.js` if the panel
   asks). If the panel caps upload size per file, use its SFTP instead —
   the daemon binaries below are tens of MB.
3. Optional but recommended: pre-bundle the daemon binaries into
   `vendor/` (both are official release builds; verify the hashes):
   ```sh
   curl -fL https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip -o /tmp/xray.zip
   unzip -o /tmp/xray.zip xray -d vendor && chmod +x vendor/xray
   # Xray 26.10.21, sha256 a27e3f95ab6ce270956d0cecd32eda4686a811afc71c64a6a734a3dede14883e
   curl -fL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o vendor/cloudflared
   chmod +x vendor/cloudflared
   # cloudflared 2026.10.5, sha256 e1bc0cf084fd9e590554fe769a86b1db46701c3f847a43d902f7b974a4e16298
   ```
   (The two binaries are deliberately not committed to this repo — see
   `.gitignore`.)
4. In the panel's **environment variables** UI, set:
   - `UUID` — a fresh UUID for this deployment
   - `AGN` — the tunnel hostname, e.g. `cf-tunnel-<name>.example.org`
   - `AGK` — that tunnel's Cloudflare token (see `env.example`)
   - `VMPT` — optional, default `8001`
5. Start the bot and watch the console:
   - `[agsbx-min] AGK length: 240 (tokens run ~184-240 chars)` — token
     copied intact
   - the argosbx log tail should end with the install success banner
6. Verify from outside: `curl -o /dev/null -w '%{http_code}' https://<AGN>/`
   → **404 means the request reached xray through the tunnel (success)**;
   530 means the tunnel is not connected.

## Resource footprint

xray + cloudflared together use roughly 100–150 MB RAM and a few hundred
MB of disk (binaries + logs) — sized for free bot tiers (e.g. 256–512 MB).

## Provider notes

- **BotKeep (botkeep.cloud): deployed and verified 2026-10-29.**
  - No Docker route exists (runtimes are language templates only); use
    the files route.
  - The panel **console input is NOT a shell** — keystrokes go to the
    app's stdin. You cannot run shell commands there; manage everything
    through files, env and restarts. The node list the installer would
    print via `agsbx list` is equally available as the generated
    `agsbx/jhsub.txt` file.
  - Files upload caps at **4 MB per file** — larger files need the
    panel's SFTP.
  - Panel env vars arrive as a `.env` file next to the app; the startup
    command must source it (`set -a; ../.env; set +a`) or the app sees
    no env at all.
  - The room image may lack `curl` **and** `wget`, both of which the
    installer's download steps call. The repo bundles a zero-dependency
    Node shim under `tools/` that answers to both names; `start.sh`
    installs whichever is missing into `bin/` automatically, so nothing
    needs to be improvised in the panel.
  - **Risk warning:** BotKeep's operator bans proxy hosting and detects
    it (an earlier account was suspended with that exact reason). This
    package does nothing to disguise itself. Deploy there only if you
    accept that the account may be suspended.
- **MWS (cloud.m-ws.cc): DO NOT DEPLOY (as of 2026-10-29).** A live probe
  confirmed MWS bot rooms still cannot reach the Cloudflare tunnel edge:
  quick-tunnel requests to `api.trycloudflare.com` time out, and the
  earlier named tunnel (roaming6) has been down since 2026-10-26 with the
  same platform-side egress failure. The package installs fine there —
  the tunnel simply never connects. Re-probe before deploying.
- Other providers: run the same 10-minute probe idea first (any
  cloudflared quick tunnel). If a trycloudflare URL gets assigned and
  serves traffic, the real deployment will work.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| cloudflared exits instantly, "token is not valid" | AGK was mangled in copy-paste (length outside ~184–240) | Re-copy from the dashboard (Add a replica) or fetch via the Cloudflare API; compare length/sha256 |
| Installer download processes get `Killed`; binaries missing or tiny | Room RAM too small (default slice) — downloads OOM-killed mid-transfer | Raise the server's resource allocation to the plan maximum, restart |
| Installer "succeeds" but a daemon never stays up | Truncated binary left by a killed download (exists, but cannot run) | `start.sh` v1.1 probes and deletes invalid binaries automatically; if hand-running, delete `~/agsbx/<binary>` and re-run |
| Tunnel probe = 530 | cloudflared not connected (bad token, or provider blocks Cloudflare egress) | Check console for the token error; if the token is valid, the provider's egress is the wall — see MWS note |
| Everything dies after ~7 days | The bot's free-tier timer expired | Restart/reset the bot per the provider's renewal rule |

## Files

```
index.js         launcher (main file)
package.json     main: index.js
server.js        optional $PORT placeholder
start.sh         env check, vendor seeding, installer runner + supervisor
env.example      the env contract (placeholders only)
vendor/          argosbx.sh (bundled installer); xray/cloudflared binaries
                 are fetched per Deploy step 3 and git-ignored
tools/           curl + wget Node shims for images that ship neither;
                 start.sh auto-installs them into bin/ when missing
Dockerfile       OPTIONAL minimal Docker variant (untested where authored)
```
