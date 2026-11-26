# MaoLauncher

Репозиторий содержит исходники MaoLauncher, Windows-установщик и GitHub Actions для сборки релизов.

## Проекты

- `MaoLauncherNew/` — актуальные исходники Electron-лаунчера. Содержимое соответствует исходному архиву MaoLauncher 2.0.
- `MaoLauncher-Setup/` — исходники Windows bootstrapper. При запуске он проверяет GitHub Releases, скачивает новую версию лаунчера и проверяет SHA-256.
- `.github/workflows/release.yml` — сборка лаунчера и установщика, упаковка ZIP, вычисление контрольной суммы и публикация GitHub Release.

## Выпуск новой версии

Создай тег с новой версией, например:

```powershell
git tag v2.0.0
git push origin v2.0.0
```

GitHub Actions соберёт Windows x64, опубликует:

- `MaoLauncher-X.Y.Z-win-x64.zip` — файлы приложения;
- `MaoLauncher-X.Y.Z-win-x64.zip.sha256` — SHA-256 архива;
- `MaoLauncher-Setup.exe` — установщик/обновлятор.

При следующем запуске установщик проверит последний релиз и обновит лаунчер, если версия новее установленной.
