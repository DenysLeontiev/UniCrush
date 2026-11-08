#!/usr/bin/env sh
# Re-scrapes lpnu.ua and syncs the teacher list into the database.
#  - New teachers are added, renamed/moved ones updated.
#  - Teachers no longer on lpnu.ua are hidden (likes/comments kept; they return if they reappear).
#  - If the scrape fails or looks partial, nothing changes.
set -e
cd "$(dirname "$0")"

echo "==> Scraping lpnu.ua (takes a few minutes)..."
docker compose run --rm --build scraper

echo "==> Restarting API to sync the new list..."
docker compose restart api

echo "==> Sync result:"
sleep 15
docker compose logs --since 2m api | grep -i "teachers sync" || echo "(no sync log yet - check: docker compose logs api)"
