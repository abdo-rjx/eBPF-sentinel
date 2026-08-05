from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class WindowRecord(Base):
    __tablename__ = "windows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pid = Column(Integer, nullable=False, index=True)
    ppid = Column(Integer, nullable=False)
    comm = Column(String(16), nullable=False, index=True)
    window_start_ns = Column(BigInteger, nullable=False)
    window_end_ns = Column(BigInteger, nullable=False)

    num_execve = Column(Integer, nullable=False)
    num_distinct_children = Column(Integer, nullable=False)
    num_file_opens = Column(Integer, nullable=False)
    num_file_renames = Column(Integer, nullable=False)
    num_file_deletes = Column(Integer, nullable=False)
    num_distinct_files_touched = Column(Integer, nullable=False)
    num_connect = Column(Integer, nullable=False)
    num_distinct_dest_ips = Column(Integer, nullable=False)
    num_setuid = Column(Integer, nullable=False)
    syscall_rate = Column(Float, nullable=False)

    anomaly_score = Column(Float, nullable=False, index=True)
    is_anomalous = Column(Boolean, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
