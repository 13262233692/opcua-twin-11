const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');

const OPCUAClientWrapper = require('./opcua/opcua-client');
const DataEngine = require('./engine/data-engine');
const WebSocketServer = require('./websocket/ws-server');
const config = require('./config/config');

class DigitalTwinServer {
    constructor() {
        this.app = express();
        this.httpServer = http.createServer(this.app);
        this.opcuaClient = null;
        this.dataEngine = null;
        this.wsServer = null;
        this.statsInterval = null;
    }

    async initialize() {
        console.log('='.repeat(60));
        console.log('🏭 产线数字孪生后端服务启动中...');
        console.log('='.repeat(60));

        this.setupExpress();
        this.setupDataEngine();
        this.setupWebSocket();
        await this.setupOPCUAClient();
        this.setupStatisticsBroadcast();

        this.startHTTPServer();

        console.log('='.repeat(60));
        console.log('✅ 数字孪生后端服务启动完成!');
        console.log('='.repeat(60));
    }

    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());
        
        this.app.use(express.static(path.join(__dirname, '../../frontend')));

        this.app.get('/api/devices', (req, res) => {
            res.json(this.dataEngine.getAllDevicesData());
        });

        this.app.get('/api/devices/:id', (req, res) => {
            const device = this.dataEngine.getDeviceData(req.params.id);
            if (device) {
                res.json(device);
            } else {
                res.status(404).json({ error: '设备不存在' });
            }
        });

        this.app.get('/api/statistics', (req, res) => {
            res.json(this.dataEngine.getStatistics());
        });

        this.app.get('/api/alerts', (req, res) => {
            res.json(this.dataEngine.getAlerts());
        });

        this.app.delete('/api/alerts', (req, res) => {
            this.dataEngine.clearAlerts();
            res.json({ success: true });
        });

        this.app.get('/api/rules', (req, res) => {
            res.json(this.dataEngine.getAlertRules());
        });

        this.app.post('/api/rules', (req, res) => {
            const rule = this.dataEngine.addAlertRule(req.body);
            res.json(rule);
        });

        this.app.put('/api/rules/:id', (req, res) => {
            const rule = this.dataEngine.updateAlertRule(req.params.id, req.body);
            if (rule) {
                res.json(rule);
            } else {
                res.status(404).json({ error: '规则不存在' });
            }
        });

        this.app.delete('/api/rules/:id', (req, res) => {
            const success = this.dataEngine.deleteAlertRule(req.params.id);
            res.json({ success });
        });

        this.app.post('/api/rules/:id/toggle', (req, res) => {
            const rule = this.dataEngine.toggleAlertRule(req.params.id);
            if (rule) {
                res.json(rule);
            } else {
                res.status(404).json({ error: '规则不存在' });
            }
        });

        this.app.get('/api/history', (req, res) => {
            const { start, end } = req.query;
            const history = this.dataEngine.getHistoryData(
                start ? parseInt(start) : null,
                end ? parseInt(end) : null
            );
            res.json(history);
        });

        this.app.get('/api/history/range', (req, res) => {
            res.json(this.dataEngine.getHistoryTimeRange());
        });

        this.app.get('/api/history/snapshot', (req, res) => {
            const { timestamp } = req.query;
            if (!timestamp) {
                return res.status(400).json({ error: '需要timestamp参数' });
            }
            const snapshot = this.dataEngine.getSnapshotAt(parseInt(timestamp));
            if (snapshot) {
                res.json(snapshot);
            } else {
                res.status(404).json({ error: '未找到快照' });
            }
        });

        this.app.get('/api/opcua/status', (req, res) => {
            res.json(this.opcuaClient.getConnectionStatus());
        });

        console.log('Express服务已配置');
    }

    setupDataEngine() {
        this.dataEngine = new DataEngine();

        this.dataEngine.on('device_updated', (deviceId, deviceData) => {
        });

        this.dataEngine.on('alert', (alert) => {
            console.log(`⚠️ 告警 [${alert.level}]: ${alert.message}`);
            if (this.wsServer) {
                this.wsServer.broadcastAlert(alert);
            }
        });

        this.dataEngine.on('rules_updated', (rules) => {
            if (this.wsServer) {
                this.wsServer.broadcast('rules_update', rules);
            }
        });

        console.log('数据引擎已启动');
    }

    setupWebSocket() {
        this.wsServer = new WebSocketServer(this.httpServer);
        this.wsServer.start();

        this.wsServer.on('request_all_data', () => {
            const devices = this.dataEngine.getAllDevicesData();
            this.wsServer.broadcastDevicesData(devices);
        });

        this.wsServer.on('client_connected', (count) => {
            console.log(`WebSocket客户端已连接，当前连接数: ${count}`);
            const devices = this.dataEngine.getAllDevicesData();
            this.wsServer.broadcastDevicesData(devices);
        });

        console.log('WebSocket服务已配置');
    }

    async setupOPCUAClient() {
        this.opcuaClient = new OPCUAClientWrapper();

        this.opcuaClient.on('connection_status', (status) => {
            console.log(`OPC UA连接状态: ${status.message}`);
            if (this.wsServer) {
                this.wsServer.broadcastConnectionStatus(status);
            }
        });

        this.opcuaClient.on('data_changed', (data) => {
            this.dataEngine.updateData(
                data.deviceId,
                data.nodeName,
                data.value,
                data.timestamp
            );
            
            if (this.wsServer) {
                const devices = this.dataEngine.getAllDevicesData();
                this.wsServer.broadcastDevicesData(devices);
            }
        });

        await this.opcuaClient.connect();
    }

    setupStatisticsBroadcast() {
        this.statsInterval = setInterval(() => {
            if (this.wsServer && this.wsServer.getClientCount() > 0) {
                const stats = this.dataEngine.getStatistics();
                this.wsServer.broadcastStatistics(stats);
            }
        }, 1000);
    }

    startHTTPServer() {
        const port = config.http.port;
        this.httpServer.listen(port, () => {
            console.log(`HTTP服务已启动，端口: ${port}`);
            console.log(`Web界面: http://localhost:${port}`);
            console.log(`API地址: http://localhost:${port}/api`);
            console.log(`WebSocket: ws://localhost:${port}/ws`);
        });
    }

    async shutdown() {
        console.log('\n正在关闭服务...');
        
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        
        if (this.opcuaClient) {
            await this.opcuaClient.disconnect();
        }
        
        if (this.wsServer) {
            this.wsServer.stop();
        }
        
        this.httpServer.close(() => {
            console.log('服务已完全关闭');
            process.exit(0);
        });
    }
}

const server = new DigitalTwinServer();
server.initialize().catch(err => {
    console.error('服务器初始化失败:', err);
    process.exit(1);
});

process.on('SIGINT', () => server.shutdown());
process.on('SIGTERM', () => server.shutdown());
