# Sonic Bloom - 第一阶段原型

## 项目结构

```
cyberFamer/
├── backend/          # Python/FastAPI 后端
│   ├── main.py      # 主应用文件
│   └── pyproject.toml
└── frontend/         # JavaScript/Three.js 前端
    ├── index.html
    └── main.js
```

## 运行步骤

### 1. 启动后端服务器

```bash
cd backend
uv run python main.py
```

后端将在 `http://localhost:8000` 启动，并开始：
- 捕获摄像头画面
- 分析音频输入
- 通过 WebSocket 广播情绪、响度和音高数据

### 2. 启动前端

在浏览器中打开 `frontend/index.html`，或者使用本地服务器：

```bash
cd frontend
# 使用 Python 简单服务器
python -m http.server 8080
```

然后在浏览器中访问 `http://localhost:8080`

## 功能说明

- **情绪分析**：使用 DeepFace 分析面部表情，映射到花朵颜色
  - happy → 黄色
  - sad → 蓝色
  - angry → 红色
  - surprise → 洋红色
  - fear → 紫色
  - disgust → 绿色
  - neutral → 白色

- **响度分析**：使用 librosa 分析音频 RMS，映射到花朵大小（0.5x - 3x）

- **音高分析**：使用 librosa.pyin 分析 F0，映射到花朵旋转角度（-0.5 到 0.5 弧度）

## 注意事项

- 确保已安装 portaudio（macOS: `brew install portaudio`）
- 需要摄像头和麦克风权限
- 首次运行 DeepFace 会下载模型文件

