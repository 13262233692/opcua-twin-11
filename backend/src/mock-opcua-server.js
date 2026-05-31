const { OPCUAServer, Variant, DataType, StatusCodes } = require('node-opcua');
const config = require('./config/config');

class MockOPCUAServer {
    constructor() {
        this.server = null;
        this.devices = {};
        this.port = 4840;
    }

    async initializeDeviceData() {
        for (const [deviceId, deviceInfo] of Object.entries(config.devices)) {
            this.devices[deviceId] = {
                temperature: 25 + Math.random() * 10,
                speed: 1000 + Math.random() * 1000,
                output: Math.floor(Math.random() * 1000),
                status: 'running'
            };
        }
    }

    async start() {
        await this.initializeDeviceData();

        this.server = new OPCUAServer({
            port: this.port,
            resourcePath: '/UA/ProductionLine',
            buildInfo: {
                productName: 'MockProductionLineServer',
                buildNumber: '1.0.0',
                buildDate: new Date()
            },
            allowAnonymous: true
        });

        await this.server.initialize();

        const addressSpace = this.server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();

        const productionLine = namespace.addObject({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: 'ProductionLine',
            displayName: '产线设备'
        });

        for (const [deviceId, deviceInfo] of Object.entries(config.devices)) {
            const deviceObj = namespace.addObject({
                componentOf: productionLine,
                browseName: deviceId,
                displayName: deviceInfo.name
            });

            this.addDeviceVariables(namespace, deviceObj, deviceId);
        }

        this.server.start(() => {
            console.log(`模拟OPC UA服务器已启动，端口: ${this.port}`);
            console.log(`端点: opc.tcp://localhost:${this.port}`);
            console.log('设备节点已创建:');
            for (const deviceId of Object.keys(config.devices)) {
                console.log(`  - ${deviceId}`);
            }
        });

        this.startDataSimulation();
    }

    addDeviceVariables(namespace, deviceObj, deviceId) {
        const device = this.devices[deviceId];

        namespace.addVariable({
            componentOf: deviceObj,
            browseName: 'Temperature',
            displayName: '温度',
            nodeId: `ns=1;s=${deviceId}.Temperature`,
            dataType: 'Double',
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: device.temperature })
            }
        });

        namespace.addVariable({
            componentOf: deviceObj,
            browseName: 'Speed',
            displayName: '转速',
            nodeId: `ns=1;s=${deviceId}.Speed`,
            dataType: 'Double',
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: device.speed })
            }
        });

        namespace.addVariable({
            componentOf: deviceObj,
            browseName: 'Output',
            displayName: '产量',
            nodeId: `ns=1;s=${deviceId}.Output`,
            dataType: 'Int32',
            value: {
                get: () => new Variant({ dataType: DataType.Int32, value: Math.floor(device.output) })
            }
        });

        namespace.addVariable({
            componentOf: deviceObj,
            browseName: 'Status',
            displayName: '状态',
            nodeId: `ns=1;s=${deviceId}.Status`,
            dataType: 'String',
            value: {
                get: () => new Variant({ dataType: DataType.String, value: device.status })
            }
        });
    }

    startDataSimulation() {
        setInterval(() => {
            for (const deviceId of Object.keys(this.devices)) {
                const device = this.devices[deviceId];
                
                device.temperature += (Math.random() - 0.5) * 2;
                device.temperature = Math.max(20, Math.min(90, device.temperature));
                
                const speedChange = (Math.random() - 0.5) * 100;
                device.speed += speedChange;
                device.speed = Math.max(0, Math.min(3000, device.speed));
                
                if (device.speed > 100) {
                    device.output += device.speed / 1000 * Math.random();
                }
                
                if (device.speed === 0) {
                    device.status = 'idle';
                } else if (device.temperature > 80) {
                    device.status = 'error';
                } else if (device.temperature > 60) {
                    device.status = 'warning';
                } else {
                    device.status = 'running';
                }
            }
        }, 100);

        setInterval(() => {
            const deviceIds = Object.keys(this.devices);
            const randomDevice = deviceIds[Math.floor(Math.random() * deviceIds.length)];
            const device = this.devices[randomDevice];
            
            if (Math.random() > 0.7) {
                device.temperature = 70 + Math.random() * 20;
                console.log(`模拟设备异常: ${randomDevice}, 温度: ${device.temperature.toFixed(1)}°C`);
            }
        }, 10000);
    }

    async stop() {
        if (this.server) {
            await this.server.shutdown(0);
            console.log('模拟OPC UA服务器已停止');
        }
    }
}

const server = new MockOPCUAServer();
server.start().catch(err => {
    console.error('启动模拟服务器失败:', err);
});

process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
});

module.exports = MockOPCUAServer;
