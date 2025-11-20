"""
Visual Designer Agent
使用大模型智能推荐视觉参数（颜色、光照、粒子效果等）
"""

from agentscope.message import Msg
import json


class VisualDesignerAgent:
    """视觉设计智能体 - 根据情绪和动作智能推荐视觉参数"""
    
    def __init__(self, name="VisualDesigner", model=None, **kwargs):
        self.name = name
        self.model = model
        self.system_prompt = """你是一个专业的视觉设计专家，擅长日式禅意风格的视觉设计。
你的任务是根据用户的情绪状态和动作特征，推荐最佳的视觉表现方案。

设计原则：
- 保持日式低饱和度配色风格
- 精致的光影效果
- 流畅的动画过渡
- 优雅的交互反馈

请以JSON格式返回推荐参数，包括：
- color: 主色调（RGB值，低饱和度）
- bloom_intensity: 发光强度 (0-1)
- particle_count: 粒子数量
- light_intensity: 光照强度 (0-1)
- animation_speed: 动画速度 (0-1)
- atmosphere: 氛围描述（如：柔和、神秘、温暖等）"""
    
    async def recommend_visual_params(self, emotion, emotion_intensity, pose_data=None):
        """根据情绪和姿态推荐视觉参数"""
        emotion_names = {
            'happy': '开心',
            'sad': '悲伤',
            'angry': '愤怒',
            'surprise': '惊讶',
            'fear': '恐惧',
            'disgust': '厌恶',
            'neutral': '中性'
        }
        
        emotion_name = emotion_names.get(emotion, '中性')
        
        prompt = f"""
        用户当前情绪：{emotion_name}
        情绪强度：{emotion_intensity}/10
        
        {f"用户动作：{pose_data}" if pose_data else ""}
        
        请推荐适合的视觉参数，保持日式禅意风格，低饱和度配色。
        返回JSON格式：
        {{
            "color": {{"r": 0.9, "g": 0.85, "b": 0.7}},
            "bloom_intensity": 0.5,
            "particle_count": 5000,
            "light_intensity": 0.6,
            "animation_speed": 0.5,
            "atmosphere": "柔和温暖"
        }}
        """
        
        if not self.model:
            return self._get_default_params(emotion, emotion_intensity)
        
        try:
            msg = Msg(name=self.name, content=prompt, role="user")
            response = self.model(msg)
            
            # 如果模型返回的是异步结果，需要 await
            if hasattr(response, '__await__'):
                response = await response
            
            # 解析响应，提取JSON
            content = response.content if hasattr(response, 'content') else str(response)
            # 尝试提取JSON
            if '```json' in content:
                json_str = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                json_str = content.split('```')[1].split('```')[0].strip()
            else:
                json_str = content
            
            params = json.loads(json_str)
            return params
        except Exception as e:
            print(f"Error parsing visual params: {e}")
            # 返回默认值
            return self._get_default_params(emotion, emotion_intensity)
    
    def _get_default_params(self, emotion, intensity):
        """获取默认视觉参数"""
        base_colors = {
            'happy': {'r': 0.95, 'g': 0.85, 'b': 0.6},
            'sad': {'r': 0.65, 'g': 0.78, 'b': 0.92},
            'angry': {'r': 1.0, 'g': 0.6, 'b': 0.62},
            'surprise': {'r': 1.0, 'g': 0.7, 'b': 0.73},
            'fear': {'r': 0.78, 'g': 0.66, 'b': 0.85},
            'disgust': {'r': 0.73, 'g': 1.0, 'b': 0.79},
            'neutral': {'r': 0.96, 'g': 0.96, 'b': 0.86}
        }
        
        color = base_colors.get(emotion, base_colors['neutral'])
        intensity_factor = intensity / 10.0
        
        return {
            "color": color,
            "bloom_intensity": 0.4 + intensity_factor * 0.3,
            "particle_count": int(3000 + intensity_factor * 5000),
            "light_intensity": 0.5 + intensity_factor * 0.3,
            "animation_speed": 0.3 + intensity_factor * 0.4,
            "atmosphere": "柔和"
        }

