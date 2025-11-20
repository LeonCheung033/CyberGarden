"""
Environment Generator Agent
动态生成环境效果参数（光照、雾、天气等）
"""

from agentscope.message import Msg
import json


class EnvironmentGeneratorAgent:
    """环境生成智能体 - 动态生成环境效果参数"""
    
    def __init__(self, name="EnvironmentGenerator", model=None, **kwargs):
        self.name = name
        self.model = model
        self.system_prompt = """你是一个环境设计专家，擅长创造沉浸式的虚拟环境。
你的任务是根据用户的情绪和动作，生成适合的环境氛围。

环境要素包括：
- 光照设置（方向、强度、颜色）
- 雾效（密度、颜色）
- 背景色
- 环境光强度
- 特殊效果（如：光斑、粒子密度等）

请以JSON格式返回环境参数，保持日式禅意风格。"""
    
    async def generate_environment(self, emotion, emotion_intensity, motion_level=0):
        """生成环境参数"""
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
        当前状态：
        - 用户情绪：{emotion_name}（强度：{emotion_intensity}/10）
        - 动作活跃度：{motion_level}/10
        
        请生成适合的环境氛围，保持日式禅意风格。
        
        返回JSON格式：
        {{
            "ambient_light": {{"r": 0.4, "g": 0.4, "b": 0.4, "intensity": 0.5}},
            "directional_light": {{
                "color": {{"r": 1.0, "g": 0.97, "b": 0.88}},
                "intensity": 0.6,
                "position": {{"x": 10, "y": 12, "z": 8}}
            }},
            "fog": {{
                "enabled": true,
                "density": 0.02,
                "color": {{"r": 0.1, "g": 0.1, "b": 0.15}}
            }},
            "background_color": {{"r": 0.1, "g": 0.1, "b": 0.12}},
            "atmosphere": "柔和神秘"
        }}
        """
        
        if not self.model:
            return self._get_default_environment(emotion, emotion_intensity)
        
        try:
            msg = Msg(name=self.name, content=prompt, role="user")
            response = self.model(msg)
            
            # 如果模型返回的是异步结果，需要 await
            if hasattr(response, '__await__'):
                response = await response
            
            content = response.content if hasattr(response, 'content') else str(response)
            if '```json' in content:
                json_str = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                json_str = content.split('```')[1].split('```')[0].strip()
            else:
                json_str = content
            
            env_params = json.loads(json_str)
            return env_params
        except Exception as e:
            print(f"Error parsing environment params: {e}")
            return self._get_default_environment(emotion, emotion_intensity)
    
    def _get_default_environment(self, emotion, intensity):
        """获取默认环境参数"""
        intensity_factor = intensity / 10.0
        
        # 根据情绪调整背景色
        bg_colors = {
            'happy': {'r': 0.12, 'g': 0.12, 'b': 0.15},
            'sad': {'r': 0.08, 'g': 0.1, 'b': 0.15},
            'angry': {'r': 0.15, 'g': 0.1, 'b': 0.1},
            'surprise': {'r': 0.15, 'g': 0.12, 'b': 0.15},
            'fear': {'r': 0.1, 'g': 0.08, 'b': 0.12},
            'disgust': {'r': 0.1, 'g': 0.12, 'b': 0.1},
            'neutral': {'r': 0.1, 'g': 0.1, 'b': 0.12}
        }
        
        bg_color = bg_colors.get(emotion, bg_colors['neutral'])
        
        return {
            "ambient_light": {
                "r": 0.4,
                "g": 0.4,
                "b": 0.4,
                "intensity": 0.4 + intensity_factor * 0.2
            },
            "directional_light": {
                "color": {"r": 1.0, "g": 0.97, "b": 0.88},
                "intensity": 0.5 + intensity_factor * 0.3,
                "position": {"x": 10, "y": 12, "z": 8}
            },
            "fog": {
                "enabled": True,
                "density": 0.015 + intensity_factor * 0.01,
                "color": bg_color
            },
            "background_color": bg_color,
            "atmosphere": "柔和"
        }

