# 🌐 Другий проєкт на тому самому VPS (інший домен)

Інструкція «на потім»: як підселити ще один сайт на сервер, де вже крутиться Spin,
не зламавши те, що працює.

**Коротка відповідь: так, можна.** Саме для цього попереду й стоїть Caddy на хості —
він тримає 80/443, а кожен проєкт слухає свій локальний порт. Caddy сам розводить
запити за доменом і сам випускає окремий сертифікат Let's Encrypt на кожен.

```
                 ┌─────────── Caddy (хост, 80/443) ───────────┐
  funforfun.party ─────────────────────────► 127.0.0.1:8080  → стек Spin
  newdomain.com   ─────────────────────────► 127.0.0.1:8081  → стек №2
                 └─────────────────────────────────────────────┘
```

---

## 0. Спершу перевірити, чи потягне сервер

```bash
ssh root@173.242.63.195
free -h                  # скільки вільної RAM + чи живий swap
df -h /                  # скільки вільного диска
docker stats --no-stream # скільки реально їсть Spin
```

Орієнтир: **повний другий стек (Postgres + Node-бекенд + nginx) — це ще ~0.5–1 ГБ RAM**
і кілька ГБ диска під образи. Якщо на VPS 2 ГБ RAM — швидше за все треба буде або
підняти тариф, або піти шляхом «спільна база» (див. розділ «Якщо тісно по памʼяті»).

Диск перед деплоєм варто почистити: `docker system prune -af` (без `--volumes`!).

---

## 1. DNS нового домену

A-записи `@` і `www` → **`173.242.63.195`** (той самий IP). TTL 60.
Якщо домен теж куплений на ukraine.com.ua — зона в панелі **adm.tools** →
Домени → Налаштування домену (DNS).

Перевірити, що розʼїхалось (робити **до** налаштування Caddy):
```bash
dig @1.1.1.1 +short newdomain.com
```
Має віддати IP VPS. **Поки тут не той IP — Caddy не отримає сертифікат.**

---

## 2. Викласти код другого проєкту

```bash
mkdir -p /opt/newproj && cd /opt/newproj
git clone <URL-репо> .
cp .env.prod.example .env
nano .env
```

У `.env` обовʼязково:
- `WEB_PORT=127.0.0.1:8081` — **інший порт, і обовʼязково з `127.0.0.1:`**,
  щоб стек не стирчав у публічний інтернет повз Caddy;
- свої `POSTGRES_PASSWORD`, `JWT_SECRET` (`openssl rand -hex 32`) — **не ті самі, що у Spin**;
- `CORS_ORIGIN=https://newdomain.com`.

Тримай реєстр портів, щоб не було колізій:

| Проєкт | Каталог | Локальний порт | Домен |
|---|---|---|---|
| Spin | `/opt/spin` | `127.0.0.1:8080` | funforfun.party |
| №2 | `/opt/newproj` | `127.0.0.1:8081` | newdomain.com |

---

## 3. Підняти стек

Імена контейнерів, мереж і томів Compose неймспейсить за іменем проєкту
(за замовчуванням = назва каталогу). Каталоги різні (`spin` vs `newproj`) — тож
конфлікту не буде. Але надійніше задати імʼя явно й **використовувати те саме
`-p` в кожній наступній команді**:

```bash
cd /opt/newproj
docker compose -p newproj -f docker-compose.prod.yml build backend
docker compose -p newproj -f docker-compose.prod.yml build web
docker compose -p newproj -f docker-compose.prod.yml up -d
```

Збирати послідовно (окремими `build`), якщо RAM ≤ 2 ГБ — інакше два Node-процеси
одночасно ловлять OOM.

Перевірка, що стек живий, ще до Caddy:
```bash
docker compose -p newproj -f docker-compose.prod.yml ps
curl -sI http://127.0.0.1:8081        # має бути 200/301, а не "Connection refused"
```

---

## 4. Додати домен у Caddy

Редагуємо `/etc/caddy/Caddyfile` — **існуючий блок Spin не чіпаємо**, просто дописуємо новий:

```
funforfun.party, www.funforfun.party {
    reverse_proxy 127.0.0.1:8080
}

newdomain.com, www.newdomain.com {
    reverse_proxy 127.0.0.1:8081
}
```

Далі:
```bash
caddy validate --config /etc/caddy/Caddyfile   # перевірити синтаксис ДО релоаду
systemctl reload caddy                          # reload, не restart — Spin не падає
journalctl -u caddy -f                          # дивитись, як виписується сертифікат
```

`reload` не рве існуючі зʼєднання, тож Spin навіть не моргне.

---

## 5. Перевірка

```bash
curl -sI https://newdomain.com                  # новий сайт
curl -sI https://funforfun.party                # Spin має лишитись живим
```

Якщо в браузері «стара сторінка» — це кеш DNS роутера/провайдера, не сервер.
Обхід кешу:
```bash
curl -sI --resolve newdomain.com:443:173.242.63.195 https://newdomain.com
```

---

## Якщо тісно по памʼяті: одна спільна Postgres

Замість другого контейнера з базою — використати вже наявний Postgres зі стеку Spin,
але **окрему базу й окремого користувача** (не окрему схему — так менше шансів
зачепити чужі дані).

1. Створити базу й користувача:
   ```bash
   docker compose -p spin -f /opt/spin/docker-compose.prod.yml exec db \
     psql -U spin -c "CREATE USER newproj WITH PASSWORD '<пароль>'; CREATE DATABASE newproj OWNER newproj;"
   ```
2. У другому проєкті прибрати сервіс `db` з `docker-compose.prod.yml`, а бекенду дати
   `DATABASE_URL` на контейнер Spin. Для цього стеки треба звести в одну docker-мережу
   (`external: true` на мережі Spin) або достукатись через хост.

Економія ~250–300 МБ RAM. Мінус — проєкти перестають бути незалежними: рестарт бази
Spin кладе обидва сайти, і бекап тепер спільний. Для двох пет-проєктів — прийнятно.

---

## ⚠️ Граблі (перевіряти в такому порядку)

1. **Заглушка «Site … not configured»** → A-записи ще дивляться на шаред-хостинг
   ukraine.com.ua, а не на VPS.
2. **`502` від Caddy** → розбіг портів між `WEB_PORT` у `.env` і `reverse_proxy`
   у Caddyfile. Звіряти з `docker compose -p <проєкт> -f docker-compose.prod.yml ps`.
3. **Сертифікат не видається** → DNS ще не вказує на VPS, або порт 80 зайнятий чимось
   крім Caddy (`ss -ltnp | grep ':80'`). Порядок завжди один: **DNS → вільний 80 → Caddy**.
4. **Новий стек не піднявся** → скоріше за все порт `8081` уже кимось зайнятий
   (`ss -ltnp | grep 8081`) або впала збірка по OOM (`dmesg | grep -i killed`).
5. **`WEB_PORT` без префікса `127.0.0.1:`** → стек стирчить назовні на `:8081` повз
   Caddy, без HTTPS. Публічними мають бути тільки 80/443.

---

## Бекапи — не забути про другий проєкт

Кожен стек має власні томи (`<проєкт>_db_data`, `<проєкт>_uploads_data`).
Список: `docker volume ls`. Бекап нової бази робиться так само, як у Spin:

```bash
docker compose -p newproj -f docker-compose.prod.yml exec db \
  pg_dump -U <user> <db> > backup_newproj_$(date +%F).sql
```

Див. також [DEPLOY.md](DEPLOY.md) — базове розгортання стеку Spin.
