# Cypher incident platform

Semester 5 academic team project, currently in progress. Cypher connects an illustrated camera simulator, a CPU-only vision service, incident management, a relational database and a React operations dashboard.

## Implemented in this snapshot

- React and TypeScript dashboard with camera controls, incident review, analyst notes, CSV export and printable reports.
- Python and FastAPI service analyzing PNG frames using connected components, silhouette geometry and temporal motion history.
- Java and Spring Boot gateway with JWT authentication, incident ingestion and WebSocket updates.
- PostgreSQL schema with JSONB evidence, relational constraints, priority rules and alert triggers.
- Docker Compose packaging, plus optional C# reporting and observability services.

**Scope:** the detector processes illustrated simulation scenes. It is not a trained CCTV recognition model. Shape scores are heuristics rather than calibrated probabilities. Real camera recognition, external emergency dispatch and production deployment are future work.

## Run locally

Prerequisites: Docker with Compose. For frontend development, Node.js 20 or later.

```sh
cp .env.example .env
docker compose up --build
```

Open http://localhost:3000. The development-only login is `admin@cypher.local` / `changeme`. The example secrets are placeholders; replace them before using a shared deployment.

Choose a camera and scene in Simulation studio. Run a scene, then review the persisted incident and its evidence frame. Safe scenes produce detections without an incident.

## Source map

| Directory | Purpose |
| --- | --- |
| `frontend/` | React dashboard and illustrated scene renderer |
| `services/ai-engine/` | FastAPI service and geometry-based vision |
| `services/gateway/` | Spring Boot APIs and authentication |
| `services/reporting/` | Optional C# reporting worker |
| `database/` | PostgreSQL schema and migrations |
| `artifacts/simulation-frames/` | Synthetic frames used by vision tests |

## Checks

```sh
cd frontend
npm ci
npm run build
cd ../services/ai-engine
python3 -m pip install -r requirements-dev.txt
python3 -m unittest test_vision
```

The vision checks cover nine simulated scenes, invalid input, repeat-request handling and safe-scene behavior. See `SIMULATION.md` for the current simulator design and `DEPLOYMENT.md` for development deployment details. Coursework hand-in files and private infrastructure credentials are omitted from this public snapshot.

This is collaborative academic work. It does not claim sole authorship of every component.
