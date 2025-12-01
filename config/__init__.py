from config.base import Config
from config.development import DevelopmentConfig
from config.production import ProductionConfig

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
