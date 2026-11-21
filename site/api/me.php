<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
method('GET');
$u = require_user();
$q = db()->prepare('SELECT minecraft_uuid,minecraft_name,linked_at FROM mao_minecraft_profiles WHERE user_id=? ORDER BY linked_at DESC');
$q->execute([$u['id']]);
respond(['ok'=>true,'user'=>$u,'minecraft_profiles'=>$q->fetchAll()]);
