# MaoLauncher Setup

Небольшой Windows bootstrapper: получает последний GitHub Release репозитория
EverestStudio/MaoLauncher, скачивает ZIP, проверяет SHA-256, устанавливает приложение в
`%LOCALAPPDATA%\Programs\MaoLauncher`, создаёт ярлык на рабочем столе и запускает лаунчер.

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
