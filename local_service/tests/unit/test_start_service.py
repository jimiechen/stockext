"""Unit tests for start_service.py.

Coverage: port check, PID file operations, process status.
"""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from local_service.start_service import (
    get_pid,
    is_port_in_use,
    is_process_running,
    remove_pid,
    write_pid,
)


class TestIsPortInUse:
    def test_port_available(self) -> None:
        # Use a high random port that's unlikely to be in use
        assert is_port_in_use("127.0.0.1", 54321) is False

    def test_port_in_use(self) -> None:
        import socket

        # Bind to a port, then check
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
            s.listen(1)
            assert is_port_in_use("127.0.0.1", port) is True


class TestPidFile:
    def test_write_and_read_pid(self, tmp_path: Path) -> None:
        pid_file = tmp_path / "test.pid"
        with patch("local_service.start_service.PID_FILE", pid_file):
            write_pid(12345)
            assert get_pid() == 12345

    def test_remove_pid(self, tmp_path: Path) -> None:
        pid_file = tmp_path / "test.pid"
        with patch("local_service.start_service.PID_FILE", pid_file):
            write_pid(12345)
            remove_pid()
            assert get_pid() is None

    def test_get_pid_no_file(self, tmp_path: Path) -> None:
        pid_file = tmp_path / "nonexistent.pid"
        with patch("local_service.start_service.PID_FILE", pid_file):
            assert get_pid() is None


class TestIsProcessRunning:
    def test_current_process_running(self) -> None:
        # Current process should be running
        assert is_process_running(os.getpid()) is True

    def test_nonexistent_process(self) -> None:
        # Use a very high PID that's unlikely to exist
        assert is_process_running(999999) is False
