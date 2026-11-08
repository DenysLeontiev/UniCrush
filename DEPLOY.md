# Deploying ЮніКраш (UniCrush) on the home VPS

Live at **https://app.unicrush.online**.

```
Internet ──► Cloudflare ──► cloudflared ──────────► host:8081 ──► nginx ──► client   (Angular static files)
            (TLS, DNS)     (your own container,                       └───► api:5166 (/api, /hubs, /swagger) ──► postgres
                            separate from this repo)
```

This repo's [compose.yaml](compose.yaml) runs the app; the Cloudflare tunnel connector is **not** part of it —
it runs separately on the VPS with your token. The server needs no public IP and no open inbound ports.

| Service    | What it does                                                                 |
|------------|------------------------------------------------------------------------------|
| `postgres` | Postgres 17, data in the `pgdata` Docker volume. Bound to `127.0.0.1:5432` only. |
| `api`      | .NET 10 API. Applies EF migrations, then syncs teachers from the newest scraper output on every start. |
| `client`   | Angular app served by its own small Nginx.                                    |
| `nginx`    | Entry point on host port **8081**. Routes `/api/`, `/hubs/` (WebSockets), `/swagger` to the API, everything else to the client. |
| `scraper`  | One-off job (not started by `up`): scrapes lpnu.ua into the `scraper-data` volume. See *Updating the teacher list*. |

## Where the settings live

No `.env` files — everything is in config files:

| Setting | File |
|---|---|
| DB connection string, `ClientUrl` (production) | [TeachersRating.API/appsettings.json](TeachersRating.API/appsettings.json) |
| DB connection string, `ClientUrl` (local dev)  | [TeachersRating.API/appsettings.Development.json](TeachersRating.API/appsettings.Development.json) |
| Site URL + API URLs for Angular (production)   | [TeachersRating.Client/src/environments/environment.ts](TeachersRating.Client/src/environments/environment.ts) — API URLs are relative (`/api`, `/hubs`) |
| Site URL + API URLs for Angular (`ng serve`)   | [TeachersRating.Client/src/environments/environment.development.ts](TeachersRating.Client/src/environments/environment.development.ts) |
| Routing / proxy rules                          | [nginx/nginx.conf](nginx/nginx.conf) |
| Postgres user/password, Nginx host port        | [compose.yaml](compose.yaml) |

**The Postgres password appears in three places and must match:** `compose.yaml` (`POSTGRES_PASSWORD`),
`appsettings.json` and `appsettings.Development.json`. Postgres only reads `POSTGRES_PASSWORD` when it first creates
the `pgdata` volume — changing it later needs `ALTER USER` inside Postgres (or deleting the volume).

## 1. Cloudflare: add app.unicrush.online to your tunnel

In **Zero Trust → Networks → Tunnels → (your tunnel) → Public Hostname → Add a public hostname**:

- Subdomain: `app` · Domain: `unicrush.online` · Path: empty
- Service type: `HTTP` · URL: depends on how your cloudflared container is networked:

| Your cloudflared runs with… | Service URL |
|---|---|
| `network_mode: host` | `localhost:8081` |
| a normal Docker network (default) | `<VPS LAN IP>:8081`, e.g. `192.168.1.50:8081` |

Cloudflare creates the `app` DNS record automatically. WebSockets are on by default for tunnels — SignalR
(`/hubs/online`) needs them.

If the site gives a Cloudflare **502**, cloudflared can't reach that URL — check `docker logs <cloudflared-container>`
and that `curl http://<VPS LAN IP>:8081` works on the VPS.

## 2. Run the app

```bash
git clone git@github.com:DenysLeontiev/LecturerSmash.git
cd LecturerSmash
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

First start: the API waits for Postgres to be healthy, creates the schema and seeds institutes/departments/workers.

Check on the VPS:

```bash
curl http://localhost:8081/api/institutes | head -c 300
```

Then open https://app.unicrush.online.

## 3. Updating

```bash
cd LecturerSmash
git pull
docker compose up -d --build
```

The DB lives in the `pgdata` volume and survives rebuilds. **`docker compose down -v` deletes it.**

## 4. Updating the teacher list (NulpScrapper)

```bash
cd LecturerSmash
./update-teachers.sh
```

It runs the `scraper` container (≈5 min, ~115 pages of lpnu.ua), then restarts the API, which syncs the new list
and prints a summary like `teachers +12 ~30 -4`.

How the sync works ([TeachersSyncService](TeachersRating.API/Services/TeachersSync/TeachersSyncService.cs)):

- Teachers are matched by their staff page URL, departments/institutes by their lpnu.ua URL.
- New ones are added; changed names / positions / photos / departments are updated.
- Ones no longer on lpnu.ua are **hidden, not deleted** — likes, comments and votes are kept and come back if they reappear.
- Safety nets: the scraper writes nothing if any page fails (network / 5xx), and the API refuses a list that has
  less than 70% of the current teachers (`TeachersImport:MinKeepRatio` in appsettings.json).
- Source file: the newest of `/app/scraper-data/output.json` (scraper volume) and `NulpScrapper/output.json`
  (committed, bundled into the image). To refresh the committed seed too, run the scraper locally:
  `cd NulpScrapper && npm ci && npm start` and commit `output.json`.

## Admin dashboard (`/admin`)

https://app.unicrush.online/admin — login with the account from `appsettings.json`:

```json
"Admin": { "Username": "admin", "Password": "ChangeMe_Admin_Password" }
```

**Change the password before the first deploy.** The account is created/updated from these values on every
API start (changing them and restarting updates the login and logs out existing sessions). Login is rate-limited
(10 attempts / 5 min per IP).

What it shows (pick any date range; everything is compared with the previous period of the same length):

- **Live**: who is online right now — country, page, device (updates in real time).
- **Active users**: DAU / WAU / MAU, stickiness, average DAU; visitors, new vs returning, sessions, page views,
  session length, bounce rate, peak concurrent users.
- **Charts**: traffic, DAU/WAU/MAU trend, votes & comments, concurrent online; hour × weekday heatmap.
- **Engagement**: funnel (visit → swipe → vote → profile → comment → share), most liked / disliked / commented /
  viewed teachers, departments, popular searches, shares.
- **Audience & devices**: countries, pages, entry pages, referrers (Telegram, Instagram…), UTM source/campaign,
  device, OS, browser/in-app browser, screen size, theme, language.
- **Moderation**: search comments, hide/restore (hidden = invisible on the site), delete permanently.

Privacy: visitors are identified by a random id in their browser (no cookies, no IPs stored). The country comes
from Cloudflare's `CF-IPCountry` header — keep **Network → IP Geolocation** enabled for `unicrush.online` in
Cloudflare (on by default). Visits over the LAN (`192.168.2.116:8081`) show as "Невідомо".

Share links with UTM tags to see which ones work, e.g. `https://app.unicrush.online/?utm_source=telegram&utm_campaign=launch`.

## 5. Backups

```bash
# dump
docker compose exec -T postgres pg_dump -U teachersrating -d teachersrating -Fc > backup_$(date +%F).dump
# restore
docker compose exec -T postgres pg_restore -U teachersrating -d teachersrating --clean --if-exists < backup_YYYY-MM-DD.dump
```

## Local development (API from the IDE)

Requires the .NET 10 SDK. Start only Postgres, then run the API and `ng serve` as usual:

```bash
docker compose up -d postgres
```

`appsettings.Development.json` connects to `localhost:5432` with the same user/password as `compose.yaml`.

## Database migrations

EF Core migrations are in `TeachersRating.API/Data/Migrations` and are applied automatically on startup.
To add one (dotnet-ef 10.x):

```bash
cd TeachersRating.API
dotnet ef migrations add <Name> -o Data/Migrations
```
