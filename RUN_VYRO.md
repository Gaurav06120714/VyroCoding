# Run VyroCoding with VyroLang (native VyroVM)

This launches the full VyroCoding platform with **VyroLang running on the native VyroVM** — Judge0 is bypassed for `.vy` programs. You write VyroLang in the browser, hit Run, and it compiles to bytecode and executes on the VM built in the [VyroLang](https://github.com/Gaurav06120714/VyroLang) repo.

## Prerequisites

- Docker (Desktop or Engine) with Compose v2
- The **VyroLang repo checked out next to this one**:

  ```
  parent/
  ├── VyroCoding/   ← you are here
  └── VyroLang/     ← git clone https://github.com/Gaurav06120714/VyroLang.git
  ```

## One command

```bash
./scripts/run-vyro.sh
```

or directly:

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.vyro.yml up --build
```

Then open **http://localhost:3002**, pick **“VyroLang (native VyroVM)”** in the language dropdown, and Run. Try:

```vy
let a = int(input())
let b = int(input())
print(a + b)
```

## What the overlay does

`docker-compose.vyro.yml` adds a throwaway `vyro-build` service (Rust + musl) that compiles the `vyro` binary from `../VyroLang/impl` into a shared volume, matching the alpine API image and your host architecture. The API then runs with `VYRO_BIN=/vyro/vyro`, so the execution dispatcher routes VyroLang to the VM and everything else to Judge0. See [docs in VyroLang](https://github.com/Gaurav06120714/VyroLang/blob/main/docs/10-cloud/VYROCODING_INTEGRATION.md).

## Run natively (no Docker)

If you'd rather use local Node + pnpm and only containerize the databases:

```bash
# 1. Build the VM
cd ../VyroLang/impl && cargo build --release && cd -

# 2. Start just Postgres + Redis
docker compose -f docker-compose.dev.yml up -d postgres redis

# 3. Run the apps with the VM wired in
export VYRO_BIN="$(cd ../VyroLang/impl && pwd)/target/release/vyro"
pnpm install
pnpm dev
```

Web on http://localhost:3002, API on http://localhost:3003.

## Ports

| Service | URL |
|---|---|
| Web (Next.js) | http://localhost:3002 |
| API (Fastify) | http://localhost:3003 |
| Collab (WS) | ws://localhost:1234 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |
