"""Safe, reversible synthetic ransomware-like file-thrash generator."""
import os
import shutil
import tempfile
import time

def run(num_files: int = 500, duration_s: float = 3.0):
    workdir = tempfile.mkdtemp(prefix="sentinel_demo_ransomware_")
    print(f"Working in {workdir} — will be deleted at the end.")
    try:
        paths = []
        start = time.time()
        for i in range(num_files):
            path = os.path.join(workdir, f"file_{i}.txt")
            with open(path, "w") as f:
                f.write("synthetic content")
            paths.append(path)
        for path in paths:
            renamed = path + ".locked"
            os.rename(path, renamed)
        for path in paths:
            os.remove(path + ".locked")
        elapsed = time.time() - start
        print(f"Created, renamed, and deleted {num_files} files in {elapsed:.2f}s — "
              f"check the dashboard for an anomaly spike now.")
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

if __name__ == "__main__":
    run()
