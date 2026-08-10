#!/usr/bin/env python3
"""SPA-aware dev server for the Al Ryum clone.
Serves files normally. Falls back to index.html for any non-file route
so React Router paths (/projects/5, /about, etc.) work in the browser.
"""
import http.server
import socketserver
import os
import sys
from socketserver import ThreadingMixIn

ROOT = "/Users/admin/al-ryum-clone"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
BIND = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        # Strip query string and fragment
        path = self.path.split("?")[0].split("#")[0]
        full = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))

        # If file exists, serve normally
        if os.path.isfile(full):
            return super().do_GET()

        # If directory, try index.html inside it
        if os.path.isdir(full):
            index_path = os.path.join(full, "index.html")
            if os.path.isfile(index_path):
                self.path = path.rstrip("/") + "/index.html"
                return super().do_GET()

        # If route has no file extension (e.g., /projects/5, /about),
        # serve the SPA's index.html so client-side routing can take over
        basename = os.path.basename(path)
        if "." not in basename:
            self.path = "/index.html"
            return super().do_GET()

        # Otherwise 404
        self.send_error(404, "File not found")


class ThreadedHTTPServer(ThreadingMixIn, http.server.HTTPServer):
    """Handle each request in a new thread — avoids head-of-line blocking."""
    daemon_threads = True
    allow_reuse_address = True


def main():
    os.chdir(ROOT)
    with ThreadedHTTPServer((BIND, PORT), SPAHandler) as httpd:
        print(f"SPA server: http://{BIND}:{PORT}/")
        print(f"  root: {ROOT}")
        print(f"  routes: any non-extension path falls back to /index.html")
        print(f"  press Ctrl-C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down.")


if __name__ == "__main__":
    main()
