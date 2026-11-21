<?php
declare(strict_types=1);
$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'backend_not_configured']);
    exit;
}
$config = require $configFile;
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function db(): PDO {
    global $config;
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $d = $config['db'];
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $d['host'], $d['port'] ?? 3306, $d['name'], $d['charset'] ?? 'utf8mb4');
    $pdo = new PDO($dsn, $d['user'], $d['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}
function json_input(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}
function respond(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function method(string $expected): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $expected) respond(['ok' => false, 'error' => 'method_not_allowed'], 405);
}
function client_ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 45); }
function bearer_token(): ?string {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$h && function_exists('getallheaders')) { $headers = getallheaders(); $h = $headers['Authorization'] ?? $headers['authorization'] ?? ''; }
    return preg_match('/^Bearer\s+([A-Za-z0-9_-]{40,100})$/i', trim($h), $m) ? $m[1] : null;
}
function current_user(): ?array {
    $token = bearer_token();
    if (!$token) return null;
    $q = db()->prepare('SELECT u.id,u.username,u.email,u.display_name,u.email_verified_at,u.status FROM mao_sessions s JOIN mao_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() LIMIT 1');
    $q->execute([hash('sha256', $token)]);
    $user = $q->fetch();
    if (!$user || $user['status'] !== 'active') return null;
    db()->prepare('UPDATE mao_sessions SET last_used_at=UTC_TIMESTAMP() WHERE token_hash=?')->execute([hash('sha256', $token)]);
    return $user;
}
function require_user(): array {
    $u = current_user();
    if (!$u) respond(['ok' => false, 'error' => 'unauthorized'], 401);
    return $u;
}
function issue_session(int $userId): string {
    global $config;
    $token = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    $days = max(1, min(90, (int)($config['app']['token_ttl_days'] ?? 30)));
    $expires = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify('+' . $days . ' days')->format('Y-m-d H:i:s');
    db()->prepare('INSERT INTO mao_sessions(user_id,token_hash,expires_at) VALUES(?,?,?)')->execute([$userId, hash('sha256', $token), $expires]);
    return $token;
}
function rate_limit(string $action, int $limit = 8, int $window = 900): void {
    // File-based temporary limiter; for multi-server deployment replace with a shared store.
    $dir = sys_get_temp_dir() . '/mao-auth-rate';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $key = hash('sha256', $action . '|' . client_ip());
    $file = $dir . '/' . $key;
    $now = time(); $data = ['start' => $now, 'count' => 0];
    if (is_file($file)) { $loaded = json_decode((string)file_get_contents($file), true); if (is_array($loaded)) $data = $loaded; }
    if ($now - (int)$data['start'] >= $window) $data = ['start' => $now, 'count' => 0];
    $data['count']++;
    @file_put_contents($file, json_encode($data), LOCK_EX);
    if ($data['count'] > $limit) respond(['ok' => false, 'error' => 'rate_limited'], 429);
}
