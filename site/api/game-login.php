<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
method('POST');

global $config;
$provided = (string)($_SERVER['HTTP_X_MAO_SERVER_KEY'] ?? '');
$expected = (string)($config['app']['game_server_secret'] ?? '');
if (strlen($expected) < 32 || !hash_equals($expected, $provided)) {
    respond(['ok'=>false,'error'=>'server_not_configured'],503);
}

$raw = file_get_contents('php://input', false, null, 0, 8193);
if ($raw === false || strlen($raw) > 8192) respond(['ok'=>false,'error'=>'request_too_large'],413);
$data = json_decode($raw, true);
if (!is_array($data)) respond(['ok'=>false,'error'=>'invalid_request'],400);

$identity = trim((string)($data['identity'] ?? ''));
$password = (string)($data['password'] ?? '');
$uuid = strtolower(trim((string)($data['uuid'] ?? '')));
$mcName = trim((string)($data['minecraft_name'] ?? ''));
if ($identity === '' || strlen($identity) > 254 || $password === '' || strlen($password) > 200 ||
    !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $uuid) ||
    !preg_match('/^[A-Za-z0-9_]{1,16}$/', $mcName)) {
    respond(['ok'=>false,'error'=>'invalid_request'],422);
}

try {
    $q = db()->prepare('SELECT id,username,password_hash,email_verified_at,status FROM mao_users WHERE username=? OR email=? LIMIT 1');
    $q->execute([$identity, mb_strtolower($identity)]);
    $user = $q->fetch();
    if (!$user || !password_verify($password, $user['password_hash']) || $user['status'] !== 'active') {
        usleep(random_int(120000, 260000));
        respond(['ok'=>false,'error'=>'invalid_credentials'],401);
    }
    if (!$user['email_verified_at']) respond(['ok'=>false,'error'=>'email_not_verified'],403);

    // Do not bind a Minecraft UUID merely because someone supplied account credentials.
    // With online-mode=false, UUIDs are name-derived and can be impersonated. Linking
    // must use a separate website-confirmed one-time challenge in a later API flow.

    $payload = ['uid'=>(int)$user['id'],'uuid'=>$uuid,'name'=>$mcName,'iat'=>time(),'exp'=>time()+90,'nonce'=>bin2hex(random_bytes(16))];
    $encoded = rtrim(strtr(base64_encode(json_encode($payload, JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
    $signature = hash_hmac('sha256', $encoded, $expected, true);
    $token = $encoded . '.' . rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
    respond(['ok'=>true,'token'=>$token,'expires_in'=>90,'account'=>['username'=>$user['username']]]);
} catch (Throwable $e) {
    error_log('Mao game login error: '.$e->getMessage());
    respond(['ok'=>false,'error'=>'server_error'],500);
}
