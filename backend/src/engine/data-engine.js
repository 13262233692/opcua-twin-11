const EventEmitter = require('events');
const config = require('../config/config');

class DataEngine extends EventEmitter {
    constructor() {
        super();
        this.deviceData = new Map();
        this.historySnapshots = [];
        this.maxHistoryHours = 1;
        this.snapshotInterval = 1000;
        this.alerts = [];
        this.alertRules = [];
        this.lastSnapshotTime = 0;
        
        this.initializeDefaultRules();
        this.initializeDeviceData();
        this.startSnapshotTimer();
    }

    initializeDefaultRules() {
        this.alertRules = [
            {
                id: 'rule_temp_error',
                name: '温度过高报警',
                deviceId: 'all',
                nodeName: 'temperature',
                condition: '>',
                threshold: 80,
                level: 'error',
                enabled: true,
                message: '{deviceName} 温度过高: {value}°C'
            },
            {
                id: 'rule_temp_warning',
                name: '温度偏高警告',
                deviceId: 'all',
                nodeName: 'temperature',
                condition: '>',
                threshold: 60,
                level: 'warning',
                enabled: true,
                message: '{deviceName} 温度偏高: {value}°C'
            },
            {
                id: 'rule_speed_zero',
                name: '设备停机',
                deviceId: 'all',
                nodeName: 'speed',
                condition: '==',
                threshold: 0,
                level: 'info',
                enabled: true,
                message: '{deviceName} 已停机'
            }
        ];
    }

    initializeDeviceData() {
        for (const [deviceId, deviceInfo] of Object.entries(config.devices)) {
            this.deviceData.set(deviceId, {
                id: deviceId,
                name: deviceInfo.name,
                type: deviceInfo.type,
                position: deviceInfo.position,
                temperature: 25,
                speed: 0,
                output: 0,
                status: 'offline',
                lastUpdate: Date.now()
            });
        }
    }

    startSnapshotTimer() {
        setInterval(() => {
            this.takeSnapshot();
        }, this.snapshotInterval);
    }

    takeSnapshot() {
        const now = Date.now();
        const snapshot = {
            timestamp: now,
            devices: {}
        };

        for (const [deviceId, data] of this.deviceData.entries()) {
            snapshot.devices[deviceId] = {
                temperature: data.temperature,
                speed: data.speed,
                output: data.output,
                status: data.status
            };
        }

        this.historySnapshots.push(snapshot);

        const cutoffTime = now - this.maxHistoryHours * 60 * 60 * 1000;
        while (this.historySnapshots.length > 0 && 
               this.historySnapshots[0].timestamp < cutoffTime) {
            this.historySnapshots.shift();
        }
    }

    updateData(deviceId, nodeName, value, timestamp) {
        const device = this.deviceData.get(deviceId);
        if (!device) return;

        device[nodeName] = value;
        device.lastUpdate = timestamp;
        
        if (nodeName === 'status') {
            device.status = value;
        }
        
        this.updateDeviceStatus(device);
        this.checkAlertRules(deviceId, nodeName, value);
        
        this.emit('device_updated', deviceId, this.getDeviceData(deviceId));
    }

    updateDeviceStatus(device) {
        const hasErrorRule = this.alertRules.find(r => 
            r.enabled && r.nodeName === 'temperature' && r.level === 'error'
        );
        const hasWarningRule = this.alertRules.find(r => 
            r.enabled && r.nodeName === 'temperature' && r.level === 'warning'
        );

        const errorThreshold = hasErrorRule ? hasErrorRule.threshold : 80;
        const warningThreshold = hasWarningRule ? hasWarningRule.threshold : 60;

        if (device.speed === 0) {
            device.status = 'idle';
        } else if (device.temperature > errorThreshold) {
            device.status = 'error';
        } else if (device.temperature > warningThreshold) {
            device.status = 'warning';
        } else {
            device.status = 'running';
        }
    }

    checkAlertRules(deviceId, nodeName, value) {
        const deviceInfo = config.devices[deviceId];
        if (!deviceInfo) return;

        for (const rule of this.alertRules) {
            if (!rule.enabled) continue;
            if (rule.deviceId !== 'all' && rule.deviceId !== deviceId) continue;
            if (rule.nodeName !== nodeName) continue;

            if (this.evaluateCondition(value, rule.condition, rule.threshold)) {
                const message = rule.message
                    .replace('{deviceName}', deviceInfo.name)
                    .replace('{value}', typeof value === 'number' ? value.toFixed(1) : value);
                
                this.addAlert(deviceId, rule.level, message, rule.id);
            }
        }
    }

    evaluateCondition(value, condition, threshold) {
        switch (condition) {
            case '>': return value > threshold;
            case '>=': return value >= threshold;
            case '<': return value < threshold;
            case '<=': return value <= threshold;
            case '==': return value == threshold;
            case '!=': return value != threshold;
            default: return false;
        }
    }

    addAlert(deviceId, level, message, ruleId = null) {
        const now = Date.now();
        
        const recentAlert = this.alerts.find(a => 
            a.deviceId === deviceId && 
            a.ruleId === ruleId && 
            a.level === level &&
            now - a.timestamp < 5000
        );

        if (recentAlert) return;

        const alert = {
            id: now + Math.random(),
            deviceId,
            ruleId,
            level,
            message,
            timestamp: now
        };
        
        this.alerts.unshift(alert);
        
        if (this.alerts.length > 200) {
            this.alerts.pop();
        }
        
        this.emit('alert', alert);
    }

    getAlertRules() {
        return this.alertRules;
    }

    addAlertRule(rule) {
        rule.id = rule.id || 'rule_' + Date.now();
        rule.enabled = rule.enabled !== false;
        this.alertRules.push(rule);
        this.emit('rules_updated', this.alertRules);
        return rule;
    }

    updateAlertRule(ruleId, updates) {
        const index = this.alertRules.findIndex(r => r.id === ruleId);
        if (index === -1) return null;
        
        this.alertRules[index] = { ...this.alertRules[index], ...updates };
        this.emit('rules_updated', this.alertRules);
        return this.alertRules[index];
    }

    deleteAlertRule(ruleId) {
        const index = this.alertRules.findIndex(r => r.id === ruleId);
        if (index === -1) return false;
        
        this.alertRules.splice(index, 1);
        this.emit('rules_updated', this.alertRules);
        return true;
    }

    toggleAlertRule(ruleId) {
        const rule = this.alertRules.find(r => r.id === ruleId);
        if (!rule) return null;
        
        rule.enabled = !rule.enabled;
        this.emit('rules_updated', this.alertRules);
        return rule;
    }

    getHistoryData(startTime, endTime) {
        if (!startTime && !endTime) {
            return this.historySnapshots;
        }

        return this.historySnapshots.filter(s => {
            if (startTime && s.timestamp < startTime) return false;
            if (endTime && s.timestamp > endTime) return false;
            return true;
        });
    }

    getDeviceData(deviceId) {
        return this.deviceData.get(deviceId);
    }

    getAllDevicesData() {
        const devices = {};
        for (const [deviceId, data] of this.deviceData.entries()) {
            devices[deviceId] = data;
        }
        return devices;
    }

    getStatistics() {
        const devices = Array.from(this.deviceData.values());
        const totalOutput = devices.reduce((sum, d) => sum + d.output, 0);
        const avgTemp = devices.length > 0 
            ? devices.reduce((sum, d) => sum + d.temperature, 0) / devices.length 
            : 0;
        const runningCount = devices.filter(d => d.status === 'running').length;
        
        return {
            totalOutput: Math.floor(totalOutput),
            avgTemp: avgTemp.toFixed(1),
            runningCount,
            totalDevices: devices.length,
            alerts: this.alerts.slice(0, 10)
        };
    }

    getAlerts() {
        return this.alerts;
    }

    clearAlerts() {
        this.alerts = [];
    }

    getHistoryTimeRange() {
        if (this.historySnapshots.length === 0) {
            return { start: Date.now(), end: Date.now() };
        }
        return {
            start: this.historySnapshots[0].timestamp,
            end: this.historySnapshots[this.historySnapshots.length - 1].timestamp
        };
    }

    getSnapshotAt(timestamp) {
        if (this.historySnapshots.length === 0) return null;
        
        let closest = this.historySnapshots[0];
        let minDiff = Math.abs(closest.timestamp - timestamp);
        
        for (const snapshot of this.historySnapshots) {
            const diff = Math.abs(snapshot.timestamp - timestamp);
            if (diff < minDiff) {
                minDiff = diff;
                closest = snapshot;
            }
        }
        
        return closest;
    }
}

module.exports = DataEngine;
