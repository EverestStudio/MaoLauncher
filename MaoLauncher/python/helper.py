"""Small Python backend used by Север Launcher."""

from __future__ import annotations

import json
import re
import socket
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


def fetch_json(url: str) -> object:
    request = Request(url, headers={"User-Agent": "SeverLauncher/1.0"})
    with urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def fabric_versions(version: str) -> list[dict]:
    if not re.fullmatch(r"\d+(?:\.\d+){1,2}(?:[-.][\w.-]+)?", version):
        raise ValueError("Некорректная версия Minecraft.")
    data = fetch_json(
        f"https://meta.fabricmc.net/v2/versions/loader/{quote(version, safe='')}"
    )
    if not isinstance(data, list):
        raise ValueError("Fabric Meta API вернул неожиданный ответ.")
    return [
        {"loader": item.get("loader", {}), "intermediary": item.get("intermediary", {})}
        for item in data[:6]
    ]


def server_status(address: str) -> dict:
    address = address.strip()
    if not address or len(address) > 255 or any(c in address for c in "/@?#\\"):
        raise ValueError("Укажите корректный IP или домен сервера.")
    started = time.perf_counter()
    try:
        with socket.create_connection((address, 25565), timeout=3):
            ping = round((time.perf_counter() - started) * 1000)
    except OSError as error:
        return {
            "configured": True,
            "online": False,
            "players": {},
            "ping": None,
            "dnsError": str(error),
        }
    data = fetch_json(f"https://api.mcsrvstat.us/3/{quote(address, safe='.:_-')}")
    if not isinstance(data, dict):
        raise ValueError("Сервис статуса вернул неожиданный ответ.")
    return {
        "configured": True,
        "online": bool(data.get("online")),
        "players": data.get("players", {}),
        "ping": ping,
    }


def main() -> int:
    if len(sys.argv) != 3:
        raise ValueError("Некорректные аргументы Python helper.")
    action, argument = sys.argv[1], sys.argv[2]
    if action == "server-status":
        result = server_status(argument)
    else:
        raise ValueError("Неизвестная операция Python helper.")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (HTTPError, URLError, TimeoutError, ValueError, OSError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        raise SystemExit(1)
