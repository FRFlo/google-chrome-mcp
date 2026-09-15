.PHONY: up down logs smoke build

up:
	@test -f .env || cp .env.example .env
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f chrome-mcp

build:
	docker build -t google-chrome-mcp:local .

smoke:
	bash tests/smoke.sh

