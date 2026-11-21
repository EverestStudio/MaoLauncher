<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
method('POST'); rate_limit('login', 10, 900);
$data = json_input();
$identity = trim((string)($data['identity'] ?? ''));
$password = (string)($data['password'] ?? '');
if ($identity === '' || $password === '') respond(['ok'=>false,'error'=>'invalid_credentials'],422);
$q = db()->prepare('SELECT id,username,email,display_name,password_hash,email_verified_at,status FROM mao_users WHERE username=? OR email=? LIMIT 1');
$q->execute([$identity, mb_strtolower($identity)]); $u = $q->fetch();
if (!$u || !password_verify($password, $u['password_hash']) || $u['status'] !== 'active') respond(['ok'=>false,'error'=>'invalid_credentials'],401);
if (!$u['email_verified_at']) respond(['ok'=>false,'error'=>'email_not_verified'],403);
if (password_needs_rehash($u['password_hash'], PASSWORD_ARGON2ID)) {
    db()->prepare('UPDATE mao_users SET password_hash=? WHERE id=?')->execute([password_hash($password,PASSWORD_ARGON2ID),$u['id']]);
}
$token = issue_session((int)$u['id']);
unset($u['password_hash'],$u['status']);
respond(['ok'=>true,'token'=>$token,'user'=>$u]);
