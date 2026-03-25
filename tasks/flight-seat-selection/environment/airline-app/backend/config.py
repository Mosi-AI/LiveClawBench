import os
from datetime import timedelta


class Config:
    """Base configuration"""

    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-secret-key-change-in-production"
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL"
    ) or "sqlite:///" + os.path.join(
        os.path.abspath(os.path.dirname(__file__)), "instance", "airline.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT Configuration
    JWT_SECRET_KEY = (
        os.environ.get("JWT_SECRET_KEY") or "jwt-secret-key-change-in-production"
    )
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)

    # CORS
    CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


class DevelopmentConfig(Config):
    """Development configuration"""

    DEBUG = True


class TestingConfig(Config):
    """Testing configuration"""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


class ProductionConfig(Config):
    """Production configuration"""

    DEBUG = False


config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
