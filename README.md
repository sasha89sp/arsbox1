# Свод — Кроссплатформенное зашифрованное пространство (Flutter + Web-превью)

Репозиторий содержит:
- **Исходный код Flutter / Dart** (`pubspec.yaml`, `lib/`, `android/app/src/main/...`) — для компиляции на **Windows** и **Android** (а также Linux / macOS).
- **Интерактивное веб-превью** (`src/`, `index.html`, `package.json`) — для предпросмотра и прототипирования прямо в AI Studio.

---

## Сборка Flutter-приложения (Windows и Android)

Требуется установленный **Flutter SDK** (Dart `>=3.3.0 <4.0.0`).

### 1. Сгенерировать платформенные раннеры (один раз после клонирования)

Если вы впервые скачали репозиторий и нужно досоздать системные файлы CMake/Gradle (`windows/`, `android/gradle/`):

```bash
flutter create --platforms=windows,android --org com.svod .
```

*(Команда не перезапишет существующие `lib/`, `pubspec.yaml` и `MainActivity.kt`, а аккуратно добавит недостающие файлы сборки Windows/Android.)*

### 2. Установить зависимости

```bash
flutter pub get
```

### 3. Запуск и сборка

**Windows:**
```bash
flutter run -d windows
flutter build windows --release
```
> Портативный режим: создайте пустой файл `portable.txt` рядом с собранным `.exe`, чтобы все зашифрованные файлы `.enc` хранились в папке `data/` рядом с программой.

**Android:**
```bash
flutter run -d android
flutter build apk --release
```

---

## Структура Flutter-проекта

- `pubspec.yaml` — зависимости (`cryptography`, `path_provider`, `local_auth`, `flutter_secure_storage`, `window_manager`, `tray_manager`, `pdf`, `record`, `audioplayers` и др.).
- `lib/main.dart` — точка входа, инициализация окна, автоблокировка паролей при сворачивании, независимые `uiScale` и `fontScale`.
- `lib/theme/app_theme.dart` — светлая и тёмная палитра (NotePlan + Joplin), `VisualDensity.compact` и масштаб шрифта `×0.92` на десктопе.
- `lib/core/crypto_service.dart` — AES-256-GCM + PBKDF2-HMAC-SHA256 (100 000 итераций) в фоновых изолятах (`compute`).
- `lib/core/atomic_storage.dart` — атомарная запись (`writeAtomic`: `.tmp → .bak → main`), чтение с откатом (`readValid`), портативный режим (`portable.txt`) и копии `safety/`.
- `lib/core/formula_engine.dart` — движок формул таблиц (`СУММ`/`SUM`, `СРЗНАЧ`/`AVERAGE`, `МИН`/`MIN`, `МАКС`/`MAX`, `СЧЁТ`/`COUNT`, диапазоны `A1:B3`).
- `lib/state/store.dart` и `lib/state/pass_store.dart` — `ChangeNotifier`-хранилища основных данных и независимого контура паролей.
- `lib/ui/shell/adaptive_shell.dart` — адаптивная раскладка (Desktop `AppMenu` + `Sidebar` + `ThreePane` + `SchedulePanel` / Mobile `AppBar` + `Drawer` + `NavigationBar` + `StatusStrip`).
- `lib/ui/modules/` — модули `notes_page.dart`, `passwords_page.dart`, `calendar_page.dart`, `shared_page.dart`, `settings_page.dart`, `extras_pages.dart`.
