<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
method('POST');
$u = require_user();
db()->prepare('DELETE FROM mao_sessions WHERE user_id=?')->execute([$u['id']]);
respond(['ok'=>true]);
