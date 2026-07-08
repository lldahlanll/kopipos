from pydantic import BaseModel
from typing import Dict, Optional, Any

class SettingUpdate(BaseModel):
    settings: Dict[str, Optional[Any]]

class SettingOut(BaseModel):
    key: str
    value: Optional[str] = None

    class Config:
        from_attributes = True
