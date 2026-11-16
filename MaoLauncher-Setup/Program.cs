using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
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
    private readonly Label _status = new()
    {
        AutoSize = false,
        Text = "Всё готово к установке",
        ForeColor = Color.FromArgb(226, 216, 237),
        Font = new Font("Segoe UI", 10F),
        BackColor = Color.Transparent
    };
    private readonly ProgressTrack _progress = new() { BackColor = Color.Transparent };
    private readonly Label _percent = new()
    {
        AutoSize = false,
        Text = "0%",
        TextAlign = ContentAlignment.MiddleRight,
        ForeColor = Color.FromArgb(214, 160, 255),
        Font = new Font("Segoe UI Semibold", 9F),
        BackColor = Color.Transparent
    };
    
    private CancellationTokenSource? _cancellation;

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern nint SendMessage(nint hWnd, int msg, nint wParam, nint lParam);

    public SetupForm()
    {
        Text = "MaoLauncher Setup";
        ClientSize = new Size(560, 520);
        MinimumSize = new Size(560, 520);
        MaximumSize = new Size(560, 520);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.None;
        ControlBox = false;
        MaximizeBox = false;
        MinimizeBox = false;
        BackColor = Color.FromArgb(13, 10, 17);
        DoubleBuffered = true;

        var background = new BackgroundCanvas(LoadBanner())
        {
            Dock = DockStyle.Fill
        };
        Controls.Add(background);

        var topBar = new Panel
        {
            Dock = DockStyle.Top,
            Height = 46,
            BackColor = Color.FromArgb(150, 12, 9, 17)
        };
        background.Controls.Add(topBar);
        topBar.MouseDown += DragWindow;
        var topTitle = new Label
        {
            Text = "MAO PICK ME  /  INSTALLER",
            AutoSize = true,
            Location = new Point(20, 15),
            ForeColor = Color.FromArgb(185, 170, 198),
            Font = new Font("Segoe UI Semibold", 8F),
            BackColor = Color.Transparent
        };
        topBar.Controls.Add(topTitle);
        topTitle.MouseDown += DragWindow;

        var windowButtons = new Panel { Dock = DockStyle.Right, Width = 92, BackColor = Color.Transparent };
        var minimizeButton = CreateWindowButton("—", Color.FromArgb(226, 216, 237));
        minimizeButton.Location = new Point(0, 0);
        minimizeButton.Click += (_, _) => WindowState = FormWindowState.Minimized;
        var closeButton = CreateWindowButton("×", Color.FromArgb(255, 255, 255));
        closeButton.Location = new Point(46, 0);
        closeButton.Click += (_, _) => Close();
        windowButtons.Controls.Add(minimizeButton);
        windowButtons.Controls.Add(closeButton);
        topBar.Controls.Add(windowButtons);
        windowButtons.BringToFront();

        var eyebrow = new Label
        {
            Text = "MINECRAFT  •  YOUR NEXT ADVENTURE",
            AutoSize = true,
            Location = new Point(40, 92),
            ForeColor = Color.FromArgb(214, 160, 255),
            Font = new Font("Segoe UI Semibold", 9F),
            BackColor = Color.Transparent
        };
        background.Controls.Add(eyebrow);

        var logo = new Label
        {
            Text = "MaoLauncher",
            AutoSize = true,
            Location = new Point(36, 122),
            ForeColor = Color.White,
            Font = new Font("Segoe UI Semibold", 32F, FontStyle.Bold),
            BackColor = Color.Transparent
        };
        background.Controls.Add(logo);

        var tagline = new Label
        {
            Text = "Твой путь в мир Minecraft начинается здесь",
            AutoSize = true,
            Location = new Point(42, 180),
            ForeColor = Color.FromArgb(213, 202, 222),
            Font = new Font("Segoe UI", 11F),
            BackColor = Color.Transparent
        };
        background.Controls.Add(tagline);

        _status.Location = new Point(42, 270);
        _status.Size = new Size(420, 24);
        background.Controls.Add(_status);

        _percent.Location = new Point(470, 270);
        _percent.Size = new Size(48, 24);
        background.Controls.Add(_percent);

        _progress.Location = new Point(42, 304);
        _progress.Size = new Size(476, 12);
        background.Controls.Add(_progress);

        var footer = new Label
        {
            Text = "MAOLAUNCHER  •  ОФИЦИАЛЬНЫЙ УСТАНОВЩИК",
            AutoSize = true,
            Location = new Point(42, 475),
            ForeColor = Color.FromArgb(145, 130, 157),
            Font = new Font("Segoe UI", 7.5F),
            BackColor = Color.Transparent
        };
        background.Controls.Add(footer);

        FormClosing += (_, _) => _cancellation?.Cancel();
        Shown += async (_, _) => await InstallAsync();
    }

    private static Button CreateWindowButton(string text, Color color)
    {
        var button = new Button
        {
            Text = text,
            Width = 46,
            Dock = DockStyle.Right,
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

    private static Image? LoadBanner()
    {
        try
        {
            using var stream = typeof(SetupForm).Assembly.GetManifestResourceStream("MaoLauncher.Setup.mao-banner.png");
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
            SetStatus("Подготавливаем ярлык MaoLauncher…");
            var setupExecutable = EnsurePersistentSetupCopy();
            TryCreateDesktopShortcut(setupExecutable);

            var installRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs", "MaoLauncher");
            var installedExe = FindInstalledLauncher(installRoot);

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
                SetStatus("Обновлений нет. Запускаем MaoLauncher…");
                SetProgress(100);
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

            SetStatus("Распаковываем новую версию…");
            var extracted = Path.Combine(work, "extracted");
            Directory.CreateDirectory(extracted);
            ExtractZipSafely(zipPath, extracted);
            var executable = Directory.GetFiles(extracted, "MaoLauncher.exe", SearchOption.AllDirectories).FirstOrDefault();
            if (executable is null)
                throw new InvalidDataException("В архиве не найден MaoLauncher.exe.");

            if (!await CloseInstalledLauncherAsync(installRoot, token))
                throw new InvalidOperationException("Перед обновлением закрой MaoLauncher и повторно запусти установщик.");

            SetStatus("Заменяем файлы лаунчера…");
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
            SetStatus("Ошибка. Установщик завершает работу…");
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
        return Directory.GetFiles(installRoot, "MaoLauncher.exe", SearchOption.AllDirectories).FirstOrDefault();
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
                if (!IsDisposed) BeginInvoke(new Action(() => SetProgress(percent)));
            }
        }
    }

    private void SetProgress(int value)
    {
        value = Math.Clamp(value, 0, 100);
        _progress.Value = value;
        _percent.Text = value + "%";
    }

    private void SetStatus(string value)
    {
        if (!IsDisposed && !Disposing && IsHandleCreated) _status.Text = value;
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

internal sealed class BackgroundCanvas : Panel
{
    private readonly Image? _image;

    public BackgroundCanvas(Image? image)
    {
        _image = image;
        DoubleBuffered = true;
        ResizeRedraw = true;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
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
}
