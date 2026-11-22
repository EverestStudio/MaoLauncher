<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
method('POST');
$u = require_user();
$data = json_input();
$name = trim((string)($data['display_name'] ?? ''));
if (!preg_match('//u', $name) || mb_strlen($name) < 2 || mb_strlen($name) > 32) {
    respond(['ok'=>false,'error'=>'invalid_display_name'], 422);
}
db()->prepare('UPDATE mao_users SET display_name=? WHERE id=?')->execute([$name, $u['id']]);
respond(['ok'=>true,'display_name'=>$name]);
