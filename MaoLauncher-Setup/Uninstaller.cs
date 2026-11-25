using System.Diagnostics;
using System.Text.Json;

namespace MaoLauncher.Setup;

internal static class Uninstaller
{
    public static void Run()
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var roamingAppData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var installRoot = Path.Combine(localAppData, "Programs", "MaoLauncher");
        var setupRoot = Path.Combine(localAppData, "Programs", "MaoLauncherSetup");
        var userData = Path.Combine(roamingAppData, "MaoLauncher");
        var defaultGame = Path.Combine(userData, "game");
        var customGameDirectory = ReadCustomGameDirectory(userData);
        var hasCustomGame = !string.IsNullOrWhiteSpace(customGameDirectory)
            && !PathsEqual(customGameDirectory, defaultGame);

        var message = "Будут удалены MaoLauncher, копия установщика, ярлыки, настройки и игровые данные в стандартной папке приложения.";
        message += hasCustomGame
            ? "\n\nВаша выбранная папка Minecraft:\n" + customGameDirectory + "\n\nОна и всё её содержимое останутся нетронутыми."
            : "\n\nТакже будет удалена стандартная папка Minecraft вместе с установленными игровыми файлами.";
        message += "\n\nПродолжить удаление?";

        if (MessageBox.Show(message, "Удаление MaoLauncher", MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2) != DialogResult.Yes)
            return;

        try
        {
            if (!CloseLauncherProcesses(installRoot))
            {
                MessageBox.Show("Не удалось закрыть MaoLauncher. Закройте игру и лаунчер, затем повторите удаление.",
                    "Удаление отменено", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            DeleteDirectoryIfExists(installRoot);
            DeleteDirectoryIfExists(userData);
            DeleteDesktopShortcuts();

            ScheduleSetupRemoval(setupRoot);
            MessageBox.Show("MaoLauncher удалён. Выбранная вами папка Minecraft не затронута.",
                "Удаление завершено", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception error)
        {
            MessageBox.Show("Не удалось полностью удалить MaoLauncher.\n\n" + error.Message,
                "Ошибка удаления", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static string? ReadCustomGameDirectory(string userData)
    {
        try
        {
            var settingsPath = Path.Combine(userData, "settings.json");
            if (!File.Exists(settingsPath)) return null;
            using var document = JsonDocument.Parse(File.ReadAllText(settingsPath));
            if (document.RootElement.TryGetProperty("gameDirectory", out var value)
                && value.ValueKind == JsonValueKind.String)
                return value.GetString();
        }
        catch { }
        return null;
    }

    private static bool PathsEqual(string left, string right)
    {
        try
        {
            return string.Equals(Path.TrimEndingDirectorySeparator(Path.GetFullPath(left)),
                Path.TrimEndingDirectorySeparator(Path.GetFullPath(right)),
                StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    private static bool CloseLauncherProcesses(string installRoot)
    {
        foreach (var process in Process.GetProcessesByName("MaoLauncher"))
        {
            using (process)
            {
                try
                {
                    var executable = process.MainModule?.FileName;
                    if (executable is null || !executable.StartsWith(installRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                        continue;
                    if (process.MainWindowHandle != IntPtr.Zero) process.CloseMainWindow();
                    if (!process.WaitForExit(8000)) return false;
                }
                catch { return false; }
            }
        }
        return true;
    }

    private static void DeleteDesktopShortcuts()
    {
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        foreach (var name in new[] { "MaoLauncher.lnk", "Удалить MaoLauncher.lnk" })
        {
            var path = Path.Combine(desktop, name);
            if (File.Exists(path)) File.Delete(path);
        }
    }

    private static void DeleteDirectoryIfExists(string path)
    {
        if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
    }

    private static void ScheduleSetupRemoval(string setupRoot)
    {
        var scriptPath = Path.Combine(Path.GetTempPath(), "MaoLauncher-uninstall-" + Guid.NewGuid().ToString("N") + ".ps1");
        var processId = Environment.ProcessId;
        var script = "$ErrorActionPreference = 'SilentlyContinue'\r\n"
            + "$processId = " + processId + "\r\n"
            + "$setup = '" + setupRoot.Replace("'", "''") + "'\r\n"
            + "while (Get-Process -Id $processId -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 400 }\r\n"
            + "if (Test-Path -LiteralPath $setup) { Remove-Item -LiteralPath $setup -Recurse -Force }\r\n"
            + "Remove-Item -LiteralPath '" + scriptPath.Replace("'", "''") + "' -Force";
        File.WriteAllText(scriptPath, script);
        var start = new ProcessStartInfo("powershell.exe",
            "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"" + scriptPath + "\"")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };
        Process.Start(start);
    }
}
