import json
import os
import pathlib
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = pathlib.Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8000"))
SUBWAY_API_KEY = os.environ.get("SEOUL_SUBWAY_API_KEY", "4f7377766673746f3639754f787679").strip()
SUBWAY_STATION = "사당"
SUBWAY_LINE_ID = "1004"


def parse_rows(xml_text: str) -> list[dict]:
    root = ET.fromstring(xml_text)
    rows: list[dict] = []

    for row_el in root.findall(".//row"):
        row = {}
        for child in row_el:
            row[child.tag] = child.text or ""
        rows.append(row)

    return rows


def fetch_subway_rows() -> list[dict]:
    if not SUBWAY_API_KEY:
        raise RuntimeError("SEOUL_SUBWAY_API_KEY is empty")

    url = (
        f"https://swopenAPI.seoul.go.kr/api/subway/"
        f"{urllib.parse.quote(SUBWAY_API_KEY)}/xml/realtimeStationArrival/0/10/"
        f"{urllib.parse.quote(SUBWAY_STATION)}"
    )
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

    with urllib.request.urlopen(request, timeout=10) as response:
        payload = response.read().decode("utf-8")

    return parse_rows(payload)


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/subway/sadang-line4"):
            self.handle_subway_proxy()
            return

        if self.path == "/":
            self.path = "/index.html"

        return super().do_GET()

    def handle_subway_proxy(self):
        try:
            rows = fetch_subway_rows()
            payload = {
                "station": SUBWAY_STATION,
                "lineId": SUBWAY_LINE_ID,
                "rows": rows,
            }
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
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

    def log_message(self, format, *args):
        return


def main():
    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print(f"Serving on http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()