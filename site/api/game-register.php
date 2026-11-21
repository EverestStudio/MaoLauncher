<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
method('POST');

global $config;
$provided = (string)($_SERVER['HTTP_X_MAO_SERVER_KEY'] ?? '');
$expected = (string)($config['app']['game_server_secret'] ?? '');
if (strlen($expected) < 32 || !hash_equals($expected, $provided)) {
    respond(['ok' => false, 'error' => 'server_not_configured'], 503);
}

rate_limit('game_register', 3, 3600);
$data = json_input();
$username = trim((string)($data['username'] ?? ''));
$email = mb_strtolower(trim((string)($data['email'] ?? '')));
$password = (string)($data['password'] ?? '');
$confirm = (string)($data['confirm_password'] ?? '');
$display = trim((string)($data['display_name'] ?? $username));

if (!preg_match('/^[A-Za-z0-9_]{3,24}$/', $username)) respond(['ok'=>false,'error'=>'invalid_username'],422);
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 254) respond(['ok'=>false,'error'=>'invalid_email'],422);
if (strlen($password) < 10 || strlen($password) > 200) respond(['ok'=>false,'error'=>'weak_password'],422);
if (!hash_equals($password, $confirm)) respond(['ok'=>false,'error'=>'password_mismatch'],422);
if (!preg_match('//u', $display) || mb_strlen($display) < 2 || mb_strlen($display) > 32) respond(['ok'=>false,'error'=>'invalid_display_name'],422);

try {
    $pdo = db();
    $hash = password_hash($password, PASSWORD_ARGON2ID);
    $q = $pdo->prepare('INSERT INTO mao_users(username,email,display_name,password_hash) VALUES(?,?,?,?)');
    $q->execute([$username,$email,$display,$hash]);
    $uid = (int)$pdo->lastInsertId();

    $raw = rtrim(strtr(base64_encode(random_bytes(36)), '+/', '-_'), '=');
    $hours = max(1, (int)($config['app']['verification_ttl_hours'] ?? 24));
    $expires = gmdate('Y-m-d H:i:s', time() + $hours * 3600);
    $pdo->prepare('INSERT INTO mao_email_tokens(user_id,token_hash,expires_at) VALUES(?,?,?)')
        ->execute([$uid,hash('sha256',$raw),$expires]);

    $url = rtrim($config['app']['base_url'],'/') . '/api/verify-email.php?token=' . rawurlencode($raw);
    $subject = 'Подтверждение аккаунта Mao';
    $body = "Здравствуйте, {$display}!\n\nПодтвердите адрес электронной почты, перейдя по ссылке:\n{$url}\n\nСсылка действительна {$hours} ч.";
    $from = $config['app']['mail_from'];
    $fromName = $config['app']['mail_from_name'] ?? 'MaoPickMe';
    $headers = 'From: ' . mb_encode_mimeheader($fromName) . " <{$from}>\r\n" . "Content-Type: text/plain; charset=UTF-8\r\n";
    $sent = @mail($email, mb_encode_mimeheader($subject), $body, $headers);

    respond(['ok'=>true,'message'=>'account_created','verification_email_sent'=>$sent]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') respond(['ok'=>false,'error'=>'username_or_email_taken'],409);
    error_log('Mao game register DB error: '.$e->getMessage());
    respond(['ok'=>false,'error'=>'server_error'],500);
} catch (Throwable $e) {
    error_log('Mao game register error: '.$e->getMessage());
    respond(['ok'=>false,'error'=>'server_error'],500);
}
