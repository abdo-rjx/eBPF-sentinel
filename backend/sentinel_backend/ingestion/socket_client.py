import socket
import json
import logging
from typing import Iterator
from .models import RawEvent

logger = logging.getLogger(__name__)

def stream_events(socket_path: str) -> Iterator[RawEvent]:
    while True:
        try:
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.connect(socket_path)
            logger.info("Connected to collector at %s", socket_path)
            buffer = ""
            while True:
                chunk = sock.recv(65536)
                if not chunk:
                    logger.warning("Collector closed the connection, reconnecting...")
                    break
                buffer += chunk.decode("utf-8", errors="replace")
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        yield RawEvent(**data)
                    except (json.JSONDecodeError, ValueError) as exc:
                        logger.warning("Dropping malformed event line: %s", exc)
                        continue
        except (ConnectionRefusedError, FileNotFoundError):
            import time
            logger.info("Collector not available yet, retrying in 2s...")
            time.sleep(2)
