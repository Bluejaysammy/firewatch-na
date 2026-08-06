# Security policy

## Supported version

The `main` branch is the only supported version; deploys should track it.

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** ("Security" tab →
"Report a vulnerability" on this repository) rather than opening a public
issue. Include reproduction steps and affected routes. You should receive an
acknowledgement within a few days.

Notes for reporters:

- The app stores no user data and requires no accounts; the interesting
  surface is the API proxy layer (`src/app/api/*`) — input validation,
  SSRF-style URL handling, and rate limiting.
- API keys for optional layers live server-side only; any way to extract
  them through the tile proxies is in scope.
