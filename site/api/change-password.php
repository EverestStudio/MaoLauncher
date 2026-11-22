<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
method('POST');
$u = require_user();
$data = json_input();
$current = (string)($data['current_password'] ?? '');
$new = (string)($data['new_password'] ?? '');
if (strlen($new) < 10 || strlen($new) > 200) respond(['ok'=>false,'error'=>'weak_password'], 422);
$q = db()->prepare('SELECT password_hash FROM mao_users WHERE id=? LIMIT 1');
$q->execute([$u['id']]);
$row = $q->fetch();
if (!$row || !password_verify($current, $row['password_hash'])) respond(['ok'=>false,'error'=>'invalid_current_password'], 403);
$hash = password_hash($new, PASSWORD_ARGON2ID);
db()->prepare('UPDATE mao_users SET password_hash=? WHERE id=?')->execute([$hash, $u['id']]);
db()->prepare('DELETE FROM mao_sessions WHERE user_id=?')->execute([$u['id']]);
respond(['ok'=>true]);
