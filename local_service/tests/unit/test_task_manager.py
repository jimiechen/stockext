"""Unit tests for TaskManager.

TDD approach: write the test first, then implement the manager.
"""

import pytest

from local_service.services.task_manager import TaskManager, TaskState, VALID_TRANSITIONS


@pytest.fixture
def manager() -> TaskManager:
    return TaskManager()


class TestTaskStateConstants:
    def test_all_states_defined(self) -> None:
        assert TaskState.IDLE == "IDLE"
        assert TaskState.TASK_RECEIVED == "TASK_RECEIVED"
        assert TaskState.COMPLETED == "COMPLETED"
        assert TaskState.FAILED == "FAILED"
        assert TaskState.TASK_BUSY == "TASK_BUSY"


class TestInitialState:
    def test_initial_state_is_idle(self, manager: TaskManager) -> None:
        assert manager.state == TaskState.IDLE
        assert manager.is_busy() is False
        assert manager.current_task is None
        assert manager.last_task is None


class TestCreateTask:
    def test_create_task_when_idle(self, manager: TaskManager) -> None:
        task = manager.create_task("000001", "平安银行", "test prompt")
        assert task is not None
        assert task["stock_code"] == "000001"
        assert task["stock_name"] == "平安银行"
        assert task["prompt"] == "test prompt"
        assert task["status"] == TaskState.TASK_RECEIVED
        assert manager.state == TaskState.TASK_RECEIVED
        assert manager.is_busy() is True

    def test_create_task_when_busy(self, manager: TaskManager) -> None:
        manager.create_task("000001", "平安银行", "test prompt")
        task2 = manager.create_task("000002", "工商银行", "test prompt 2")
        assert task2 is None
        assert manager.is_busy() is True

    def test_task_id_format(self, manager: TaskManager) -> None:
        task = manager.create_task("000001", "平安银行", "test prompt")
        assert task["task_id"].startswith("task_000001_")


class TestStateTransitions:
    def test_valid_transition(self, manager: TaskManager) -> None:
        manager.create_task("000001", "平安银行", "test prompt")
        result = manager.transition(TaskState.DS_PAGE_CHECKING)
        assert result is True
        assert manager.state == TaskState.DS_PAGE_CHECKING

    def test_invalid_transition(self, manager: TaskManager) -> None:
        manager.create_task("000001", "平安银行", "test prompt")
        result = manager.transition(TaskState.COMPLETED)
        assert result is False
        assert manager.state == TaskState.TASK_RECEIVED

    def test_all_valid_transitions_exist(self) -> None:
        for state in [
            TaskState.IDLE,
            TaskState.TASK_RECEIVED,
            TaskState.DS_PAGE_CHECKING,
            TaskState.DS_PAGE_READY,
            TaskState.INPUTTING_PROMPT,
            TaskState.PROMPT_SENT,
            TaskState.WAITING_RESPONSE,
            TaskState.RESPONSE_DONE,
            TaskState.RESULT_EXTRACTED,
            TaskState.RESULT_RETURNED_TO_SERVER,
            TaskState.FEISHU_PUSHING,
        ]:
            assert state in VALID_TRANSITIONS


class TestCompleteTask:
    def test_complete_task(self, manager: TaskManager) -> None:
        manager.create_task("000001", "平安银行", "test prompt")
        manager.complete_task("analysis result", "success")
        assert manager.state == TaskState.IDLE
        assert manager.is_busy() is False
        assert manager.current_task is None
        assert manager.last_task is not None
        assert manager.last_task["status"] == TaskState.COMPLETED
        assert manager.last_task["analysis_result"] == "analysis result"
        assert manager.last_task["feishu_push_status"] == "success"
        assert manager.last_task["finished_at"] is not None


class TestFailTask:
    def test_fail_task(self, manager: TaskManager) -> None:
        manager.create_task("000001", "平安银行", "test prompt")
        manager.fail_task("DS_PAGE_NOT_FOUND", "DeepSeek page not found")
        assert manager.state == TaskState.IDLE
        assert manager.is_busy() is False
        assert manager.last_task is not None
        assert manager.last_task["status"] == TaskState.FAILED
        assert manager.last_task["last_error"]["code"] == "DS_PAGE_NOT_FOUND"


class TestPushFailed:
    def test_push_failed(self, manager: TaskManager) -> None:
        manager.create_task("000001", "平安银行", "test prompt")
        manager.push_failed("analysis result", "FEISHU_PUSH_FAILED", "Webhook error")
        assert manager.state == TaskState.IDLE
        assert manager.last_task["status"] == TaskState.ANALYSIS_SUCCESS_PUSH_FAILED
        assert manager.last_task["analysis_result"] == "analysis result"
        assert manager.last_task["feishu_push_status"] == "failed"


class TestOnDisconnect:
    def test_disconnect_fails_current_task(self, manager: TaskManager) -> None:
        manager.create_task("000001", "平安银行", "test prompt")
        manager.on_disconnect()
        assert manager.state == TaskState.IDLE
        assert manager.last_task["status"] == TaskState.FAILED
        assert manager.last_task["last_error"]["code"] == "WS_DISCONNECTED"

    def test_disconnect_when_idle_does_nothing(self, manager: TaskManager) -> None:
        manager.on_disconnect()
        assert manager.state == TaskState.IDLE
        assert manager.last_task is None
