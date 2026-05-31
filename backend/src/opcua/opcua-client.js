const { OPCUAClient, AttributeIds, TimestampsToReturn } = require('node-opcua');
const EventEmitter = require('events');
const config = require('../config/config');

class OPCUAClientWrapper extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.session = null;
        this.subscription = null;
        this.monitoredItems = new Map();
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.isReconnecting = false;
    }

    async connect() {
        try {
            console.log('正在连接OPC UA服务器:', config.opcua.endpointUrl);
            
            this.client = OPCUAClient.create({
                endpointMustExist: false,
                keepSessionAlive: config.opcua.keepSessionAlive,
                connectionStrategy: {
                    maxRetry: 10,
                    initialDelay: 1000,
                    maxDelay: 10000
                }
            });

            this.client.on('backoff', (retry, delay) => {
                console.log(`连接重试 #${retry}，延迟 ${delay}ms`);
                this.isConnected = false;
                this.emit('connection_status', { connected: false, message: '连接中...' });
            });

            this.client.on('connection_reestablished', async () => {
                console.log('OPC UA连接已重新建立');
                await this.handleReconnection();
            });

            this.client.on('start_reconnection', () => {
                console.log('OPC UA开始重连...');
                this.isConnected = false;
                this.emit('connection_status', { connected: false, message: '重连中...' });
            });

            this.client.on('after_reconnection', () => {
                console.log('OPC UA重连完成');
            });

            await this.client.connect(config.opcua.endpointUrl);
            console.log('OPC UA客户端已连接');

            await this.setupSessionAndSubscription();

        } catch (error) {
            console.error('OPC UA连接失败:', error.message);
            this.isConnected = false;
            this.emit('connection_status', { connected: false, message: '连接失败' });
            
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`将在5秒后重试连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                setTimeout(() => this.connect(), 5000);
            }
        }
    }

    async setupSessionAndSubscription() {
        try {
            this.session = await this.client.createSession();
            console.log('OPC UA会话已创建');

            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.isReconnecting = false;
            this.emit('connection_status', { connected: true, message: '已连接' });

            await this.createSubscription();
            await this.setupMonitoredItems();

        } catch (error) {
            console.error('创建会话和订阅失败:', error);
        }
    }

    async handleReconnection() {
        if (this.isReconnecting) {
            console.log('已有重连操作正在进行，跳过...');
            return;
        }

        this.isReconnecting = true;
        console.log('🔄 检测到连接恢复，正在重建会话和订阅...');

        try {
            await this.cleanupOldSession();

            await this.setupSessionAndSubscription();
            
            console.log('✅ 重连完成！会话、订阅、监控项已全部恢复');
        } catch (error) {
            console.error('❌ 重连后重建订阅失败:', error.message);
            this.isReconnecting = false;
        }
    }

    async cleanupOldSession() {
        try {
            await this.cleanupOldSubscription();
            
            if (this.session) {
                console.log('清理旧会话...');
                try {
                    await this.session.close();
                } catch (e) {
                }
                this.session = null;
            }
        } catch (error) {
            console.error('清理旧会话时出错:', error.message);
        }
    }

    async cleanupOldSubscription() {
        try {
            if (this.subscription) {
                console.log('清理旧订阅...');
                try {
                    await this.subscription.terminate();
                } catch (e) {
                }
                this.subscription = null;
            }
            this.monitoredItems.clear();
        } catch (error) {
            console.error('清理旧订阅时出错:', error.message);
        }
    }

    async createSubscription() {
        if (!this.session) return;

        try {
            await this.cleanupOldSubscription();

            this.subscription = await this.session.createSubscription2({
                requestedPublishingInterval: config.opcua.requestedPublishingInterval,
                requestedLifetimeCount: config.opcua.requestedLifetimeCount,
                requestedMaxKeepAliveCount: config.opcua.requestedMaxKeepAliveCount,
                maxNotificationsPerPublish: config.opcua.maxNotificationsPerPublish,
                publishingEnabled: config.opcua.publishingEnabled,
                priority: config.opcua.priority
            });

            console.log('OPC UA订阅已创建');

            this.subscription.on('keepalive', () => {
            });

            this.subscription.on('terminated', () => {
                console.log('OPC UA订阅已终止，可能需要重连');
                this.isConnected = false;
                this.emit('connection_status', { connected: false, message: '订阅终止' });
            });

        } catch (error) {
            console.error('创建订阅失败:', error.message);
        }
    }

    async setupMonitoredItems() {
        if (!this.subscription) return;

        const deviceNodes = this.generateNodeIds();
        
        for (const [deviceId, nodes] of Object.entries(deviceNodes)) {
            for (const [nodeName, nodeId] of Object.entries(nodes)) {
                await this.monitorItem(deviceId, nodeName, nodeId);
            }
        }
    }

    generateNodeIds() {
        const nodes = {};
        
        for (const deviceId of Object.keys(config.devices)) {
            nodes[deviceId] = {
                temperature: `ns=1;s=${deviceId}.Temperature`,
                speed: `ns=1;s=${deviceId}.Speed`,
                output: `ns=1;s=${deviceId}.Output`,
                status: `ns=1;s=${deviceId}.Status`
            };
        }
        
        return nodes;
    }

    async monitorItem(deviceId, nodeName, nodeId) {
        try {
            const monitoredItem = await this.subscription.monitor({
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            }, {
                samplingInterval: 100,
                discardOldest: true,
                queueSize: 10
            }, TimestampsToReturn.Both);

            const key = `${deviceId}.${nodeName}`;
            this.monitoredItems.set(key, monitoredItem);

            monitoredItem.on('changed', (dataValue) => {
                const value = dataValue.value.value;
                const timestamp = dataValue.sourceTimestamp || new Date();
                
                this.emit('data_changed', {
                    deviceId,
                    nodeName,
                    value,
                    timestamp: timestamp.getTime()
                });
            });

            console.log(`已监控节点: ${key}`);

        } catch (error) {
            console.error(`监控节点失败 ${nodeId}:`, error.message);
        }
    }

    async disconnect() {
        try {
            if (this.subscription) {
                await this.subscription.terminate();
            }
            if (this.session) {
                await this.session.close();
            }
            if (this.client) {
                await this.client.disconnect();
            }
            this.isConnected = false;
            console.log('OPC UA客户端已断开连接');
            this.emit('connection_status', { connected: false, message: '已断开' });
        } catch (error) {
            console.error('断开连接失败:', error);
        }
    }

    getConnectionStatus() {
        return {
            connected: this.isConnected,
            endpoint: config.opcua.endpointUrl
        };
    }
}

module.exports = OPCUAClientWrapper;
