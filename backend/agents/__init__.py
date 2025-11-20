"""
CyberGarden Agents Module
Multi-agent system for intelligent visual design and interaction
"""

from .visual_designer import VisualDesignerAgent
from .butterfly_controller import ButterflyControllerAgent
from .environment_generator import EnvironmentGeneratorAgent
from .coordinator import CoordinatorAgent

__all__ = [
    'VisualDesignerAgent',
    'ButterflyControllerAgent',
    'EnvironmentGeneratorAgent',
    'CoordinatorAgent',
]

