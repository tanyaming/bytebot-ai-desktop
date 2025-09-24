#!/bin/bash

echo "🐳 启动 ByteBot Docker 服务..."

# 等待Docker启动
echo "⏳ 等待Docker启动..."
while ! docker info >/dev/null 2>&1; do
    echo "等待Docker守护进程启动..."
    sleep 2
done

echo "✅ Docker已启动"

# 停止现有容器
echo "🧹 清理现有容器..."
docker-compose -f docker/docker-compose.yml down

# 启动服务
echo "🚀 启动Docker服务..."
docker-compose -f docker/docker-compose.yml up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 15

# 检查服务状态
echo "📊 检查服务状态..."
echo "外部MySQL: $(curl -s mysql://mysqlroot:Htjc2025a@8.137.123.168:3306/testData >/dev/null 2>&1 && echo '✅ 可连接' || echo '❌ 无法连接')"
echo "Desktop服务: $(docker-compose -f docker/docker-compose.yml ps bytebot-desktop | grep -q "Up" && echo '✅ 运行中' || echo '❌ 未运行')"
echo "Agent服务: $(docker-compose -f docker/docker-compose.yml ps bytebot-agent | grep -q "Up" && echo '✅ 运行中' || echo '❌ 未运行')"
echo "UI服务: $(docker-compose -f docker/docker-compose.yml ps bytebot-ui | grep -q "Up" && echo '✅ 运行中' || echo '❌ 未运行')"

# 检查端口
echo ""
echo "🔍 检查端口状态..."
echo "9990端口: $(lsof -i :9990 >/dev/null 2>&1 && echo '✅ 已占用' || echo '❌ 未占用')"
echo "9991端口: $(lsof -i :9991 >/dev/null 2>&1 && echo '✅ 已占用' || echo '❌ 未占用')"
echo "9992端口: $(lsof -i :9992 >/dev/null 2>&1 && echo '✅ 已占用' || echo '❌ 未占用')"

echo ""
echo "🎉 ByteBot Docker 服务启动完成！"
echo "📱 访问地址: http://localhost:9992"
echo "🔧 API 接口: http://localhost:9991"
echo "🖥️  VNC 桌面: http://localhost:9990/vnc"
echo ""
echo "查看日志: docker-compose -f docker/docker-compose.yml logs -f"
echo "停止服务: docker-compose -f docker/docker-compose.yml down"
