#!/usr/bin/env python3
"""
开发服务器 - 禁用缓存，方便开发调试
"""
import http.server
import socketserver
from pathlib import Path

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 禁用缓存
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    PORT = 8080
    Handler = NoCacheHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🚀 开发服务器启动在 http://localhost:{PORT}")
        print(f"📝 已禁用缓存，代码更改会立即生效")
        print(f"按 Ctrl+C 停止服务器")
        httpd.serve_forever()

