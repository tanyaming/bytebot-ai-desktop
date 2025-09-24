"use client";

import React, { useRef, useEffect, useState } from "react";

interface VncViewerProps {
  viewOnly?: boolean;
}

export function VncViewer({ viewOnly = true }: VncViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [VncComponent, setVncComponent] = useState<any>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Dynamically import the VncScreen component only on the client side
    import("react-vnc").then(({ VncScreen }) => {
      setVncComponent(() => VncScreen);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return; // SSR safety‑net
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    // 确保URL不会累积参数
    const baseUrl = `${proto}://${window.location.host}/api/proxy/websockify`;
    setWsUrl(baseUrl);
  }, [retryCount]); // 依赖retryCount来重新生成URL

  const handleConnect = () => {
    console.log("VNC connected successfully");
    setConnectionError(null);
    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    console.log("VNC disconnected");
    setIsConnecting(false);
    if (retryCount < 3) {
      setTimeout(() => {
        console.log(`Retrying VNC connection, attempt ${retryCount + 1}/3`);
        setRetryCount(prev => prev + 1);
      }, 3000); // 增加重试间隔
    } else {
      setConnectionError("连接失败，已达到最大重试次数");
    }
  };

  const handleError = (error: { message?: string }) => {
    console.error("VNC connection error:", error);
    setIsConnecting(false);
    setConnectionError(error.message || "连接失败");
  };

  return (
    <div ref={containerRef} className="h-full w-full">
      {connectionError && (
        <div className="flex items-center justify-center h-full bg-gray-100">
          <div className="text-center">
            <p className="text-red-600 mb-2">VNC连接错误: {connectionError}</p>
            <button 
              onClick={() => {
                setConnectionError(null);
                setRetryCount(0);
                setIsConnecting(true);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              disabled={isConnecting}
            >
              {isConnecting ? "连接中..." : "重试连接"}
            </button>
          </div>
        </div>
      )}
      {VncComponent && wsUrl && !connectionError && (
        <VncComponent
          rfbOptions={{
            secure: false,
            shared: true,
            wsProtocols: ["binary"],
          }}
          autoConnect={true}
          key={`${viewOnly ? "view-only" : "interactive"}-${retryCount}-${Date.now()}`}
          url={wsUrl}
          scaleViewport
          viewOnly={viewOnly}
          style={{ width: "100%", height: "100%" }}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onError={handleError}
        />
      )}
      {isConnecting && !connectionError && (
        <div className="flex items-center justify-center h-full bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-gray-600">正在连接VNC...</p>
          </div>
        </div>
      )}
    </div>
  );
}
