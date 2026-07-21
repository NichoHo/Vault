.PHONY: up down seed test fmt vet

up:
	docker compose up --build -d

down:
	docker compose down -v

seed:
	go run ./cmd/seed

test:
	go test -p 1 ./...

fmt:
	gofmt -w .

vet:
	go vet ./...
