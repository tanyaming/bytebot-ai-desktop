import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createProxyServer } from "http-proxy";
import next from "next";
import { createServer } from "http";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// 全局错误处理
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message, err.code);
  // 不要退出进程，只是记录错误
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // 不要退出进程，只是记录错误
});

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "9992", 10);

// Backend URLs
const BYTEBOT_AGENT_BASE_URL = process.env.BYTEBOT_AGENT_BASE_URL;
const BYTEBOT_DESKTOP_VNC_URL = process.env.BYTEBOT_DESKTOP_VNC_URL;

const app = next({ dev, hostname, port });

app
  .prepare()
  .then(() => {
    const handle = app.getRequestHandler();
    const nextUpgradeHandler = app.getUpgradeHandler();

    const vncProxy = createProxyServer({ 
      changeOrigin: true, 
      ws: true,
      timeout: 60000, // 增加超时时间到60秒
      proxyTimeout: 60000,
      followRedirects: true,
      secure: false, // 如果是自签名证书，设置为false
    });

    const expressApp = express();
    const server = createServer(expressApp);

    // API proxy for backend requests
    const apiProxy = createProxyMiddleware({
      target: BYTEBOT_AGENT_BASE_URL,
      changeOrigin: true,
      pathRewrite: { "^/api": "" },
    });

    // WebSocket proxy for Socket.IO connections to backend
    const tasksProxy = createProxyMiddleware({
      target: BYTEBOT_AGENT_BASE_URL,
      ws: true,
      pathRewrite: { "^/api/proxy/tasks": "/socket.io" },
    });

    // Apply HTTP proxies
    expressApp.use("/api", apiProxy);
    expressApp.use("/api/proxy/tasks", tasksProxy);
    expressApp.use("/api/proxy/websockify", (req, res) => {
      console.log("Proxying websockify request");
      // Rewrite path
      const targetUrl = new URL(BYTEBOT_DESKTOP_VNC_URL!);
      req.url =
        targetUrl.pathname +
        (req.url?.replace(/^\/api\/proxy\/websockify/, "") || "");
      
      // 添加错误处理
      req.on('error', (err) => {
        console.log('Request error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Proxy request failed' });
        }
      });
      
      res.on('error', (err) => {
        console.log('Response error:', err.message);
      });
      
      vncProxy.web(req, res, {
        target: `${targetUrl.protocol}//${targetUrl.host}`,
        timeout: 60000, // 增加超时时间到60秒
        proxyTimeout: 60000,
      }, (err) => {
        if (err) {
          console.log('Proxy error:', err.message);
          if (!res.headersSent) {
            res.status(502).json({ error: 'Bad Gateway' });
          }
        }
      });
    });

    // Handle all other requests with Next.js
    expressApp.all("*", (req, res) => handle(req, res));

    // Properly upgrade WebSocket connections
    server.on("upgrade", (request, socket, head) => {
      const { pathname } = new URL(
        request.url!,
        `http://${request.headers.host}`,
      );

      if (pathname.startsWith("/api/proxy/tasks")) {
        return tasksProxy.upgrade(request, socket as any, head);
      }

      if (pathname.startsWith("/api/proxy/websockify")) {
        const targetUrl = new URL(BYTEBOT_DESKTOP_VNC_URL!);
        request.url =
          targetUrl.pathname +
          (request.url?.replace(/^\/api\/proxy\/websockify/, "") || "");
        console.log("Proxying websockify upgrade request: ", request.url);
        
        // 改进错误处理
        socket.on('error', (err) => {
          console.log('WebSocket proxy error:', err.message, err.code);
          // 不要抛出未捕获的异常
        });
        
        socket.on('close', (code, reason) => {
          console.log(`WebSocket connection closed: ${code} ${reason}`);
        });
        
        // 添加超时处理
        const connectionTimeout = setTimeout(() => {
          if (!socket.destroyed) {
            console.log('WebSocket connection timeout, closing socket');
            socket.destroy();
          }
        }, 60000);
        
        socket.on('close', () => {
          clearTimeout(connectionTimeout);
        });
        
        return vncProxy.ws(request, socket as any, head, {
          target: `${targetUrl.protocol}//${targetUrl.host}`,
          timeout: 60000,
          proxyTimeout: 60000,
        });
      }

      nextUpgradeHandler(request, socket, head);
    });

    server.listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Server failed to start:", err);
    process.exit(1);
  });
