# Infrastructure — Piston Code-Execution VM

> Oracle Cloud A1 (2 OCPU / 12 GB RAM, Ampere aarch64) running Piston behind a Caddy reverse proxy.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **OS** | Ubuntu 22.04+ or Debian 12+ (aarch64) on Oracle Cloud |
| **Docker** | `>= 24.x` with the Compose V2 plugin (`docker compose`) |
| **Open ports** | Only **port 2001** needs to be reachable from the internet (or restricted to [Vercel's IP range](https://vercel.com/docs/security/deployment-protection)) |

---

## Quick Start

### 1. Configure the shared secret

```bash
cd infrastructure/
cp .env.example .env
nano .env          # Replace the placeholder with a strong random string
```

> **Tip:** Generate a secret with `openssl rand -base64 32`.

### 2. Start the services

```bash
docker compose up -d
```

Caddy and Piston will start.  Caddy listens on **port 2001** (HTTP) and
forwards authenticated requests to Piston on the internal Docker network.

### 3. Install language runtimes

Piston ships with no runtimes by default.  Install the ones Tech Track needs:

```bash
docker compose exec piston /bin/sh -c \
  "piston ppman install python && \
   piston ppman install gcc    && \
   piston ppman install g++"
```

### 4. Verify

```bash
# Should return 403 (no secret header)
curl -s -o /dev/null -w "%{http_code}" http://localhost:2001/api/v2/runtimes

# Should return 200 + a JSON array of installed runtimes
curl -H 'X-Piston-Secret: YOUR_SECRET' http://localhost:2001/api/v2/runtimes
```

Or from the project root (on your dev machine), run the automated health check:

```bash
npx tsx scripts/test-piston-health.ts
```

---

## Firewall Notes

Only **port 2001** needs to be open.  You can further restrict it to Vercel's
edge IPs if you want defense-in-depth on top of the shared secret.

Ports 80 and 443 are exposed in `docker-compose.yml` for future use (e.g., if
you add a domain name and want Caddy to auto-provision a TLS certificate).
They can safely remain closed in the Oracle Cloud security list until needed.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `curl` returns **connection refused** | Is Docker running? `docker compose ps` |
| `curl` returns **403** with the secret | Double-check `.env` — the secret must match exactly |
| Runtimes list is empty | Re-run the `piston ppman install` commands above |
| Out-of-memory kills | Reduce Piston's memory limit in `docker-compose.yml` |
