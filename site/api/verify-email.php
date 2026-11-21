<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
$token = (string)($_GET['token'] ?? '');
if (!preg_match('/^[A-Za-z0-9_-]{40,100}$/', $token)) respond(['ok'=>false,'error'=>'invalid_token'],400);
$pdo = db();
$q = $pdo->prepare('SELECT id,user_id FROM mao_email_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() LIMIT 1');
$q->execute([hash('sha256',$token)]); $row = $q->fetch();
if (!$row) respond(['ok'=>false,'error'=>'token_expired_or_used'],400);
$pdo->beginTransaction();
$pdo->prepare('UPDATE mao_users SET email_verified_at=UTC_TIMESTAMP() WHERE id=?')->execute([$row['user_id']]);
$pdo->prepare('UPDATE mao_email_tokens SET used_at=UTC_TIMESTAMP() WHERE id=?')->execute([$row['id']]);
$pdo->commit();
header('Location: ../account/login.html?verified=1'); exit;
