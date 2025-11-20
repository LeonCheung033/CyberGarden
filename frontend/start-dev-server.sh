#!/bin/bash
# 开发服务器启动脚本 - 禁用缓存

echo "🚀 启动开发服务器（禁用缓存）..."
echo "📝 访问: http://localhost:8080"
echo "⚠️  如果看到 304，请强制刷新浏览器 (Cmd+Shift+R)"
echo ""

cd "$(dirname "$0")"
python3 server.py

