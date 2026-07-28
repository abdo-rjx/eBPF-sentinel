from pydantic import BaseModel
from typing import Optional
from enum import Enum

class EventType(str, Enum):
    execve = "execve"
    connect = "connect"
    accept = "accept"
    openat = "openat"
    unlink = "unlink"
    rename = "rename"
    setuid = "setuid"

class RawEvent(BaseModel):
    ts: int
    pid: int
    tid: int
    ppid: int
    uid: int
    comm: str
    event_type: EventType
    filename: Optional[str] = ""
    dst_ip: Optional[int] = 0
    dst_port: Optional[int] = 0
    target_uid: Optional[int] = 0
