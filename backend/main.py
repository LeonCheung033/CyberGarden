import asyncio
import cv2
import numpy as np
import librosa
import pyaudio
import json
from collections import deque
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from deepface import DeepFace
import uvicorn

# --- FastAPI App ---
app = FastAPI()

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

# WebSocket 路由
@app.websocket("/ws/data")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # 保持连接，等待后端推送数据
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

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
async def analyze_media():
    # 初始化摄像头
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Warning: Could not open camera")
        return
    
    # 设置摄像头分辨率（提高检测精度）
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    # 初始化音频
    CHUNK = 2048  # 增加块大小以提高音高检测精度
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 44100
    
    audio = pyaudio.PyAudio()
    stream = audio.open(
        format=FORMAT,
        channels=CHANNELS,
        rate=RATE,
        input=True,
        frames_per_buffer=CHUNK
    )
    
    print("Starting media analysis...")
    
    # 音频平滑处理
    loudness_history = deque(maxlen=5)
    pitch_history = deque(maxlen=5)
    
    try:
        frame_count = 0
        while True:
            # 1. 读取视频帧（降低帧率以减少计算负担）
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.1)
                continue
            
            frame_count += 1
            
            # 2. 读取音频块
            audio_data = stream.read(CHUNK, exception_on_overflow=False)
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            
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
            
            # 6. 格式化数据为 JSON
            data = {
                "emotion": emotion,
                "loudness": loudness,
                "pitch": pitch
            }
            json_data = json.dumps(data)
            
            # 7. 广播数据（降低频率）
            if manager.active_connections:
                await manager.broadcast(json_data)
            
            # 8. 控制更新频率
            await asyncio.sleep(0.15)  # 降低更新频率
            
    except Exception as e:
        print(f"Analysis error: {e}")
    finally:
        cap.release()
        stream.stop_stream()
        stream.close()
        audio.terminate()
        print("Media analysis stopped")

# --- 启动任务 ---
@app.on_event("startup")
async def startup_event():
    # 启动后台分析任务
    asyncio.create_task(analyze_media())

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
