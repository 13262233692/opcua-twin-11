const WebSocket = require('ws');
const EventEmitter = require('events');
const config = require('../config/config');

class WebSocketServer extends EventEmitter {
    constructor(httpServer) {
        super();
        this.wss = null;
        this.clients = new Set();
        this.httpServer = httpServer;
        this.lastBroadcastData = null;
        this.broadcastInterval = null;
    }

    start() {
        this.wss = new WebSocket.Server({ 
            server: this.httpServer,
            path: '/ws'
        });

        this.wss.on('connection', (ws, req) => {
            const clientIp = req.socket.remoteAddress;
            console.log(`WebSocket客户端已连接: ${clientIp}`);
            
            this.clients.add(ws);
            this.emit('client_connected', this.clients.size);

            ws.send(JSON.stringify({
                type: 'welcome',
                message: '已连接到数字孪生WebSocket服务',
                timestamp: Date.now()
            }));

            if (this.lastBroadcastData) {
                ws.send(JSON.stringify(this.lastBroadcastData));
            }

            ws.on('message', (message) => {
                this.handleMessage(ws, message);
            });

            ws.on('close', () => {
                console.log(`WebSocket客户端已断开: ${clientIp}`);
                this.clients.delete(ws);
                this.emit('client_disconnected', this.clients.size);
            });

            ws.on('error', (error) => {
                console.error('WebSocket错误:', error);
            });
        });

        console.log(`WebSocket服务已启动`);
    }

    handleMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;
                case 'request_all':
                    this.emit('request_all_data');
                    break;
                case 'request_device':
                    this.emit('request_device_data', data.deviceId);
                    break;
                default:
                    console.log('收到未知消息类型:', data.type);
            }
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
        }
    }

    broadcast(type, data) {
        const message = {
            type,
            data,
            timestamp: Date.now()
        };

        this.lastBroadcastData = message;

        const messageStr = JSON.stringify(message);
        
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        }
    }

    broadcastDevicesData(devicesData) {
        this.broadcast('devices_update', devicesData);
    }

    broadcastStatistics(statistics) {
        this.broadcast('statistics', statistics);
    }

    broadcastAlert(alert) {
        this.broadcast('alert', alert);
    }

    broadcastConnectionStatus(status) {
        this.broadcast('opcua_status', status);
    }

    sendToClient(ws, type, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type,
                data,
                timestamp: Date.now()
            }));
        }
    }

    getClientCount() {
        return this.clients.size;
    }

    stop() {
        if (this.wss) {
            this.wss.close();
        }
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
        }
    }
}

module.exports = WebSocketServer;
