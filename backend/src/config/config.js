const config = {
    opcua: {
        endpointUrl: process.env.OPCUA_ENDPOINT || 'opc.tcp://localhost:4840',
        keepSessionAlive: true,
        requestedPublishingInterval: 100,
        requestedLifetimeCount: 10,
        requestedMaxKeepAliveCount: 5,
        maxNotificationsPerPublish: 10,
        publishingEnabled: true,
        priority: 10
    },
    websocket: {
        port: process.env.WS_PORT || 8080,
        broadcastInterval: 100
    },
    http: {
        port: process.env.HTTP_PORT || 3000
    },
    devices: {
        'CNC-001': {
            name: 'CNC加工中心-001',
            type: 'cnc',
            position: { x: -8, y: 0, z: -5 }
        },
        'CNC-002': {
            name: 'CNC加工中心-002',
            type: 'cnc',
            position: { x: -8, y: 0, z: 5 }
        },
        'ROBOT-001': {
            name: '工业机器人-001',
            type: 'robot',
            position: { x: 0, y: 0, z: 0 }
        },
        'CONVEYOR-001': {
            name: '输送带-001',
            type: 'conveyor',
            position: { x: 8, y: 0, z: 0 }
        },
        'AGV-001': {
            name: 'AGV小车-001',
            type: 'agv',
            position: { x: 0, y: 0, z: -8 }
        }
    },
    thresholds: {
        temperature: {
            warning: 60,
            error: 80
        },
        speed: {
            min: 0,
            max: 3000
        }
    }
};

module.exports = config;
