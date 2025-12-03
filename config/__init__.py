# config/__init__.py
from config.base import Config
from config.development import DevelopmentConfig
from config.production import ProductionConfig

# 配置
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

