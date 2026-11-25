# MaoLauncher Setup

Небольшой Windows bootstrapper: получает последний GitHub Release репозитория
EverestStudio/MaoLauncher, скачивает ZIP, проверяет SHA-256, устанавливает приложение в
`%LOCALAPPDATA%\Programs\MaoLauncher`, создаёт ярлыки запуска и удаления на рабочем столе и запускает лаунчер.

## Удаление

Установщик создаёт ярлык «Удалить MaoLauncher». Он запускает встроенный деинсталлятор,
который удаляет установленный лаунчер, копию установщика, ярлыки и данные приложения.
Стандартная папка Minecraft внутри данных приложения удаляется вместе с ними.
Если пользователь выбрал собственную папку Minecraft, деинсталлятор оставляет её
полностью нетронутой. Исходный EXE установщика, который пользователь мог запустить
из папки «Загрузки» или другого произвольного места, автоматически не удаляется.

## Требования к GitHub Release

В каждом релизе должны быть два assets с одинаковой базовой частью имени:

- `MaoLauncher-1.0.0-win-x64.zip`
- `MaoLauncher-1.0.0-win-x64.zip.sha256`

Файл `.sha256` должен содержать 64-символьный SHA-256 архива (допускается стандартная строка sha256sum с именем файла).

## Сборка bootstrapper

На Windows с установленным .NET 10 SDK:

```powershell
dotnet publish .\MaoLauncher.Setup.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
```

Готовый EXE будет в `bin\Release\net10.0-windows\win-x64\publish\MaoLauncher-Setup.exe`.

Это исходный прототип. Для полноценной проверки нужно добавить исходники MaoLauncher и опубликовать первый совместимый GitHub Release.

## Видео-фон установщика

Файл `MaoLauncher/src/assets/background.mp4` встраивается в EXE установщика.
На старте он извлекается во временную папку и воспроизводится через WebView2:
автозапуск, без звука, по кругу, с масштабированием `cover`. Интерфейс установщика
остаётся поверх видео. Если WebView2 Runtime недоступен, установщик использует
статичный `background_main.jpg`.

Для воспроизведения требуется установленный Microsoft Edge WebView2 Runtime.
