import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler


SUBWAY_API_KEY = os.environ.get("SEOUL_SUBWAY_API_KEY", "").strip()
SUBWAY_STATION = "사당"
SUBWAY_LINE_ID = "1004"
UPSTREAM_TIMEOUT_SECONDS = 30
UPSTREAM_RETRY_COUNT = 1


def fetch_subway_rows():
    if not SUBWAY_API_KEY:
        raise RuntimeError("SEOUL_SUBWAY_API_KEY is empty")

    url = (
        "https://swopenAPI.seoul.go.kr/api/subway/"
        f"{urllib.parse.quote(SUBWAY_API_KEY)}/xml/realtimeStationArrival/0/10/"
        f"{urllib.parse.quote(SUBWAY_STATION)}"
    )
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.8",
            "Connection": "close",
        },
    )

    for attempt in range(UPSTREAM_RETRY_COUNT + 1):
        try:
            with urllib.request.urlopen(request, timeout=UPSTREAM_TIMEOUT_SECONDS) as response:
                xml_text = response.read().decode("utf-8")
            break
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            if attempt < UPSTREAM_RETRY_COUNT:
                time.sleep(1)
                continue
            raise RuntimeError(
                f"Upstream request failed after {UPSTREAM_TIMEOUT_SECONDS}s: {exc}"
            ) from exc

    root = ET.fromstring(xml_text)
    rows = []

    for row_el in root.findall(".//row"):
        row = {}
        for child in row_el:
            row[child.tag] = child.text or ""

        if row.get("subwayId") == SUBWAY_LINE_ID:
            rows.append(row)

    return rows


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if not self.path.startswith("/api/subway/sadang-line4"):
            self.send_response(404)
            self.end_headers()
            return

        try:
            rows = fetch_subway_rows()
            body = json.dumps(
                {
                    "station": SUBWAY_STATION,
                    "lineId": SUBWAY_LINE_ID,
                    "rows": rows,
                },
                ensure_ascii=False,
            ).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (urllib.error.URLError, TimeoutError, ET.ParseError, RuntimeError) as exc:
            body = json.dumps({"error": str(exc)}, ensure_ascii=False).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
