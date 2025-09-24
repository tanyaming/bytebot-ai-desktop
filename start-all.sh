#!/bin/bash

# ByteBot 一键启动脚本
echo "🚀 启动 ByteBot 项目..."

# 设置环境变量
export QWEN_API_KEY="sk-667b5f886a894b8ca168b5aaa90d1470"
export QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
export DATABASE_URL="mysql://mysqlroot:Htjc2025a@8.137.123.168:3306/testData?charset=utf8mb4"
export BYTEBOT_DESKTOP_BASE_URL="http://localhost:9990"

# 清理现有进程
echo "🧹 清理现有进程..."
pkill -f "nest start" 2>/dev/null || true
pkill -f "tsx server" 2>/dev/null || true
sleep 2

# 启动 Agent 服务
echo "🤖 启动 Agent 服务 (端口 9991)..."
cd packages/bytebot-agent
npm run start:dev &
AGENT_PID=$!
cd ../..

# 等待 Agent 服务启动
sleep 8

# 启动 Desktop 服务
echo "🖥️  启动 Desktop 服务 (端口 9990)..."
cd packages/bytebotd

# 检查noVNC是否已安装
if [ ! -d "noVNC" ]; then
    echo "📥 安装noVNC客户端..."
    git clone https://github.com/novnc/noVNC.git
fi

# 检查websockify是否已安装
if ! command -v websockify &> /dev/null; then
    echo "📥 安装websockify..."
    pip3 install --break-system-packages websockify
fi

# 检查index.html是否存在
if [ ! -f "noVNC/index.html" ]; then
    echo "📝 创建noVNC index.html..."
    cat > noVNC/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>noVNC</title>
    <script>
        window.location.href = 'vnc.html' + window.location.search;
    </script>
</head>
<body>
    <p>正在重定向到VNC客户端...</p>
</body>
</html>
EOF
fi

npm run start:dev &
DESKTOP_PID=$!
cd ../..

# 等待 Desktop 服务启动
sleep 8

# 启动 UI 服务
echo "🌐 启动 UI 服务 (端口 9992)..."
cd packages/bytebot-ui
BYTEBOT_AGENT_BASE_URL="http://localhost:9991" \
BYTEBOT_DESKTOP_VNC_URL="http://localhost:9990/websockify" \
npm run dev &
UI_PID=$!
cd ../..

# 等待所有服务启动
sleep 10

# 检查服务状态
echo "📊 检查服务状态..."
echo "Agent 服务 (9991): $(lsof -i :9991 >/dev/null 2>&1 && echo '✅ 运行中' || echo '❌ 未运行')"
echo "Desktop 服务 (9990): $(lsof -i :9990 >/dev/null 2>&1 && echo '✅ 运行中' || echo '❌ 未运行')"
echo "UI 服务 (9992): $(lsof -i :9992 >/dev/null 2>&1 && echo '✅ 运行中' || echo '❌ 未运行')"

# 检查VNC连接
echo ""
echo "🔍 检查VNC连接..."
echo "noVNC客户端: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:9990/novnc/ | grep -q "200" && echo '✅ 可访问' || echo '❌ 不可访问')"
echo "VNC重定向: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:9990/vnc | grep -q "302" && echo '✅ 可访问' || echo '❌ 不可访问')"
echo "WebSocket端点: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:9990/websockify | grep -q "200\|101\|400" && echo '✅ 可访问' || echo '❌ 不可访问')"

echo ""
echo "🎉 ByteBot 启动完成！"
echo "📱 访问地址: http://localhost:9992"
echo "🔧 API 接口: http://localhost:9991"
echo "🖥️  VNC 桌面: http://localhost:9990/vnc"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap 'echo "🛑 停止所有服务..."; kill $AGENT_PID $DESKTOP_PID $UI_PID 2>/dev/null; exit' INT
wait

