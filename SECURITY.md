# Security Policy

## Supported Versions

This project is in active local-first development. The default branch is the only supported line for security updates.

## Threat model (read this first)

Reel Studio is designed as a **single-user, local-first** app (localhost / Docker on `127.0.0.1`).

| Mode | Status |
| --- | --- |
| `npm run dev` / Docker on **127.0.0.1** | Supported |
| Binding to LAN / public internet **without** additional auth | **Not supported** — treat as unsafe |
| Multi-tenant SaaS hosting | Out of scope today |

If you expose the app beyond loopback, you must put your own authentication / reverse proxy in front and set `REEL_STRICT_AUTH=1`. See [Hosting](#hosting--network-exposure).

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for sensitive security reports.

1. Prefer [GitHub Security Advisories](https://github.com/mohitkale/reel-studio/security/advisories/new) (private vulnerability reporting), or email the maintainer at **mr.mohit44@gmail.com**.
2. Include reproduction steps, impact, and affected files/versions.
3. If possible, include a minimal patch suggestion.

We aim to acknowledge reports within 7 days.

## Hosting / network exposure

Hardening already in this repo:

- Native dev/start bind to `127.0.0.1`; `REEL_BIND_HOST` or CLI `-H`/`--hostname` explicitly overrides this
- All API/media handlers require authorization, including GET and progress streams
- Raw Host is checked against loopback names plus `REEL_ALLOWED_HOSTS` before any browser signal or token; Proxy repeats the Host check for pages and static routes
- Strict mode requires a valid bearer token even with `Sec-Fetch-Site: same-origin`
- `/media/*` is not world-readable on non-loopback hosts
- HyperFrames local path resolution checks real paths under `media/` / `public/music/`, including external symlinks
- Export media requests revalidate DNS at socket lookup and every redirect; private, mixed-public/private, mapped-IP and special-address targets are rejected
- Chromium receives local media files; remote HTML, SVG and playlists disguised as media are rejected before native probing
- Targeted CSP `frame-ancestors` and SAMEORIGIN framing headers restrict embedding; same-origin previews remain supported
- VoiceForge proxies require `authorize()`
- MCP token is returned **once** on generate/rotate; GET only reports configured status
- Docker Compose publishes `127.0.0.1:3000` only
- Asset uploads reject SVG, check media signatures, and count streamed bytes before multipart parsing
- Lottie previews use the expression-free light player; uploaded expressions are not executed
- Provider key writes reject line breaks and dotenv metacharacters before touching disk

**Local process trust:** in default mode, local scripts and processes can call
loopback APIs without a token and perform web actions, including approvals.
MCP scopes and approval restrictions apply to requests presenting MCP credentials,
not to every process on the host. Host and Fetch Metadata headers do not identify
the client or prove human interaction. Do not share the host with untrusted code.

`REEL_STRICT_AUTH=1` rejects uncredentialed API/media requests regardless of browser
headers. This mode has no browser login/session: the ordinary browser UI cannot
use APIs or media, and bearer automation cannot access web-only settings or
approve jobs. A remotely usable browser deployment needs its own session/auth
integration. Strict mode alone does not implement that integration.

Still **your** responsibility when hosting:

- TLS termination and a real login / SSO if users are untrusted
- Network firewall; do not publish port 3000 to `0.0.0.0`
- Rotate provider API keys and MCP tokens
- Set `REEL_STRICT_AUTH=1`, and add the proxy hostname to `REEL_ALLOWED_HOSTS`
- Preserve an allowed raw Host through the proxy; `X-Forwarded-Host` and `TRUST_PROXY` do not bypass the Host guard

## Secret Handling Rules

- Never commit real secrets, tokens, or private keys.
- Keep runtime keys in `.env.local` only.
- `.env.example` must contain placeholders only.
- Use `npm run security:scan` before creating commits / PRs.

## Pre-Commit Secret Scan

Local git hooks live in `.githooks/` (`pre-commit` secret scan).

Enable once per clone:

```bash
npm run prepare:hooks
```

Then each commit scans the index with `node scripts/scan-secrets.mjs --staged` and blocks staged secrets, even if the working copy has already been cleaned. Findings redact values.

## Scope

The scanner checks tracked files (or staged content in the hook) for key signatures, opaque assigned provider tokens, and private key headers. It is a guardrail, not a guarantee. Runtime secret files use POSIX owner-only modes where supported; Windows protection depends on the account/directory ACL.

HyperFrames Chromium runs without its OS sandbox. Media signature checks are not full decoder validation, and the CSP does not restrict inline preview scripts. Do not treat uploaded media or local code as safely isolated from your account. The development Docker source mount is writable by the container; named volumes and a non-root user do not make it a hostile-code sandbox.

See [portability and hardening](docs/PORTABILITY_HARDENING.md) for byte limits, tests and remaining advisory reachability. Browser previews may still request public media directly; export DNS pinning does not claim to protect arbitrary browser DNS resolution.
