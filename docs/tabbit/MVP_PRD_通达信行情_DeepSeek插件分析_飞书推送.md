# MVP 产品需求文档（PRD）

## 通达信本地行情 + DeepSeek 网页端插件分析 + 飞书群聊推送系统

| 属性 | 内容 |
|---|---|
| 文档版本 | MVP V0.2（评审修订版） |
| 日期 | 2026年5月11日 |
| 状态 | 评审通过，可进入 P0/MVP 开发 |
| 产品目标 | 先跑通端到端主流程，验证浏览器插件操作 DeepSeek 网页端的可行性 |
| 技术方案 | Python FastAPI + WebSocket + 浏览器插件 + DeepSeek 网页端 + 飞书机器人 |
| 明确排除 | 不调用 DeepSeek API，不使用 Selenium / Playwright，不使用 Native Messaging |

---

## 1. 文档概述

### 1.1 文档目的

本文档用于定义"通达信本地行情 + DeepSeek 网页端插件分析 + 飞书群聊推送系统"的 MVP 阶段需求。

MVP 阶段的目标不是完成完整产品，而是验证核心技术链路是否可行，包括本地 Python 服务、浏览器插件、DeepSeek 网页端交互和飞书推送之间的最小闭环。

### 1.2 MVP 核心验证目标

MVP 阶段需要验证以下问题：

1. 本地 Python 服务是否可以稳定启动 FastAPI 服务；
2. 浏览器插件是否可以通过 WebSocket 连接本地 Python 服务；
3. Python 服务是否可以向插件下发分析任务；
4. 插件是否可以在 DeepSeek 网页端输入 Prompt 并发送；
5. 插件是否可以等待 DeepSeek 回复完成并提取结果；
6. 插件是否可以把结果通过 WebSocket 返回给本地 Python 服务；
7. Python 服务是否可以将分析结果推送到飞书群聊。

### 1.3 MVP 不解决的问题

MVP 阶段不做以下内容：

| 不做内容 | 原因 |
|---|---|
| 多股票批量并发分析 | 会增加队列、并发和页面状态管理复杂度 |
| 完整任务调度系统 | MVP 通过 HTTP 接口手动触发 |
| 复杂飞书交互式卡片 | 先使用文本消息验证推送链路 |
| 多浏览器适配 | 优先支持 Chrome 或 Edge 一种浏览器 |
| 多 DeepSeek 会话管理 | 先复用当前已登录页面 |
| 自动登录 DeepSeek | 登录由用户手动完成 |
| Native Messaging | 本方案使用 FastAPI + WebSocket |
| Selenium / Playwright | 本方案通过浏览器插件操作网页端 |
| DeepSeek API | 本方案不调用 API，只操作网页端 |

### 1.4 评审修订说明

本版（V0.2）基于评审意见修订，主要变更：

| 变更项 | 说明 |
|---|---|
| 新增任务触发接口 | 增加 `POST /tasks/analyze` 和 `GET /tasks/latest` |
| 新增单任务锁机制 | 增加 `TASK_BUSY` 状态，拒绝并发任务 |
| 新增插件状态上报 | 增加 `STATUS_REPORT` 消息 |
| 量化回复完成判断 | 明确 5 秒文本稳定、180 秒最大超时、最小 20 字符 |
| 明确飞书失败处理 | 区分分析成功与推送失败，保留分析结果 |
| 增加重复执行验收 | 连续 5 次执行成功不少于 4 次 |
| 明确 token 鉴权规则 | token 存储、校验、日志脱敏 |
| 增加 DOM 选择器管理 | 选择器集中配置，便于修改 |
| 明确 mock 行情策略 | 第一阶段 mock，第二阶段接真实行情 |
| 调整开发顺序 | 按 P0-1 到 P0-5 五步推进 |

---

## 2. 项目背景与目标

### 2.1 项目背景

用户希望构建一个本地行情分析与自动推送系统。系统从通达信或本地行情数据源获取股票行情，将行情数据组织成 Prompt，交由 DeepSeek 网页端进行分析，并将分析结果自动推送到飞书群聊。

由于用户明确要求不调用 DeepSeek API，因此系统采用浏览器插件方案。浏览器插件复用用户已经登录的 DeepSeek 网页会话，通过 Content Script 操作网页 DOM，完成 Prompt 输入、发送、等待回复和结果提取。

本地 Python 服务负责行情获取、任务生成、插件通信、结果接收和飞书推送。

### 2.2 MVP 产品目标

MVP 阶段的产品目标是：

> 用最小功能集合跑通"行情数据 → DeepSeek 网页分析 → 飞书推送"的完整链路，并验证浏览器插件操作 DeepSeek 网页端的稳定性。

### 2.3 MVP 成功标准

MVP 成功的判断标准是：

| 指标 | MVP 标准 |
|---|---|
| 本地服务启动 | FastAPI 服务可正常启动 |
| 插件连接 | 插件可成功连接本地 WebSocket |
| 任务下发 | Python 服务可向插件下发分析任务 |
| DeepSeek 操作 | 插件可在 DeepSeek 页面输入并发送 Prompt |
| 结果提取 | 插件可提取 DeepSeek 最终回复 |
| 结果回传 | 插件可通过 WebSocket 返回分析结果 |
| 飞书推送 | Python 服务可将分析结果推送到飞书群 |
| 单次任务成功率 | MVP 测试环境下 ≥ 80% |
| 连续执行稳定性 | 连续执行 5 次，成功次数不少于 4 次 |
| 单次任务耗时 | 默认不超过 180 秒 |
| 失败可见性 | 失败时能返回明确错误信息 |

---

## 3. MVP 系统架构

### 3.1 总体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MVP 系统架构                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────┐       WebSocket        ┌──────────────┐  │
│  │ 本地 Python 服务        │ ◄───────────────────► │ 浏览器插件     │  │
│  │ FastAPI                │                       │ Background   │  │
│  │                        │                       │ Script       │  │
│  │ • /health              │                       └──────┬───────┘  │
│  │ • /tasks/analyze       │                              │          │
│  │ • /tasks/latest        │                              ▼          │
│  │ • /ws/plugin           │                       ┌──────────────┐  │
│  │ • 行情数据获取          │                       │ Content      │  │
│  │ • Prompt 生成           │                       │ Script       │  │
│  │ • 结果接收              │                       └──────┬───────┘  │
│  │ • 飞书推送              │                              │          │
│  └────────────────────────┘                              ▼          │
│                                                     ┌──────────────┐  │
│                                                     │ DeepSeek     │  │
│                                                     │ 网页端        │  │
│                                                     └──────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 模块职责

| 模块 | MVP 职责 |
|---|---|
| 本地 Python FastAPI 服务 | 启动本地服务、提供 HTTP 接口、生成分析任务、下发任务、接收结果、推送飞书 |
| WebSocket 通道 | 实现本地服务与浏览器插件之间的双向通信 |
| 浏览器插件 Background Script | 连接本地 WebSocket、接收任务、转发任务给 Content Script、回传结果、上报状态 |
| 浏览器插件 Content Script | 注入 DeepSeek 页面，执行输入、发送、等待、提取结果 |
| DeepSeek 网页端 | 由用户手动登录，提供模型分析能力 |
| 飞书机器人 | 接收 Python 服务推送的分析结果 |

### 3.3 架构约束

MVP 阶段必须遵守以下约束：

1. 不调用 DeepSeek API；
2. 不使用 Selenium；
3. 不使用 Playwright；
4. 不使用 Native Messaging；
5. 不实现自动登录 DeepSeek；
6. 插件只操作用户已打开且已登录的 DeepSeek 网页；
7. 本地 FastAPI 服务仅监听 `127.0.0.1`，禁止监听 `0.0.0.0`；
8. WebSocket 通信仅限本机浏览器插件与本地服务之间使用。

---

## 4. MVP 用户流程

### 4.1 启动流程

**第一步：启动本地 Python 服务**

```bash
python main.py
```

或：

```bash
uvicorn main:app --host 127.0.0.1 --port 8765
```

启动成功后输出：

```
FastAPI service started.
Health check: http://127.0.0.1:8765/health
Plugin WebSocket: ws://127.0.0.1:8765/ws/plugin?token={LOCAL_WS_TOKEN}
```

**第二步：启用浏览器插件**

1. 打开 Chrome 或 Edge 扩展管理页面；
2. 开启开发者模式；
3. 选择"加载已解压的扩展程序"；
4. 选择插件目录；
5. 确认插件已启用。

**第三步：打开 DeepSeek 网页端**

用户手动打开 `https://chat.deepseek.com/` 并登录。插件自动检测页面状态。

**第四步：确认连接**

插件 Background Script 启动后，主动连接本地 WebSocket 服务（地址含鉴权 token：`ws://127.0.0.1:8765/ws/plugin?token={WS_TOKEN}`，其中 `{WS_TOKEN}` 为配置文件中 `WS_TOKEN` 的值）。连接成功后，插件发送 `PLUGIN_CONNECTED` 消息。用户通过 Popup 确认状态为"已连接"。

### 4.2 分析流程（手动触发）

MVP 阶段通过 HTTP 接口手动触发任务，服务启动后不自动执行。

```
1. 用户通过 HTTP 接口或 curl 触发分析任务
2. Python 服务获取一只股票的行情数据（mock 或真实）
3. Python 服务根据行情数据生成 Prompt
4. Python 服务通过 WebSocket 向插件发送 ANALYZE_REQUEST
5. 插件 Background Script 收到任务
6. Background Script 转发任务给 DeepSeek 页面中的 Content Script
7. Content Script 检查 DeepSeek 页面是否可用
8. Content Script 将 Prompt 输入到 DeepSeek 输入框
9. Content Script 点击发送按钮
10. Content Script 等待 DeepSeek 回复完成（5 秒文本稳定判定）
11. Content Script 提取最后一条 AI 回复内容
12. 插件通过 WebSocket 返回 ANALYZE_RESPONSE
13. Python 服务接收分析结果
14. Python 服务将结果格式化为飞书文本消息
15. Python 服务推送到飞书群聊
```

### 4.3 异常流程

MVP 阶段需要覆盖以下基础异常：

| 异常场景 | MVP 处理方式 |
|---|---|
| 插件未连接 | 返回 `PLUGIN_NOT_CONNECTED`，提示启动插件 |
| 任务执行中重复触发 | 返回 `TASK_BUSY`，拒绝新任务 |
| DeepSeek 页面未打开 | 插件返回 `DS_PAGE_NOT_FOUND` |
| DeepSeek 未登录 | 插件返回 `DS_NOT_LOGIN` |
| 找不到输入框 | 插件返回 `DS_INPUT_NOT_FOUND` |
| 发送失败 | 插件返回 `DS_SEND_FAILED` |
| 等待回复超时 | 插件返回 `DS_RESPONSE_TIMEOUT` |
| 回复内容为空 | 插件返回 `DS_RESPONSE_EMPTY` |
| Content Script 未响应 | 插件返回 `CONTENT_SCRIPT_NOT_READY` |
| 飞书推送失败 | 本地保留分析结果，返回 `ANALYSIS_SUCCESS_PUSH_FAILED` |

MVP 阶段不要求复杂自动恢复，但必须能清晰显示失败原因，方便下一阶段优化。

---

## 5. MVP 功能需求

### 5.1 本地 Python 服务

#### 5.1.1 服务启动

本地 Python 服务基于 FastAPI 实现，启动后监听本地地址：

```
127.0.0.1:8765
```

服务启动成功后，控制台输出服务状态、WebSocket 地址和当前配置。

#### 5.1.2 HTTP 接口

MVP 阶段提供以下 HTTP 接口：

**健康检查接口**

| 接口 | 方法 | 说明 |
|---|---|---|
| `/health` | GET | 检查本地服务是否正常运行 |

返回示例：

```json
{
  "status": "ok",
  "service": "tdx-deepseek-feishu-mvp",
  "version": "0.2.0"
}
```

**手动触发分析接口（评审新增）**

| 接口 | 方法 | 说明 |
|---|---|---|
| `/tasks/analyze` | POST | 手动触发一次分析任务 |
| `/tasks/latest` | GET | 查看最近一次任务状态 |

`POST /tasks/analyze` 请求体：

```json
{
  "stock_code": "000001",
  "stock_name": "平安银行",
  "use_mock_data": true
}
```

成功返回：

```json
{
  "status": "accepted",
  "task_id": "task_000001_20260511_184847",
  "message": "分析任务已创建"
}
```

插件未连接时返回：

```json
{
  "status": "failed",
  "code": "PLUGIN_NOT_CONNECTED",
  "message": "浏览器插件未连接，请先启动插件并打开 DeepSeek 页面"
}
```

任务执行中时返回：

```json
{
  "status": "failed",
  "code": "TASK_BUSY",
  "message": "当前已有任务执行中，MVP 阶段不支持并发任务"
}
```

`GET /tasks/latest` 返回示例：

**场景一：任务成功完成**

```json
{
  "task_id": "task_000001_20260511_184847",
  "status": "COMPLETED",
  "stock_code": "000001",
  "stock_name": "平安银行",
  "started_at": "2026-05-11T18:48:47",
  "finished_at": "2026-05-11T18:50:15",
  "duration_seconds": 88,
  "analysis_result": "【走势简述】\n该股票短线表现较活跃...\n【短线关注点】\n...\n【风险提示】\n...\n【一句话结论】\n...",
  "feishu_push_status": "success",
  "last_error": null
}
```

**场景二：分析成功但飞书推送失败**

```json
{
  "task_id": "task_000002_20260511_185200",
  "status": "ANALYSIS_SUCCESS_PUSH_FAILED",
  "stock_code": "000001",
  "stock_name": "平安银行",
  "started_at": "2026-05-11T18:52:00",
  "finished_at": "2026-05-11T18:53:30",
  "duration_seconds": 90,
  "analysis_result": "【走势简述】\n该股票短线表现较活跃...\n【短线关注点】\n...\n【风险提示】\n...\n【一句话结论】\n...",
  "feishu_push_status": "failed",
  "last_error": "FEISHU_PUSH_FAILED: 飞书 Webhook 返回 HTTP 500"
}
```

**场景三：任务失败**

```json
{
  "task_id": "task_000003_20260511_190000",
  "status": "FAILED",
  "stock_code": "000001",
  "stock_name": "平安银行",
  "started_at": "2026-05-11T19:00:00",
  "finished_at": "2026-05-11T19:03:00",
  "duration_seconds": 180,
  "analysis_result": null,
  "feishu_push_status": null,
  "last_error": "DS_RESPONSE_TIMEOUT: 等待 DeepSeek 回复超时（180秒）"
}
```

**场景四：无历史任务**

```json
{
  "task_id": null,
  "status": null,
  "message": "暂无历史任务"
}
```

#### 5.1.3 WebSocket 插件接口

本地服务提供 WebSocket 接口：

```
/ws/plugin
```

完整地址（含鉴权 token）：

```
ws://127.0.0.1:8765/ws/plugin?token={LOCAL_WS_TOKEN}
```

其中 `{LOCAL_WS_TOKEN}` 为配置文件中 `WS_TOKEN` 的值，插件连接时必须携带正确的 token，否则服务端拒绝连接并返回 `WS_AUTH_FAILED`。

该接口用于接收插件连接、下发分析任务、接收插件进度、接收最终结果和接收错误消息。

#### 5.1.4 行情数据获取（mock 优先策略）

MVP 联调分为两个阶段：

| 阶段 | 数据源 | 说明 |
|---|---|---|
| 第一阶段 | mock 数据 | 固定行情数据，验证完整链路 |
| 第二阶段 | 真实行情 | 接入通达信 tqcenter 或其他行情工具 |

**第一阶段（mock 行情）**：使用固定测试数据，重点验证插件操作 DeepSeek 的链路。

**第二阶段（真实行情）**：只有当 mock 模式跑通后，才接入真实行情数据源。

MVP 允许通过 `use_mock_data` 参数切换：

```json
{
  "stock_code": "000001",
  "stock_name": "平安银行",
  "use_mock_data": true
}
```

mock 数据示例：

```json
{
  "stock_code": "000001",
  "stock_name": "平安银行",
  "price": 12.58,
  "change_percent": 3.25,
  "volume": 125800,
  "amount": 15824000,
  "open": 12.30,
  "high": 12.80,
  "low": 12.20,
  "pre_close": 12.18,
  "timestamp": "2026-05-11 14:30:00"
}
```

#### 5.1.5 Prompt 生成

Python 服务根据行情数据生成固定模板 Prompt。

MVP Prompt 示例（评审修订，增加输出格式约束）：

```text
你是一个股票行情分析助手。请基于以下行情数据进行简要分析。

股票代码：{stock_code}
股票名称：{stock_name}
当前价格：{price}
涨跌幅：{change_percent}
成交量：{volume}
时间：{timestamp}

请严格按以下格式输出：

【走势简述】
...

【短线关注点】
...

【风险提示】
...

【一句话结论】
...

要求：
- 语言简洁
- 不要给出确定性投资建议
- 输出控制在 500 字以内
```

> 评审说明：MVP 阶段不强制 JSON 输出格式，因为网页端输出 JSON 可能不稳定，解析失败反而增加复杂度。固定文本标题更适合 MVP。

#### 5.1.6 飞书推送

MVP 阶段使用飞书机器人文本消息推送，不做交互式卡片。

飞书消息格式示例：

```text
【行情分析结果】

股票：{stock_name}（{stock_code}）
时间：{timestamp}

行情数据：
当前价格：{price}
涨跌幅：{change_percent}
成交量：{volume}

DeepSeek 分析：
{analysis_result}

提示：以上内容为模型基于行情数据生成的分析，仅供参考。
```

**飞书推送失败处理（评审新增）**：

| 场景 | 任务状态 | 分析结果处理 |
|---|---|---|
| 分析成功 + 飞书推送成功 | `COMPLETED` | 记录到最近任务接口 |
| 分析成功 + 飞书推送失败 | `ANALYSIS_SUCCESS_PUSH_FAILED` | 本地保留分析结果，可通过 `/tasks/latest` 查询 |
| 分析失败 | `FAILED` | 记录错误信息 |

> 评审说明：飞书推送失败时，分析结果必须至少在本地日志和 `/tasks/latest` 接口中保留，避免 DeepSeek 分析已完成但结果丢失。

#### 5.1.7 单任务锁机制（评审新增）

MVP 阶段只支持单任务串行。Python 服务内部维护当前任务状态：

| 场景 | 处理 |
|---|---|
| 当前无任务 | 接收新任务并执行 |
| 当前任务执行中 | 拒绝新任务，返回 `TASK_BUSY` |
| 当前任务失败 | 状态恢复为 `IDLE` |
| 当前任务成功 | 状态恢复为 `IDLE` |
| WebSocket 断开 | 当前任务标记失败，状态恢复为 `IDLE` |

---

### 5.2 浏览器插件

#### 5.2.1 插件组成

MVP 插件至少包含以下文件或模块：

| 模块 | 说明 |
|---|---|
| `manifest.json` | 插件配置 |
| `background.js` | 负责 WebSocket 连接、任务转发、状态上报 |
| `content.js` | 注入 DeepSeek 页面，操作 DOM |
| `selectors.js` | DOM 选择器集中管理 |
| `utils/protocol.js` | WebSocket 消息协议定义与构造工具 |
| `utils/state.js` | 插件状态机管理 |
| `utils/logger.js` | 插件日志工具（输出到 console 和 Background Script） |
| `popup.html` | 展示基础状态 |
| `popup.js` | 读取并展示插件状态 |

MVP 阶段可以不做 Options 配置页，服务地址使用配置文件中 `WS_TOKEN` 的值拼接：

```
ws://127.0.0.1:8765/ws/plugin?token={LOCAL_WS_TOKEN}
```

#### 5.2.2 DOM 选择器管理（评审新增）

DeepSeek 网页端 DOM 结构可能随版本更新变化。MVP 阶段选择器允许硬编码，但必须集中管理，便于后续调整。

建议在 `selectors.js` 中集中定义：

```javascript
// selectors.js - DOM 选择器集中管理
const SELECTORS = {
  // DeepSeek 页面核心元素
  inputBox: 'textarea',
  sendButton: 'button[type="submit"]',
  messageList: '.message-content',
  stopButton: '[class*="stop"]',
  newChatButton: '[class*="new-chat"]',

  // 登录状态判断
  loginButton: 'button:has-text("登录")',
  loginQRCode: '[class*="qrcode"]',
  loginPhoneInput: 'input[type="tel"]',

  // 对话区域
  chatArea: '[class*="chat"]',
  userMessage: '[class*="user-message"]',
  assistantMessage: '[class*="assistant-message"]'
};
```

选择器更新规则：

1. 发现 DeepSeek 页面更新导致选择器失效时，只需修改 `selectors.js`；
2. 可以配置多个备选选择器，按优先级尝试；
3. 选择器修改后需重新测试全部验收项。

#### 5.2.3 WebSocket 连接

插件 Background Script 启动后，主动连接本地服务。

连接成功后，发送：

```json
{
  "type": "PLUGIN_CONNECTED",
  "request_id": "req_plugin_connected",
  "task_id": null,
  "timestamp": "2026-05-11T17:20:32",
  "payload": {
    "plugin_version": "0.2.0",
    "browser": "chrome"
  }
}
```

连接断开后，插件每 3 秒尝试重连一次。

#### 5.2.4 插件状态模型（评审新增）

插件内部维护以下状态：

| 状态 | 含义 | Popup 显示 |
|---|---|---|
| `WS_DISCONNECTED` | 未连接本地服务 | 未连接 |
| `WS_CONNECTING` | 正在连接本地服务 | 连接中... |
| `WS_CONNECTED` | 已连接本地服务 | 已连接 |
| `DS_PAGE_NOT_FOUND` | 未找到 DeepSeek 页面 | 页面未找到 |
| `DS_PAGE_FOUND` | 已找到 DeepSeek 页面 | 页面已找到 |
| `DS_READY` | DeepSeek 页面可操作 | 就绪 |
| `TASK_RUNNING` | 当前有任务执行中 | 执行中 |
| `TASK_FAILED` | 最近任务失败 | 失败：{错误码} |
| `TASK_SUCCESS` | 最近任务成功 | 成功 |

#### 5.2.5 插件状态上报（评审新增）

插件定期或状态变化时，主动上报 `STATUS_REPORT` 消息。

```json
{
  "type": "STATUS_REPORT",
  "request_id": "req_status_001",
  "task_id": null,
  "timestamp": "2026-05-11T18:48:47",
  "payload": {
    "ws_status": "WS_CONNECTED",
    "deepseek_status": "DS_READY",
    "task_status": "IDLE",
    "last_error": null
  }
}
```

状态上报时机：

| 时机 | 说明 |
|---|---|
| 连接成功 | 上报 `WS_CONNECTED` |
| 连接断开 | 上报 `WS_DISCONNECTED` |
| 页面检测 | 上报 `DS_PAGE_FOUND` 或 `DS_PAGE_NOT_FOUND` |
| 任务开始 | 上报 `TASK_RUNNING` |
| 任务完成 | 上报 `TASK_SUCCESS` 或 `TASK_FAILED` |
| 定期心跳 | 每 30 秒随 PING 上报 |

> 评审说明：状态上报能显著降低联调难度。MVP 不做复杂监控，但状态可见性是必须的。

#### 5.2.6 DeepSeek 页面识别与登录判断（评审细化）

MVP 阶段页面识别和登录判断逻辑如下：

| 判断项 | MVP 判断方式 |
|---|---|
| 页面是否存在 | 通过 `chrome.tabs.query` 查询 `https://chat.deepseek.com/*` 域名页面 |
| Content Script 是否可用 | 向目标 tab 发送 `PING_CONTENT`，收到响应即认为可注入 |
| 是否已登录 | 页面中存在输入框（`textarea`）和发送按钮（`button[type="submit"]`） |
| 未登录 | 找不到输入框，且页面存在登录按钮、二维码、手机号输入等登录特征 |
| 页面不可用 | 页面存在但 Content Script 无响应或 DOM 结构不符合预期 |

判断流程：

```
1. chrome.tabs.query 查询 DeepSeek 域名
   ├── 无匹配 → DS_PAGE_NOT_FOUND
   └── 有匹配 → 发送 PING_CONTENT
       ├── 无响应 → CONTENT_SCRIPT_NOT_READY
       └── 有响应 → 检查登录状态
           ├── 找到输入框 → DS_READY
           └── 找不到输入框 → 检查登录特征
               ├── 存在登录特征 → DS_NOT_LOGIN
               └── 无登录特征 → DS_PAGE_NOT_READY
```

> 评审说明：必须把判断依据写清楚，否则"未登录""页面未打开""页面结构变化"容易混在一起，导致错误码失真。

#### 5.2.7 Prompt 输入与发送

Content Script 需要完成以下动作：

1. 定位 DeepSeek 输入框（使用 `selectors.js` 中定义的选择器）；
2. 清空输入框或确保当前输入区域为空；
3. 输入本次任务 Prompt；
4. 点击发送按钮；
5. 返回任务进度 `ANALYZE_PROGRESS`（stage: `PROMPT_SENT`）。

#### 5.2.8 响应等待与结果提取（评审量化）

Content Script 需要等待 DeepSeek 输出完成。

**量化参数**：

| 参数 | 值 | 说明 |
|---|---|---|
| 最大等待时间 | 180 秒 | 超时返回 `DS_RESPONSE_TIMEOUT` |
| 文本稳定判断时间 | 5 秒 | 连续 5 秒文本无变化视为完成 |
| 最小有效回复长度 | 20 个字符 | 低于此长度视为空结果 |
| 轮询间隔 | 1 秒 | 每秒检测一次 |
| 空结果重试次数 | 0 次 | MVP 不重试，直接报错 |

**判断逻辑**：

> Content Script 使用 MutationObserver 或定时轮询监听最后一条 AI 回复文本变化。当回复文本长度大于最小有效长度（20 字符），且连续 5 秒未发生变化时，认为回复完成。若 180 秒内未满足完成条件，则返回 `DS_RESPONSE_TIMEOUT`。若完成后文本为空或小于最小有效长度，则返回 `DS_RESPONSE_EMPTY`。

**组合判断策略**：

| 判断条件 | 说明 |
|---|---|
| 停止按钮消失 | DeepSeek 生成中会显示"停止生成"按钮，完成后消失 |
| 文本连续 5 秒稳定 | 回复内容不再变化 |
| 文本长度 ≥ 20 字符 | 避免截断或空结果 |
| 最大等待 180 秒 | 兜底超时 |

#### 5.2.9 插件 Popup

MVP Popup 页面展示基础状态：

| 展示项 | 说明 |
|---|---|
| 本地服务连接状态 | 已连接 / 未连接 / 连接中 |
| DeepSeek 页面状态 | 未找到 / 已找到 / 就绪 |
| 当前任务状态 | 空闲 / 执行中 / 成功 / 失败 |
| 最近错误信息 | 显示最近一次错误码和错误描述 |
| 最近任务耗时 | 显示最近一次任务执行时间 |

MVP 阶段 Popup 不要求复杂交互，只用于调试和确认状态。

---

## 6. WebSocket 消息协议

### 6.1 基础消息结构

所有 WebSocket 消息采用 JSON 格式。

```json
{
  "type": "MESSAGE_TYPE",
  "request_id": "req_xxx",
  "task_id": "task_xxx",
  "timestamp": "2026-05-11T17:20:32",
  "payload": {}
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | string | 是 | 消息类型 |
| `request_id` | string | 是 | 请求 ID |
| `task_id` | string/null | 否 | 任务 ID |
| `timestamp` | string | 是 | ISO 时间 |
| `payload` | object | 是 | 消息内容 |

### 6.2 MVP 消息类型

| 消息类型 | 方向 | 说明 |
|---|---|---|
| `PLUGIN_CONNECTED` | 插件 → Python 服务 | 插件连接成功 |
| `STATUS_REPORT` | 插件 → Python 服务 | 插件状态上报（评审新增） |
| `PING` | 双向 | 心跳检测 |
| `PONG` | 双向 | 心跳响应 |
| `PING_CONTENT` | Background → Content Script | 检测 Content Script 是否可用（评审新增） |
| `PONG_CONTENT` | Content Script → Background | Content Script 响应（评审新增） |
| `ANALYZE_REQUEST` | Python 服务 → 插件 | 下发分析任务 |
| `ANALYZE_PROGRESS` | 插件 → Python 服务 | 返回任务进度 |
| `ANALYZE_RESPONSE` | 插件 → Python 服务 | 返回分析结果 |
| `ERROR` | 双向 | 返回错误信息 |

### 6.3 分析任务请求

Python 服务发送：

```json
{
  "type": "ANALYZE_REQUEST",
  "request_id": "req_20260511172032001",
  "task_id": "task_000001_20260511_172032",
  "timestamp": "2026-05-11T17:20:32",
  "payload": {
    "stock_code": "000001",
    "stock_name": "平安银行",
    "prompt": "请基于以下行情数据进行简要分析……",
    "timeout_seconds": 180
  }
}
```

### 6.4 任务进度消息

插件返回：

```json
{
  "type": "ANALYZE_PROGRESS",
  "request_id": "req_20260511172032001",
  "task_id": "task_000001_20260511_172032",
  "timestamp": "2026-05-11T17:20:40",
  "payload": {
    "stage": "PROMPT_SENT",
    "message": "Prompt 已发送，正在等待 DeepSeek 回复"
  }
}
```

进度 stage 取值：

| stage | 说明 |
|---|---|
| `DS_PAGE_CHECKING` | 正在检查 DeepSeek 页面 |
| `DS_PAGE_READY` | DeepSeek 页面可用 |
| `INPUTTING_PROMPT` | 正在输入 Prompt |
| `PROMPT_SENT` | Prompt 已发送 |
| `WAITING_RESPONSE` | 等待 DeepSeek 回复 |
| `RESPONSE_DONE` | DeepSeek 回复完成 |
| `RESULT_EXTRACTED` | 结果已提取 |

### 6.5 分析结果消息

插件返回：

```json
{
  "type": "ANALYZE_RESPONSE",
  "request_id": "req_20260511172032001",
  "task_id": "task_000001_20260511_172032",
  "timestamp": "2026-05-11T17:22:00",
  "payload": {
    "status": "success",
    "result": "根据当前行情数据，该股票短线表现较活跃……",
    "duration_seconds": 88
  }
}
```

### 6.6 错误消息

插件返回：

```json
{
  "type": "ERROR",
  "request_id": "req_20260511172032001",
  "task_id": "task_000001_20260511_172032",
  "timestamp": "2026-05-11T17:23:32",
  "payload": {
    "code": "DS_RESPONSE_TIMEOUT",
    "message": "等待 DeepSeek 回复超时",
    "retryable": true
  }
}
```

---

## 7. MVP 任务状态机

### 7.1 任务状态

| 状态 | 说明 |
|---|---|
| `IDLE` | 插件空闲，可接收新任务 |
| `TASK_RECEIVED` | 插件已收到任务 |
| `DS_PAGE_CHECKING` | 正在检查 DeepSeek 页面 |
| `DS_PAGE_READY` | DeepSeek 页面可用 |
| `INPUTTING_PROMPT` | 正在输入 Prompt |
| `PROMPT_SENT` | Prompt 已发送 |
| `WAITING_RESPONSE` | 等待 DeepSeek 回复 |
| `RESPONSE_DONE` | DeepSeek 回复完成 |
| `RESULT_EXTRACTED` | 结果已提取 |
| `RESULT_RETURNED_TO_SERVER` | 结果已回传到本地服务（评审新增） |
| `FEISHU_PUSHING` | 正在推送飞书（评审新增） |
| `COMPLETED` | 任务完成（分析 + 推送均成功） |
| `ANALYSIS_SUCCESS_PUSH_FAILED` | 分析成功但飞书推送失败（评审新增） |
| `FAILED` | 任务失败 |
| `TASK_BUSY` | 当前已有任务执行中，拒绝新任务（评审新增） |

### 7.2 正常状态流转

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
COMPLETED
  ↓
IDLE
```

### 7.3 异常状态流转

**任务失败**：

```
任意状态
  ↓
FAILED
  ↓
IDLE
```

**飞书推送失败但分析成功**：

```
RESULT_RETURNED_TO_SERVER
  ↓
FEISHU_PUSHING
  ↓
ANALYSIS_SUCCESS_PUSH_FAILED
  ↓
IDLE
```

**任务执行中收到新任务**：

```
TASK_RUNNING + NEW_TASK
  ↓
TASK_BUSY（拒绝新任务，当前任务不受影响）
```

---

## 8. MVP 错误码

### 8.1 完整错误码列表

> **术语区分**：`FEISHU_PUSH_FAILED` 是飞书推送动作失败的**错误码**，表示推送调用本身出错；`ANALYSIS_SUCCESS_PUSH_FAILED` 是任务的**最终状态**，表示 DeepSeek 分析已成功完成但飞书推送失败。两者出现在不同阶段，前者是错误码，后者是状态值。

| 错误码 | 含义 | 是否可重试 | 触发方 |
|---|---|---|---|
| `PLUGIN_NOT_CONNECTED` | 插件未连接本地服务 | 是 | Python 服务 |
| `TASK_BUSY` | 当前已有任务执行中 | 否（需等待） | Python 服务 |
| `WS_AUTH_FAILED` | WebSocket token 校验失败，拒绝连接且不打印完整 token | 是（修正 token） | Python 服务 |
| `WS_DISCONNECTED` | WebSocket 连接断开 | 是 | 双向 |
| `DS_PAGE_NOT_FOUND` | 未找到 DeepSeek 页面 | 是 | 插件 |
| `DS_NOT_LOGIN` | DeepSeek 未登录 | 是 | 插件 |
| `DS_PAGE_NOT_READY` | 页面存在但核心元素不可用 | 是 | 插件 |
| `CONTENT_SCRIPT_NOT_READY` | Content Script 未响应 | 是（刷新页面） | 插件 |
| `DS_INPUT_NOT_FOUND` | 未找到输入框 | 否（页面结构变化） | 插件 |
| `DS_SEND_BUTTON_NOT_FOUND` | 未找到发送按钮 | 否（页面结构变化） | 插件 |
| `DS_SEND_FAILED` | Prompt 发送失败 | 是 | 插件 |
| `DS_RESPONSE_TIMEOUT` | 等待回复超时（180 秒） | 是 | 插件 |
| `DS_RESPONSE_EMPTY` | 回复内容为空或过短 | 是 | 插件 |
| `RESULT_EXTRACT_FAILED` | 提取结果失败 | 是 | 插件 |
| `FEISHU_PUSH_FAILED` | 飞书推送动作失败（错误码） | 是 | Python 服务 |
| `MARKET_DATA_FAILED` | 行情数据获取失败 | 是 | Python 服务 |
| `UNKNOWN_ERROR` | 未知错误 | 视情况 | 双向 |

> 注意：`ANALYSIS_SUCCESS_PUSH_FAILED` 不是错误码，而是任务最终状态（见第 7 章）。当 `FEISHU_PUSH_FAILED` 错误发生时，任务状态被标记为 `ANALYSIS_SUCCESS_PUSH_FAILED`，分析结果保留在本地。

---

## 9. MVP 配置项

MVP 阶段配置文件使用 `config.py` 或 `.env`。

| 配置项 | 示例值 | 说明 |
|---|---|---|
| `HOST` | `127.0.0.1` | 本地服务监听地址（禁止 `0.0.0.0`） |
| `PORT` | `8765` | 本地服务端口 |
| `WS_PATH` | `/ws/plugin` | WebSocket 路径 |
| `WS_TOKEN` | `mvp_local_token` | WebSocket 鉴权 token |
| `FEISHU_WEBHOOK_URL` | `https://xxx` | 飞书机器人 Webhook |
| `DEFAULT_STOCK_CODE` | `000001` | MVP 默认股票代码 |
| `DEFAULT_STOCK_NAME` | `平安银行` | MVP 默认股票名称 |
| `DEEPSEEK_TIMEOUT_SECONDS` | `180` | DeepSeek 最大等待时间 |
| `TEXT_STABLE_SECONDS` | `5` | 文本稳定判断时间 |
| `MIN_RESPONSE_LENGTH` | `20` | 最小有效回复长度（字符） |
| `POLL_INTERVAL_MS` | `1000` | 轮询间隔（毫秒） |
| `WS_RECONNECT_INTERVAL` | `3` | 插件重连间隔（秒） |
| `WS_MAX_RECONNECT` | `10` | 插件最大重连次数 |
| `LOG_LEVEL` | `INFO` | 日志级别 |

---

## 10. MVP 安全要求

### 10.1 本地服务监听限制

FastAPI 服务只能监听：

```
127.0.0.1
```

MVP 阶段不允许监听 `0.0.0.0`，避免局域网其他设备访问本地服务。

### 10.2 WebSocket 鉴权（评审细化）

MVP 阶段采用 URL 参数 token 鉴权。

| 项 | 规则 |
|---|---|
| 连接方式 | `ws://127.0.0.1:8765/ws/plugin?token={LOCAL_WS_TOKEN}` |
| token 来源 | 配置文件 `WS_TOKEN` 字段，禁止硬编码在代码中 |
| 插件侧 token | MVP 写入插件配置文件，后续放 Options 页 |
| 校验时机 | WebSocket 握手时校验 URL 参数中的 token |
| 校验失败处理 | 关闭 WebSocket 连接，返回 `WS_AUTH_FAILED`，不发送任何消息，不打印完整 token |
| token 日志 | 禁止打印完整 token，只打印前 4 位和后 4 位（如 `mvpx...oken`） |

### 10.3 插件权限最小化

插件权限应尽量收敛。MVP 阶段建议只申请：

| 权限 | 用途 |
|---|---|
| `tabs` | 查找 DeepSeek 页面 |
| `scripting` | 注入 Content Script |
| `storage` | 保存基础状态 |
| `host_permissions` | 限定到 `https://chat.deepseek.com/*` |

不建议申请 `<all_urls>`。

### 10.4 日志脱敏

日志中不得记录以下内容：

1. DeepSeek 登录 Cookie；
2. 浏览器用户隐私数据；
3. 飞书 Webhook 完整地址（只记录域名和路径）；
4. 完整鉴权 token（只记录前 4 位和后 4 位）；
5. 过长的完整 Prompt 和完整回复内容（截断到 200 字符）。

MVP 阶段可以记录任务 ID、状态、耗时和错误码。

---

## 11. MVP 部署要求

### 11.1 Python 服务部署

MVP 阶段支持本地命令行启动。

```bash
python main.py
```

或：

```bash
uvicorn main:app --host 127.0.0.1 --port 8765
```

启动成功后输出：

```
FastAPI service started.
Health check: http://127.0.0.1:8765/health
Plugin WebSocket: ws://127.0.0.1:8765/ws/plugin?token={LOCAL_WS_TOKEN}
```

### 11.2 浏览器插件安装

MVP 阶段采用开发者模式加载插件。

1. 打开 Chrome 或 Edge 扩展管理页面；
2. 开启开发者模式；
3. 选择"加载已解压的扩展程序"；
4. 选择插件目录；
5. 确认插件已启用；
6. 打开 DeepSeek 网页端并手动登录；
7. 确认插件 Popup 显示本地服务已连接。

### 11.3 飞书机器人配置

用户需要提前创建飞书群机器人，并将 Webhook 配置到本地服务配置文件中。

MVP 阶段只支持一个飞书群 Webhook。

---

## 12. MVP 验收标准

### 12.1 主流程验收

| 编号 | 验收项 | 通过标准 |
|---|---|---|
| A1 | 启动 Python 服务 | 服务可正常启动，`/health` 返回 `ok` |
| A2 | 插件连接 WebSocket | 插件 Popup 显示已连接 |
| A3 | DeepSeek 页面识别 | 打开并登录 DeepSeek 后，插件能识别页面 |
| A4 | 手动触发分析任务 | `POST /tasks/analyze` 返回 `accepted` |
| A5 | 输入 Prompt | DeepSeek 输入框中出现完整 Prompt |
| A6 | 发送 Prompt | 插件能触发发送 |
| A7 | 等待回复 | 插件能等待 DeepSeek 输出完成 |
| A8 | 提取结果 | 插件能提取最后一条 AI 回复 |
| A9 | 回传结果 | Python 服务收到 `ANALYZE_RESPONSE` |
| A10 | 飞书推送 | 飞书群收到分析消息 |

### 12.2 异常验收

| 编号 | 场景 | 通过标准 |
|---|---|---|
| E1 | 未打开 DeepSeek 页面 | 返回 `DS_PAGE_NOT_FOUND` |
| E2 | DeepSeek 未登录 | 返回 `DS_NOT_LOGIN` 或明确提示用户登录 |
| E3 | WebSocket 断开 | 插件自动重连 |
| E4 | DeepSeek 超时 | 返回 `DS_RESPONSE_TIMEOUT` |
| E5 | 飞书 Webhook 错误 | 返回 `ANALYSIS_SUCCESS_PUSH_FAILED`，本地保留分析结果 |

### 12.3 重复执行与稳定性验收（评审新增）

| 编号 | 验收项 | 通过标准 |
|---|---|---|
| S1 | 连续执行稳定性 | 连续执行 5 次，成功次数不少于 4 次（≥ 80%） |
| S2 | 任务执行中重复触发 | 返回 `TASK_BUSY`，不影响当前任务 |
| S3 | DeepSeek 页面刷新后恢复 | 页面刷新并重新就绪后，可继续执行任务 |
| S4 | 飞书失败不丢结果 | 飞书 Webhook 错误时，`/tasks/latest` 仍可查到分析结果 |
| S5 | 查询最近任务 | `GET /tasks/latest` 返回正确的任务状态和结果 |

### 12.4 性能验收

| 指标 | MVP 标准 |
|---|---|
| WebSocket 连接建立时间 | ≤ 5 秒 |
| Prompt 下发到插件接收 | ≤ 1 秒 |
| DeepSeek 最大等待时间 | 默认 180 秒 |
| 飞书推送耗时 | ≤ 5 秒 |
| 单次完整任务成功率 | 测试环境下 ≥ 80% |

### 12.5 排除项验证

| 编号 | 排除项 | 验证标准 |
|---|---|
| X1 | 不使用 DeepSeek API | 代码中无 API 调用逻辑 |
| X2 | 不使用 Selenium/Playwright | 代码中无浏览器自动化库依赖 |
| X3 | 不使用 Native Messaging | 无 Native Host 注册，无 stdin/stdout 通信 |
| X4 | 使用 WebSocket | 使用 FastAPI WebSocket 进行通信 |

---

## 13. MVP 开发任务拆分

### 13.1 开发顺序（评审调整）

MVP 按以下顺序推进，每步独立可验证：

| 阶段 | 目标 | 验证方式 | 说明 |
|---|---|---|---|
| **P0-1** | WebSocket 联通 | Python 服务与插件完成收发消息 | 先不接行情、不操作 DeepSeek |
| **P0-2** | DeepSeek 固定 Prompt 测试 | 不接行情，发送固定 Prompt，验证页面操作和结果提取 | 核心风险验证 |
| **P0-3** | 飞书推送测试 | 将固定 Prompt 的结果推送飞书 | 验证推送链路 |
| **P0-4** | 接入 mock 行情 | 用 mock 行情生成 Prompt | 验证 Prompt 生成 |
| **P0-5** | 接入真实行情 | 替换 mock 数据为通达信或本地行情数据 | 最后接入 |

> 评审说明：不应该先接真实通达信行情。先把问题隔离——P0-1 到 P0-3 验证插件链路，P0-4 到 P0-5 验证行情接入。否则一开始接真实行情，一旦失败，很难判断是行情问题、WebSocket 问题、插件问题、DeepSeek 页面问题还是飞书问题。

### 13.2 后端 Python 服务

| 任务 | 说明 | 阶段 |
|---|---|---|
| FastAPI 服务框架 | 实现 `/health`、`/tasks/analyze`、`/tasks/latest` 和 `/ws/plugin` | P0-1 |
| WebSocket 连接管理 | 管理插件连接、断开、token 鉴权、消息收发 | P0-1 |
| 单任务锁 | 维护当前任务状态，拒绝并发任务 | P0-1 |
| Mock 行情数据 | 提供固定测试数据 | P0-4 |
| 真实行情接入 | 接入通达信 tqcenter 或其他行情工具 | P0-5 |
| Prompt 生成 | 使用固定模板生成 Prompt | P0-4 |
| 分析任务下发 | 向插件发送 `ANALYZE_REQUEST` | P0-2 |
| 结果接收 | 接收 `ANALYZE_RESPONSE` 和 `ERROR` | P0-2 |
| 飞书推送 | 调用飞书 Webhook 发送文本消息 | P0-3 |
| 最近任务记录 | 保存最近一次任务状态和结果 | P0-3 |
| 日志记录 | 记录任务状态、耗时、错误码（脱敏） | P0-1 |

### 13.3 浏览器插件

| 任务 | 说明 | 阶段 |
|---|---|---|
| manifest 配置 | 定义插件权限和注入规则 | P0-1 |
| selectors.js | DOM 选择器集中管理 | P0-2 |
| Background Script | 连接 WebSocket，接收任务，状态上报 | P0-1 |
| Content Script | 操作 DeepSeek 页面 DOM | P0-2 |
| 页面识别与登录判断 | 检测 DeepSeek 页面和登录状态 | P0-2 |
| Prompt 输入 | 定位输入框并输入 Prompt | P0-2 |
| 发送操作 | 点击发送按钮 | P0-2 |
| 回复监听 | 等待 AI 回复完成（5 秒稳定判定） | P0-2 |
| 结果提取 | 提取最后一条 AI 回复 | P0-2 |
| 错误返回 | 统一返回错误码 | P0-2 |
| Popup 页面 | 展示连接和任务状态 | P0-1 |

### 13.4 联调任务

| 任务 | 说明 | 阶段 |
|---|---|---|
| 插件连接本地服务 | 验证 WebSocket 双向通信 | P0-1 |
| 状态上报验证 | 验证 `STATUS_REPORT` 消息 | P0-1 |
| 下发固定 Prompt | 不接行情，发送固定 Prompt | P0-2 |
| DeepSeek 回传结果 | 验证网页操作和结果提取 | P0-2 |
| 飞书推送结果 | 验证结果能到飞书群 | P0-3 |
| 飞书失败保留结果 | 验证推送失败时结果不丢失 | P0-3 |
| 异常场景测试 | 验证页面未打开、未登录、超时等场景 | P0-2 |
| 连续执行测试 | 连续 5 次执行验证稳定性 | P0-5 |

---

## 14. MVP 之后的迭代方向

### 14.1 V0.2 稳定性增强

| 能力 | 说明 |
|---|---|
| 任务队列 | 支持多个分析任务排队执行 |
| 自动重试 | 超时、空结果、发送失败时自动重试 |
| 更稳健的 DOM 选择器 | 支持多选择器匹配和降级 |
| 更准确的回复完成判断 | 结合按钮状态、文本稳定时间、DOM 变化 |
| 本地日志页面 | 查看最近任务和错误 |

### 14.2 V0.3 产品化增强

| 能力 | 说明 |
|---|---|
| Options 配置页 | 配置本地服务地址、超时、选择器等 |
| 飞书卡片消息 | 使用更清晰的结构化卡片 |
| 多股票批量分析 | 支持多个股票串行分析 |
| 定时任务 | 支持盘中、收盘后自动分析 |
| Prompt 模板管理 | 支持不同分析场景模板 |
| 运行监控 | 显示服务、插件、任务状态 |

### 14.3 V1.0 完整版本

| 能力 | 说明 |
|---|---|
| 多策略分析 | 支持技术面、资金面、消息面等模板 |
| 多群推送 | 支持不同股票推送到不同飞书群 |
| 结果归档 | 保存历史分析结果 |
| 可视化管理界面 | 本地 Web 控制台 |
| 插件自动升级 | 降低维护成本 |
| 更完善的权限和安全控制 | 提升长期运行安全性 |

---

## 15. 对原方案的调整说明

这版 MVP PRD（V0.2）相比 V0.1 和原完整 PRD 做了以下关键收敛。

**第一，删除了 Native Messaging。** 原因是当前方案已经明确使用 Python FastAPI 和 WebSocket，本地服务与插件之间没有必要再引入 Native Messaging Host、stdin/stdout、4 字节长度头和浏览器原生通信注册流程。

**第二，删除了 Selenium / Playwright。** 原因是用户明确要求不是浏览器自动化，而是开发浏览器插件，通过插件操作 DeepSeek 网页端。

**第三，MVP 阶段不做完整产品化配置。** 原因是当前最大风险是 DeepSeek 网页端操作是否稳定，所以先把固定服务地址、固定 Prompt、固定股票、固定飞书群跑通。

**第四，MVP 阶段只做单任务串行。** 原因是 DeepSeek 网页端天然不适合一开始就做多任务并发，先验证一个任务完整闭环更稳妥。

**第五，飞书先使用文本消息。** 原因是文本消息实现简单、调试方便，等主链路稳定后再升级为飞书卡片。

**第六，错误处理只做"可见、可定位"，不做复杂自动恢复。** 原因是 MVP 的重点是验证可行性，而不是一开始就实现完整容错系统。

**第七，新增手动触发接口和单任务锁。** 原因是任务触发方式必须明确，且必须防止并发任务导致 DeepSeek 页面输入混乱。

**第八，量化了 DeepSeek 回复完成判断参数。** 原因是"连续若干秒"不够具体，必须明确 5 秒文本稳定、180 秒最大超时、最小 20 字符等具体数值。

**第九，新增插件状态上报。** 原因是状态可见性能显著降低联调难度，MVP 不做复杂监控但状态必须可见。

**第十，明确了 mock 行情优先策略。** 原因是本项目核心风险在插件操作 DeepSeek，而不是行情数据。先用 mock 数据验证完整链路更高效。

---

## 16. TDD 开发规格与 AI Vibecoding 约束

### 16.1 TDD 开发原则

MVP 开发采用 **Test-Driven Development（测试驱动开发）** 模式，严格遵循 **Red → Green → Refactor** 循环：

| 阶段 | 动作 | 说明 |
|---|---|---|
| **Red** | 先写失败的测试 | 根据需求或验收标准编写测试用例，运行确认失败 |
| **Green** | 写最少的代码让测试通过 | 不追求完美实现，只追求测试变绿 |
| **Refactor** | 重构代码 | 在测试保护下优化代码结构，确保测试仍然通过 |

**核心原则**：

- 不允许在没有对应测试的情况下编写业务代码；
- 每个验收项（A1-A10、E1-E5、S1-S5、X1-X4）至少有一个对应测试；
- 每个 P0 阶段开始前，先编写该阶段的验收测试；
- 测试失败时优先修复代码，而非修改测试。

### 16.2 MVP 测试金字塔

```
          ┌─────────────┐
          │  E2E 测试   │  少量（2-3 个）
          │  端到端链路  │
          ├─────────────┤
          │ 集成测试     │  中等（5-8 个）
          │ WS + HTTP    │
          ├─────────────┤
          │  单元测试     │  大量（15-20 个）
          │ 函数/模块    │
          └─────────────┘
```

| 层级 | 数量 | 说明 |
|---|---|---|
| 单元测试 | 15-20 个 | 覆盖 Prompt 生成、行情数据解析、状态机转换、消息构造、飞书格式化 |
| 集成测试 | 5-8 个 | 覆盖 WebSocket 协议、HTTP 接口、插件-服务通信 |
| E2E 测试 | 2-3 个 | 覆盖完整链路（mock 模式下跑通全流程） |

### 16.3 后端 Python 测试用例

使用 `pytest` + `pytest-asyncio` 编写。

**单元测试**：

| 编号 | 测试用例 | 覆盖验收项 | 说明 |
|---|---|---|---|
| UT-P01 | `test_generate_prompt` | A5 | 验证 Prompt 模板生成，包含行情数据和格式约束 |
| UT-P02 | `test_generate_prompt_with_mock_data` | A5 | 使用 mock 行情数据生成 Prompt，验证字段填充 |
| UT-P03 | `test_parse_market_data` | A5 | 验证行情数据解析（mock 和真实格式） |
| UT-P04 | `test_task_state_transitions` | S2 | 验证任务状态机：IDLE → TASK_RECEIVED → FAILED → IDLE |
| UT-P05 | `test_task_busy_rejection` | S2 | 验证任务执行中收到新任务返回 TASK_BUSY |
| UT-P06 | `test_feishu_message_format` | A10 | 验证飞书文本消息格式化输出 |
| UT-P07 | `test_feishu_push_success` | A10 | Mock 飞书 Webhook，验证推送成功 |
| UT-P08 | `test_feishu_push_failure_preserves_result` | S4 | Mock 飞书 Webhook 返回错误，验证分析结果保留 |
| UT-P09 | `test_task_result_persistence` | S4 | 验证最近任务结果可通过 `/tasks/latest` 查询 |
| UT-P10 | `test_ws_token_validation` | E3 | 验证错误 token 被拒绝，正确 token 通过 |
| UT-P11 | `test_health_endpoint` | A1 | 验证 `/health` 返回正确结构 |

**集成测试**：

| 编号 | 测试用例 | 覆盖验收项 | 说明 |
|---|---|---|---|
| IT-P01 | `test_ws_plugin_connect_and_auth` | A2 | 验证插件通过 WebSocket 连接并完成鉴权 |
| IT-P02 | `test_ws_plugin_status_report` | A2 | 验证插件状态上报消息格式 |
| IT-P03 | `test_ws_analyze_request_response_flow` | A4-A9 | 验证 ANALYZE_REQUEST → ANALYZE_PROGRESS → ANALYZE_RESPONSE 完整流程 |
| IT-P04 | `test_ws_error_handling` | E1-E4 | 验证各类 ERROR 消息格式和处理 |
| IT-P05 | `test_post_tasks_analyze_accepted` | A4 | 验证 `POST /tasks/analyze` 成功返回 |
| IT-P06 | `test_post_tasks_analyze_plugin_not_connected` | E1 | 验证插件未连接时返回 `PLUGIN_NOT_CONNECTED` |
| IT-P07 | `test_post_tasks_analyze_task_busy` | S2 | 验证任务执行中返回 `TASK_BUSY` |
| IT-P08 | `test_get_tasks_latest` | S5 | 验证 `/tasks/latest` 返回正确数据 |

### 16.4 浏览器插件测试用例

使用 Jest + `jest-chrome`（Mock Chrome API）编写。

**单元测试**：

| 编号 | 测试用例 | 覆盖验收项 | 说明 |
|---|---|---|---|
| UT-E01 | `test_selectors_config` | — | 验证 `selectors.js` 导出所有必需选择器 |
| UT-E02 | `test_state_transitions` | S2 | 验证插件状态机转换逻辑 |
| UT-E03 | `test_protocol_message_builder` | — | 验证 WebSocket 消息构造（PLUGIN_CONNECTED、ANALYZE_PROGRESS 等） |
| UT-E04 | `test_protocol_message_parser` | — | 验证 WebSocket 消息解析（ANALYZE_REQUEST、PING 等） |
| UT-E05 | `test_logger_output` | — | 验证日志工具输出格式 |

**集成测试（需 Mock Chrome API）**：

| 编号 | 测试用例 | 覆盖验收项 | 说明 |
|---|---|---|---|
| IT-E01 | `test_ws_connect_with_token` | A2 | 验证 Background Script 使用正确 token 连接 WebSocket |
| IT-E02 | `test_ws_reconnect_on_disconnect` | E3 | 验证断线后自动重连 |
| IT-E03 | `test_forward_task_to_content_script` | A4-A6 | 验证 Background Script 将 ANALYZE_REQUEST 转发给 Content Script |
| IT-E04 | `test_content_script_dom_operations` | A5-A8 | 验证 Content Script DOM 操作序列（输入、发送、等待、提取） |
| IT-E05 | `test_response_timeout_detection` | E4 | 验证 180 秒超时返回 `DS_RESPONSE_TIMEOUT` |
| IT-E06 | `test_empty_response_detection` | — | 验证回复过短返回 `DS_RESPONSE_EMPTY` |
| IT-E07 | `test_page_not_found_error` | E1 | 验证未找到 DeepSeek 页面返回 `DS_PAGE_NOT_FOUND` |
| IT-E08 | `test_login_status_detection` | E2 | 验证登录状态判断逻辑 |

### 16.5 WebSocket 协议测试用例

独立协议测试，不依赖具体实现。

| 编号 | 测试用例 | 说明 |
|---|---|---|
| WS-P01 | `test_message_structure` | 验证所有消息包含 type、request_id、task_id、timestamp、payload |
| WS-P02 | `test_plugin_connected_message` | 验证 PLUGIN_CONNECTED 消息格式 |
| WS-P03 | `test_status_report_message` | 验证 STATUS_REPORT 消息包含 ws_status、deepseek_status、task_status |
| WS-P04 | `test_analyze_request_message` | 验证 ANALYZE_REQUEST 消息包含 stock_code、prompt、timeout_seconds |
| WS-P05 | `test_analyze_progress_stages` | 验证 ANALYZE_PROGRESS 所有 stage 取值合法 |
| WS-P06 | `test_analyze_response_message` | 验证 ANALYZE_RESPONSE 消息包含 status、result、duration_seconds |
| WS-P07 | `test_error_message` | 验证 ERROR 消息包含 code、message、retryable |
| WS-P08 | `test_ping_pong_message` | 验证 PING/PONG 消息格式 |

### 16.6 Mock 策略

#### 16.6.1 Mock 行情数据

```python
# tests/fixtures/mock_market_data.py

MOCK_STOCK = {
    "stock_code": "000001",
    "stock_name": "平安银行",
    "price": 12.58,
    "change_percent": 3.25,
    "volume": 125800,
    "amount": 15824000,
    "open": 12.30,
    "high": 12.80,
    "low": 12.20,
    "pre_close": 12.18,
    "timestamp": "2026-05-11 14:30:00"
}
```

使用方式：

- 通过 `POST /tasks/analyze` 的 `use_mock_data: true` 参数启用；
- Mock 数据与真实数据结构完全一致，替换时无需修改下游代码；
- Mock 数据可配置，支持自定义字段。

#### 16.6.2 Mock DeepSeek

插件测试中不连接真实 DeepSeek 页面，而是 Mock Content Script 的 DOM 操作。

```javascript
// tests/__mocks__/content_script.js
// Mock DeepSeek 页面 DOM 操作
global.chrome.tabs.sendMessage = (tabId, message, callback) => {
  if (message.type === 'ANALYZE_REQUEST') {
    // 模拟延迟后返回固定结果
    setTimeout(() => {
      callback({
        type: 'ANALYZE_RESPONSE',
        payload: {
          status: 'success',
          result: '【走势简述】\nMock 分析结果...\n【短线关注点】\n...\n【风险提示】\n...\n【一句话结论】\n...',
          duration_seconds: 5
        }
      });
    }, 100);
  }
};
```

Mock DeepSeek 场景：

| 场景 | Mock 行为 |
|---|---|
| 正常回复 | 延迟 100ms 后返回固定分析结果 |
| 超时 | 延迟 200000ms 后返回（触发 180 秒超时） |
| 空结果 | 返回空字符串（触发 DS_RESPONSE_EMPTY） |
| 页面未找到 | 抛出 DS_PAGE_NOT_FOUND 错误 |
| 未登录 | 抛出 DS_NOT_LOGIN 错误 |

#### 16.6.3 Mock 飞书 Webhook

```python
# tests/conftest.py
import pytest
from unittest.mock import patch

@pytest.fixture
def mock_feishu_success():
    with patch("feishu_pusher.send_webhook") as mock:
        mock.return_value = {"code": 0, "msg": "success"}
        yield mock

@pytest.fixture
def mock_feishu_failure():
    with patch("feishu_pusher.send_webhook") as mock:
        mock.return_value = {"code": 19021, "msg": "webhook not found"}
        yield mock
```

### 16.7 P0-1 到 P0-5 分阶段 TDD 开发计划

#### P0-1：WebSocket 联通

| 步骤 | 动作 | 测试 |
|---|---|---|
| 1 | 编写 `/health` 测试 | UT-P11 |
| 2 | 编写 WebSocket token 鉴权测试 | UT-P10 |
| 3 | 实现 `/health` 和 `/ws/plugin` | — |
| 4 | 编写插件连接测试 | IT-P01 |
| 5 | 编写状态上报测试 | IT-P02 |
| 6 | 实现插件 Background Script WebSocket 客户端 | — |
| 7 | 运行全部 P0-1 测试 | UT-P10, UT-P11, IT-P01, IT-P02 |

**P0-1 完成标准**：插件能连接本地服务，双向收发 PING/PONG 和 STATUS_REPORT 消息。

#### P0-2：DeepSeek 固定 Prompt 测试

| 步骤 | 动作 | 测试 |
|---|---|---|
| 1 | 编写消息协议测试 | WS-P01 ~ WS-P08 |
| 2 | 编写任务状态机测试 | UT-P04, UT-P05 |
| 3 | 编写 Content Script DOM 操作测试 | UT-E01 ~ UT-E05, IT-E04 ~ IT-E08 |
| 4 | 编写任务下发-回传集成测试 | IT-P03, IT-P04 |
| 5 | 实现 Content Script 和 Background Script 任务转发 | — |
| 6 | 运行全部 P0-2 测试 | — |

**P0-2 完成标准**：能发送固定 Prompt，Mock DeepSeek 返回结果，结果通过 WebSocket 回传。

#### P0-3：飞书推送测试

| 步骤 | 动作 | 测试 |
|---|---|---|
| 1 | 编写飞书消息格式化测试 | UT-P06 |
| 2 | 编写飞书推送成功测试 | UT-P07 |
| 3 | 编写飞书推送失败保留结果测试 | UT-P08 |
| 4 | 编写最近任务查询测试 | UT-P09 |
| 5 | 实现飞书推送模块和 `/tasks/latest` | — |
| 6 | 运行全部 P0-3 测试 | — |

**P0-3 完成标准**：分析结果能推送到飞书群；推送失败时结果不丢失。

#### P0-4：接入 Mock 行情

| 步骤 | 动作 | 测试 |
|---|---|---|
| 1 | 编写 Prompt 生成测试 | UT-P01, UT-P02 |
| 2 | 编写行情数据解析测试 | UT-P03 |
| 3 | 编写 `POST /tasks/analyze` 接口测试 | IT-P05 ~ IT-P07 |
| 4 | 实现 Prompt 生成和 mock 行情接口 | — |
| 5 | 运行全部 P0-4 测试 | — |

**P0-4 完成标准**：`POST /tasks/analyze` 使用 mock 行情数据生成 Prompt 并下发。

#### P0-5：接入真实行情 + E2E 测试

| 步骤 | 动作 | 测试 |
|---|---|---|
| 1 | 编写 E2E 测试（mock 模式全链路） | E2E-01 |
| 2 | 编写连续执行稳定性测试 | E2E-02 |
| 3 | 替换 mock 为真实行情数据源 | — |
| 4 | 运行全部 P0-5 测试 | — |

**P0-5 完成标准**：连续执行 5 次成功不少于 4 次，全部验收项通过。

### 16.8 AI Vibecoding 禁止事项

使用 AI 编码工具（如 SOLO、Cursor、Copilot）时，必须遵守以下约束：

| 禁止事项 | 原因 | 正确做法 |
|---|---|---|
| 禁止在没有测试的情况下生成业务代码 | 违反 TDD 原则 | 先写测试，再生成实现 |
| 禁止跳过 Red 阶段直接写实现 | 无法验证需求理解 | 先确认测试失败，再写实现 |
| 禁止修改测试来适配实现 | 掩盖真实问题 | 修改实现来通过测试 |
| 禁止一次性生成大量代码 | 难以 review 和定位问题 | 按 TDD 步骤逐步生成 |
| 禁止在 Prompt 中省略验收标准 | AI 无法判断完成质量 | 每次生成时附带对应验收项编号 |
| 禁止跳过 Refactor 阶段 | 技术债累积 | 测试通过后必须审查和重构 |
| 禁止使用 Selenium / Playwright | 违反架构约束 | 使用浏览器插件 Content Script |
| 禁止调用 DeepSeek API | 违反架构约束 | 操作 DeepSeek 网页端 |
| 禁止使用 Native Messaging | 违反架构约束 | 使用 FastAPI + WebSocket |
| 禁止监听 0.0.0.0 | 安全风险 | 仅监听 127.0.0.1 |
| 禁止在日志中打印完整 token | 安全风险 | 只打印前 4 位和后 4 位 |
| 禁止硬编码 WebSocket 地址 | 不利于配置管理 | 使用 `{LOCAL_WS_TOKEN}` 占位符 |
| 禁止实现多股票并发 | 超出 MVP 范围 | MVP 只做单任务串行 |
| 禁止实现飞书卡片消息 | 超出 MVP 范围 | MVP 只做文本消息 |

### 16.9 Definition of Done

每个 P0 阶段的完成标准：

| 条件 | 说明 |
|---|---|
| 所有测试通过 | 该阶段对应的全部测试用例执行通过 |
| 无新增 TODO | 代码中不存在 `TODO`、`FIXME`、`HACK` 注释 |
| 无 console 错误 | 浏览器控制台无运行时错误 |
| 无日志警告 | 服务端日志中无 WARNING 及以上级别 |
| 代码已提交 | 所有代码已提交到版本控制 |
| 验收项已覆盖 | 该阶段对应的验收项（A/E/S/X）全部通过 |

**MVP 整体完成标准**：

| 条件 | 说明 |
|---|---|
| A1-A10 全部通过 | 主流程 10 项验收全部通过 |
| E1-E5 全部通过 | 异常场景 5 项验收全部通过 |
| S1-S5 全部通过 | 稳定性 5 项验收全部通过 |
| X1-X4 全部通过 | 排除项 4 项验证全部通过 |
| 连续 5 次成功 ≥ 4 次 | 端到端稳定性达标 |

### 16.10 推荐代码结构

```
stock_analyzer/
├── local_service/                    # 本地 Python 服务
│   ├── main.py                       # FastAPI 入口
│   ├── app.py                        # FastAPI 应用配置
│   ├── websocket_handler.py          # WebSocket 连接管理
│   ├── task_manager.py               # 任务状态机与单任务锁
│   ├── stock_analyzer.py             # 行情数据获取（mock + 真实）
│   ├── prompt_builder.py             # Prompt 模板生成
│   ├── feishu_pusher.py              # 飞书推送
│   ├── config.py                     # 配置文件
│   ├── requirements.txt              # Python 依赖
│   └── tests/                        # 后端测试
│       ├── conftest.py               # pytest fixtures
│       ├── fixtures/
│       │   └── mock_market_data.py   # Mock 行情数据
│       ├── unit/                     # 单元测试
│       │   ├── test_prompt_builder.py
│       │   ├── test_task_manager.py
│       │   ├── test_feishu_pusher.py
│       │   └── test_ws_auth.py
│       ├── integration/              # 集成测试
│       │   ├── test_ws_flow.py
│       │   ├── test_http_endpoints.py
│       │   └── test_task_flow.py
│       └── e2e/                      # E2E 测试
│           └── test_full_pipeline.py
│
├── extension/                        # 浏览器插件
│   ├── manifest.json                 # 插件清单
│   ├── background.js                 # Background Script
│   ├── content.js                    # Content Script
│   ├── selectors.js                  # DOM 选择器集中管理
│   ├── utils/
│   │   ├── protocol.js               # 消息协议定义与构造
│   │   ├── state.js                  # 状态机管理
│   │   └── logger.js                # 日志工具
│   ├── popup.html                    # Popup 页面
│   ├── popup.js                      # Popup 逻辑
│   ├── icons/                        # 图标
│   └── tests/                        # 插件测试
│       ├── __mocks__/
│       │   └── chrome_api.js          # Mock Chrome API
│       ├── unit/                     # 单元测试
│       │   ├── test_selectors.js
│       │   ├── test_state.js
│       │   ├── test_protocol.js
│       │   └── test_logger.js
│       └── integration/              # 集成测试
│           ├── test_ws_connection.js
│           ├── test_task_forwarding.js
│           └── test_content_script.js
│
└── README.md                         # 使用说明
```

---

*文档结束*
