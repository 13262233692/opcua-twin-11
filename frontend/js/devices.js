class DeviceManager {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.devices = {};
        this.thresholds = {
            temperature: {
                warning: 60,
                error: 80
            }
        };
    }

    initializeDevices(devicesConfig) {
        for (const [deviceId, deviceInfo] of Object.entries(devicesConfig)) {
            const deviceGroup = this.sceneManager.createDevice(deviceId, deviceInfo);
            
            this.devices[deviceId] = {
                id: deviceId,
                info: deviceInfo,
                mesh: deviceGroup,
                data: {
                    temperature: 25,
                    speed: 0,
                    output: 0,
                    status: 'offline'
                }
            };
        }
    }

    updateDeviceData(deviceId, data) {
        const device = this.devices[deviceId];
        if (!device) return;

        device.data = { ...device.data, ...data };
        
        const status = this.determineStatus(device.data);
        device.data.status = status;

        this.sceneManager.updateDeviceStatus(deviceId, status);
        this.sceneManager.updateDeviceAnimation(deviceId, device.data.speed);

        this.updateDeviceUI(deviceId, device.data);
    }

    determineStatus(data) {
        if (data.speed === 0) {
            return 'idle';
        } else if (data.temperature > this.thresholds.temperature.error) {
            return 'error';
        } else if (data.temperature > this.thresholds.temperature.warning) {
            return 'warning';
        } else {
            return 'running';
        }
    }

    updateDeviceUI(deviceId, data) {
        const deviceCard = document.querySelector(`[data-device-id="${deviceId}"]`);
        if (!deviceCard) return;

        const tempElement = deviceCard.querySelector('.temp-value');
        const speedElement = deviceCard.querySelector('.speed-value');
        const outputElement = deviceCard.querySelector('.output-value');
        const statusDot = deviceCard.querySelector('.device-status');

        if (tempElement) {
            tempElement.textContent = `${data.temperature.toFixed(1)}°C`;
            tempElement.className = 'data-value temp';
            if (data.temperature > this.thresholds.temperature.error) {
                tempElement.classList.add('high');
            } else if (data.temperature > this.thresholds.temperature.warning) {
                tempElement.classList.add('medium');
            } else {
                tempElement.classList.add('normal');
            }
        }

        if (speedElement) {
            speedElement.textContent = `${Math.round(data.speed)} RPM`;
        }

        if (outputElement) {
            outputElement.textContent = Math.floor(data.output);
        }

        if (statusDot) {
            statusDot.className = 'device-status';
            statusDot.classList.add(data.status);
        }
    }

    renderDeviceList() {
        const deviceList = document.getElementById('device-list');
        deviceList.innerHTML = '';

        for (const [deviceId, device] of Object.entries(this.devices)) {
            const card = this.createDeviceCard(deviceId, device);
            deviceList.appendChild(card);
        }
    }

    createDeviceCard(deviceId, device) {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.setAttribute('data-device-id', deviceId);

        const statusClass = device.data.status || 'offline';
        
        card.innerHTML = `
            <h3>
                <span class="device-status ${statusClass}"></span>
                ${device.info.name}
            </h3>
            <div class="data-row">
                <span class="data-label">🌡️ 温度</span>
                <span class="data-value temp temp-value">${device.data.temperature.toFixed(1)}°C</span>
            </div>
            <div class="data-row">
                <span class="data-label">⚡ 转速</span>
                <span class="data-value speed-value">${Math.round(device.data.speed)} RPM</span>
            </div>
            <div class="data-row">
                <span class="data-label">📦 产量</span>
                <span class="data-value output-value">${Math.floor(device.data.output)}</span>
            </div>
            <div class="data-row">
                <span class="data-label">📊 状态</span>
                <span class="data-value">${this.getStatusText(device.data.status)}</span>
            </div>
        `;

        card.addEventListener('click', () => this.focusDevice(deviceId));

        return card;
    }

    getStatusText(status) {
        const statusMap = {
            'running': '运行中',
            'warning': '警告',
            'error': '故障',
            'idle': '待机',
            'offline': '离线'
        };
        return statusMap[status] || status;
    }

    focusDevice(deviceId) {
        const device = this.devices[deviceId];
        if (!device) return;

        const position = device.mesh.position;
        const camera = this.sceneManager.camera;
        
        const targetPosition = new THREE.Vector3(
            position.x + 8,
            position.y + 6,
            position.z + 8
        );

        const startPosition = camera.position.clone();
        const startTarget = this.sceneManager.controls.target.clone();
        const endTarget = new THREE.Vector3(position.x, position.y + 1, position.z);

        let progress = 0;
        const duration = 1000;
        const startTime = Date.now();

        const animateCamera = () => {
            progress = Math.min((Date.now() - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            camera.position.lerpVectors(startPosition, targetPosition, eased);
            this.sceneManager.controls.target.lerpVectors(startTarget, endTarget, eased);
            this.sceneManager.controls.update();

            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            }
        };

        animateCamera();
    }

    getDevice(deviceId) {
        return this.devices[deviceId];
    }

    getAllDevicesData() {
        const data = {};
        for (const [deviceId, device] of Object.entries(this.devices)) {
            data[deviceId] = device.data;
        }
        return data;
    }

    getStatistics() {
        const devices = Object.values(this.devices);
        const totalOutput = devices.reduce((sum, d) => sum + d.data.output, 0);
        const avgTemp = devices.length > 0 
            ? devices.reduce((sum, d) => sum + d.data.temperature, 0) / devices.length 
            : 0;
        const runningCount = devices.filter(d => d.data.status === 'running').length;

        return {
            totalOutput: Math.floor(totalOutput),
            avgTemp: avgTemp.toFixed(1),
            runningCount,
            totalDevices: devices.length
        };
    }
}
