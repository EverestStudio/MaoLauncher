using System.Diagnostics;
using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MaoLauncher.Setup;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new SetupForm());
    }
}

internal sealed class SetupForm : Form
{
    private const string Repository = "EverestStudio/MaoLauncher";
    private static readonly HttpClient Http = CreateHttpClient();
    private readonly Label _status = new() { AutoSize = true, Text = "Готов к установке MaoLauncher." };
    private readonly ProgressBar _progress = new() { Minimum = 0, Maximum = 100, Dock = DockStyle.Top, Height = 22 };
    private readonly Button _install = new() { Text = "Установить", AutoSize = true };
    private readonly Button _cancel = new() { Text = "Отмена", AutoSize = true, Enabled = false };
    private CancellationTokenSource? _cancellation;

    public SetupForm()
    {
        Text = "Установка MaoLauncher";
        Width = 480;
        Height = 190;
        MinimumSize = new Size(480, 190);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;

        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(18), ColumnCount = 2, RowCount = 3 };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        _status.Margin = new Padding(0, 0, 0, 14);
        _progress.Margin = new Padding(0, 0, 0, 14);
        layout.Controls.Add(_status, 0, 0);
        layout.SetColumnSpan(_status, 2);
        layout.Controls.Add(_progress, 0, 1);
        layout.SetColumnSpan(_progress, 2);
        var buttons = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.RightToLeft, Dock = DockStyle.Fill };
        buttons.Controls.Add(_cancel);
        buttons.Controls.Add(_install);
        layout.Controls.Add(buttons, 0, 2);
        layout.SetColumnSpan(buttons, 2);
        Controls.Add(layout);

        _install.Click += async (_, _) => await InstallAsync();
        _cancel.Click += (_, _) => _cancellation?.Cancel();
    }

    private static HttpClient CreateHttpClient()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromMinutes(30) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("MaoLauncher-Setup/1.0");
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        return client;
    }

    private async Task InstallAsync()
    {
        _cancellation = new CancellationTokenSource();
        var token = _cancellation.Token;
        SetBusy(true);
        _progress.Value = 0;
        string? work = null;

        try
        {
            SetStatus("Проверяем последнюю версию на GitHub…");
            using var releaseResponse = await Http.GetAsync(
                $"https://api.github.com/repos/{Repository}/releases/latest",
                HttpCompletionOption.ResponseHeadersRead, token);
            if (releaseResponse.StatusCode == HttpStatusCode.NotFound)
                throw new InvalidOperationException("На GitHub пока нет опубликованного релиза MaoLauncher.");
            releaseResponse.EnsureSuccessStatusCode();

            using var releaseJson = JsonDocument.Parse(await releaseResponse.Content.ReadAsStreamAsync(token));
            var root = releaseJson.RootElement;
            var version = root.TryGetProperty("tag_name", out var tag) ? tag.GetString() ?? "latest" : "latest";
            var assets = root.GetProperty("assets").EnumerateArray().ToArray();
            var archive = assets.FirstOrDefault(a =>
            {
                var name = a.GetProperty("name").GetString() ?? "";
                return name.StartsWith("MaoLauncher-", StringComparison.OrdinalIgnoreCase)
                    && name.EndsWith("-win-x64.zip", StringComparison.OrdinalIgnoreCase);
            });
            if (archive.ValueKind == JsonValueKind.Undefined)
                throw new InvalidOperationException("В последнем релизе не найден архив MaoLauncher для Windows x64.");

            var archiveName = archive.GetProperty("name").GetString()!;
            var archiveUrl = archive.GetProperty("browser_download_url").GetString()!;
            var checksumAsset = assets.FirstOrDefault(a =>
                string.Equals(a.GetProperty("name").GetString(), archiveName + ".sha256", StringComparison.OrdinalIgnoreCase));
            if (checksumAsset.ValueKind == JsonValueKind.Undefined)
                throw new InvalidOperationException($"В релизе отсутствует файл контрольной суммы {archiveName}.sha256.");

            work = Path.Combine(Path.GetTempPath(), "MaoLauncher-Setup-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(work);
            var zipPath = Path.Combine(work, archiveName);

            SetStatus("Скачиваем MaoLauncher " + version + "…");
            await DownloadFileAsync(archiveUrl, zipPath, token);

            SetStatus("Проверяем SHA-256…");
            var checksumUrl = checksumAsset.GetProperty("browser_download_url").GetString()!;
            var checksumText = await Http.GetStringAsync(checksumUrl, token);
            var match = Regex.Match(checksumText, @"\b[0-9a-fA-F]{64}\b");
            if (!match.Success)
                throw new InvalidDataException("Файл контрольной суммы имеет неверный формат.");
            await using (var stream = File.OpenRead(zipPath))
            {
                var actual = Convert.ToHexString(await SHA256.HashDataAsync(stream, token));
                if (!actual.Equals(match.Value, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("SHA-256 архива не совпадает. Установка остановлена.");
            }

            SetStatus("Распаковываем файлы…");
            var extracted = Path.Combine(work, "extracted");
            Directory.CreateDirectory(extracted);
            ExtractZipSafely(zipPath, extracted);
            var executable = Directory.GetFiles(extracted, "MaoLauncher.exe", SearchOption.AllDirectories).FirstOrDefault();
            if (executable is null)
                throw new InvalidDataException("В архиве не найден MaoLauncher.exe.");

            SetStatus("Устанавливаем приложение…");
            var installRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "MaoLauncher");
            var parent = Path.GetDirectoryName(installRoot)!;
            Directory.CreateDirectory(parent);
            var stagedInstall = Path.Combine(parent, "MaoLauncher.new-" + Guid.NewGuid().ToString("N"));
            Directory.Move(Path.GetDirectoryName(executable)!, stagedInstall);

            var backup = installRoot + ".old";
            if (Directory.Exists(backup)) Directory.Delete(backup, true);
            if (Directory.Exists(installRoot)) Directory.Move(installRoot, backup);
            try
            {
                Directory.Move(stagedInstall, installRoot);
                if (Directory.Exists(backup)) Directory.Delete(backup, true);
            }
            catch
            {
                if (!Directory.Exists(installRoot) && Directory.Exists(backup))
                    Directory.Move(backup, installRoot);
                throw;
            }

            var installedExe = Path.Combine(installRoot, "MaoLauncher.exe");
            if (!File.Exists(installedExe))
                installedExe = Directory.GetFiles(installRoot, "MaoLauncher.exe", SearchOption.AllDirectories).First();

            TryCreateDesktopShortcut(installedExe);
            SetStatus("Установка завершена. Запускаем MaoLauncher…");
            Process.Start(new ProcessStartInfo(installedExe) { UseShellExecute = true });
            _progress.Value = 100;
            Close();
        }
        catch (OperationCanceledException)
        {
            SetStatus("Установка отменена.");
        }
        catch (Exception ex)
        {
            SetStatus("Не удалось установить MaoLauncher.");
            MessageBox.Show(this, ex.Message, "Ошибка установки", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            if (work is not null)
            {
                try { Directory.Delete(work, true); } catch { }
            }
            _cancellation?.Dispose();
            _cancellation = null;
            if (!IsDisposed) SetBusy(false);
        }
    }

    private async Task DownloadFileAsync(string url, string destination, CancellationToken token)
    {
        using var response = await Http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, token);
        response.EnsureSuccessStatusCode();
        var total = response.Content.Headers.ContentLength;
        await using var input = await response.Content.ReadAsStreamAsync(token);
        await using var output = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true);
        var buffer = new byte[81920];
        long received = 0;
        int read;
        while ((read = await input.ReadAsync(buffer.AsMemory(0, buffer.Length), token)) > 0)
        {
            await output.WriteAsync(buffer.AsMemory(0, read), token);
            received += read;
            if (total is > 0)
            {
                var percent = (int)Math.Clamp(received * 100 / total.Value, 0, 100);
                if (!IsDisposed) BeginInvoke(new Action(() => _progress.Value = percent));
            }
        }
    }

    private static void ExtractZipSafely(string zipPath, string destination)
    {
        var root = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
        using var archive = ZipFile.OpenRead(zipPath);
        foreach (var entry in archive.Entries)
        {
            var target = Path.GetFullPath(Path.Combine(destination, entry.FullName));
            if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("Архив содержит недопустимый путь.");
            if (string.IsNullOrEmpty(entry.Name))
            {
                Directory.CreateDirectory(target);
                continue;
            }
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            entry.ExtractToFile(target, overwrite: true);
        }
    }

    private static void TryCreateDesktopShortcut(string executable)
    {
        try
        {
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var shortcutPath = Path.Combine(desktop, "MaoLauncher.lnk");
            var shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType is null) return;
            dynamic shell = Activator.CreateInstance(shellType)!;
            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = executable;
            shortcut.WorkingDirectory = Path.GetDirectoryName(executable);
            shortcut.Description = "MaoLauncher";
            shortcut.Save();
        }
        catch { }
    }

    private void SetStatus(string value)
    {
        if (!IsDisposed) _status.Text = value;
    }

    private void SetBusy(bool busy)
    {
        _install.Enabled = !busy;
        _cancel.Enabled = busy;
    }
}
