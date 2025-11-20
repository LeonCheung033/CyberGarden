"""
Butterfly Controller Agent
AI 控制蝴蝶的行为逻辑（飞行路径、互动模式等）
"""

from agentscope.message import Msg
import json
import math


class ButterflyControllerAgent:
    """蝴蝶控制智能体 - AI 控制蝴蝶行为逻辑"""
    
    def __init__(self, name="ButterflyController", model=None, **kwargs):
        self.name = name
        self.model = model
        self.system_prompt = """你是一个蝴蝶行为专家，控制虚拟蝴蝶的智能行为。
你的任务是根据用户的情绪、动作和花园状态，决定蝴蝶的行为模式。

行为模式包括：
- follow_hand: 跟随用户手势
- circle_flower: 围绕花朵飞行
- land_on_flower: 停在花朵上
- free_fly: 自由飞行
- respond_to_emotion: 响应情绪变化

请以JSON格式返回行为参数，包括：
- behavior: 行为模式
- target_position: 目标位置 {x, y, z}
- flight_speed: 飞行速度 (0-1)
- wing_flap_frequency: 翅膀扇动频率 (0-1)
- interaction_target: 互动目标（花朵ID或null）"""
    
    async def decide_behavior(self, emotion, emotion_intensity, hand_position=None, flower_positions=None):
        """决定蝴蝶行为"""
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
        - 手部位置：{hand_position if hand_position else "未检测到"}
        - 花朵数量：{len(flower_positions) if flower_positions else 0}
        
        请决定蝴蝶的最佳行为模式。
        
        返回JSON格式：
        {{
            "behavior": "follow_hand",
            "target_position": {{"x": 0, "y": 2, "z": 0}},
            "flight_speed": 0.5,
            "wing_flap_frequency": 0.6,
            "interaction_target": null
        }}
        """
        
        if not self.model:
            return self._get_default_behavior(emotion, hand_position, flower_positions)
        
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
            
            behavior = json.loads(json_str)
            return behavior
        except Exception as e:
            print(f"Error parsing butterfly behavior: {e}")
            return self._get_default_behavior(emotion, hand_position, flower_positions)
    
    def _get_default_behavior(self, emotion, hand_position, flower_positions):
        """获取默认行为"""
        # 如果有手部位置，优先跟随
        if hand_position:
            return {
                "behavior": "follow_hand",
                "target_position": {
                    "x": hand_position.get('x', 0),
                    "y": hand_position.get('y', 2),
                    "z": hand_position.get('z', 0)
                },
                "flight_speed": 0.6,
                "wing_flap_frequency": 0.7,
                "interaction_target": None
            }
        
        # 如果有花朵，围绕飞行
        if flower_positions and len(flower_positions) > 0:
            target_flower = flower_positions[0]
            return {
                "behavior": "circle_flower",
                "target_position": {
                    "x": target_flower.get('x', 0),
                    "y": target_flower.get('y', 2.5),
                    "z": target_flower.get('z', 0)
                },
                "flight_speed": 0.4,
                "wing_flap_frequency": 0.5,
                "interaction_target": 0
            }
        
        # 默认自由飞行
        return {
            "behavior": "free_fly",
            "target_position": {"x": 0, "y": 2, "z": 0},
            "flight_speed": 0.3,
            "wing_flap_frequency": 0.4,
            "interaction_target": None
        }

