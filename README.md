# Sonic Bloom - Cyber Garden 🌺

一个基于实时情绪和音频分析的交互式 3D 花园可视化项目。通过摄像头捕捉面部表情，通过麦克风分析声音特征，实时生成一个日式风格的 3D 花朵花园，花朵的颜色、大小和旋转会根据你的情绪和声音动态变化。

## ✨ 特性

### 🎭 情绪识别
- 使用 **DeepFace** 实时分析面部表情
- 支持 7 种情绪：开心、悲伤、愤怒、惊讶、恐惧、厌恶、中性
- 情绪稳定算法，避免快速跳变
- 情绪映射到花朵颜色（日式低饱和度配色）

### 🔊 音频分析
- **响度分析**：使用 librosa 计算音频 RMS，控制花朵大小
- **音高分析**：使用 librosa.pyin 提取基频（F0），控制花朵旋转
- 实时音频处理和平滑过渡

### 🤖 AI 智能系统（可选）
- **AgentScope 多智能体系统**：
  - **VisualDesignerAgent**：使用大模型智能推荐视觉参数（颜色、光照、粒子效果）
  - **ButterflyControllerAgent**：AI 控制蝴蝶行为逻辑（飞行路径、互动模式）
  - **EnvironmentGeneratorAgent**：动态生成环境效果（光照、雾效、氛围）
  - **CoordinatorAgent**：协调所有智能体，整合结果
- 支持 **DeepSeek** 和 **阿里云百炼平台** API
- 根据情绪和动作智能调整视觉效果

### 🦋 交互式蝴蝶系统
- **3D 蝴蝶模型**：精致的翅膀、身体、触角
- **AI 行为控制**：
  - 跟随用户手势（通过姿态检测）
  - 围绕花朵飞行
  - 停在花朵上互动
  - 响应情绪变化
- **实时姿态检测**：使用 TensorFlow.js MediaPipe Pose
- **手势识别**：识别挥手、指向等手势

### 🎨 高级视觉效果
- **Three.js** 3D 渲染引擎
- **Post-processing 效果**：
  - SSAO（屏幕空间环境光遮蔽）
  - Bloom（柔和发光）
  - Film Grain（胶片颗粒感）
  - 色调映射
- **GPU 加速粒子系统**：10,000+ 粒子，情绪粒子和蝴蝶轨迹
- **自定义 Shader Material**：花瓣发光和脉动效果
- 日式低饱和度配色方案
- 11 朵动态花朵，中心花朵响应实时数据
- 动态光照和物理引擎支持

### 📊 实时数据展示
- 左上角信息面板显示：
  - 当前情绪状态
  - 响度百分比和可视化进度条
  - 音高频率和可视化进度条
  - 各项数据对花朵的影响说明
- 右上角 FPS 监控

## 🏗️ 项目结构

```
cyberFamer/
├── backend/              # Python/FastAPI 后端
│   ├── main.py          # 主应用文件（FastAPI + WebSocket）
│   ├── pyproject.toml   # 依赖管理（uv）
│   ├── uv.lock          # 依赖锁定文件
│   ├── .env.example     # 环境变量模板
│   ├── .env             # 环境变量文件（需自行创建，不提交到 git）
│   ├── agents/          # AI 智能体模块
│   │   ├── __init__.py
│   │   ├── visual_designer.py      # 视觉设计智能体
│   │   ├── butterfly_controller.py # 蝴蝶控制智能体
│   │   ├── environment_generator.py # 环境生成智能体
│   │   └── coordinator.py          # 协调者智能体
│   └── config/          # 配置文件
│       └── agents_config.yaml
├── frontend/            # JavaScript/Three.js 前端
│   ├── index.html       # HTML 入口文件
│   ├── main.js          # Three.js 场景和 WebSocket 客户端
│   ├── ml/              # 机器学习模块
│   │   ├── pose-detection.js    # 姿态检测
│   │   └── gesture-recognizer.js # 手势识别
│   ├── models/          # 3D 模型
│   │   └── butterfly.js         # 蝴蝶模型
│   ├── ai/              # AI 系统
│   │   └── butterfly-ai.js      # 蝴蝶 AI 行为
│   ├── physics/         # 物理引擎
│   │   └── physics-world.js
│   ├── shaders/         # 自定义 Shader
│   │   └── flower-shader.js
│   ├── particles/       # 粒子系统
│   │   └── gpu-particles.js
│   └── effects/         # 后处理效果
│       └── postprocessing-setup.js
└── README.md            # 项目文档
```

## 🛠️ 技术栈

### 后端
- **Python 3.12+**
- **FastAPI** - Web 框架和 WebSocket 服务器
- **DeepFace** - 面部情绪识别
- **OpenCV** - 摄像头捕获
- **librosa** - 音频分析（响度、音高）
- **PyAudio** - 音频输入
- **AgentScope** - 多智能体框架
- **python-dotenv** - 环境变量管理
- **uv** - 依赖管理

### 前端
- **Three.js** - 3D 渲染引擎
- **TensorFlow.js** - 机器学习框架
- **MediaPipe Pose** - 姿态检测
- **Post-processing** - 后处理效果（SSAO、Bloom、Film Grain）
- **Cannon.js** - 物理引擎
- **WebSocket** - 实时数据通信
- **ES6 Modules** - 模块化开发

## 📦 安装步骤

### 前置要求

1. **Python 3.12+**
2. **uv** - Python 包管理器
   ```bash
   # macOS/Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

3. **portaudio**（音频库）
   ```bash
   # macOS
   brew install portaudio
   
   # Ubuntu/Debian
   sudo apt-get install portaudio19-dev
   ```

### 安装依赖

```bash
# 进入项目目录
cd cyberFamer

# 安装后端依赖
cd backend
uv sync
```

首次运行会自动创建虚拟环境并安装所有依赖。

### 配置 API Keys（可选）

项目支持使用 AI 大模型来智能推荐视觉参数和控制蝴蝶行为。要启用此功能，需要配置 API keys：

1. **复制环境变量模板文件**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **编辑 `.env` 文件，填入你的 API keys**
   ```bash
   # 使用你喜欢的编辑器
   nano .env
   # 或
   vim .env
   ```

3. **获取 API Keys**
   - **DeepSeek API Key**（推荐）：
     - 访问 https://platform.deepseek.com/
     - 注册账号并创建 API key
     - 将 key 填入 `DEEPSEEK_API_KEY`
   
   - **阿里云百炼平台 API Key**（可选）：
     - 访问 https://dashscope.console.aliyun.com/
     - 注册账号并创建 API key
     - 将 key 填入 `DASHSCOPE_API_KEY`

4. **保存文件**

**注意**：
- 如果不配置 API keys，系统会使用默认值，AI 功能将受限，但基础功能（情绪识别、音频分析、3D 渲染）仍然可用
- 至少设置一个 API key 才能启用完整的 AI 功能
- `.env` 文件已添加到 `.gitignore`，不会被提交到版本控制系统
- 请妥善保管你的 API keys，不要泄露给他人

## 🚀 运行步骤

### 1. 启动后端服务器

启动方式与之前完全相同，`.env` 文件会在程序启动时自动加载：

```bash
cd backend
source ./.venv/bin/activate
uv run python main.py
```

**或者直接使用 uv run（推荐）**：
```bash
cd backend
uv run python main.py
```

后端将在 `http://localhost:8000` 启动，并开始：
- 自动加载 `.env` 文件中的环境变量（如果存在）
- 捕获摄像头画面（每 3 帧分析一次）
- 实时分析音频输入
- 通过 WebSocket 广播情绪、响度和音高数据
- 如果配置了 API keys，会启动 AI 智能体系统

**注意**：
- 启动方式**无需改变**，`.env` 文件会在程序启动时自动加载
- 首次运行 DeepFace 会自动下载模型文件（可能需要一些时间）
- 需要授予摄像头和麦克风权限
- 如果未配置 API keys，会在控制台显示警告，但系统仍可正常运行（使用默认值）
- 如果配置了 `.env` 文件，程序会自动读取其中的 API keys

### 2. 启动前端

**方式一：直接打开 HTML 文件**
```bash
# 在浏览器中打开
open frontend/index.html
```

**方式二：使用本地服务器（推荐）**
```bash
cd frontend

# Python 3
python -m http.server 8080

# 或使用 Node.js
npx serve -p 8080
```

然后在浏览器中访问 `http://localhost:8080`

## 🎮 使用说明

1. **允许权限**：浏览器会请求摄像头和麦克风权限，请点击"允许"
2. **查看效果**：
   - 中心花朵会根据你的情绪改变颜色
   - 说话时，花朵会根据声音响度放大/缩小
   - 音调高低会影响花朵的旋转角度
   - 其他花朵会产生涟漪效果
   - 蝴蝶会根据你的手势和情绪智能飞行
   - 如果配置了 AI，视觉效果会根据 AI 推荐动态调整
3. **查看数据**：
   - 左上角信息面板实时显示当前的情绪、响度和音高数据
   - 右上角显示 FPS（帧率）监控
4. **手势控制**：
   - 伸出手，蝴蝶会跟随你的手势
   - 挥手可以触发特殊效果

## 🎨 情绪与颜色映射

| 情绪 | 颜色 | 效果 |
|------|------|------|
| 😊 开心 | 柔和的黄色 | 温暖明亮的色调 |
| 😢 悲伤 | 柔和的蓝色 | 冷静忧郁的色调 |
| 😠 愤怒 | 柔和的红色 | 温暖但克制的色调 |
| 😲 惊讶 | 柔和的粉红色 | 活泼可爱的色调 |
| 😨 恐惧 | 柔和的紫色 | 神秘优雅的色调 |
| 🤢 厌恶 | 柔和的绿色 | 清新自然的色调 |
| 😐 中性 | 米色 | 温和中性的色调 |

## 📈 数据映射

### 响度 → 花朵大小
- **范围**：0% - 100%
- **映射**：0.9x - 1.3x 缩放
- **效果**：声音越大，花朵越大

### 音高 → 花朵旋转
- **范围**：50 Hz - 400 Hz
- **映射**：-14° 到 +14° 旋转
- **效果**：低音向左倾斜，高音向右倾斜

## 🔧 技术细节

### 后端优化
- **情绪稳定器**：使用滑动窗口（15 帧）统计情绪，避免快速跳变
- **性能优化**：降低检测频率、缩小图像尺寸、音频平滑处理
- **异步处理**：使用 asyncio 实现非阻塞的媒体分析

### 前端优化
- **平滑过渡**：使用 LERP 实现颜色、大小、旋转的平滑动画
- **后处理效果**：Bloom 强度 0.5，Film Grain 噪声强度 0.15
- **性能优化**：合理的更新频率，优化的渲染设置

## ⚠️ 注意事项

1. **系统要求**：
   - macOS / Linux / Windows
   - 现代浏览器（Chrome、Firefox、Safari、Edge）
   - 摄像头和麦克风设备

2. **首次运行**：
   - DeepFace 会自动下载模型文件（约 100MB+）
   - 可能需要一些时间，请耐心等待

3. **性能建议**：
   - 建议使用 Chrome 或 Edge 浏览器以获得最佳性能
   - 如果性能不佳，可以降低摄像头分辨率

4. **依赖问题**：
   - 如果 PyAudio 安装失败，请确保已安装 portaudio
   - 如果 DeepFace 报错，可能需要安装 tf-keras

## 🐛 常见问题

**Q: WebSocket 连接失败**
- 确保后端服务器正在运行
- 检查防火墙设置
- 确认端口 8000 未被占用

**Q: 摄像头无法打开**
- 检查浏览器权限设置
- 确保没有其他应用占用摄像头
- 尝试刷新页面

**Q: 音频分析不准确**
- 确保麦克风权限已授予
- 检查麦克风是否正常工作
- 尝试调整麦克风音量

**Q: 情绪识别不准确**
- 确保光线充足
- 正对摄像头
- 情绪稳定器需要几秒钟来稳定

## 🔐 环境变量说明

项目使用 `.env` 文件管理敏感配置（API keys）。`.env` 文件不会被提交到版本控制系统。

### 必需的环境变量
无（所有环境变量都是可选的）

### 可选的环境变量

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key | https://platform.deepseek.com/ |
| `DASHSCOPE_API_KEY` | 阿里云百炼平台 API Key | https://dashscope.console.aliyun.com/ |

### 环境变量优先级

1. `.env` 文件（推荐）
2. 系统环境变量
3. 默认值（如果未设置，AI 功能将受限）

## 📝 开发计划

- [x] AI 智能体系统集成
- [x] 姿态检测和手势识别
- [x] 交互式蝴蝶系统
- [x] GPU 粒子系统
- [x] 高级后处理效果
- [ ] 添加多人模式支持
- [ ] 增加更多花朵类型和样式
- [ ] 添加音频可视化（频谱分析）
- [ ] 支持自定义配色方案
- [ ] 添加录制和回放功能
- [ ] 移动端适配

## 📄 许可证

本项目为课程作业项目，仅供学习和研究使用。

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

---

**享受你的 Cyber Garden 之旅！** 🌸✨
