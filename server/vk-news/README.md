# VK news feed for MaoLauncher

Upload the contents of this folder to `public_html/api/` (or the equivalent public web directory), so the endpoint is:

`https://maopickme.ru/api/news.php`

## Files to upload
- `news.php`
- `.htaccess`
- `news-config.php.example` (rename it to `news-config.php` on the server)

Edit `news-config.php` on the server and replace `PASTE_VK_SERVICE_KEY_HERE` with the **service access key** of a VK application. Do not put the key in MaoLauncher, GitHub, or a public file. The included `.htaccess` denies direct HTTP access to the config file on Apache hosting. If your hosting uses Nginx, store the config outside the public web directory instead.

The endpoint reads the latest public posts from the group short name `maopickme_mc`, caches the result for five minutes, and returns JSON. It requires PHP cURL and (for long text) mbstring.

## Test
Open `https://maopickme.ru/api/news.php` in a browser. A working setup returns JSON with `"ok":true` and a `"news"` array. If it reports a missing service key, check `news-config.php`. Never send the key in chat.

The launcher requests this endpoint every 15 minutes and displays each post as a clickable news card linking to the original VK post.
