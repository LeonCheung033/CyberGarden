import asyncio
import cv2
import numpy as np
import librosa
import pyaudio
import json
import os
from collections import deque
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from deepface import DeepFace
import uvicorn
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# AgentScope imports
from agentscope.model import OpenAIChatModel, DashScopeChatModel
from agents.visual_designer import VisualDesignerAgent
from agents.butterfly_controller import ButterflyControllerAgent
from agents.environment_generator import EnvironmentGeneratorAgent
from agents.coordinator import CoordinatorAgent

# --- FastAPI App ---
app = FastAPI()

# --- AgentScope 初始化 ---
def init_agents():
    """初始化 AgentScope 和 agents"""
    try:
        # 创建模型实例
        deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "")
        dashscope_api_key = os.getenv("DASHSCOPE_API_KEY", "")
        
        deepseek_model = None
        if deepseek_api_key:
            try:
                deepseek_model = OpenAIChatModel(
                    model_name="deepseek-chat",
                    api_key=deepseek_api_key,
                    base_url="https://api.deepseek.com"
                )
            except Exception as e:
                print(f"Error creating DeepSeek model: {e}")
        
        qwen_model = None
        if dashscope_api_key:
            try:
                qwen_model = DashScopeChatModel(
                    model_name="qwen-turbo",
                    api_key=dashscope_api_key
                )
            except Exception as e:
                print(f"Error creating DashScope model: {e}")
        
        # 创建 agents（如果 API key 不存在，使用 None，agent 会使用默认值）
        visual_agent = VisualDesignerAgent(
            name="VisualDesigner",
            model=deepseek_model
        ) if deepseek_model else None
        
        butterfly_agent = ButterflyControllerAgent(
            name="ButterflyController",
            model=qwen_model
        ) if qwen_model else None
        
        env_agent = EnvironmentGeneratorAgent(
            name="EnvironmentGenerator",
            model=deepseek_model
        ) if deepseek_model else None
        
        # 创建协调者
        if visual_agent and butterfly_agent and env_agent:
            coordinator = CoordinatorAgent(
                visual_agent=visual_agent,
                butterfly_agent=butterfly_agent,
                env_agent=env_agent
            )
            print("AgentScope initialized successfully")
            return coordinator
        else:
            print("Warning: Some API keys are missing. Agents will use default values.")
            return None
            
    except Exception as e:
        print(f"Error initializing AgentScope: {e}")
        print("Continuing without AI agents...")
        return None

# 初始化 agents
coordinator = init_agents()

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"✓ WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"✗ WebSocket disconnected. Remaining connections: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        # 创建连接列表的副本，避免在迭代时修改列表
        connections_to_remove = []
        for connection in self.active_connections:
            try:
                # 检查连接状态
                if connection.client_state.name == "CONNECTED":
                    await connection.send_text(message)
                else:
                    connections_to_remove.append(connection)
            except Exception as e:
                # 连接已断开，标记为需要移除
                print(f"Error sending message to WebSocket: {e}")
                connections_to_remove.append(connection)
        
        # 移除断开的连接
        for connection in connections_to_remove:
            self.disconnect(connection)

manager = ConnectionManager()

# WebSocket 路由
@app.websocket("/ws/data")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print(f"✓ WebSocket connected. Total connections: {len(manager.active_connections)}")
    try:
        while True:
            # 接收前端发送的数据（如姿态数据）
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                try:
                    received_data = json.loads(data)
                    if received_data.get("type") == "pose":
                        # 更新全局姿态数据（在 analyze_media 中使用）
                        # 注意：这里需要线程安全的方式传递数据
                        pass
                    elif received_data.get("type") == "ping":
                        # 响应前端心跳
                        await websocket.send_text(json.dumps({"type": "pong", "timestamp": received_data.get("timestamp")}))
                except Exception as e:
                    print(f"Error processing received data: {e}")
            except asyncio.TimeoutError:
                # 发送心跳保持连接
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"✗ WebSocket disconnected. Remaining connections: {len(manager.active_connections)}")

# --- 情绪稳定性处理 ---
class EmotionStabilizer:
    def __init__(self, window_size=10, threshold=0.6):
        self.emotion_history = deque(maxlen=window_size)
        self.current_emotion = "neutral"
        self.confidence_threshold = threshold
    
    def update(self, emotion, confidence=None):
        """更新情绪，返回稳定后的情绪"""
        self.emotion_history.append(emotion)
        
        # 统计最近的情绪分布
        emotion_counts = {}
        for e in self.emotion_history:
            emotion_counts[e] = emotion_counts.get(e, 0) + 1
        
        # 找到最常见的情绪
        if emotion_counts:
            most_common = max(emotion_counts.items(), key=lambda x: x[1])
            emotion_freq = most_common[1] / len(self.emotion_history)
            
            # 只有当情绪频率超过阈值时才更新
            if emotion_freq >= self.confidence_threshold:
                self.current_emotion = most_common[0]
        
        return self.current_emotion

emotion_stabilizer = EmotionStabilizer(window_size=15, threshold=0.5)

# --- 音频和视频分析 ---
async def analyze_media(coordinator_instance=None):
    # 初始化摄像头
    cap = None
    try:
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("Warning: Could not open camera")
            cap = None
    except Exception as e:
        print(f"Warning: Camera initialization failed: {e}")
        cap = None
    
    if not cap:
        print("Camera not available. Continuing without video analysis...")
    else:
        # 设置摄像头分辨率（提高检测精度）
        try:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        except Exception as e:
            print(f"Warning: Could not set camera resolution: {e}")
    
    # 初始化音频（添加错误处理）
    CHUNK = 2048  # 增加块大小以提高音高检测精度
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 44100
    
    audio = None
    stream = None
    
    try:
        audio = pyaudio.PyAudio()
        
        # 列出可用的音频输入设备（调试用）
        print("Available audio input devices:")
        for i in range(audio.get_device_count()):
            info = audio.get_device_info_by_index(i)
            if info['maxInputChannels'] > 0:
                print(f"  Device {i}: {info['name']} (inputs: {info['maxInputChannels']})")
        
        # 尝试打开默认输入设备
        try:
            stream = audio.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK,
                input_device_index=None,  # 使用默认设备
                start=False  # 先不启动，避免权限问题
            )
            stream.start_stream()
            print("Audio stream opened successfully")
        except OSError as e:
            print(f"Warning: Could not open audio stream: {e}")
            print("Audio analysis will be disabled. Please check microphone permissions.")
            # 清理资源
            if stream:
                try:
                    stream.stop_stream()
                    stream.close()
                except:
                    pass
            if audio:
                try:
                    audio.terminate()
                except:
                    pass
            audio = None
            stream = None
    except Exception as e:
        print(f"Warning: Audio initialization failed: {e}")
        print("Audio analysis will be disabled.")
        audio = None
        stream = None
    
    print("Starting media analysis...")
    
    # 音频平滑处理
    loudness_history = deque(maxlen=5)
    pitch_history = deque(maxlen=5)
    
    # 花朵位置（用于蝴蝶行为）
    flower_positions = [
        {"x": -4, "y": 0, "z": -3},
        {"x": -2, "y": 0, "z": -4},
        {"x": 0, "y": 0, "z": -4},
        {"x": 2, "y": 0, "z": -3},
        {"x": 4, "y": 0, "z": -2},
        {"x": -3, "y": 0, "z": 2},
        {"x": 0, "y": 0, "z": 3},
        {"x": 3, "y": 0, "z": 2},
        {"x": -5, "y": 0, "z": 0},
        {"x": 5, "y": 0, "z": 0},
        {"x": 0, "y": 0, "z": 0},  # 中心花朵
    ]
    
    # 姿态数据（暂时为空，后续由前端提供）
    pose_data = None
    
    try:
        frame_count = 0
        emotion_duration = 0
        last_emotion = "neutral"
        confidence = 0.5  # 默认置信度
        
        while True:
            # 1. 读取视频帧（降低帧率以减少计算负担）
            if cap:
                ret, frame = cap.read()
                if not ret:
                    await asyncio.sleep(0.1)
                    continue
            else:
                # 如果没有摄像头，使用空白帧
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                await asyncio.sleep(0.1)
            
            frame_count += 1
            
            # 2. 读取音频块（如果音频流可用）
            if stream and stream.is_active():
                try:
                    audio_data = stream.read(CHUNK, exception_on_overflow=False)
                    audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
                except Exception as e:
                    if frame_count % 30 == 0:  # 每30帧打印一次错误
                        print(f"Audio read error: {e}")
                    audio_array = np.zeros(CHUNK, dtype=np.float32)
            else:
                # 如果没有音频流，使用静音
                audio_array = np.zeros(CHUNK, dtype=np.float32)
            
            # 3. 分析情绪（降低检测频率）
            emotion = "neutral"
            if frame_count % 3 == 0:  # 每3帧检测一次
                try:
                    # 缩小图像以提高速度
                    small_frame = cv2.resize(frame, (320, 240))
                    rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
                    
                    result = DeepFace.analyze(
                        rgb_frame,
                        actions=['emotion'],
                        detector_backend='opencv',
                        enforce_detection=False,
                        silent=True
                    )
                    if isinstance(result, list):
                        result = result[0]
                    
                    # 获取情绪和置信度
                    emotion_scores = result.get('emotion', {})
                    if emotion_scores:
                        emotion = max(emotion_scores.items(), key=lambda x: x[1])[0]
                        confidence = emotion_scores.get(emotion, 0) / 100.0
                    else:
                        emotion = result.get('dominant_emotion', 'neutral')
                        confidence = 0.5
                    
                    # 使用稳定器平滑情绪
                    emotion = emotion_stabilizer.update(emotion, confidence)
                    
                    # 计算情绪持续时间
                    if emotion == last_emotion:
                        emotion_duration += 0.15
                    else:
                        emotion_duration = 0.15
                        last_emotion = emotion
                    
                except Exception as e:
                    # 只在出错时打印，避免刷屏
                    if frame_count % 30 == 0:
                        print(f"Emotion analysis error: {e}")
            
            # 4. 分析响度 (RMS) - 平滑处理
            try:
                rms = librosa.feature.rms(y=audio_array, frame_length=CHUNK)[0][0]
                loudness = float(np.clip(rms * 15, 0, 1))  # 调整归一化
                loudness_history.append(loudness)
                loudness = float(np.mean(loudness_history))  # 使用平均值
            except Exception as e:
                loudness = 0.0
            
            # 5. 分析音高 (F0) - 平滑处理
            try:
                f0, voiced_flag, voiced_probs = librosa.pyin(
                    audio_array,
                    fmin=50,
                    fmax=400,
                    sr=RATE,
                    frame_length=CHUNK
                )
                valid_f0 = f0[~np.isnan(f0)]
                if len(valid_f0) > 0:
                    pitch = float(np.median(valid_f0))  # 使用中位数更稳定
                    pitch = np.clip(pitch, 50, 400)
                else:
                    pitch = 220.0
                
                pitch_history.append(pitch)
                pitch = float(np.mean(pitch_history))  # 使用平均值
            except Exception as e:
                pitch = 220.0
            
            # 6. 调用 AI agents（每10帧调用一次，降低API调用频率）
            ai_data = None
            if coordinator_instance and frame_count % 10 == 0:
                try:
                    emotion_intensity = confidence * 10
                    audio_features = {
                        "loudness": loudness,
                        "pitch": pitch
                    }
                    
                    ai_data = await coordinator_instance.process_emotion_data(
                        emotion=emotion,
                        emotion_intensity=emotion_intensity,
                        audio_features=audio_features,
                        pose_data=pose_data,
                        flower_positions=flower_positions
                    )
                except Exception as e:
                    print(f"Error calling agents: {e}")
                    ai_data = None
            
            # 7. 格式化数据为 JSON
            data = {
                "emotion": emotion,
                "loudness": loudness,
                "pitch": pitch,
                "emotion_intensity": confidence * 10,
                "emotion_duration": emotion_duration
            }
            
            # 添加 AI 推荐数据
            if ai_data:
                data["ai"] = {
                    "visual": ai_data.get("visual"),
                    "butterfly": ai_data.get("butterfly"),
                    "environment": ai_data.get("environment")
                }
            
            json_data = json.dumps(data, default=str)
            
            # 8. 广播数据（降低频率）
            if manager.active_connections:
                await manager.broadcast(json_data)
                # 每30帧打印一次日志，确认数据正在发送
                if frame_count % 30 == 0:
                    print(f"[{frame_count}] 已发送数据: emotion={emotion}, loudness={loudness:.2f}, pitch={pitch:.1f}, connections={len(manager.active_connections)}")
            else:
                # 如果没有连接，每30帧打印一次警告
                if frame_count % 30 == 0:
                    print(f"[{frame_count}] 警告: 没有活跃的WebSocket连接")
            
            # 9. 控制更新频率
            await asyncio.sleep(0.15)  # 降低更新频率
            
    except Exception as e:
        print(f"Analysis error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 清理资源
        if cap:
            cap.release()
        if stream:
            try:
                if stream.is_active():
                    stream.stop_stream()
                stream.close()
            except Exception as e:
                print(f"Error closing audio stream: {e}")
        if audio:
            try:
                audio.terminate()
            except Exception as e:
                print(f"Error terminating audio: {e}")
        print("Media analysis stopped")

# --- 启动任务 ---
@app.on_event("startup")
async def startup_event():
    # 启动后台分析任务，传入 coordinator
    asyncio.create_task(analyze_media(coordinator))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
