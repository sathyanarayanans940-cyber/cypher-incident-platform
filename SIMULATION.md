# Cypher simulation and small-instance operation

Open the app on port 3000. Live Cockpit, Incidents, Incident Details, Camera Network,
and Analytics & Reports follow the six-screen Figma reference. Navigation, filters,
camera creation/pause, incident review, analyst notes, CSV exports and printable
reports are connected to working actions.

## Use the simulator

1. Choose an enabled camera and a scene in Simulation studio.
2. Run scene analyzes nine sampled frames. Shuffle & loop randomly chooses both
   the camera and scenario between runs. Stop cancels the current client request.
3. Animation runs at up to 20 fps on the laptop; Python receives approximately one
   320×180 PNG each second, only while the simulation is active and the tab visible.
4. Geometry is measured from the PNG. Scenario names and desired priorities are
   not sent to the detector. Person displacement and distance are tracked over time.
5. After three samples, actionable events are saved once per scenario. Safe scenes
   produce detections but no incidents. Event IDs also deduplicate across retries.
6. Open a saved incident to review its original frame, acknowledge, assign, resolve,
   escalate, mark a false positive, or add persistent analyst notes.

| Scene / measured evidence | Result |
| --- | --- |
| Tapered blade; distance between people decreases | Critical |
| Tapered blade, without directed approach | High |
| Horizontal person silhouette | High health event |
| Ambiguous elongated object / unattended bag | Medium |
| Empty or obscured scene | Low camera review |
| Bottle, phone, normal walking | Safe; no incident |

This is an **illustrated-domain computer-vision demonstration**, not a trained AI
model for real CCTV. It uses connected components, silhouette geometry, and motion
history. Shape-match scores are heuristics, not calibrated probabilities. It cannot
reliably recognize arbitrary real knives, weapons, falls, or benign objects. Real
camera recognition requires labelled training/evaluation data and an appropriate
model. The UI explicitly labels all generated camera feeds as simulation.

## Resources

Default services: Postgres, Java gateway, Python vision engine, Nginx frontend.
Their hard memory caps total 544 MiB (100 + 320 + 100 + 24). Actual usage is lower;
the Ubuntu kernel, Docker, code-server, and filesystem cache need the remaining RAM.
The existing swap is left as configured. No video is recorded; one compressed
evidence frame is stored with each incident. History is retained in Postgres and
the UI loads the latest 1,000 incidents, with pagination/filtering in the browser.
No event data is deleted automatically. Stop continuous simulation when done.

Grafana and Prometheus are optional (`--profile observability`). The C# reporting
service is optional (`--profile reporting`); CSV and Print / Save as PDF work in the
browser without it. Optional service volumes remain available. Logging rotates at
5 MB × 2 files per container. Python uses Pillow instead of OpenCV/NumPy, a single
worker, limited concurrent requests, and at most 64 short-lived tracking sessions.

Use `docker compose up -d` for routine startup. There is no need to rebuild on
every start. For an updated frontend, preferably build with `npm ci && npm run build`
on the development laptop, upload `frontend/dist`, then:

```bash
docker compose -f docker-compose.yml -f docker-compose.prebuilt.yml build frontend
docker compose -f docker-compose.yml -f docker-compose.prebuilt.yml up -d --no-build frontend
```

This avoids installing Node dependencies on the 1 GB server. Full-source Docker
builds are still available through the normal frontend Dockerfile.

## Verification

`scripts/check-simulation.mjs` renders test frames with the exact frontend drawing
code; `services/ai-engine/test_vision.py` checks all nine scenarios, input limits,
idempotency, and the no-incident path for a bottle. `npm run build --prefix frontend`
checks TypeScript and creates production assets.

`scripts/deploy-small.sh` backs up affected remote source files under `.backups`,
tags the old service images `before-simulation`, builds serially, applies the
additive database migration, and starts the four services. It preserves `.env`
and all database volumes. No broad Docker prune or database reset is performed.
