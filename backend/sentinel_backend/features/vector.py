from pydantic import BaseModel

FEATURE_COLUMNS = [
    "num_execve",
    "num_distinct_children",
    "num_file_opens",
    "num_file_renames",
    "num_file_deletes",
    "num_distinct_files_touched",
    "num_connect",
    "num_distinct_dest_ips",
    "num_setuid",
    "syscall_rate",
]


class FeatureVector(BaseModel):
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

    def to_array(self) -> list[float]:
        return [float(getattr(self, col)) for col in FEATURE_COLUMNS]
