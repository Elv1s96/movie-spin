# ▶️ Як запускати Spin вручну

Проєкт складається з **3 частин**, які треба підняти в такому порядку:
**База даних → Бекенд → Фронтенд**.

Усі команди виконуй у папці проєкту: `~/PhpstormProjects/Spin`.

---

## Щоденний запуск (коли залежності вже встановлені)

Відкрий **2 вкладки термінала**.

### 0. Перед стартом — Docker
Запусти застосунок **Docker Desktop** (іконка кита в меню-барі має бути активна).

### 1. База даних (одна команда, вкладка не потрібна)
```bash
cd ~/PhpstormProjects/Spin
docker compose up -d
```
Це підніме Postgres на `localhost:5432` у фоні. Робиться раз — далі просто працює.

### 2. Бекенд — **вкладка 1**
```bash
cd ~/PhpstormProjects/Spin/backend
npm run start:dev
```
Готово, коли з'явиться: `🎡 Spin API running on http://localhost:3000/api`
Цю вкладку **не закривай** — поки вона відкрита, бекенд працює.

### 3. Фронтенд — **вкладка 2**
```bash
cd ~/PhpstormProjects/Spin/frontend
npm run dev
```
Готово, коли з'явиться: `➜  Local:   http://localhost:5173/`

### 4. Відкрий у браузері
👉 **http://localhost:5173**

---

## Як зупинити

- **Бекенд і фронтенд:** у кожній вкладці натисни `Ctrl + C`.
- **База даних:**
  ```bash
  cd ~/PhpstormProjects/Spin
  docker compose down          # зупинити (дані збережуться)
  ```
  Дані фільмів/колес лежать у Docker-томі й переживають зупинку.
  Стерти геть усе разом з даними: `docker compose down -v`.

---

## Перший запуск на новій/чистій машині

Один раз треба доставити залежності й створити таблиці в БД:

```bash
cd ~/PhpstormProjects/Spin
docker compose up -d

cd backend
npm install
npx prisma migrate dev        # створює схему БД

cd ../frontend
npm install
```
Далі — «Щоденний запуск» вище.

---

## Якщо «стало недоступне» / не відкривається

Перевір, що всі три частини живі:

```bash
docker ps | grep spin_db                 # має бути рядок (healthy)
lsof -ti:3000 && echo "backend OK"       # бекенд
lsof -ti:5173 && echo "frontend OK"      # фронтенд
```
- Немає `spin_db` → `docker compose up -d`
- Немає backend → перезапусти вкладку 1 (`npm run start:dev`)
- Немає frontend → перезапусти вкладку 2 (`npm run dev`)

Типова причина недоступності: закрив вкладку термінала або комп заснув — процес зупинився.

---

## Порти (щоб не плутатись)

| Частина | Адреса |
|---|---|
| Фронтенд (відкривати цю) | http://localhost:5173 |
| Бекенд API | http://localhost:3000/api |
| Postgres | localhost:5432 |

---

## Фільми

Фільми додаються вручну на сторінці «Мої фільми». Також є масовий
**імпорт/експорт JSON** (кнопки на сторінці; приклад формату —
`frontend/public/movies.example.json`).
