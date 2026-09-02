-- Разова чистка: позначки «запропоновано», що лишились від фільмів, яких уже
-- немає на колесі сесії. Раніше видалення позиції колеса не знімало позначку,
-- і на сторінці гостя фільм назавжди лишався зайнятим.
-- Чіпаємо лише ВІДКРИТІ сесії: у закритих ці записи — історія й нікому не заважають.
DELETE FROM "Suggestion" s
USING "SuggestionSession" ss
WHERE s."sessionId" = ss."id"
  AND ss."closedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "WheelItem" wi
    WHERE wi."wheelId" = ss."wheelId"
      AND wi."movieId" = s."movieId"
  );
