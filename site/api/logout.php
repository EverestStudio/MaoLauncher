<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
method('POST');
$token = bearer_token();
if ($token) db()->prepare('DELETE FROM mao_sessions WHERE token_hash=?')->execute([hash('sha256',$token)]);
respond(['ok'=>true]);
