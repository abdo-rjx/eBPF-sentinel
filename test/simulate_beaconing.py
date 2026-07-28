"""Safe synthetic C2-beaconing-like generator. Connects repeatedly to
loopback addresses only — makes no real outbound network contact."""
import socket
import time

def run(num_connections: int = 40, interval_s: float = 0.1):
    for i in range(num_connections):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.2)
            s.connect_ex(("127.0.0.1", 9999))
            s.close()
        except OSError:
            pass
        time.sleep(interval_s)
    print(f"Attempted {num_connections} rapid connects — check the dashboard for a beaconing-pattern anomaly.")

if __name__ == "__main__":
    run()
