using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace MaoLauncher.Setup;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        if (args.Any(arg => string.Equals(arg, "--uninstall", StringComparison.OrdinalIgnoreCase)))
        {
            Uninstaller.Run();
            return;
        }
        Application.Run(new SetupForm());
    }
}

internal sealed class SetupForm : Form
{
    private const string Repository = "EverestStudio/MaoLauncher";
    private static readonly HttpClient Http = CreateHttpClient();
    private WebView2? _webView;
    private bool _uiReady;
    private CancellationTokenSource? _cancellation;

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern nint SendMessage(nint hWnd, int msg, nint wParam, nint lParam);

    public SetupForm()
    {
        Text = "MaoLauncher Setup";
        using (var iconStream = typeof(SetupForm).Assembly.GetManifestResourceStream("MaoLauncher.Setup.mao-icon.ico"))
        {
            if (iconStream is not null) Icon = new Icon(iconStream);
        }

        ClientSize = new Size(768, 558);
        MinimumSize = new Size(768, 558);
        MaximumSize = new Size(768, 558);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.None;
        ControlBox = false;
        MaximizeBox = false;
        MinimizeBox = false;
        BackColor = Color.FromArgb(9, 10, 14);
        Resize += (_, _) => UpdateWindowRegion();
        UpdateWindowRegion();

        _webView = new WebView2
        {
            Dock = DockStyle.Fill,
            DefaultBackgroundColor = Color.FromArgb(0, 9, 10, 14)
        };
        Controls.Add(_webView);

        FormClosing += (_, _) => _cancellation?.Cancel();
        FormClosed += (_, _) => _webView?.Dispose();
        Shown += async (_, _) =>
        {
            await InitializeInstallerUiAsync();
            await InstallAsync();
        };
    }

    private static Button CreateWindowButton(string text, Color color)
    {
        var button = new Button
        {
            Text = text,
            Width = 46,
            Height = 46,
            Dock = DockStyle.None,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.Transparent,
            ForeColor = color,
            Font = new Font("Segoe UI", 15F, FontStyle.Regular),
            Cursor = Cursors.Hand,
            UseVisualStyleBackColor = false,
            TabStop = false
        };
        button.FlatAppearance.BorderSize = 0;
        button.FlatAppearance.MouseOverBackColor = Color.FromArgb(70, 255, 255, 255);
        button.FlatAppearance.MouseDownBackColor = Color.FromArgb(100, 255, 255, 255);
        return button;
    }

    private static void WriteErrorLog(string message, Exception? error)
    {
        try
        {
            var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MaoLauncherSetup");
            Directory.CreateDirectory(directory);
            var path = Path.Combine(directory, "setup.log");
            File.AppendAllText(path, $"[{DateTimeOffset.Now:O}] {message}{Environment.NewLine}{error}{Environment.NewLine}");
        }
        catch { }
    }

    private void UpdateWindowRegion()
    {
        if (ClientSize.Width <= 0 || ClientSize.Height <= 0) return;
        using var path = CreateRoundedPath(new Rectangle(0, 0, ClientSize.Width, ClientSize.Height), 18);
        Region?.Dispose();
        Region = new Region(path);
    }

    private static GraphicsPath CreateRoundedPath(Rectangle bounds, int radius)
    {
        var diameter = radius * 2;
        var path = new GraphicsPath();
        path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 180, 90);
        path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 90);
        path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter, diameter, diameter, 0, 90);
        path.AddArc(bounds.Left, bounds.Bottom - diameter, diameter, diameter, 90, 90);
        path.CloseFigure();
        return path;
    }

    private async Task InitializeInstallerUiAsync()
    {
        if (_webView is null) return;

        try
        {
            await _webView.EnsureCoreWebView2Async();
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.WebMessageReceived += (_, args) =>
            {
                try
                {
                    using var message = JsonDocument.Parse(args.WebMessageAsJson);
                    var action = message.RootElement.TryGetProperty("action", out var value)
                        ? value.GetString()
                        : null;

                    switch (action)
                    {
                        case "minimize":
                            WindowState = FormWindowState.Minimized;
                            break;
                        case "close":
                            Close();
                            break;
                        case "drag":
                            ReleaseCapture();
                            SendMessage(Handle, 0xA1, (nint)0x2, 0);
                            break;
                    }
                }
                catch (Exception ex)
                {
                    WriteErrorLog("Не удалось обработать действие интерфейса установщика.", ex);
                }
            };

            using var htmlStream = typeof(SetupForm).Assembly.GetManifestResourceStream("MaoLauncher.Setup.installer.html")
                ?? throw new FileNotFoundException("В установщик не встроен installer.html.");
            using var reader = new StreamReader(htmlStream);
            var html = await reader.ReadToEndAsync();

            using var logoStream = typeof(SetupForm).Assembly.GetManifestResourceStream("MaoLauncher.Setup.mao-icon.png")
                ?? throw new FileNotFoundException("В установщик не встроен mao-icon.png.");
            using var logoBuffer = new MemoryStream();
            await logoStream.CopyToAsync(logoBuffer);
            var logoData = Convert.ToBase64String(logoBuffer.ToArray());
            html = html.Replace("kitty.png", "data:image/png;base64," + logoData, StringComparison.Ordinal);

            var navigation = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            EventHandler<CoreWebView2NavigationCompletedEventArgs>? navigationHandler = null;
            navigationHandler = (_, args) =>
            {
                _webView.CoreWebView2.NavigationCompleted -= navigationHandler;
                if (args.IsSuccess) navigation.TrySetResult(true);
                else navigation.TrySetException(new InvalidOperationException("Не удалось загрузить интерфейс установщика."));
            };
            _webView.CoreWebView2.NavigationCompleted += navigationHandler;
            _webView.NavigateToString(html);
            await navigation.Task;

            _uiReady = true;
            SetProgress(0, "Инициализация установщика");
        }
        catch (Exception ex)
        {
            WriteErrorLog("Не удалось открыть новый интерфейс установщика.", ex);
            throw;
        }
    }

    private static Image? LoadBanner()
    {
        try
        {
            using var stream = typeof(SetupForm).Assembly.GetManifestResourceStream("MaoLauncher.Setup.background_main.jpg");
            if (stream is null) return null;
            using var image = Image.FromStream(stream);
            return new Bitmap(image);
        }
        catch { return null; }
    }

    private void DragWindow(object? sender, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;
        ReleaseCapture();
        SendMessage(Handle, 0xA1, (nint)0x2, 0);
    }

    private static Button CreateButton(string text, bool primary)
    {
        var button = new Button
        {
            Text = text,
            FlatStyle = FlatStyle.Flat,
            FlatAppearance = { BorderSize = 1, BorderColor = primary ? Color.FromArgb(205, 145, 250) : Color.FromArgb(105, 83, 122) },
            BackColor = primary ? Color.FromArgb(112, 62, 145) : Color.FromArgb(34, 27, 43),
            ForeColor = Color.White,
            Font = new Font("Segoe UI Semibold", 10F),
            Cursor = Cursors.Hand,
            UseVisualStyleBackColor = false
        };
        button.FlatAppearance.MouseOverBackColor = primary ? Color.FromArgb(132, 76, 168) : Color.FromArgb(52, 40, 65);
        button.FlatAppearance.MouseDownBackColor = Color.FromArgb(82, 45, 108);
        button.Resize += (_, _) =>
        {
            using var path = CreateRoundedPath(new Rectangle(0, 0, button.Width, button.Height), 12);
            button.Region?.Dispose();
            button.Region = new Region(path);
        };
        return button;
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
        if (_cancellation is not null) return;
        _cancellation = new CancellationTokenSource();
        var token = _cancellation.Token;
        SetProgress(0);
        string? work = null;

        try
        {
            SetStatus("Подготавливаем ярлык MaoLauncher…", "Подготовка установщика");
            SetProgress(4, "Подготовка установщика");
            var setupExecutable = EnsurePersistentSetupCopy();
            TryCreateDesktopShortcut(setupExecutable);
            TryCreateUninstallShortcut(setupExecutable);

            var installRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs", "MaoLauncher");
            var installedExe = FindInstalledLauncher(installRoot);

            SetStatus("Проверяем последнюю версию на GitHub…", "Проверка обновлений");
            SetProgress(10, "Проверка обновлений");
            using var releaseResponse = await Http.GetAsync(
                $"https://api.github.com/repos/{Repository}/releases/latest",
                HttpCompletionOption.ResponseHeadersRead, token);
            if (releaseResponse.StatusCode == HttpStatusCode.NotFound)
                throw new InvalidOperationException("На GitHub пока нет опубликованного релиза MaoLauncher.");
            releaseResponse.EnsureSuccessStatusCode();

            using var releaseJson = JsonDocument.Parse(await releaseResponse.Content.ReadAsStreamAsync(token));
            var root = releaseJson.RootElement;
            var version = root.TryGetProperty("tag_name", out var tag) ? tag.GetString() ?? "latest" : "latest";
            if (!Regex.IsMatch(version, @"^v?\d+\.\d+\.\d+$"))
                throw new InvalidDataException("У последнего релиза некорректный номер версии.");
            version = version.TrimStart('v', 'V');

            var versionFile = Path.Combine(installRoot, "launcher.version");
            var installedVersion = File.Exists(versionFile) ? File.ReadAllText(versionFile).Trim() : "";
            var assets = root.GetProperty("assets").EnumerateArray().ToArray();

            if (installedExe is not null &&
                Regex.IsMatch(installedVersion, @"^\d+\.\d+\.\d+$") &&
                CompareVersions(installedVersion, version) >= 0)
            {
                SetStatus("Обновлений нет. Запускаем MaoLauncher…", "Уже установлена последняя версия");
                SetProgress(100, "Готово");
                Process.Start(new ProcessStartInfo(installedExe)
                {
                    UseShellExecute = true,
                    WorkingDirectory = Path.GetDirectoryName(installedExe)!
                });
                await Task.Delay(350, token);
                Close();
                return;
            }

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

            SetStatus((installedExe is null ? "Устанавливаем MaoLauncher " : "Доступно обновление. Скачиваем MaoLauncher ") + version + "…");
            SetProgress(15, "Получение файлов MaoLauncher");
            await DownloadFileAsync(archiveUrl, zipPath, token);
            SetProgress(65, "Загрузка завершена");

            SetStatus("Проверяем SHA-256…", "Проверка целостности загруженного архива");
            SetProgress(70, "Проверка SHA-256");
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

            SetStatus("Распаковываем новую версию…", "Подготовка файлов MaoLauncher");
            SetProgress(72, "Распаковка файлов");
            var extracted = Path.Combine(work, "extracted");
            Directory.CreateDirectory(extracted);
            ExtractZipSafely(zipPath, extracted, percent => SetProgress(72 + percent * 16 / 100, "Распаковка файлов MaoLauncher"));
            var executable = Directory.GetFiles(extracted, "MaoLauncher.exe", SearchOption.AllDirectories).FirstOrDefault();
            if (executable is null)
                throw new InvalidDataException("В архиве не найден MaoLauncher.exe.");

            if (!await CloseInstalledLauncherAsync(installRoot, token))
                throw new InvalidOperationException("Перед обновлением закрой MaoLauncher и повторно запусти установщик.");

            SetStatus("Заменяем файлы лаунчера…", "Обновление установленной версии");
            SetProgress(91, "Обновление файлов");
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
                var versionPath = Path.Combine(installRoot, "launcher.version");
                var versionTemp = versionPath + ".new";
                File.WriteAllText(versionTemp, version);
                File.Move(versionTemp, versionPath, true);
                installedExe = FindInstalledLauncher(installRoot)
                    ?? throw new InvalidDataException("После установки не найден MaoLauncher.exe.");
            }
            catch
            {
                try { if (Directory.Exists(installRoot)) Directory.Delete(installRoot, true); } catch { }
                if (Directory.Exists(backup)) Directory.Move(backup, installRoot);
                throw;
            }
            try { if (Directory.Exists(backup)) Directory.Delete(backup, true); } catch { }

            TryCreateDesktopShortcut(setupExecutable);
            SetStatus("Готово! Запускаем MaoLauncher…");
            SetProgress(100);
            Process.Start(new ProcessStartInfo(installedExe)
            {
                UseShellExecute = true,
                WorkingDirectory = installRoot
            });
            await Task.Delay(350, token);
            Close();
        }
        catch (OperationCanceledException)
        {
            WriteErrorLog("Установка прервана закрытием окна.", null);
        }
        catch (Exception ex)
        {
            SetStatus("Ошибка установки", "Подробности сохранены в setup.log");
            WriteErrorLog("Не удалось установить или обновить MaoLauncher.", ex);
        }
        finally
        {
            if (work is not null)
            {
                try { Directory.Delete(work, true); } catch { }
            }
            _cancellation?.Dispose();
            _cancellation = null;
            if (!IsDisposed && !token.IsCancellationRequested)
            {
                try { await Task.Delay(1400); } catch { }
                if (!IsDisposed) Close();
            }
        }
    }

    private static string EnsurePersistentSetupCopy()
    {
        var source = Environment.ProcessPath
            ?? throw new InvalidOperationException("Не удалось определить расположение установщика.");
        var setupDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs", "MaoLauncherSetup");
        Directory.CreateDirectory(setupDirectory);
        var destination = Path.Combine(setupDirectory, "MaoLauncher-Setup.exe");
        if (!string.Equals(Path.GetFullPath(source), Path.GetFullPath(destination), StringComparison.OrdinalIgnoreCase))
        {
            var temporary = destination + ".new";
            try
            {
                File.Copy(source, temporary, true);
                File.Move(temporary, destination, true);
            }
            catch
            {
                try { if (File.Exists(temporary)) File.Delete(temporary); } catch { }
                if (!File.Exists(destination)) throw;
            }
        }
        return destination;
    }

    private static string? FindInstalledLauncher(string installRoot)
    {
        if (!Directory.Exists(installRoot)) return null;
        foreach (var executable in Directory.GetFiles(installRoot, "MaoLauncher.exe", SearchOption.AllDirectories))
        {
            var resources = Path.Combine(Path.GetDirectoryName(executable)!, "resources");
            if (File.Exists(Path.Combine(resources, "app.asar")))
                return executable;
        }
        return null;
    }

    private static int CompareVersions(string left, string right)
    {
        if (!Version.TryParse(left, out var a) || !Version.TryParse(right, out var b))
            throw new InvalidDataException("Не удалось сравнить версии MaoLauncher.");
        return a.CompareTo(b);
    }

    private async Task<bool> CloseInstalledLauncherAsync(string installRoot, CancellationToken token)
    {
        if (!Directory.Exists(installRoot)) return true;
        var processes = Process.GetProcessesByName("MaoLauncher");
        foreach (var process in processes)
        {
            using (process)
            {
                string? processPath = null;
                try { processPath = process.MainModule?.FileName; } catch { }
                if (processPath is not null &&
                    !processPath.StartsWith(installRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                    continue;

                if (process.MainWindowHandle != IntPtr.Zero)
                    process.CloseMainWindow();

                for (var attempt = 0; attempt < 40 && !process.HasExited; attempt++)
                    await Task.Delay(500, token);

                if (!process.HasExited)
                {
                    throw new InvalidOperationException("Не удалось закрыть запущенный MaoLauncher. Установщик завершает работу без изменения установленной версии.");
                }
            }
        }
        return true;
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
                if (!IsDisposed)
                {
                    var mappedPercent = 15 + percent * 50 / 100;
                    BeginInvoke(new Action(() => SetProgress(mappedPercent, "Загрузка файлов MaoLauncher")));
                }
            }
        }
    }

    private void SetProgress(int value, string? detail = null)
    {
        value = Math.Clamp(value, 0, 100);
        if (!_uiReady || _webView is null || _webView.IsDisposed) return;

        var safeDetail = JsonSerializer.Serialize(detail ?? "");
        var script = $"window.setProgress && window.setProgress({value}, {safeDetail});";
        try { _ = _webView.CoreWebView2.ExecuteScriptAsync(script); } catch { }
    }

    private void SetStatus(string value, string? detail = null)
    {
        if (!_uiReady || _webView is null || _webView.IsDisposed) return;
        var safeStatus = JsonSerializer.Serialize(value);
        var safeDetail = JsonSerializer.Serialize(detail ?? "");
        var script = $"window.setStatus && window.setStatus({safeStatus}, {safeDetail});";
        try { _ = _webView.CoreWebView2.ExecuteScriptAsync(script); } catch { }
    }

    private static void ExtractZipSafely(string zipPath, string destination, Action<int>? progress = null)
    {
        var root = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
        using var archive = ZipFile.OpenRead(zipPath);
        var entries = archive.Entries;
        var totalEntries = Math.Max(entries.Count, 1);
        var processedEntries = 0;
        foreach (var entry in entries)
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
            processedEntries++;
            progress?.Invoke(processedEntries * 100 / totalEntries);
        }
    }

    private static void TryCreateUninstallShortcut(string setupExecutable)
    {
        try
        {
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var shortcutPath = Path.Combine(desktop, "Удалить MaoLauncher.lnk");
            var shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType is null) return;
            dynamic shell = Activator.CreateInstance(shellType)!;
            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = setupExecutable;
            shortcut.Arguments = "--uninstall";
            shortcut.WorkingDirectory = Path.GetDirectoryName(setupExecutable);
            shortcut.Description = "Удаление MaoLauncher и установленных игровых файлов";
            shortcut.Save();
        }
        catch { }
    }

    private static void TryCreateDesktopShortcut(string setupExecutable)
    {
        try
        {
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var shortcutPath = Path.Combine(desktop, "MaoLauncher.lnk");
            var shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType is null) return;
            dynamic shell = Activator.CreateInstance(shellType)!;
            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = setupExecutable;
            shortcut.WorkingDirectory = Path.GetDirectoryName(setupExecutable);
            shortcut.Description = "Проверка обновлений и запуск MaoLauncher";
            shortcut.Save();
        }
        catch { }
    }
}

internal sealed class ProgressTrack : Control
{
    private int _value;
    [System.ComponentModel.DesignerSerializationVisibility(System.ComponentModel.DesignerSerializationVisibility.Hidden)]
    public int Value
    {
        get => _value;
        set { _value = Math.Clamp(value, 0, 100); Invalidate(); }
    }

    public ProgressTrack()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
    }

    private static GraphicsPath CreateProgressPath(Rectangle bounds)
    {
        var path = new GraphicsPath();
        var diameter = Math.Min(bounds.Height, bounds.Width);
        path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 90, 180);
        path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 180);
        path.CloseFigure();
        return path;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        if (ClientSize.Width <= 0 || ClientSize.Height <= 0) return;
        var trackBounds = new Rectangle(0, 0, ClientSize.Width - 1, ClientSize.Height - 1);
        using var trackPath = CreateProgressPath(trackBounds);
        using var track = new SolidBrush(Color.FromArgb(90, 230, 210, 245));
        e.Graphics.FillPath(track, trackPath);

        var width = (int)(ClientSize.Width * _value / 100f);
        if (width > 0)
        {
            var fillBounds = new Rectangle(0, 0, Math.Min(width, ClientSize.Width) - 1, ClientSize.Height - 1);
            if (fillBounds.Width > 0)
            {
                using var fillPath = CreateProgressPath(fillBounds);
                using var fill = new LinearGradientBrush(fillBounds, Color.FromArgb(164, 103, 206), Color.FromArgb(220, 166, 255), LinearGradientMode.Horizontal);
                e.Graphics.FillPath(fill, fillPath);
            }
        }
    }
}

internal sealed class ShineImageOverlay : Control
{
    private readonly Bitmap _image;
    private readonly GraphicsPath _alphaMask = new();
    private readonly System.Windows.Forms.Timer _timer;
    private float _position = -120;

    public ShineImageOverlay(Bitmap image)
    {
        _image = image;
        // Build a clip path from opaque pixel runs. Bitmap.GetPixel is available here
        // because the field is explicitly a Bitmap, not the base Image type.
        for (var y = 0; y < _image.Height; y++)
        {
            var runStart = -1;
            for (var x = 0; x <= _image.Width; x++)
            {
                var opaque = x < _image.Width && _image.GetPixel(x, y).A > 12;
                if (opaque && runStart < 0) runStart = x;
                if (!opaque && runStart >= 0)
                {
                    _alphaMask.AddRectangle(new Rectangle(runStart, y, x - runStart, 1));
                    runStart = -1;
                }
            }
        }

        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
        _timer = new System.Windows.Forms.Timer { Interval = 28 };
        _timer.Tick += (_, _) =>
        {
            _position += 5.5f;
            if (_position > Width + 120) _position = -120;
            Invalidate();
        };
        _timer.Start();
        Disposed += (_, _) => { _timer.Dispose(); _alphaMask.Dispose(); _image.Dispose(); };
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        if (Width <= 0 || Height <= 0) return;
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.DrawImage(_image, ClientRectangle);

        var state = g.Save();
        try
        {
            var scaleX = Width / (float)_image.Width;
            var scaleY = Height / (float)_image.Height;
            g.ScaleTransform(scaleX, scaleY);
            g.SetClip(_alphaMask, CombineMode.Intersect);

            var shineBounds = new RectangleF(
                _position / scaleX, 0, 82 / scaleX, _image.Height);
            using var shine = new LinearGradientBrush(
                shineBounds,
                Color.FromArgb(0, 255, 255, 255),
                Color.FromArgb(0, 255, 255, 255),
                LinearGradientMode.Horizontal);
            shine.InterpolationColors = new ColorBlend
            {
                Positions = new[] { 0f, .42f, .55f, 1f },
                Colors = new[]
                {
                    Color.FromArgb(0, 255, 255, 255),
                    Color.FromArgb(0, 255, 255, 255),
                    Color.FromArgb(155, 255, 255, 255),
                    Color.FromArgb(0, 255, 255, 255)
                }
            };
            g.FillRectangle(shine, 0, 0, _image.Width, _image.Height);
        }
        finally
        {
            g.Restore(state);
        }
    }
}

internal sealed class BackgroundCanvas : Panel
{
    private readonly Image? _image;

    public BackgroundCanvas(Image? image)
    {
        _image = image;
        DoubleBuffered = true;
        ResizeRedraw = true;
    }

    protected override void OnPaintBackground(PaintEventArgs e)
    {
        // Transparent child controls ask their parent to paint its background.
        // Draw the banner here (not only in OnPaint) so labels never show clipped image tiles.
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.HighQuality;
        if (_image is not null)
        {
            var scale = Math.Max(Width / (float)_image.Width, Height / (float)_image.Height);
            var w = _image.Width * scale;
            var h = _image.Height * scale;
            g.DrawImage(_image, (Width - w) / 2, (Height - h) / 2, w, h);
        }
        else
        {
            using var gradient = new LinearGradientBrush(ClientRectangle, Color.FromArgb(35, 22, 45), Color.FromArgb(10, 9, 14), LinearGradientMode.ForwardDiagonal);
            g.FillRectangle(gradient, ClientRectangle);
        }

        using var shade = new SolidBrush(Color.FromArgb(178, 8, 7, 12));
        g.FillRectangle(shade, ClientRectangle);
        using var sideGlow = new LinearGradientBrush(new Rectangle(0, 0, Width, Height), Color.FromArgb(70, 102, 54, 137), Color.FromArgb(0, 20, 14, 26), LinearGradientMode.Horizontal);
        g.FillRectangle(sideGlow, ClientRectangle);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
    }
}
