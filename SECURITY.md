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

- Mutating APIs require same-origin browser signals, loopback, or a valid MCP bearer token
- `/media/*` is not world-readable on non-loopback hosts
- HyperFrames local path resolution is contained under `media/` / `public/music/`
- Scene background URLs reject private/link-local hosts (SSRF guard)
- VoiceForge proxies require `authorize()`
- MCP token is returned **once** on generate/rotate; GET only reports configured status
- Docker Compose publishes `127.0.0.1:3000` only
- Asset uploads reject SVG and enforce a size cap

Still **your** responsibility when hosting:

- TLS termination and a real login / SSO if users are untrusted
- Network firewall; do not publish port 3000 to `0.0.0.0`
- Rotate provider API keys and MCP tokens
- Set `REEL_STRICT_AUTH=1` (and optionally `TRUST_PROXY=1` only behind a proxy you control)

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

Then each commit will run `npm run security:scan` and block commits that appear to contain secrets.

## Scope

The scanner checks tracked files for common secret signatures (API key patterns and private key headers). It is a guardrail, not a guarantee.
