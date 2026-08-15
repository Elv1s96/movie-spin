#!/bin/sh
set -e

echo "→ Prisma: накочую міграції (migrate deploy)…"
npx prisma migrate deploy

echo "→ Запускаю Spin API…"
exec node dist/main
