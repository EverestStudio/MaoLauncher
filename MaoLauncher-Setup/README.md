# MaoLauncher Setup

Windows bootstrapper для репозитория `EverestStudio/MaoLauncher`.

При каждом запуске установщик:

1. Запрашивает последний опубликованный GitHub Release.
2. Сравнивает его версию с установленной.
3. Если версия новее или лаунчер ещё не установлен — скачивает ZIP `MaoLauncher-X.Y.Z-win-x64.zip`.
4. Скачивает соответствующий файл `.sha256` и проверяет SHA-256 архива.
5. Безопасно распаковывает архив, заменяет файлы лаунчера с резервной копией и запускает новую версию.
6. Если обновлений нет — запускает уже установленный MaoLauncher.

Установка выполняется в `%LOCALAPPDATA%\Programs\MaoLauncher`. Настройки и игровые файлы хранятся отдельно от папки приложения.

## Сборка

Требуется Windows и .NET 10 SDK:

```powershell
dotnet publish .\MaoLauncher.Setup.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
```

Исходники интерфейса установщика находятся в этой папке. Иконки и фоновое изображение берутся из `MaoLauncherNew/assets`.

## Публикация релиза

Основной workflow `.github/workflows/release.yml` собирает лаунчер из `MaoLauncherNew`, упаковывает `win-unpacked` в ZIP, создаёт SHA-256 и публикует этот архив вместе с `MaoLauncher-Setup.exe`.

Чтобы выпустить новую версию, создай и отправь тег вида `v2.0.0` (номер должен быть больше предыдущего релиза):

```powershell
git tag v2.0.0
git push origin v2.0.0
```

Установщик использует публичный GitHub Releases API и не требует токена или приватного ключа на компьютере пользователя.
