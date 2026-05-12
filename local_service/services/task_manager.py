"""Task manager with single-task lock and state machine.

States:
    IDLE, TASK_RECEIVED, DS_PAGE_CHECKING, DS_PAGE_READY,
    INPUTTING_PROMPT, PROMPT_SENT, WAITING_RESPONSE, RESPONSE_DONE,
    RESULT_EXTRACTED, RESULT_RETURNED_TO_SERVER, FEISHU_PUSHING,
    COMPLETED, ANALYSIS_SUCCESS_PUSH_FAILED, FAILED, TASK_BUSY
"""

import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


class TaskState:
    IDLE = "IDLE"
    TASK_RECEIVED = "TASK_RECEIVED"
    DS_PAGE_CHECKING = "DS_PAGE_CHECKING"
    DS_PAGE_READY = "DS_PAGE_READY"
    INPUTTING_PROMPT = "INPUTTING_PROMPT"
    PROMPT_SENT = "PROMPT_SENT"
    WAITING_RESPONSE = "WAITING_RESPONSE"
    RESPONSE_DONE = "RESPONSE_DONE"
    RESULT_EXTRACTED = "RESULT_EXTRACTED"
    RESULT_RETURNED_TO_SERVER = "RESULT_RETURNED_TO_SERVER"
    FEISHU_PUSHING = "FEISHU_PUSHING"
    COMPLETED = "COMPLETED"
    ANALYSIS_SUCCESS_PUSH_FAILED = "ANALYSIS_SUCCESS_PUSH_FAILED"
    FAILED = "FAILED"
    TASK_BUSY = "TASK_BUSY"


VALID_TRANSITIONS = {
    TaskState.IDLE: [
        TaskState.TASK_RECEIVED,
        TaskState.TASK_BUSY,
    ],
    TaskState.TASK_RECEIVED: [
        TaskState.DS_PAGE_CHECKING,
        TaskState.FAILED,
    ],
    TaskState.DS_PAGE_CHECKING: [
        TaskState.DS_PAGE_READY,
        TaskState.FAILED,
    ],
    TaskState.DS_PAGE_READY: [
        TaskState.INPUTTING_PROMPT,
        TaskState.FAILED,
    ],
    TaskState.INPUTTING_PROMPT: [
        TaskState.PROMPT_SENT,
        TaskState.FAILED,
    ],
    TaskState.PROMPT_SENT: [
        TaskState.WAITING_RESPONSE,
        TaskState.FAILED,
    ],
    TaskState.WAITING_RESPONSE: [
        TaskState.RESPONSE_DONE,
        TaskState.FAILED,
    ],
    TaskState.RESPONSE_DONE: [
        TaskState.RESULT_EXTRACTED,
        TaskState.FAILED,
    ],
    TaskState.RESULT_EXTRACTED: [
        TaskState.RESULT_RETURNED_TO_SERVER,
        TaskState.FAILED,
    ],
    TaskState.RESULT_RETURNED_TO_SERVER: [
        TaskState.FEISHU_PUSHING,
        TaskState.FAILED,
    ],
    TaskState.FEISHU_PUSHING: [
        TaskState.COMPLETED,
        TaskState.ANALYSIS_SUCCESS_PUSH_FAILED,
        TaskState.FAILED,
    ],
    TaskState.COMPLETED: [TaskState.IDLE],
    TaskState.ANALYSIS_SUCCESS_PUSH_FAILED: [TaskState.IDLE],
    TaskState.FAILED: [TaskState.IDLE],
    TaskState.TASK_BUSY: [TaskState.IDLE],
}


class TaskManager:
    """Manages task lifecycle with single-task lock."""

    def __init__(self) -> None:
        self._state = TaskState.IDLE
        self._current_task: dict[str, Any] | None = None
        self._last_task: dict[str, Any] | None = None

    @property
    def state(self) -> str:
        return self._state

    @property
    def current_task(self) -> dict[str, Any] | None:
        return self._current_task

    @property
    def last_task(self) -> dict[str, Any] | None:
        return self._last_task

    def is_busy(self) -> bool:
        """Return True if a task is currently executing."""
        return self._state not in (TaskState.IDLE, TaskState.COMPLETED, TaskState.FAILED, TaskState.ANALYSIS_SUCCESS_PUSH_FAILED)

    def transition(self, new_state: str) -> bool:
        """Transition to new state if valid.

        Returns True if transition succeeded.
        """
        valid = VALID_TRANSITIONS.get(self._state, [])
        if new_state not in valid:
            logger.warning(
                "Invalid state transition: %s -> %s",
                self._state,
                new_state,
            )
            return False

        logger.info("State transition: %s -> %s", self._state, new_state)
        self._state = new_state
        return True

    def create_task(self, stock_code: str, stock_name: str, prompt: str) -> dict[str, Any] | None:
        """Create a new task if not busy.

        Returns task dict or None if busy.
        """
        if self.is_busy():
            logger.warning("Task busy, rejecting new task")
            return None

        now = datetime.now()
        task_id = f"task_{stock_code}_{now.strftime('%Y%m%d_%H%M%S')}"

        task = {
            "task_id": task_id,
            "stock_code": stock_code,
            "stock_name": stock_name,
            "prompt": prompt,
            "status": TaskState.TASK_RECEIVED,
            "started_at": now.isoformat(),
            "finished_at": None,
            "duration_seconds": None,
            "analysis_result": None,
            "feishu_push_status": None,
            "last_error": None,
        }

        self._current_task = task
        self._state = TaskState.TASK_RECEIVED
        logger.info("Task created: %s", task_id)
        return task

    def complete_task(self, result: str | None = None, feishu_status: str | None = None) -> None:
        """Mark current task as completed."""
        if self._current_task:
            self._current_task["status"] = TaskState.COMPLETED
            self._current_task["finished_at"] = datetime.now().isoformat()
            self._current_task["analysis_result"] = result
            self._current_task["feishu_push_status"] = feishu_status or "success"
            self._last_task = self._current_task.copy()
            self._current_task = None
            self._state = TaskState.IDLE
            logger.info("Task completed")

    def fail_task(self, error_code: str, error_message: str) -> None:
        """Mark current task as failed."""
        if self._current_task:
            self._current_task["status"] = TaskState.FAILED
            self._current_task["finished_at"] = datetime.now().isoformat()
            self._current_task["last_error"] = {
                "code": error_code,
                "message": error_message,
            }
            self._last_task = self._current_task.copy()
            self._current_task = None
            self._state = TaskState.IDLE
            logger.info("Task failed: %s - %s", error_code, error_message)

    def push_failed(self, result: str, error_code: str, error_message: str) -> None:
        """Mark task as analysis success but push failed."""
        if self._current_task:
            self._current_task["status"] = TaskState.ANALYSIS_SUCCESS_PUSH_FAILED
            self._current_task["finished_at"] = datetime.now().isoformat()
            self._current_task["analysis_result"] = result
            self._current_task["feishu_push_status"] = "failed"
            self._current_task["last_error"] = {
                "code": error_code,
                "message": error_message,
            }
            self._last_task = self._current_task.copy()
            self._current_task = None
            self._state = TaskState.IDLE
            logger.info("Task analysis success but push failed")

    def on_disconnect(self) -> None:
        """Handle WebSocket disconnect - fail current task."""
        if self.is_busy() and self._current_task:
            self.fail_task("WS_DISCONNECTED", "WebSocket disconnected during task execution")
