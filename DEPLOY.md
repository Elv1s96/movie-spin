# 🚀 Розгортання Spin на VPS (Docker)

Увесь застосунок піднімається однією командою: **Postgres + бекенд (з авто-міграціями) + nginx** (роздає фронт і проксіює `/api` та `/uploads`). Усе за одним доменом, тож CORS не потрібен.

---

## 1. Що треба на сервері

- VPS з публічним IP. Мінімум, якого вистачає: **1 ядро / 2 ГБ RAM / 20 ГБ диска**.
- ОС — **Ubuntu 24.04 LTS** (перевірена, підтримка до 2029, Docker ставиться без танців).
  Debian 13 теж підходить і їсть менше RAM у спокої.
- Встановлені **Docker** і **Docker Compose plugin**:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
  (плагін `docker compose` ставиться разом із Docker).

### 1.1. Swap — обовʼязково на 2 ГБ RAM

Збірка фронту (`vite build`) і бекенду (`nest build`) — процеси Node, кожен може взяти
500–800 МБ. Без swap на 2 ГБ збірка ризикує впасти з `Killed` (OOM). Робимо один раз:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # щоб лишився після ребуту
```
Перевірити: `free -h` — має зʼявитися рядок `Swap: 2.0Gi`.

## 2. Забрати код на сервер

```bash
git clone <URL-твого-репозиторію> spin
cd spin
```
(або скопіювати папку через `scp`/`rsync`).

## 3. Налаштувати змінні

```bash
cp .env.prod.example .env
nano .env
```
Обовʼязково зміни:
- `POSTGRES_PASSWORD` — сильний пароль БД;
- `JWT_SECRET` — довгий випадковий рядок (`openssl rand -hex 32`);
- `CORS_ORIGIN` — твій домен (або лиши `*`);
- за потреби `WEB_PORT` (за замовчуванням `80`).

Файл `.env` **не** потрапляє в git (він у `.gitignore`).

## 4. Запуск

**На сервері з 1 ядром / 2 ГБ RAM** збирай послідовно — `up --build` будує обидва образи
паралельно, і два процеси Node одночасно можуть не влізти в памʼять:

```bash
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d
```

На сервері з 4+ ГБ RAM можна однією командою:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Що станеться:
1. підніметься Postgres (з томом `db_data`);
2. збереться й стартує бекенд — **автоматично накотить міграції** (`prisma migrate deploy`);
3. збереться фронт і nginx почне роздавати сайт на порту `WEB_PORT`.

Перша збірка на слабкому VPS триває 5–10 хвилин (ставляться node_modules: ~510 МБ бекенд,
~92 МБ фронт). Наступні — швидше завдяки кешу шарів.

Відкрий у браузері: `http://<IP-сервера>` (або свій домен). Зареєструйся — і користуйся.

## 5. Оновлення після змін у коді

```bash
git pull
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d
```
Нові міграції накотяться самі на старті бекенду.

---

## Корисні команди

```bash
docker compose -f docker-compose.prod.yml ps          # статус
docker compose -f docker-compose.prod.yml logs -f      # логи всіх сервісів
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml down         # зупинити (дані лишаються)
docker compose -f docker-compose.prod.yml down -v      # зупинити + СТЕРТИ дані (том БД і постери)

free -h                                                # памʼять і swap
docker stats --no-stream                               # скільки їсть кожен контейнер
```

### Чистка диска

Після кількох деплоїв старі образи й build-кеш накопичуються і можуть зʼїсти 20 ГБ.
Раз на кілька оновлень:

```bash
docker system prune -af          # старі образи + зупинені контейнери + build-кеш
docker system df                 # скільки що займає
```
`prune -af` **не чіпає томи** (`db_data`, `uploads_data`) — дані в безпеці.
Не додавай прапорець `--volumes`, інакше зітреш базу.

## Дані та бекапи

- **БД** — том `db_data`, **постери** — том `uploads_data`. Переживають перезапуск/оновлення; стираються лише `down -v`.
- Бекап бази:
  ```bash
  docker compose -f docker-compose.prod.yml exec db \
    pg_dump -U spin spin > backup_$(date +%F).sql
  ```

---

## HTTPS (домен + сертифікат)

Стек віддає HTTP на порт `80`. Для HTTPS найпростіше поставити **reverse-proxy** попереду:

- **Caddy** — автоматичний Let's Encrypt: постав `WEB_PORT=8080`, а Caddy на 80/443 проксіює на `localhost:8080` (Caddyfile: `your-domain.com { reverse_proxy localhost:8080 }`).
- **Cloudflare** — постав домен за Cloudflare (proxy) і ввімкни Flexible/Full SSL — сертифікат на їхньому боці.
- **certbot + nginx** на хості — класичний варіант.

Після HTTPS онови `CORS_ORIGIN` на `https://your-domain.com`.

---

## Як це влаштовано (коротко)

| Сервіс | Образ / збірка | Роль |
|---|---|---|
| `db` | `postgres:16-alpine` | база даних (том `db_data`) |
| `backend` | `backend/Dockerfile` (Node 22) | NestJS API, міграції на старті, постери в томі `uploads_data` |
| `web` | `frontend/Dockerfile` (Vite → nginx) | статика фронту + проксі `/api` і `/uploads` на `backend:3000` |

Фронт звертається до API за відносним `/api`, тож усе працює з одного домену без додаткових налаштувань.
