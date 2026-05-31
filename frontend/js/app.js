class DigitalTwinApp {
    constructor() {
        this.sceneManager = null;
        this.deviceManager = null;
        this.ws = null;
        this.wsConnected = false;
        this.opcuaConnected = false;
        
        this.alertRules = [];
        this.historyData = [];
        this.isPlaybackMode = false;
        this.isPlaying = false;
        this.playbackSpeed = 1;
        this.playbackIndex = 0;
        this.playbackInterval = null;
        this.currentPlaybackTime = 0;
        
        this.editingRuleId = null;
        this.timelineVisible = false;
        
        this.devicesConfig = {
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
        };

        this.init();
    }

    init() {
        console.log('🏭 产线数字孪生3D看板启动中...');
        
        this.sceneManager = new SceneManager();
        this.deviceManager = new DeviceManager(this.sceneManager);
        
        this.deviceManager.initializeDevices(this.devicesConfig);
        this.deviceManager.renderDeviceList();
        
        this.connectWebSocket();
        this.loadAlertRules();
        
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        console.log('✅ 数字孪生看板初始化完成');
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log(`连接WebSocket: ${wsUrl}`);
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket已连接');
                this.wsConnected = true;
                this.updateWSStatus(true);
                this.ws.send(JSON.stringify({ type: 'request_all' }));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('解析WebSocket消息失败:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket已断开');
                this.wsConnected = false;
                this.updateWSStatus(false);
                
                setTimeout(() => {
                    console.log('尝试重新连接WebSocket...');
                    this.connectWebSocket();
                }, 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket错误:', error);
                this.wsConnected = false;
                this.updateWSStatus(false);
            };
            
        } catch (error) {
            console.error('创建WebSocket连接失败:', error);
        }
    }

    handleMessage(message) {
        if (this.isPlaybackMode) return;
        
        switch (message.type) {
            case 'welcome':
                console.log(message.message);
                break;
                
            case 'devices_update':
                this.handleDevicesUpdate(message.data);
                break;
                
            case 'statistics':
                this.handleStatisticsUpdate(message.data);
                break;
                
            case 'opcua_status':
                this.handleOPCUAStatus(message.data);
                break;
                
            case 'alert':
                this.handleAlert(message.data);
                break;
                
            case 'rules_update':
                this.handleRulesUpdate(message.data);
                break;
                
            default:
                break;
        }
    }

    handleDevicesUpdate(devicesData) {
        for (const [deviceId, deviceData] of Object.entries(devicesData)) {
            this.deviceManager.updateDeviceData(deviceId, deviceData);
        }
        
        this.updateStatisticsDisplay();
    }

    handleStatisticsUpdate(stats) {
        document.getElementById('total-output').textContent = stats.totalOutput.toLocaleString();
        document.getElementById('avg-temp').textContent = `${stats.avgTemp}°C`;
        document.getElementById('running-devices').textContent = `${stats.runningCount}/${stats.totalDevices}`;
    }

    handleOPCUAStatus(status) {
        this.opcuaConnected = status.connected;
        const statusElement = document.getElementById('opcua-status');
        statusElement.textContent = status.connected ? '已连接' : status.message;
        statusElement.style.color = status.connected ? '#00ff88' : '#ff6666';
    }

    handleAlert(alert) {
        console.log(`⚠️ [${alert.level.toUpperCase()}] ${alert.message}`);
        
        if (alert.level === 'error') {
            this.showNotification(alert.message, 'error');
        } else if (alert.level === 'warning') {
            this.showNotification(alert.message, 'warning');
        }
    }

    handleRulesUpdate(rules) {
        this.alertRules = rules;
        this.renderRulesList();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 30px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            animation: slideDown 0.3s ease-out;
            ${type === 'error' ? 'background: rgba(255, 68, 68, 0.9);' : ''}
            ${type === 'warning' ? 'background: rgba(255, 170, 0, 0.9);' : ''}
            ${type === 'info' ? 'background: rgba(0, 150, 255, 0.9);' : ''}
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    updateWSStatus(connected) {
        const statusDot = document.getElementById('ws-status');
        const statusText = document.getElementById('ws-status-text');
        
        if (connected) {
            statusDot.classList.remove('disconnected');
            statusText.textContent = 'WebSocket已连接';
            statusText.style.color = '#00ff88';
        } else {
            statusDot.classList.add('disconnected');
            statusText.textContent = 'WebSocket连接断开';
            statusText.style.color = '#ff6666';
        }
    }

    updateStatisticsDisplay() {
        const stats = this.deviceManager.getStatistics();
        document.getElementById('total-output').textContent = stats.totalOutput.toLocaleString();
        document.getElementById('avg-temp').textContent = `${stats.avgTemp}°C`;
        document.getElementById('running-devices').textContent = `${stats.runningCount}/${stats.totalDevices}`;
    }

    updateTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
        document.getElementById('update-time').textContent = timeStr;
    }

    async loadAlertRules() {
        try {
            const response = await fetch('/api/rules');
            this.alertRules = await response.json();
            this.renderRulesList();
        } catch (error) {
            console.error('加载报警规则失败:', error);
        }
    }

    renderRulesList() {
        const container = document.getElementById('rules-list');
        container.innerHTML = '';

        for (const rule of this.alertRules) {
            const card = this.createRuleCard(rule);
            container.appendChild(card);
        }
    }

    createRuleCard(rule) {
        const card = document.createElement('div');
        card.className = 'rule-card';
        card.setAttribute('data-rule-id', rule.id);

        const conditionText = this.getConditionText(rule.condition);
        const nodeText = this.getNodeText(rule.nodeName);
        const deviceText = rule.deviceId === 'all' ? '所有设备' : rule.deviceId;

        card.innerHTML = `
            <div class="rule-header">
                <span class="rule-name">${rule.name}</span>
                <div class="rule-toggle ${rule.enabled ? 'active' : ''}" onclick="toggleRule('${rule.id}')"></div>
            </div>
            <div class="rule-details">
                ${deviceText} | ${nodeText} ${conditionText} ${rule.threshold}
            </div>
            <div class="rule-details" style="color: ${this.getLevelColor(rule.level)}">
                级别: ${this.getLevelText(rule.level)}
            </div>
            <div class="rule-actions">
                <button class="rule-btn edit" onclick="editRule('${rule.id}')">编辑</button>
                <button class="rule-btn delete" onclick="deleteRule('${rule.id}')">删除</button>
            </div>
        `;

        return card;
    }

    getConditionText(condition) {
        const map = {
            '>': '大于',
            '>=': '大于等于',
            '<': '小于',
            '<=': '小于等于',
            '==': '等于',
            '!=': '不等于'
        };
        return map[condition] || condition;
    }

    getNodeText(nodeName) {
        const map = {
            'temperature': '温度',
            'speed': '转速',
            'output': '产量'
        };
        return map[nodeName] || nodeName;
    }

    getLevelText(level) {
        const map = {
            'info': '信息',
            'warning': '警告',
            'error': '错误'
        };
        return map[level] || level;
    }

    getLevelColor(level) {
        const map = {
            'info': '#00aaff',
            'warning': '#ffaa00',
            'error': '#ff4444'
        };
        return map[level] || '#88aacc';
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');

        document.getElementById('devices-panel').classList.toggle('hidden', tab !== 'devices');
        document.getElementById('rules-panel').classList.toggle('hidden', tab !== 'rules');
    }

    openRuleModal(ruleId = null) {
        this.editingRuleId = ruleId;
        const modal = document.getElementById('rule-modal');
        modal.classList.remove('hidden');

        if (ruleId) {
            const rule = this.alertRules.find(r => r.id === ruleId);
            if (rule) {
                document.getElementById('modal-title').textContent = '编辑报警规则';
                document.getElementById('rule-name').value = rule.name;
                document.getElementById('rule-device').value = rule.deviceId;
                document.getElementById('rule-node').value = rule.nodeName;
                document.getElementById('rule-condition').value = rule.condition;
                document.getElementById('rule-threshold').value = rule.threshold;
                document.getElementById('rule-level').value = rule.level;
                document.getElementById('rule-message').value = rule.message;
            }
        } else {
            document.getElementById('modal-title').textContent = '添加报警规则';
            document.getElementById('rule-name').value = '';
            document.getElementById('rule-device').value = 'all';
            document.getElementById('rule-node').value = 'temperature';
            document.getElementById('rule-condition').value = '>';
            document.getElementById('rule-threshold').value = '';
            document.getElementById('rule-level').value = 'warning';
            document.getElementById('rule-message').value = '';
        }
    }

    closeRuleModal() {
        document.getElementById('rule-modal').classList.add('hidden');
        this.editingRuleId = null;
    }

    async saveRule() {
        const rule = {
            name: document.getElementById('rule-name').value,
            deviceId: document.getElementById('rule-device').value,
            nodeName: document.getElementById('rule-node').value,
            condition: document.getElementById('rule-condition').value,
            threshold: parseFloat(document.getElementById('rule-threshold').value),
            level: document.getElementById('rule-level').value,
            message: document.getElementById('rule-message').value
        };

        if (!rule.name || isNaN(rule.threshold)) {
            alert('请填写完整的规则信息');
            return;
        }

        try {
            let response;
            if (this.editingRuleId) {
                response = await fetch(`/api/rules/${this.editingRuleId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rule)
                });
            } else {
                response = await fetch('/api/rules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rule)
                });
            }

            if (response.ok) {
                this.closeRuleModal();
                this.loadAlertRules();
                this.showNotification('规则保存成功', 'info');
            }
        } catch (error) {
            console.error('保存规则失败:', error);
        }
    }

    async toggleRule(ruleId) {
        try {
            await fetch(`/api/rules/${ruleId}/toggle`, { method: 'POST' });
            this.loadAlertRules();
        } catch (error) {
            console.error('切换规则状态失败:', error);
        }
    }

    async deleteRule(ruleId) {
        if (!confirm('确定要删除这条规则吗？')) return;

        try {
            await fetch(`/api/rules/${ruleId}`, { method: 'DELETE' });
            this.loadAlertRules();
            this.showNotification('规则已删除', 'info');
        } catch (error) {
            console.error('删除规则失败:', error);
        }
    }

    toggleTimeline() {
        this.timelineVisible = !this.timelineVisible;
        document.getElementById('timeline-container').classList.toggle('hidden', !this.timelineVisible);
        
        if (this.timelineVisible) {
            this.loadHistoryData();
        } else {
            this.exitPlaybackMode();
        }
    }

    async loadHistoryData() {
        try {
            const response = await fetch('/api/history');
            this.historyData = await response.json();
            this.updateTimeline();
        } catch (error) {
            console.error('加载历史数据失败:', error);
        }
    }

    updateTimeline() {
        if (this.historyData.length === 0) return;

        const start = this.historyData[0].timestamp;
        const end = this.historyData[this.historyData.length - 1].timestamp;

        document.getElementById('time-start').textContent = new Date(start).toLocaleTimeString('zh-CN');
        document.getElementById('time-end').textContent = new Date(end).toLocaleTimeString('zh-CN');

        const slider = document.getElementById('timeline-slider');
        slider.max = this.historyData.length - 1;
        slider.value = this.historyData.length - 1;

        this.updateCurrentTimeDisplay(end);
    }

    updateCurrentTimeDisplay(timestamp) {
        document.getElementById('current-time').textContent = new Date(timestamp).toLocaleTimeString('zh-CN');
    }

    togglePlayback() {
        if (this.historyData.length === 0) {
            this.showNotification('暂无历史数据', 'warning');
            return;
        }

        this.isPlaying = !this.isPlaying;
        const btn = document.getElementById('play-btn');
        btn.textContent = this.isPlaying ? '⏸️' : '▶️';

        if (this.isPlaying) {
            this.enterPlaybackMode();
            this.startPlayback();
        } else {
            this.stopPlayback();
        }
    }

    enterPlaybackMode() {
        this.isPlaybackMode = true;
        document.getElementById('live-indicator').classList.add('playback');
        document.getElementById('live-indicator').querySelector('span').textContent = '回放模式';
    }

    exitPlaybackMode() {
        this.isPlaybackMode = false;
        this.isPlaying = false;
        document.getElementById('play-btn').textContent = '▶️';
        document.getElementById('live-indicator').classList.remove('playback');
        document.getElementById('live-indicator').querySelector('span').textContent = '实时模式';
        
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'request_all' }));
        }
    }

    startPlayback() {
        const slider = document.getElementById('timeline-slider');
        this.playbackIndex = parseInt(slider.value);

        if (this.playbackIndex >= this.historyData.length - 1) {
            this.playbackIndex = 0;
        }

        this.playbackInterval = setInterval(() => {
            if (this.playbackIndex >= this.historyData.length - 1) {
                this.isPlaying = false;
                document.getElementById('play-btn').textContent = '▶️';
                clearInterval(this.playbackInterval);
                this.exitPlaybackMode();
                return;
            }

            this.playbackIndex++;
            this.applySnapshot(this.playbackIndex);
            slider.value = this.playbackIndex;
        }, 1000 / this.playbackSpeed);
    }

    stopPlayback() {
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }
    }

    seekTimeline(value) {
        const index = parseInt(value);
        this.playbackIndex = index;
        this.applySnapshot(index);
    }

    applySnapshot(index) {
        if (index < 0 || index >= this.historyData.length) return;

        const snapshot = this.historyData[index];
        this.updateCurrentTimeDisplay(snapshot.timestamp);

        for (const [deviceId, deviceData] of Object.entries(snapshot.devices)) {
            this.deviceManager.updateDeviceData(deviceId, deviceData);
        }

        this.updateStatisticsDisplay();
    }

    changePlaybackSpeed() {
        this.playbackSpeed = parseFloat(document.getElementById('speed-select').value);
        
        if (this.isPlaying) {
            this.stopPlayback();
            this.startPlayback();
        }
    }
}

let app;

window.addEventListener('DOMContentLoaded', () => {
    app = new DigitalTwinApp();
});

function switchTab(tab) {
    if (app) app.switchTab(tab);
}

function toggleRotation() {
    if (app && app.sceneManager) {
        const enabled = app.sceneManager.toggleAutoRotate();
        console.log('自动旋转:', enabled ? '开启' : '关闭');
    }
}

function resetCamera() {
    if (app && app.sceneManager) {
        app.sceneManager.resetCamera();
        console.log('视角已重置');
    }
}

function toggleWireframe() {
    if (app && app.sceneManager) {
        const enabled = app.sceneManager.toggleWireframe();
        console.log('线框模式:', enabled ? '开启' : '关闭');
    }
}

function toggleTimeline() {
    if (app) app.toggleTimeline();
}

function openRuleModal(ruleId = null) {
    if (app) app.openRuleModal(ruleId);
}

function closeRuleModal() {
    if (app) app.closeRuleModal();
}

function saveRule() {
    if (app) app.saveRule();
}

function toggleRule(ruleId) {
    if (app) app.toggleRule(ruleId);
}

function deleteRule(ruleId) {
    if (app) app.deleteRule(ruleId);
}

function editRule(ruleId) {
    if (app) app.openRuleModal(ruleId);
}

function togglePlayback() {
    if (app) app.togglePlayback();
}

function seekTimeline(value) {
    if (app) app.seekTimeline(value);
}

function changePlaybackSpeed() {
    if (app) app.changePlaybackSpeed();
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes slideUp {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
