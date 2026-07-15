# Lucky Constructor — Telegram Bot Keyboard Builder

[Русское описание ниже](#на-русском)

---

## English

A visual admin panel for building and managing Telegram Bot inline keyboards.

### Features

- **Visual drag-and-drop constructor** — create button grids (2 columns) with row/col/width settings
- **Live Telegram preview** — see how your keyboard looks in real time
- **Undo/Redo** (Ctrl+Z / Ctrl+Y) — up to 50 steps
- **Multi-select** — bulk hide, show, or delete buttons
- **Copy/Paste/Duplicate** — quick clipboard operations (Ctrl+C / Ctrl+V / Ctrl+D)
- **Action types** — Callback, URL, Web App, Menu navigation, Login URL, Switch Inline Query, Pay
- **Button styles** — Primary, Success, Danger
- **Premium emoji icons** — attach custom emoji to button labels
- **Hidden buttons zone** — move buttons to a hidden area without deleting
- **File manager** — upload and manage media files
- **User management** — view users, search, view details
- **Support tickets** — view and close support conversations
- **Broadcast** — send messages to all users with photo and reply markup
- **Promo codes** — create and manage activation codes
- **Settings** — configure bot token, admin IDs, and other options
- **Desktop mode** — windowed UI with taskbar and terminal emulator

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+D` | Duplicate selected button |
| `Ctrl+C` | Copy selected button |
| `Ctrl+V` | Paste from clipboard |
| `Ctrl+S` | Save constructor to bot |
| `Delete` | Delete selected button |
| `Escape` | Exit multi-select mode |

### Tech stack

- Single HTML file + single JS file — no build step, no dependencies
- SortableJS for drag-and-drop
- Material Symbols for icons
- Vanilla JavaScript (ES5 compatible)

### Setup

1. Place `index.html` and `constructor-ui.js` (in `static/` subfolder) on your web server
2. The admin panel expects a backend API at `api/constructor`, `api/users`, etc.
3. Open `index.html` in your browser and log in

---

## На русском

Админ-панель для визуального создания и управления инлайн-клавиатурами Telegram-бота.

### Возможности

- **Визуальный конструктор с drag-and-drop** — создавайте сетки кнопок (2 колонки) с настройкой строки, колонки и ширины
- **Живое превью Telegram** — видьте как выглядит клавиатура в реальном времени
- **Отмена/Повтор** (Ctrl+Z / Ctrl+Y) — до 50 шагов
- **Множественный выбор** — массовое скрытие, показ и удаление кнопок
- **Копирование/Вставка/Дублирование** — быстрые операции с буфером обмена (Ctrl+C / Ctrl+V / Ctrl+D)
- **Типы действий** — Callback, URL, Web App, навигация по меню, Login URL, Switch Inline Query, Pay
- **Стили кнопок** — Primary, Success, Danger
- **Premium эмодзи иконки** — привязка кастомных эмодзи к подписям кнопок
- **Зона скрытых кнопок** — перемещайте кнопки в скрытую область без удаления
- **Файловый менеджер** — загрузка и управление медиафайлами
- **Управление пользователями** — просмотр, поиск, детали
- **Тикеты поддержки** — просмотр и закрытие диалогов
- **Рассылка** — отправка сообщений всем пользователям с фото и reply-разметкой
- **Промокоды** — создание и управление кодами активации
- **Настройки** — конфигурация токена бота, ID администраторов и прочего
- **Режим «Рабочий стол»** — оконный интерфейс с панелью задач и эмулятором терминала

### Горячие клавиши

| Комбинация | Действие |
|---|---|
| `Ctrl+Z` | Отмена |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Повтор |
| `Ctrl+D` | Дублировать выбранную кнопку |
| `Ctrl+C` | Копировать выбранную кнопку |
| `Ctrl+V` | Вставить из буфера обмена |
| `Ctrl+S` | Сохранить конструктор в бота |
| `Delete` | Удалить выбранную кнопку |
| `Escape` | Выйти из режима множественного выбора |

### Технологии

- Один HTML-файл + один JS-файл — без сборки, без зависимостей
- SortableJS для drag-and-drop
- Material Symbols для иконок
- Чистый JavaScript (совместим с ES5)

### Установка

1. Разместите `index.html` и `constructor-ui.js` (в подпапке `static/`) на веб-сервере
2. Админ-панель ожидает бэкенд API по адресам `api/constructor`, `api/users` и т.д.
3. Откройте `index.html` в браузере и войдите в систему

### Лицензия

MIT
