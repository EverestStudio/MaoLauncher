<?php
// Copy to config.php and fill in credentials. Never publish config.php in a public repository.
return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'hm572194_maoaccounts',
        'user' => 'hm572194_tomskiy',
        'pass' => 'ef1seoa6',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'base_url' => 'https://hm572194.webhm.cloud/',
        'token_ttl_days' => 30,
        'verification_ttl_hours' => 24,
        'mail_from' => 'maoaccaunts@hm572194.webhm.cloud',
        'mail_from_name' => 'MaoPickMe',
    ],
];
