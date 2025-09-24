#!/bin/bash

echo "🔧 修复noVNC配置..."

# 检查容器是否运行
if ! docker ps | grep -q bytebot-desktop; then
    echo "❌ bytebot-desktop容器未运行，请先启动Docker服务"
    exit 1
fi

# 创建index.html文件
echo "📝 创建noVNC index.html文件..."
docker exec bytebot-desktop bash -c 'cat > /opt/noVNC/index.html << EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>noVNC</title>
    <script>
        window.location.href = "vnc.html" + window.location.search;
    </script>
</head>
<body>
    <p>正在重定向到VNC客户端...</p>
</body>
</html>
EOF'

# 验证修复
echo "🧪 验证修复..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:9990/novnc/ | grep -q "200"; then
    echo "✅ noVNC配置修复成功！"
    echo "🎉 现在可以访问 http://localhost:9990/vnc 了"
else
    echo "❌ noVNC配置仍有问题"
    exit 1
fi
