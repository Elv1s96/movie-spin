/**
 * Налаштування сесії пропонування.
 *
 * Зберігаються в БД одним Json-полем (SuggestionSession.options), тож нова
 * опція — це поле в цьому інтерфейсі + рядок у normalizeOptions + чекбокс у
 * формі на фронті. Міграція не потрібна.
 *
 * Дефолти застосовуються при кожному читанні, тому старі сесії, записані до
 * появи опції, поводяться як «опція вимкнена».
 */
export interface SessionOptions {
  /** Питати ім'я гостя перед пропозицією. */
  askName: boolean;
  /** Ім'я обов'язкове — без нього пропозицію не приймаємо. */
  requireName: boolean;
}

export const DEFAULT_SESSION_OPTIONS: SessionOptions = {
  askName: false,
  requireName: false,
};

/**
 * Json з БД або тіло запиту → повний набір опцій з дефолтами.
 * Єдине місце, де опції інтерпретуються: і на запис, і на читання.
 */
export function normalizeOptions(raw: unknown): SessionOptions {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const askName = src.askName === true;
  return {
    askName,
    // Вимагати ім'я, не питаючи його, немає сенсу — гість такого не пройде.
    requireName: askName && src.requireName === true,
  };
}
