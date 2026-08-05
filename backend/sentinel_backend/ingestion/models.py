from enum import Enum

from pydantic import BaseModel


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
    filename: str | None = ""
    dst_ip: int | None = 0
    dst_port: int | None = 0
    target_uid: int | None = 0
