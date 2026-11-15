<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');
header('X-Content-Type-Options: nosniff');

$configFile = __DIR__ . '/news-config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'News source is not configured.'], JSON_UNESCAPED_UNICODE);
    exit;
}
$config = require $configFile;
$serviceKey = is_array($config) ? trim((string)($config['vk_service_key'] ?? '')) : '';
if ($serviceKey === '' || $serviceKey === 'PASTE_VK_SERVICE_KEY_HERE') {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'VK service key is missing.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$cacheFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'mao-vk-news-' . sha1(__DIR__) . '.json';
if (is_file($cacheFile) && filemtime($cacheFile) > time() - 300) {
    readfile($cacheFile);
    exit;
}

$query = http_build_query([
    'domain' => 'maopickme_mc',
    'count' => 10,
    'filter' => 'owner',
    'v' => '5.199',
]);
$ch = curl_init('https://api.vk.ru/method/wall.get?' . $query);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $serviceKey, 'Accept: application/json'],
    CURLOPT_USERAGENT => 'MaoLauncher-News/1.0',
]);
$response = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false || $status < 200 || $status >= 300) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'VK API request failed.'], JSON_UNESCAPED_UNICODE);
    exit;
}
$data = json_decode($response, true);
if (!is_array($data) || isset($data['error']) || !isset($data['response']['items']) || !is_array($data['response']['items'])) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'VK API returned an invalid response.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$news = [];
foreach ($data['response']['items'] as $post) {
    if (!is_array($post) || empty($post['text'])) continue;
    $text = trim(html_entity_decode(strip_tags((string)$post['text']), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    if ($text === '') continue;
    $lines = preg_split('/\R/u', $text) ?: [$text];
    $title = trim((string)array_shift($lines));
    if ($title === '') $title = 'Новости MaoPickMe';
    $body = trim(implode("\n", $lines));
    if ($body === '') $body = $text;
    if (mb_strlen($title, 'UTF-8') > 150) $title = mb_substr($title, 0, 147, 'UTF-8') . '…';
    if (mb_strlen($body, 'UTF-8') > 1000) $body = mb_substr($body, 0, 997, 'UTF-8') . '…';

    $image = '';
    foreach (($post['attachments'] ?? []) as $attachment) {
        if (($attachment['type'] ?? '') === 'photo') {
            $sizes = $attachment['photo']['sizes'] ?? [];
            usort($sizes, static fn($a, $b) => (($b['width'] ?? 0) * ($b['height'] ?? 0)) <=> (($a['width'] ?? 0) * ($a['height'] ?? 0)));
            $candidate = (string)($sizes[0]['url'] ?? '');
            if (str_starts_with($candidate, 'https://')) $image = $candidate;
            break;
        }
    }
    $ownerId = (int)($post['owner_id'] ?? 0);
    $postId = (int)($post['id'] ?? 0);
    $news[] = [
        'title' => $title,
        'text' => $body,
        'date' => !empty($post['date']) ? date('d.m.Y', (int)$post['date']) : '',
        'image' => $image,
        'url' => ($ownerId !== 0 && $postId !== 0) ? 'https://vk.ru/wall' . $ownerId . '_' . $postId : 'https://vk.ru/maopickme_mc',
    ];
    if (count($news) >= 10) break;
}

$output = json_encode(['ok' => true, 'news' => $news], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($output === false) {
    http_response_code(500);
    echo '{"ok":false,"error":"JSON encoding failed."}';
    exit;
}
@file_put_contents($cacheFile, $output, LOCK_EX);
echo $output;
