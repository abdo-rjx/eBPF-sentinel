from pydantic import BaseModel
from datetime import datetime

class WindowOut(BaseModel):
    id: int
    pid: int
    ppid: int
    comm: str
    window_start_ns: int
    window_end_ns: int
    num_execve: int
    num_distinct_children: int
    num_file_opens: int
    num_file_renames: int
    num_file_deletes: int
    num_distinct_files_touched: int
    num_connect: int
    num_distinct_dest_ips: int
    num_setuid: int
    syscall_rate: float
    anomaly_score: float
    is_anomalous: bool
    created_at: datetime

    model_config = {"from_attributes": True}
