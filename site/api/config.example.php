<?php
// Copy to config.php on the hosting account. Never publish config.php.
return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'YOUR_DATABASE_NAME',
        'user' => 'YOUR_DATABASE_USER',
        'pass' => 'CHANGE_THIS',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'base_url' => 'https://hm572194.webhm.cloud/',
        'token_ttl_days' => 30,
        'verification_ttl_hours' => 24,
        'mail_from' => 'YOUR_VERIFICATION_EMAIL',
        'mail_from_name' => 'MaoPickMe',
        // Must match plugins/MaoAuth/config.yml server-secret. Generate a random secret (32+ chars).
        'game_server_secret' => 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET',
    ],
];
