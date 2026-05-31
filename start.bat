@echo off
chcp 65001 >nul
echo ========================================
echo 🏭 产线数字孪生3D看板启动脚本
echo ========================================
echo.

echo [1/3] 启动模拟OPC UA服务器...
start "OPC UA Server" cmd /k "cd /d %~dp0backend && node src/mock-opcua-server.js"

timeout /t 3 /nobreak >nul

echo [2/3] 启动后端服务...
start "Backend Server" cmd /k "cd /d %~dp0backend && node src/server.js"

timeout /t 3 /nobreak >nul

echo [3/3] 打开浏览器访问...
start http://localhost:3000

echo.
echo ========================================
echo ✅ 启动完成！
echo.
echo 服务地址:
echo   - Web界面: http://localhost:3000
echo   - OPC UA: opc.tcp://localhost:4840
echo   - WebSocket: ws://localhost:3000/ws
echo.
echo 请查看新打开的终端窗口了解运行状态
echo ========================================
echo.
pause
