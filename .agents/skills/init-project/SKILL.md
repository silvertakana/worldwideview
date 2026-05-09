---
name: init-project
description: Use when initializing a new project locally — runs setup commands to configure environment, install dependencies, start databases, and validate the dev server is working.
---

# Initialize Project

Run the following commands to set up and start the project locally:

## 1. Create Environment File
```bash
cp .env.example .env
```
Creates your local environment configuration from the example template.

## 2. Install Dependencies
```bash
uv sync
```
Installs all Python packages defined in pyproject.toml.

## 3. Start Database
```bash
docker-compose up -d db
```
Starts PostgreSQL 18 in a Docker container on port 5433.

## 4. Run Database Migrations
```bash
uv run alembic upgrade head
```
Applies all pending database migrations.

## 5. Start Development Server
```bash
uv run uvicorn app.main:app --reload --port 8123
```
Starts the FastAPI server with hot-reload on port 8123.

## 6. Validate Setup

Check that everything is working:

```bash
# Test API health
curl -s http://localhost:8123/health

# Test database connection
curl -s http://localhost:8123/health/db
```

Both should return `{"status":"healthy"}` responses.

## Access Points

- Swagger UI: http://localhost:8123/docs
- Health Check: http://localhost:8123/health
- Database: localhost:5433

## Cleanup

To stop services:
```bash
# Stop dev server: Ctrl+C
# Stop database: docker-compose down
```
