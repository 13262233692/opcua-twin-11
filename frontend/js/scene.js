class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();
        this.autoRotate = false;
        this.wireframeMode = false;
        this.deviceMeshes = new Map();
        this.deviceData = {};
        
        this.colors = {
            normal: 0x00ff88,
            warning: 0xffaa00,
            error: 0xff4444,
            idle: 0x6688aa,
            offline: 0x444444
        };
        
        this.init();
        this.animate();
    }

    init() {
        const container = document.getElementById('canvas-container');
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1a);
        this.scene.fog = new THREE.Fog(0x0a0a1a, 30, 80);

        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(20, 15, 20);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 60;
        this.controls.maxPolarAngle = Math.PI / 2.1;

        this.setupLights();
        this.createFloor();
        this.createGrid();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(20, 30, 20);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 100;
        mainLight.shadow.camera.left = -30;
        mainLight.shadow.camera.right = 30;
        mainLight.shadow.camera.top = 30;
        mainLight.shadow.camera.bottom = -30;
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
        fillLight.position.set(-20, 10, -20);
        this.scene.add(fillLight);

        const pointLight1 = new THREE.PointLight(0x00aaff, 0.5, 50);
        pointLight1.position.set(-15, 10, 0);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff6600, 0.3, 50);
        pointLight2.position.set(15, 10, 0);
        this.scene.add(pointLight2);
    }

    createFloor() {
        const floorGeometry = new THREE.PlaneGeometry(60, 60);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(60, 0.1, 60));
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.3 });
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        edges.position.y = 0.05;
        this.scene.add(edges);
    }

    createGrid() {
        const gridHelper = new THREE.GridHelper(60, 30, 0x005588, 0x003355);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }

    createDevice(deviceId, deviceInfo) {
        let deviceGroup;
        
        switch (deviceInfo.type) {
            case 'cnc':
                deviceGroup = this.createCNCMachine(deviceId);
                break;
            case 'robot':
                deviceGroup = this.createRobot(deviceId);
                break;
            case 'conveyor':
                deviceGroup = this.createConveyor(deviceId);
                break;
            case 'agv':
                deviceGroup = this.createAGV(deviceId);
                break;
            default:
                deviceGroup = this.createGenericDevice(deviceId);
        }

        deviceGroup.position.set(
            deviceInfo.position.x,
            deviceInfo.position.y,
            deviceInfo.position.z
        );

        deviceGroup.userData = {
            deviceId,
            type: deviceInfo.type,
            name: deviceInfo.name,
            rotatingParts: [],
            status: 'offline'
        };

        this.scene.add(deviceGroup);
        this.deviceMeshes.set(deviceId, deviceGroup);

        return deviceGroup;
    }

    createCNCMachine(deviceId) {
        const group = new THREE.Group();

        const baseGeometry = new THREE.BoxGeometry(3, 1.5, 2.5);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a3a,
            roughness: 0.5,
            metalness: 0.5
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.75;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const topGeometry = new THREE.BoxGeometry(2.8, 1, 2.3);
        const topMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3a4a,
            roughness: 0.3,
            metalness: 0.7
        });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.y = 2;
        top.castShadow = true;
        group.add(top);

        const spindleGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 16);
        const spindleMaterial = new THREE.MeshStandardMaterial({
            color: 0x6688aa,
            roughness: 0.2,
            metalness: 0.8
        });
        const spindle = new THREE.Mesh(spindleGeometry, spindleMaterial);
        spindle.position.y = 1.5;
        spindle.castShadow = true;
        group.add(spindle);

        const chuckGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8);
        const chuckMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.1,
            metalness: 0.9
        });
        const chuck = new THREE.Mesh(chuckGeometry, chuckMaterial);
        chuck.position.y = 1;
        chuck.castShadow = true;
        group.add(chuck);

        const statusGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const statusMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.offline,
            emissive: this.colors.offline,
            emissiveIntensity: 0.5
        });
        const statusLight = new THREE.Mesh(statusGeometry, statusMaterial);
        statusLight.position.set(1.2, 2.5, 0);
        group.add(statusLight);

        group.userData.statusLight = statusLight;
        group.userData.rotatingParts = [chuck];

        this.addDeviceLabel(group, deviceId);

        return group;
    }

    createRobot(deviceId) {
        const group = new THREE.Group();

        const baseGeometry = new THREE.CylinderGeometry(1, 1.2, 0.5, 16);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6600,
            roughness: 0.4,
            metalness: 0.6
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.25;
        base.castShadow = true;
        group.add(base);

        const arm1Geometry = new THREE.BoxGeometry(0.5, 2, 0.5);
        const arm1Material = new THREE.MeshStandardMaterial({
            color: 0xff8800,
            roughness: 0.3,
            metalness: 0.7
        });
        const arm1 = new THREE.Mesh(arm1Geometry, arm1Material);
        arm1.position.y = 1.5;
        arm1.castShadow = true;
        group.add(arm1);

        const joint1Geometry = new THREE.SphereGeometry(0.35, 16, 16);
        const jointMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.3,
            metalness: 0.8
        });
        const joint1 = new THREE.Mesh(joint1Geometry, jointMaterial);
        joint1.position.y = 2.5;
        joint1.castShadow = true;
        group.add(joint1);

        const arm2Geometry = new THREE.BoxGeometry(0.4, 1.5, 0.4);
        const arm2Material = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            roughness: 0.3,
            metalness: 0.7
        });
        const arm2 = new THREE.Mesh(arm2Geometry, arm2Material);
        arm2.position.set(0.5, 3.2, 0);
        arm2.rotation.z = -Math.PI / 4;
        arm2.castShadow = true;
        group.add(arm2);

        const gripperGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.3);
        const gripperMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.2,
            metalness: 0.8
        });
        const gripper = new THREE.Mesh(gripperGeometry, gripperMaterial);
        gripper.position.set(1.1, 3.8, 0);
        gripper.castShadow = true;
        group.add(gripper);

        const statusGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const statusMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.offline,
            emissive: this.colors.offline,
            emissiveIntensity: 0.5
        });
        const statusLight = new THREE.Mesh(statusGeometry, statusMaterial);
        statusLight.position.set(0.8, 0.8, 0.8);
        group.add(statusLight);

        group.userData.statusLight = statusLight;
        group.userData.rotatingParts = [base, gripper];
        group.userData.arm1 = arm1;
        group.userData.arm2 = arm2;

        this.addDeviceLabel(group, deviceId);

        return group;
    }

    createConveyor(deviceId) {
        const group = new THREE.Group();

        const frameGeometry = new THREE.BoxGeometry(0.5, 0.8, 8);
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x334455,
            roughness: 0.5,
            metalness: 0.5
        });

        const leftFrame = new THREE.Mesh(frameGeometry, frameMaterial);
        leftFrame.position.set(-1.5, 0.4, 0);
        leftFrame.castShadow = true;
        group.add(leftFrame);

        const rightFrame = new THREE.Mesh(frameGeometry, frameMaterial);
        rightFrame.position.set(1.5, 0.4, 0);
        rightFrame.castShadow = true;
        group.add(rightFrame);

        const beltGeometry = new THREE.BoxGeometry(2.5, 0.1, 7.8);
        const beltMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.8,
            metalness: 0.1
        });
        const belt = new THREE.Mesh(beltGeometry, beltMaterial);
        belt.position.y = 0.85;
        belt.receiveShadow = true;
        group.add(belt);

        const rollerGeometry = new THREE.CylinderGeometry(0.15, 0.15, 2.8, 16);
        const rollerMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.3,
            metalness: 0.7
        });

        for (let i = -3; i <= 3; i++) {
            const roller = new THREE.Mesh(rollerGeometry, rollerMaterial);
            roller.rotation.z = Math.PI / 2;
            roller.position.set(0, 0.75, i * 2.5);
            roller.castShadow = true;
            group.add(roller);
        }

        const legGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.2);
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0x445566,
            roughness: 0.5,
            metalness: 0.5
        });

        const positions = [[-1.4, -3.8], [1.4, -3.8], [-1.4, 3.8], [1.4, 3.8]];
        for (const pos of positions) {
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.set(pos[0], 0, pos[1]);
            leg.castShadow = true;
            group.add(leg);
        }

        const statusGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const statusMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.offline,
            emissive: this.colors.offline,
            emissiveIntensity: 0.5
        });
        const statusLight = new THREE.Mesh(statusGeometry, statusMaterial);
        statusLight.position.set(0, 1.5, 0);
        group.add(statusLight);

        group.userData.statusLight = statusLight;
        group.userData.belt = belt;

        this.addDeviceLabel(group, deviceId);

        return group;
    }

    createAGV(deviceId) {
        const group = new THREE.Group();

        const bodyGeometry = new THREE.BoxGeometry(2, 0.6, 1.5);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x0088cc,
            roughness: 0.3,
            metalness: 0.6
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        body.castShadow = true;
        group.add(body);

        const wheelGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.15, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.8,
            metalness: 0.1
        });

        const wheelPositions = [
            [-0.85, 0.25, 0.6],
            [0.85, 0.25, 0.6],
            [-0.85, 0.25, -0.6],
            [0.85, 0.25, -0.6]
        ];

        const wheels = [];
        for (const pos of wheelPositions) {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(pos[0], pos[1], pos[2]);
            wheel.castShadow = true;
            group.add(wheel);
            wheels.push(wheel);
        }

        const liftGeometry = new THREE.BoxGeometry(1.5, 0.15, 1.2);
        const liftMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.4,
            metalness: 0.6
        });
        const lift = new THREE.Mesh(liftGeometry, liftMaterial);
        lift.position.y = 0.95;
        lift.castShadow = true;
        group.add(lift);

        const statusGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const statusMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.offline,
            emissive: this.colors.offline,
            emissiveIntensity: 0.5
        });
        const statusLight = new THREE.Mesh(statusGeometry, statusMaterial);
        statusLight.position.set(0, 1.3, 0);
        group.add(statusLight);

        group.userData.statusLight = statusLight;
        group.userData.rotatingParts = wheels;
        group.userData.lift = lift;

        this.addDeviceLabel(group, deviceId);

        return group;
    }

    createGenericDevice(deviceId) {
        const group = new THREE.Group();

        const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
        const boxMaterial = new THREE.MeshStandardMaterial({
            color: 0x445566,
            roughness: 0.5,
            metalness: 0.5
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.y = 1;
        box.castShadow = true;
        group.add(box);

        const statusGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const statusMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.offline,
            emissive: this.colors.offline,
            emissiveIntensity: 0.5
        });
        const statusLight = new THREE.Mesh(statusGeometry, statusMaterial);
        statusLight.position.set(0, 2.2, 0);
        group.add(statusLight);

        group.userData.statusLight = statusLight;

        this.addDeviceLabel(group, deviceId);

        return group;
    }

    addDeviceLabel(group, deviceId) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        context.fillStyle = 'rgba(0, 50, 100, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.strokeStyle = '#00aaff';
        context.lineWidth = 2;
        context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        
        context.fillStyle = '#ffffff';
        context.font = 'bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(deviceId, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({ map: texture });
        const label = new THREE.Sprite(labelMaterial);
        label.position.y = 3.5;
        label.scale.set(2, 0.5, 1);
        group.add(label);
    }

    updateDeviceStatus(deviceId, status) {
        const deviceGroup = this.deviceMeshes.get(deviceId);
        if (!deviceGroup) return;

        const statusLight = deviceGroup.userData.statusLight;
        if (statusLight) {
            const color = this.colors[status] || this.colors.offline;
            statusLight.material.color.setHex(color);
            statusLight.material.emissive.setHex(color);
            statusLight.material.emissiveIntensity = status === 'error' ? 1 : 0.5;
        }

        deviceGroup.userData.status = status;
        deviceGroup.userData.isBlinking = (status === 'error' || status === 'warning');
        deviceGroup.userData.blinkColor = this.colors[status] || this.colors.offline;
        deviceGroup.userData.blinkSpeed = status === 'error' ? 4 : 2;
    }

    updateDeviceAnimation(deviceId, speed) {
        const deviceGroup = this.deviceMeshes.get(deviceId);
        if (!deviceGroup) return;

        deviceGroup.userData.currentSpeed = speed;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        for (const [deviceId, deviceGroup] of this.deviceMeshes.entries()) {
            const speed = deviceGroup.userData.currentSpeed || 0;
            const status = deviceGroup.userData.status;
            const rotationSpeed = (speed / 3000) * 5;

            if (deviceGroup.userData.isBlinking && deviceGroup.userData.statusLight) {
                const blinkFactor = (Math.sin(time * deviceGroup.userData.blinkSpeed * Math.PI) + 1) / 2;
                const intensity = 0.3 + blinkFactor * 0.7;
                deviceGroup.userData.statusLight.material.emissiveIntensity = intensity;
                
                const scale = 1 + blinkFactor * 0.3;
                deviceGroup.userData.statusLight.scale.set(scale, scale, scale);
            } else if (deviceGroup.userData.statusLight) {
                deviceGroup.userData.statusLight.material.emissiveIntensity = 0.5;
                deviceGroup.userData.statusLight.scale.set(1, 1, 1);
            }

            if (deviceGroup.userData.rotatingParts) {
                for (const part of deviceGroup.userData.rotatingParts) {
                    part.rotation.y += rotationSpeed * delta;
                }
            }

            if (deviceGroup.userData.arm1 && status === 'running') {
                deviceGroup.userData.arm1.rotation.z = Math.sin(Date.now() * 0.001) * 0.2;
            }

            if (deviceGroup.userData.arm2 && status === 'running') {
                deviceGroup.userData.arm2.rotation.x = Math.sin(Date.now() * 0.0015) * 0.1;
            }

            if (deviceGroup.userData.belt) {
                const belt = deviceGroup.userData.belt;
                if (belt.material.map) {
                    belt.material.map.offset.y += rotationSpeed * delta * 0.1;
                }
            }

            if (status === 'error') {
                deviceGroup.position.x += (Math.random() - 0.5) * 0.02;
                deviceGroup.position.z += (Math.random() - 0.5) * 0.02;
            }
        }

        if (this.autoRotate) {
            this.controls.autoRotate = true;
            this.controls.autoRotateSpeed = 0.5;
        } else {
            this.controls.autoRotate = false;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    toggleAutoRotate() {
        this.autoRotate = !this.autoRotate;
        return this.autoRotate;
    }

    resetCamera() {
        this.camera.position.set(20, 15, 20);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    toggleWireframe() {
        this.wireframeMode = !this.wireframeMode;
        
        this.scene.traverse((object) => {
            if (object.isMesh && object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.wireframe = this.wireframeMode);
                } else {
                    object.material.wireframe = this.wireframeMode;
                }
            }
        });
        
        return this.wireframeMode;
    }

    getDeviceMesh(deviceId) {
        return this.deviceMeshes.get(deviceId);
    }

    getAllDevices() {
        return Array.from(this.deviceMeshes.values());
    }
}
