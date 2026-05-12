"""Self-starting script for local_service.

Usage:
    python start_service.py              # Start service normally
    python start_service.py --daemon     # Start as background process (Windows)
    python start_service.py --stop       # Stop running service
    python start_service.py --status     # Check service status

Features:
    - Auto-detects Python executable
    - Checks if port is already in use
    - Creates PID file for process management
    - Logs to local_service/logs/service.log
    - Handles graceful shutdown on SIGINT/SIGTERM
"""

import argparse
import logging
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

from local_service.core.config import HOST, PORT

# Paths
BASE_DIR = Path(__file__).parent.resolve()
PID_FILE = BASE_DIR / ".service.pid"
LOG_DIR = BASE_DIR / "logs"
LOG_FILE = LOG_DIR / "service.log"


def setup_logging() -> logging.Logger:
    """Configure logging to file and console."""
    LOG_DIR.mkdir(exist_ok=True)

    logger = logging.getLogger("local_service")
    logger.setLevel(logging.INFO)

    # File handler
    file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_format = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(file_format)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_format = logging.Formatter("[%(levelname)s] %(message)s")
    console_handler.setFormatter(console_format)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger


def is_port_in_use(host: str, port: int) -> bool:
    """Check if the port is already in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            return False
        except OSError:
            return True


def get_pid() -> int | None:
    """Read PID from PID file."""
    if PID_FILE.exists():
        try:
            return int(PID_FILE.read_text().strip())
        except (ValueError, OSError):
            return None
    return None


def is_process_running(pid: int) -> bool:
    """Check if a process with given PID is running."""
    if os.name == "nt":  # Windows
        import ctypes

        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(1, False, pid)
        if handle:
            kernel32.CloseHandle(handle)
            return True
        return False
    else:  # Unix-like
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False


def write_pid(pid: int) -> None:
    """Write PID to PID file."""
    PID_FILE.write_text(str(pid))


def remove_pid() -> None:
    """Remove PID file."""
    if PID_FILE.exists():
        PID_FILE.unlink()


def start_service(daemon: bool = False) -> None:
    """Start the FastAPI service."""
    logger = setup_logging()

    # Check if already running
    existing_pid = get_pid()
    if existing_pid and is_process_running(existing_pid):
        logger.info("Service is already running (PID: %d)", existing_pid)
        print(f"Service is already running (PID: {existing_pid})")
        return

    # Check port availability
    if is_port_in_use(HOST, PORT):
        logger.error("Port %d is already in use on %s", PORT, HOST)
        print(f"Error: Port {PORT} is already in use on {HOST}")
        sys.exit(1)

    logger.info("Starting local_service on %s:%d", HOST, PORT)
    print(f"Starting local_service on {HOST}:{PORT}...")

    # Build command
    python_exe = sys.executable
    cmd = [
        python_exe,
        "-m",
        "uvicorn",
        "local_service.app:app",
        "--host", HOST,
        "--port", str(PORT),
        "--no-access-log",
    ]

    if daemon and os.name == "nt":
        # Windows: use STARTUPINFO to hide console window
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        process = subprocess.Popen(
            cmd,
            cwd=str(BASE_DIR.parent),
            startupinfo=startupinfo,
            creationflags=subprocess.CREATE_NEW_CONSOLE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        # Foreground mode
        process = subprocess.Popen(cmd, cwd=str(BASE_DIR.parent))

    write_pid(process.pid)
    logger.info("Service started (PID: %d)", process.pid)
    print(f"Service started (PID: {process.pid})")
    print(f"Logs: {LOG_FILE}")
    print(f"Health: http://{HOST}:{PORT}/health")
    print(f"WebSocket: ws://{HOST}:{PORT}/ws/plugin")

    if not daemon:
        try:
            process.wait()
        except KeyboardInterrupt:
            logger.info("Received KeyboardInterrupt, shutting down...")
            stop_service()


def stop_service() -> None:
    """Stop the running service."""
    logger = setup_logging()
    pid = get_pid()

    if not pid:
        print("No PID file found. Service may not be running.")
        return

    if not is_process_running(pid):
        print(f"Process {pid} is not running.")
        remove_pid()
        return

    logger.info("Stopping service (PID: %d)...", pid)
    print(f"Stopping service (PID: {pid})...")

    if os.name == "nt":
        import ctypes

        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(1, False, pid)
        if handle:
            kernel32.TerminateProcess(handle, 0)
            kernel32.CloseHandle(handle)
    else:
        os.kill(pid, signal.SIGTERM)
        # Wait for graceful shutdown
        for _ in range(10):
            if not is_process_running(pid):
                break
            time.sleep(0.5)
        else:
            os.kill(pid, signal.SIGKILL)

    remove_pid()
    logger.info("Service stopped")
    print("Service stopped")


def check_status() -> None:
    """Check service status."""
    pid = get_pid()

    if pid and is_process_running(pid):
        print(f"Service is running (PID: {pid})")
        print(f"Health: http://{HOST}:{PORT}/health")
        print(f"WebSocket: ws://{HOST}:{PORT}/ws/plugin")
        print(f"Logs: {LOG_FILE}")
    else:
        print("Service is not running")
        if PID_FILE.exists():
            print("(Stale PID file found, removing...)")
            remove_pid()


def signal_handler(signum, frame) -> None:
    """Handle shutdown signals."""
    print("\nReceived shutdown signal, stopping service...")
    stop_service()
    sys.exit(0)


if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, signal_handler)

    parser = argparse.ArgumentParser(description="Local Service Manager")
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run service in background (Windows)",
    )
    parser.add_argument(
        "--stop",
        action="store_true",
        help="Stop running service",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Check service status",
    )

    args = parser.parse_args()

    if args.stop:
        stop_service()
    elif args.status:
        check_status()
    else:
        start_service(daemon=args.daemon)
