# Shared Ubuntu / code-server deployment

This assumes Docker Engine and the Compose plugin are already installed on the EC2 Ubuntu instance.

## First deployment

```bash
git clone <your-repository-url> cypher
cd cypher
cp .env.example .env
sed -i 's/replace-this-with-a-long-random-secret-at-least-32-characters/<generate-a-real-secret>/' .env
docker compose up -d --build
docker compose ps
```

The frontend is the team entry point at port `3000`. Keep `5432`, `9090`, and `3001` restricted to the team or private network. If the dashboard is exposed publicly, put it behind HTTPS and an authenticated reverse proxy before sharing it.

## Shared code-server workflow

All teammates can open the same checked-out directory in code-server. The app runtime is isolated in Docker, so editing source files does not modify the host Python/Java/.NET installations. Rebuild only the service you changed during development:

```bash
docker compose up -d --build gateway
docker compose logs -f gateway
```

For a full reset of the development database, remove only the named project volume and start again:

```bash
docker compose down
docker volume rm cypher_postgres-data
docker compose up -d --build
```

## Service map

| Service | Host port | Container port | Purpose |
| --- | ---: | ---: | --- |
| Frontend | 3000 | 80 | React operations cockpit |
| Gateway | 8081 | 8080 | JWT API and WebSocket broker |
| AI engine | 5000 | 5000 | FastAPI inference boundary |
| Reporting | 5001 | 5001 | Reports and alert processing |
| PostgreSQL | 5432 | 5432 | Persistent relational data |
| Prometheus | 9090 | 9090 | Metrics scrape endpoint |
| Grafana | 3001 | 3000 | Metrics dashboard |
| Jenkins | 8082 | 8080 | Optional deployment automation |

## Demo API path

```bash
curl -X POST 'http://localhost:5000/demo/threat?camera_id=1'
curl http://localhost:5001/api/reports/incidents.csv
```

The AI service submits an incident using `X-Service-Key`; the gateway persists detections and the incident in one transaction, PostgreSQL creates a pending alert with its trigger, the reporting worker marks it dispatched, and the gateway broadcasts the incident to subscribed dashboards.
