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
    private readonly Button _install = CreateButton("Установить MaoLauncher", true);
    private readonly Button _cancel = CreateButton("Отмена", false);
    private readonly Button _close = CreateChromeButton("×");
    private readonly Button _minimize = CreateChromeButton("—");
    private CancellationTokenSource? _cancellation;

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern nint SendMessage(nint hWnd, int msg, nint wParam, nint lParam);

    public SetupForm()
    {
        Text = "MaoLauncher Setup";
        ClientSize = new Size(760, 440);
        MinimumSize = new Size(760, 440);
        MaximumSize = new Size(760, 440);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.None;
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
            Height = 42,
            BackColor = Color.FromArgb(150, 12, 9, 17)
        };
        background.Controls.Add(topBar);
        topBar.MouseDown += DragWindow;
        var topTitle = new Label
        {
            Text = "MAO PICK ME  /  INSTALLER",
            AutoSize = true,
            Location = new Point(22, 13),
            ForeColor = Color.FromArgb(185, 170, 198),
            Font = new Font("Segoe UI Semibold", 8F),
            BackColor = Color.Transparent
        };
        topBar.Controls.Add(topTitle);
        topTitle.MouseDown += DragWindow;

        _minimize.Location = new Point(678, 0);
        _close.Location = new Point(718, 0);
        topBar.Controls.Add(_minimize);
        topBar.Controls.Add(_close);
        _minimize.Click += (_, _) => WindowState = FormWindowState.Minimized;
        _close.Click += (_, _) => Close();

        var eyebrow = new Label
        {
            Text = "MINECRAFT  •  YOUR NEXT ADVENTURE",
            AutoSize = true,
            Location = new Point(54, 118),
            ForeColor = Color.FromArgb(214, 160, 255),
            Font = new Font("Segoe UI Semibold", 9F),
            BackColor = Color.Transparent
        };
        background.Controls.Add(eyebrow);

        var logo = new Label
        {
            Text = "MaoLauncher",
            AutoSize = true,
            Location = new Point(50, 143),
            ForeColor = Color.White,
            Font = new Font("Segoe UI Semibold", 35F, FontStyle.Bold),
            BackColor = Color.Transparent
        };
        background.Controls.Add(logo);

        var tagline = new Label
        {
            Text = "Твой путь в мир Minecraft начинается здесь",
            AutoSize = true,
            Location = new Point(56, 202),
            ForeColor = Color.FromArgb(213, 202, 222),
            Font = new Font("Segoe UI", 11F),
            BackColor = Color.Transparent
        };
        background.Controls.Add(tagline);

        _status.Location = new Point(56, 278);
        _status.Size = new Size(540, 24);
        background.Controls.Add(_status);

        _percent.Location = new Point(650, 278);
        _percent.Size = new Size(54, 24);
        background.Controls.Add(_percent);

        _progress.Location = new Point(56, 309);
        _progress.Size = new Size(648, 7);
        background.Controls.Add(_progress);

        _install.Location = new Point(56, 350);
        _install.Size = new Size(232, 46);
        background.Controls.Add(_install);

        _cancel.Location = new Point(302, 350);
        _cancel.Size = new Size(112, 46);
        _cancel.Enabled = false;
        background.Controls.Add(_cancel);

        var footer = new Label
        {
            Text = "MAOLAUNCHER  •  ОФИЦИАЛЬНЫЙ УСТАНОВЩИК",
            AutoSize = true,
            Location = new Point(56, 414),
            ForeColor = Color.FromArgb(145, 130, 157),
            Font = new Font("Segoe UI", 7.5F),
            BackColor = Color.Transparent
        };
        background.Controls.Add(footer);

        _install.Click += async (_, _) => await InstallAsync();
        _cancel.Click += (_, _) => _cancellation?.Cancel();
        FormClosing += (_, _) => _cancellation?.Cancel();
    }

    private static Image? LoadBanner()
    {
        try
        {
            using var stream = typeof(SetupForm).Assembly.GetManifestResourceStream("MaoLauncher.Setup.mao-banner.png");
            return stream is null ? null : Image.FromStream(stream);
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
        return button;
    }

    private static Button CreateChromeButton(string text)
    {
        var button = new Button
        {
            Text = text,
            Size = new Size(40, 42),
            FlatStyle = FlatStyle.Flat,
            FlatAppearance = { BorderSize = 0 },
            BackColor = Color.Transparent,
            ForeColor = Color.FromArgb(220, 210, 230),
            Font = new Font("Segoe UI", 11F),
            Cursor = Cursors.Hand,
            UseVisualStyleBackColor = false
        };
        button.FlatAppearance.MouseOverBackColor = Color.FromArgb(100, 130, 90, 150);
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
        _cancellation = new CancellationTokenSource();
        var token = _cancellation.Token;
        SetBusy(true);
        SetProgress(0);
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
            SetProgress(100);
            Process.Start(new ProcessStartInfo(installedExe) { UseShellExecute = true });
            await Task.Delay(350);
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
        if (!IsDisposed) _status.Text = value;
    }

    private void SetBusy(bool busy)
    {
        _install.Enabled = !busy;
        _cancel.Enabled = busy;
        _install.Text = busy ? "Установка…" : "Установить MaoLauncher";
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
}

internal sealed class ProgressTrack : Control
{
    private int _value;
    public int Value
    {
        get => _value;
        set { _value = Math.Clamp(value, 0, 100); Invalidate(); }
    }

    public ProgressTrack()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using var track = new SolidBrush(Color.FromArgb(90, 230, 210, 245));
        using var fill = new LinearGradientBrush(ClientRectangle, Color.FromArgb(164, 103, 206), Color.FromArgb(220, 166, 255), LinearGradientMode.Horizontal);
        e.Graphics.FillRectangle(track, ClientRectangle);
        var width = (int)(ClientSize.Width * _value / 100f);
        if (width > 0) e.Graphics.FillRectangle(fill, 0, 0, width, ClientSize.Height);
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
