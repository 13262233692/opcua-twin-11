# 🏭 产线数字孪生3D看板

基于OPC UA和Three.js的实时产线数字孪生可视化系统

## 📋 项目结构

```
opcua-twin-11/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   │   └── config.js
│   │   ├── opcua/          # OPC UA客户端
│   │   │   └── opcua-client.js
│   │   ├── engine/         # 数据采集引擎
│   │   │   └── data-engine.js
│   │   ├── websocket/      # WebSocket服务
│   │   │   └── ws-server.js
│   │   ├── server.js       # 主服务器入口
│   │   └── mock-opcua-server.js  # 模拟OPC UA服务器
│   └── package.json
├── frontend/               # 前端3D看板
│   ├── index.html         # 主页面
│   └── js/
│       ├── scene.js       # Three.js 3D场景
│       ├── devices.js     # 设备管理
│       └── app.js         # 主应用
├── start.bat              # Windows启动脚本
└── README.md
```

## 🚀 快速开始

### 方法一：使用启动脚本（推荐）

```bash
# Windows
start.bat
```

### 方法二：手动启动

1. **安装后端依赖**
```bash
cd backend
npm install
```

2. **启动模拟OPC UA服务器**（用于测试）
```bash
cd backend
npm run mock
```

3. **启动后端服务**（新终端）
```bash
cd backend
npm run server
```

4. **访问Web界面**
```
打开浏览器访问: http://localhost:3000
```

## 📡 服务端口

| 服务 | 端口 | 地址 |
|------|------|------|
| Web界面 | 3000 | http://localhost:3000 |
| OPC UA服务器 | 4840 | opc.tcp://localhost:4840 |
| WebSocket | 3000 | ws://localhost:3000/ws |

## 🏭 设备列表

系统包含以下模拟设备：

| 设备ID | 设备名称 | 类型 |
|--------|----------|------|
| CNC-001 | CNC加工中心-001 | CNC机床 |
| CNC-002 | CNC加工中心-002 | CNC机床 |
| ROBOT-001 | 工业机器人-001 | 机械臂 |
| CONVEYOR-001 | 输送带-001 | 输送带 |
| AGV-001 | AGV小车-001 | AGV |

## 📊 数据节点

每个设备包含以下数据节点：

| 节点 | 说明 | 单位 |
|------|------|------|
| Temperature | 设备温度 | °C |
| Speed | 转速/运行速度 | RPM |
| Output | 累计产量 | 件 |
| Status | 设备状态 | - |

## 🎮 前端功能

- **3D场景交互**
  - 鼠标左键拖拽：旋转视角
  - 鼠标右键拖拽：平移视角
  - 鼠标滚轮：缩放视角
  
- **控制面板**
  - 🔄 自动旋转：切换场景自动旋转
  - 🎯 重置视角：恢复默认视角
  - 📐 线框模式：切换线框显示

- **设备交互**
  - 点击右侧设备卡片：相机聚焦到对应设备
  - 实时状态指示灯：绿色=正常，黄色=警告，红色=故障

- **实时数据**
  - 设备温度、转速、产量实时显示
  - 总产量、平均温度、运行设备统计
  - 异常状态告警通知

## 🔧 技术栈

**后端：**
- Node.js
- node-opcua (OPC UA客户端/服务器)
- WebSocket (ws库)
- Express.js (HTTP服务)

**前端：**
- Three.js (3D渲染)
- 原生JavaScript

## ⚙️ 配置说明

修改 `backend/src/config/config.js` 自定义配置：

```javascript
{
  opcua: {
    endpointUrl: 'opc.tcp://localhost:4840',  // OPC UA服务器地址
    // ...
  },
  websocket: {
    port: 8080,  // WebSocket端口
  },
  http: {
    port: 3000,  // HTTP端口
  },
  devices: {
    // 设备配置...
  },
  thresholds: {
    temperature: {
      warning: 60,   // 温度警告阈值
      error: 80      // 温度错误阈值
    }
  }
}
```

## 📈 状态说明

| 状态 | 颜色 | 说明 |
|------|------|------|
| running | 绿色 | 正常运行 |
| warning | 黄色 | 警告状态 |
| error | 红色 | 故障状态 |
| idle | 蓝色 | 待机状态 |
| offline | 灰色 | 离线状态 |

## 🔌 API接口

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/devices | GET | 获取所有设备数据 |
| /api/devices/:id | GET | 获取指定设备数据 |
| /api/statistics | GET | 获取统计数据 |
| /api/alerts | GET | 获取告警列表 |
| /api/opcua/status | GET | 获取OPC UA连接状态 |

## 🐛 故障排查

1. **OPC UA连接失败**
   - 检查模拟OPC UA服务器是否启动
   - 确认端口4840未被占用

2. **WebSocket连接失败**
   - 检查后端服务是否正常运行
   - 确认浏览器支持WebSocket

3. **3D场景加载失败**
   - 检查网络连接（Three.js使用CDN）
   - 确认浏览器支持WebGL

## 📝 开发说明

- 模拟OPC UA服务器会随机生成设备数据
- 每10秒会随机触发一个设备异常用于演示
- 设备旋转速度与实际转速数据联动
- 设备颜色根据温度阈值自动变化

## 📄 许可证

MIT License
