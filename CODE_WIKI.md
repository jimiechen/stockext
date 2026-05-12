# StockExt 项目代码库 Wiki

## 1. 仓库概览

StockExt 是一个将通达信本地行情数据、DeepSeek 网页端 AI 分析和飞书推送集成的 MVP 项目。它通过浏览器插件操作 DeepSeek 网页端，无需直接调用 API，实现了自动化的行情分析和结果推送功能。

### 主要功能
- **本地 FastAPI 服务**：提供 HTTP 接口和 WebSocket 通信
- **浏览器插件**：操作 DeepSeek 网页端，自动输入 Prompt、发送并提取分析结果
- **WebSocket 双向通信**：实现本地服务与浏览器插件的实时交互
- **单任务锁机制**：确保任务串行执行，避免并发冲突
- **状态管理**：完善的任务状态机和插件状态上报
- **飞书推送**：将分析结果推送到飞书群聊

### 典型应用场景
- 自动化股票行情分析和预警
- 无需 API 接入的 AI 服务调用
- 自定义 Prompt 批量处理和结果收集

---

## 2. 目录结构

项目采用清晰的双模块架构设计，分为浏览器插件和本地 FastAPI 服务两个独立部分，通过 WebSocket 通信。插件负责与 DeepSeek 网页端交互，服务端负责任务管理和外部集成。

```text
/workspace
├── docs/                # 项目文档和规划
│   └── tabbit/         # 产品需求文档和开发计划
├── extension/          # 浏览器插件模块（Chrome/Edge 扩展）
│   ├── tests/         # 插件测试用例
│   │   ├── integration/
│   │   └── unit/
│   ├── utils/         # 工具函数（协议、状态、日志）
│   ├── background.js  # 后台服务工作者
│   ├── content.js     # 页面注入脚本
│   └── manifest.json  # 插件配置文件
├── local_service/      # 本地 Python 服务（FastAPI）
│   ├── api/           # API 路由和 WebSocket
│   ├── core/          # 核心配置
│   ├── services/      # 业务逻辑服务
│   ├── tests/         # 服务端测试
│   ├── app.py         # FastAPI 应用工厂
│   └── main.py        # 服务入口
├── package.json       # Node 项目配置
└── jest.config.js     # Jest 测试配置
```

### 核心目录职责说明

| 模块 | 主要职责 | 文件位置 | 核心文件 |
|------|---------|---------|---------|
| 本地服务 | FastAPI Web 服务、任务管理、通信 | local_service/ | app.py, main.py, services/task_manager.py |
| 插件后台 | WebSocket 连接、任务转发、状态管理 | extension/ | background.js, utils/state.js |
| 插件内容脚本 | DeepSeek 页面操作、Prompt 输入、结果提取 | extension/ | content.js |
| 通信协议 | WebSocket 消息格式定义和解析 | extension/utils/ | protocol.js |

---

## 3. 系统架构与主流程

### 3.1 整体架构

项目采用三层架构设计：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           用户层                                         │
│                    (手动触发 HTTP 请求)                                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                      本地 FastAPI 服务层                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  • HTTP 接口: /health, /tasks/analyze, /tasks/latest             │   │
│  │  • WebSocket: /ws/plugin (插件通信)                              │   │
│  │  • 任务管理器 (TaskManager) - 单任务锁、状态机                    │   │
│  │  • 行情数据获取 / Prompt 生成                                     │   │
│  │  • 飞书推送                                                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ WebSocket
┌────────────────────────────────────▼────────────────────────────────────┐
│                       浏览器插件层                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Background Script (后台工作者)                                    │   │
│  │  - WebSocket 连接管理                                              │   │
│  │  - 任务转发给 Content Script                                       │   │
│  │  - 状态上报                                                        │   │
│  └─────────────────────────┬────────────────────────────────────────┘   │
│                            │ Chrome Messaging                          │
│  ┌─────────────────────────▼────────────────────────────────────────┐   │
│  │  Content Script (注入 DeepSeek 页面)                              │   │
│  │  - 页面状态检测                                                    │   │
│  │  - Prompt 输入                                                    │   │
│  │  - 发送和等待回复                                                  │   │
│  │  - 结果提取                                                        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ DOM 操作
┌────────────────────────────────────▼────────────────────────────────────┐
│                    DeepSeek 网页端 (外部服务)                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 主流程

#### 任务执行流程

```
1. 用户触发 HTTP 请求 (POST /tasks/analyze)
   ↓
2. TaskManager 检查是否有任务在执行
   ├─ 有任务 → 返回 TASK_BUSY
   └─ 无任务 → 创建新任务，状态 TASK_RECEIVED
   ↓
3. 通过 WebSocket 发送 ANALYZE_REQUEST 给插件
   ↓
4. 插件 Background Script 接收请求
   ↓
5. 查找 DeepSeek 页面并检测 Content Script 可用性
   ↓
6. Content Script 检查页面状态
   ├─ 页面不可用 → 返回错误
   └─ 页面就绪 → 继续
   ↓
7. Content Script 输入 Prompt 并点击发送
   ↓
8. 等待 DeepSeek 回复 (文本稳定检测 + 超时机制)
   ↓
9. 提取结果并通过 ANALYZE_RESPONSE 返回
   ↓
10. 本地服务接收结果，推送到飞书
    ↓
11. 任务完成，状态变为 COMPLETED 或 ANALYSIS_SUCCESS_PUSH_FAILED
```

### 3.3 状态机设计

#### 任务状态流转

```
IDLE
  ↓
TASK_RECEIVED
  ↓
DS_PAGE_CHECKING
  ↓
DS_PAGE_READY
  ↓
INPUTTING_PROMPT
  ↓
PROMPT_SENT
  ↓
WAITING_RESPONSE
  ↓
RESPONSE_DONE
  ↓
RESULT_EXTRACTED
  ↓
RESULT_RETURNED_TO_SERVER
  ↓
FEISHU_PUSHING
  ↓
COMPLETED / ANALYSIS_SUCCESS_PUSH_FAILED
  ↓
IDLE

(任何状态都可能跳转到 FAILED)
```

---

## 4. 核心功能模块

### 4.1 本地服务 - 任务管理模块

**功能说明**：负责任务生命周期管理、单任务锁、状态流转控制。

**主要职责**：
- 创建和追踪任务
- 维护任务状态机
- 防止并发任务冲突
- 记录最近任务状态

**核心文件**：[local_service/services/task_manager.py](file:///workspace/local_service/services/task_manager.py)

**关键类与方法**：
- `TaskManager`：核心任务管理器
  - `create_task(stock_code, stock_name, prompt)` - 创建新任务
  - `transition(new_state)` - 状态转换
  - `complete_task(result, feishu_status)` - 任务完成
  - `fail_task(error_code, error_message)` - 任务失败
  - `is_busy()` - 检查是否有任务在执行

### 4.2 浏览器插件 - 后台工作者

**功能说明**：管理 WebSocket 连接，转发任务，上报插件状态。

**主要职责**：
- 连接本地 WebSocket 服务
- 自动重连机制
- 心跳 PONG 响应
- 接收并转发分析任务给 Content Script
- 返回结果给本地服务

**核心文件**：[extension/background.js](file:///workspace/extension/background.js)

**关键函数**：
- `connect()` - 连接 WebSocket
- `handleAnalyzeRequest(msg)` - 处理分析请求
- `scheduleReconnect()` - 调度重连

### 4.3 浏览器插件 - 内容脚本

**功能说明**：注入 DeepSeek 页面，执行 DOM 操作、Prompt 输入、回复等待和结果提取。

**主要职责**：
- 页面就绪检测和登录状态判断
- Prompt 输入和发送
- 智能等待 DeepSeek 回复（文本稳定 + 超时）
- 结果提取和错误处理

**核心文件**：[extension/content.js](file:///workspace/extension/content.js)

**关键函数**：
- `checkPageStatus()` - 检测页面状态
- `inputPrompt(prompt)` - 输入 Prompt
- `clickSend()` - 点击发送按钮
- `waitForResponse(options)` - 等待回复（核心算法）
- `extractResult()` - 提取结果
- `executeTask(task)` - 执行完整任务

### 4.4 通信协议模块

**功能说明**：定义 WebSocket 消息格式，提供消息构建和解析工具。

**主要职责**：
- 统一消息结构定义
- 消息类型枚举
- 消息构建辅助函数
- JSON 解析和错误处理

**核心文件**：[extension/utils/protocol.js](file:///workspace/extension/utils/protocol.js)

**消息类型**：
- `PLUGIN_CONNECTED` - 插件连接成功
- `PING` / `PONG` - 心跳
- `STATUS_REPORT` - 状态上报
- `ANALYZE_REQUEST` - 分析请求
- `ANALYZE_PROGRESS` - 任务进度
- `ANALYZE_RESPONSE` - 分析结果
- `ERROR` - 错误信息

---

## 5. 核心 API/类/函数

### 5.1 本地服务 - TaskManager 类

**类名**：`TaskManager`  
**文件**：[local_service/services/task_manager.py](file:///workspace/local_service/services/task_manager.py#L88-L206)  
**作用**：管理任务的完整生命周期

**主要方法**：

| 方法 | 说明 | 参数 | 返回值 |
|------|------|------|--------|
| `create_task(stock_code, stock_name, prompt)` | 创建新任务（单任务锁） | 股票代码, 股票名称, Prompt | 任务对象 或 None（忙） |
| `transition(new_state)` | 执行状态转换 | 新状态 | boolean（成功/失败） |
| `complete_task(result, feishu_status)` | 标记任务完成 | 分析结果, 飞书状态 | - |
| `fail_task(error_code, error_message)` | 标记任务失败 | 错误码, 错误信息 | - |
| `is_busy()` | 检查是否有任务在执行 | - | boolean |

### 5.2 Content Script - waitForResponse 函数

**函数名**：`waitForResponse(options)`  
**文件**：[extension/content.js](file:///workspace/extension/content.js#L186-L237)  
**作用**：智能等待 DeepSeek 回复完成

**参数**：
- `maxWaitMs` (可选) - 最大等待毫秒数（默认 180000）
- `stableMs` (可选) - 文本稳定时间（默认 5000）
- `minLength` (可选) - 最小有效回复长度（默认 20）

**返回值**：
```javascript
{
  success: boolean,      // 是否成功
  result?: string,       // 分析结果
  error?: string,        // 错误码
  durationMs: number     // 耗时
}
```

**算法逻辑**：
1. 轮询检查最后一条 AI 消息
2. 检测停止按钮是否消失
3. 验证文本是否稳定 5 秒
4. 检查文本长度是否满足最小要求
5. 超时（180秒）返回错误

### 5.3 Background Script - handleAnalyzeRequest 函数

**函数名**：`handleAnalyzeRequest(msg)`  
**文件**：[extension/background.js](file:///workspace/extension/background.js#L137-L198)  
**作用**：处理来自本地服务的分析请求

**参数**：`msg` - WebSocket 消息对象

**流程**：
1. 查找 DeepSeek 页面
2. 检测 Content Script 是否就绪（PING_CONTENT）
3. 检查页面状态（CHECK_PAGE_STATUS）
4. 转发任务给 Content Script
5. 转发结果或错误回本地服务

### 5.4 协议工具 - protocol 模块

**文件**：[extension/utils/protocol.js](file:///workspace/extension/utils/protocol.js)

**核心函数**：

| 函数 | 说明 |
|------|------|
| `pluginConnected(info)` | 构建插件连接消息 |
| `ping()` / `pong()` | 构建心跳消息 |
| `analyzeRequest(requestId, taskId, payload)` | 构建分析请求 |
| `analyzeResponse(requestId, taskId, payload)` | 构建分析响应 |
| `error(requestId, taskId, code, message, retryable)` | 构建错误消息 |
| `parse(raw)` | 解析 JSON 消息 |

### 5.5 插件状态管理 - StateManager 类

**类名**：`StateManager`  
**文件**：[extension/utils/state.js](file:///workspace/extension/utils/state.js#L14-L51)  
**作用**：管理插件 WebSocket 连接状态

**状态**：
- `WS_DISCONNECTED` - 未连接
- `WS_CONNECTING` - 连接中
- `WS_CONNECTED` - 已连接

**主要方法**：
- `transition(newState)` - 状态转换
- `onTransition(fn)` - 注册状态变化监听

---

## 6. 技术栈与依赖

| 类别 | 技术/库 | 版本 | 用途 | 来源 |
|------|---------|------|------|------|
| 后端语言 | Python | 3.x+ | 本地服务开发 | [requirements.txt](file:///workspace/local_service/requirements.txt) |
| Web 框架 | FastAPI | >= 0.110.0 | HTTP API 和 WebSocket | [requirements.txt](file:///workspace/local_service/requirements.txt) |
| ASGI 服务器 | uvicorn | >= 0.29.0 | 运行 FastAPI 服务 | [requirements.txt](file:///workspace/local_service/requirements.txt) |
| 浏览器扩展 | Chrome Extension | Manifest V3 | 浏览器插件 | [manifest.json](file:///workspace/extension/manifest.json) |
| 测试框架 (JS) | Jest | ^30.4.2 | 插件单元测试 | [package.json](file:///workspace/package.json) |
| 测试环境 (JS) | jsdom | ^26.1.0 | DOM 模拟 | [package.json](file:///workspace/package.json) |
| 测试框架 (Python) | pytest | >= 8.0.0 | 服务端单元测试 | [requirements.txt](file:///workspace/local_service/requirements.txt) |
| WebSocket 库 | ws | ^8.20.0 | 插件测试 WebSocket | [package.json](file:///workspace/package.json) |

---

## 7. 关键模块与典型用例

### 7.1 启动本地服务

**功能说明**：启动 FastAPI 本地服务，监听 127.0.0.1:8765

**配置与依赖**：
- 配置文件：[local_service/core/config.py](file:///workspace/local_service/core/config.py)
- 依赖：`pip install -r local_service/requirements.txt`

**使用示例**：

```python
# 方式一：直接运行
python local_service/main.py

# 方式二：使用 uvicorn
uvicorn local_service.app:app --host 127.0.0.1 --port 8765
```

**接口说明**：
- `GET /health` - 健康检查
- `POST /tasks/analyze` - 触发分析任务
- `GET /tasks/latest` - 获取最近任务状态
- `WS /ws/plugin` - 插件 WebSocket 通信

### 7.2 安装与运行浏览器插件

**功能说明**：加载浏览器插件并连接本地服务

**安装步骤**：
1. 打开 Chrome/Edge 扩展管理页面
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 [extension/](file:///workspace/extension) 目录
5. 打开 [https://chat.deepseek.com/](https://chat.deepseek.com/) 并登录

**配置文件**：[extension/config.json](file:///workspace/extension/config.json) - 配置 WS_TOKEN

### 7.3 触发分析任务

**功能说明**：通过 HTTP 接口手动触发分析任务

**使用示例**：

```bash
# 触发分析任务
curl -X POST http://127.0.0.1:8765/tasks/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "stock_code": "000001",
    "stock_name": "平安银行",
    "use_mock_data": true
  }'

# 查询最近任务状态
curl http://127.0.0.1:8765/tasks/latest
```

---

## 8. 配置、部署与开发

### 8.1 本地服务配置

**配置文件**：[local_service/core/config.py](file:///workspace/local_service/core/config.py)

```python
HOST: str = "127.0.0.1"     # 仅本地监听，禁止 0.0.0.0
PORT: int = 8765            # 服务端口
WS_PATH: str = "/ws/plugin" # WebSocket 路径
WS_TOKEN: str = ""          # WebSocket 鉴权令牌
```

### 8.2 插件配置

**配置文件**：[extension/config.json](file:///workspace/extension/config.json)

```json
{
  "WS_TOKEN": "your_token_here"
}
```

### 8.3 测试

**运行插件测试**：
```bash
npm test
```

**运行服务端测试**：
```bash
cd local_service
pytest tests/
```

---

## 9. 监控与维护

### 9.1 常见错误码

| 错误码 | 说明 | 触发方 |
|--------|------|--------|
| `PLUGIN_NOT_CONNECTED` | 插件未连接 | 本地服务 |
| `TASK_BUSY` | 任务执行中 | 本地服务 |
| `WS_AUTH_FAILED` | Token 验证失败 | 本地服务 |
| `DS_PAGE_NOT_FOUND` | 未找到 DeepSeek 页面 | 插件 |
| `DS_NOT_LOGIN` | DeepSeek 未登录 | 插件 |
| `DS_PAGE_NOT_READY` | 页面未就绪 | 插件 |
| `CONTENT_SCRIPT_NOT_READY` | Content Script 未响应 | 插件 |
| `DS_INPUT_NOT_FOUND` | 未找到输入框 | 插件 |
| `DS_SEND_FAILED` | 发送失败 | 插件 |
| `DS_RESPONSE_TIMEOUT` | 等待回复超时 | 插件 |
| `DS_RESPONSE_EMPTY` | 回复为空 | 插件 |
| `FEISHU_PUSH_FAILED` | 飞书推送失败 | 本地服务 |

### 9.2 DeepSeek 页面变化处理

当 DeepSeek 页面 DOM 结构变化时，需要更新选择器：

**位置**：[extension/content.js](file:///workspace/extension/content.js) 中的 `SELECTORS` 对象

**策略**：提供多个备选选择器，按优先级尝试

---

## 10. 总结与亮点回顾

StockExt 项目通过创新性的浏览器插件方案，成功绕过了 API 限制，实现了 DeepSeek 网页端的自动化操作。项目设计亮点包括：

1. **插件架构**：利用浏览器插件实现对目标网页的操作，无需 API
2. **状态机设计**：完善的任务状态管理，确保流程可控
3. **单任务锁**：避免并发任务导致的页面混乱
4. **智能等待**：文本稳定检测 + 超时机制，平衡响应速度和可靠性
5. **容错设计**：清晰的错误码定义和状态可见性
6. **可测试性**：完善的单元测试和集成测试框架

该项目为类似场景提供了可借鉴的架构思路，特别适合需要与现有 Web 产品集成的自动化场景。
