# ADR-0010: Port-Based Service Isolation

## Status

Accepted

## Context

The initial Docker architecture used a single nginx container with path-based routing to serve both the Web POS and Admin Panel applications from the same server. This approach introduced several challenges:

1. **Complex nginx configuration** - Required careful ordering of location blocks and special handling for static assets
2. **Path collision risks** - Admin's `/assets/*` and web's `/assets/*` could conflict
3. **Maintenance burden** - Each new route addition required nginx config updates
4. **Debugging difficulty** - 404 errors were difficult to trace due to overlapping location blocks

### Original Architecture

```
                    ┌─────────────────┐
                    │   nginx:80      │
Client ───────────► │  /        ──►  │ ──► web dist (/)
                    │  /admin/  ──►  │ ──► admin dist (/admin/)
                    │  /api/v1/* ──► │ ──► api:3000
                    └─────────────────┘
```

## Decision

We will use **port-based service isolation** where each application runs in its own container on a dedicated port.

### New Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   nginx:80      │     │   nginx:80      │     │   bun:3000      │
│   pos-web       │     │   pos-admin     │     │   pos-api       │
│   port 8080     │     │   port 8081     │     │   port 3000     │
│                 │     │                 │     │                 │
│  /        ──►   │     │  /        ──►   │     │  /api/v1/*      │
│  /assets/* ──►  │     │  /assets/* ──►  │     │                 │
│  /api/* ──►     │     │  /api/* ──►     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       localhost:8080          localhost:8081          localhost:3000
```

## Consequences

### Positive

1. **Simplified nginx configs** - Each app has a simple, self-contained nginx config
2. **No path conflicts** - Each app owns its entire URL space
3. **Independent scaling** - Each service can be scaled independently
4. **Easier debugging** - Clear separation of concerns
5. **Independent deployments** - Web and admin can be deployed separately

### Negative

1. **Multiple ports to manage** - Must remember different ports (8080, 8081, 3000)
2. **More containers** - Slightly higher resource usage
3. **Reverse proxy needed for production** - For single-port access in production

## Implementation

### Files Changed

| File | Change |
|------|--------|
| `docker-compose.yml` | Split `frontend` into `web` (8080) and `admin` (8081) |
| `docker-compose.prod.yml` | Split `frontend` into `web` (80) and `admin` (8081) |
| `Dockerfile.web` | Created - builds web with simple nginx config |
| `Dockerfile.admin` | Created - builds admin with simple nginx config |
| `Dockerfile.frontend` | Deleted - no longer needed |
| `apps/web/nginx.conf` | Created - simple nginx for web |
| `apps/admin/nginx.conf` | Created - simple nginx for admin |
| `.env.example` | Updated - added WEB_PORT and ADMIN_PORT |

### URLs

| Service | Development | Production |
|---------|-------------|------------|
| Web POS | `http://localhost:8080/` | `http://localhost:80/` |
| Admin Panel | `http://localhost:8081/` | `http://localhost:8081/` |
| API | `http://localhost:3000/api/v1/*` | `http://localhost:3000/api/v1/*` |

## Alternatives Considered

### Subdomain-Based Routing
- Each app on its own subdomain (`pos.example.com`, `admin.example.com`)
- Requires DNS configuration and reverse proxy (Traefik)
- **Rejected** - adds complexity for development environment

### Path-Based Routing (Original)
- Single container with complex nginx config
- **Rejected** - maintenance burden and path collision risks

### Nginx Proxy Manager
- GUI-based reverse proxy
- **Rejected** - additional component to manage

## Rollout Plan

1. Build new Docker images:
   ```bash
   docker compose build web admin
   ```

2. Start services:
   ```bash
   docker compose up -d
   ```

3. Verify each service:
   - `http://localhost:8080/` - Web POS
   - `http://localhost:8081/` - Admin Panel
   - `http://localhost:3000/api/v1/health` - API

4. Update any existing containers:
   ```bash
   docker compose down
   docker compose up -d
   ```

## Notes

For production deployments requiring single-port access, consider adding a reverse proxy (Traefik, Nginx, or Caddy) to route subdomains to the appropriate internal ports.
