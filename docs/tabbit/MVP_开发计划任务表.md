# MVP 开发计划任务表

## 通达信本地行情 + DeepSeek 网页端插件分析 + 飞书群聊推送系统

| 属性 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 日期 | 2026-05-12 |
| 状态 | 评审中 |
| 对应 PRD | MVP_PRD_通达信行情_DeepSeek插件分析_飞书推送.md V0.2 |

---

## 一、评审结论

### 1.1 PRD 整体评估

| 维度 | 评估 | 说明 |
|---|---|---|
| 完整性 | 通过 | 覆盖架构、接口、协议、状态机、错误码、验收标准 |
| 可行性 | 通过 | 分阶段隔离风险，P0-1 到 P0-5 递进合理 |
| 技术约束 | 通过 | 明确排除 Selenium/Playwright/Native Messaging/API |
| 安全要求 | 通过 | 127.0.0.1 监听、token 脱敏、权限最小化 |
| TDD 约束 | 通过 | Red→Green→Refactor，测试先行，禁止无测试写业务代码 |
| 验收标准 | 通过 | A1-A10、E1-E5、S1-S5、X1-X4 量化可验证 |

### 1.2 关键风险点

| 风险等级 | 风险项 | 应对策略 |
|---|---|---|
| 高 | DeepSeek 网页端 DOM 结构变化 | selectors.js 集中管理，多备选选择器 |
| 高 | 回复完成判断稳定性 | 5秒文本稳定 + 停止按钮消失 + 180秒超时组合策略 |
| 中 | WebSocket 本机连接稳定性 | 3秒自动重连，10次上限 |
| 中 | 飞书 Webhook 失败丢结果 | 本地保留结果，`/tasks/latest` 可查询 |
| 低 | 单任务锁限制并发 | MVP 明确不做并发，后续迭代再扩展 |

### 1.3 评审建议

1. **P0-2 为核心风险阶段**：DeepSeek 网页操作是否稳定决定项目成败，建议预留充足时间
2. **Mock 策略优先**：严格按 PRD 要求，P0-1 到 P0-3 不接真实行情，隔离变量
3. **状态上报必须实现**：STATUS_REPORT 显著降低联调难度，不可省略
4. **token 日志脱敏**：开发阶段就要遵守，避免后期安全审计问题
5. **连续稳定性测试**：P0-5 必须完成 5 次执行成功不少于 4 次

---

## 二、任务总览

### 2.1 按 P0 阶段划分

| 阶段 | 目标 | 预计工时 | 任务数 | 核心交付物 |
|---|---|---|---|---|
| P0-1 | WebSocket 联通 | 16h | 4 | Python FastAPI + 插件 Background Script 双向通信 |
| P0-2 | DeepSeek 固定 Prompt 测试 | 24h | 6 | Content Script DOM 操作 + 结果提取 |
| P0-3 | 飞书推送测试 | 12h | 4 | 飞书文本推送 + 失败保留结果 |
| P0-4 | 接入 Mock 行情 | 12h | 4 | Prompt 生成 + `/tasks/analyze` 接口 |
| P0-5 | 接入真实行情 + E2E | 16h | 4 | 通达信行情 + 连续稳定性测试 |
| **合计** | **MVP 完整链路** | **80h** | **22** | **端到端可运行系统** |

### 2.2 按模块划分

| 模块 | 任务数 | 主要工作 |
|---|---|---|
| 后端 Python 服务 | 10 | FastAPI、WebSocket、任务管理、行情、Prompt、飞书推送 |
| 浏览器插件 | 8 | manifest、Background、Content Script、Popup、选择器、协议、状态、日志 |
| 联调与测试 | 4 | 各阶段集成测试、E2E 测试、稳定性测试 |

---

## 三、详细任务表

### 阶段 P0-1：WebSocket 联通（预计 16h）

> 目标：Python 服务与浏览器插件完成 WebSocket 双向通信，先不接行情、不操作 DeepSeek

#### P0-1.1 搭建 Python FastAPI 服务框架

| 属性 | 内容 |
|---|---|
| 任务ID | T001 |
| 阶段 | P0-1 |
| 模块 | 后端 Python 服务 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | 无 |

**任务描述**：
搭建 FastAPI 服务框架，实现 `/health` 接口和 `/ws/plugin` WebSocket 端点。服务监听 `127.0.0.1:8765`。

**验收标准**：
- `GET /health` 返回 `{"status": "ok", "service": "tdx-deepseek-feishu-mvp", "version": "0.2.0"}`
- 服务启动后控制台输出 WebSocket 地址
- 代码结构符合 PRD 推荐目录结构

**AI 提示词**：
```markdown
## 任务: 搭建 Python FastAPI 服务框架

### 目标
创建本地 Python FastAPI 服务，提供健康检查接口和 WebSocket 端点。

### 要求
1. 创建 `local_service/` 目录结构
2. 实现 `main.py` 作为 FastAPI 入口
3. 实现 `app.py` 配置 FastAPI 应用
4. 实现 `GET /health` 接口，返回固定 JSON
5. 实现 `/ws/plugin` WebSocket 端点（先空实现，后续填充鉴权和消息处理）
6. 服务只监听 `127.0.0.1:8765`
7. 使用 `config.py` 管理配置（HOST, PORT, WS_PATH, WS_TOKEN）
8. 创建 `requirements.txt` 列出依赖

### 验收标准
- [ ] `GET /health` 返回正确结构
- [ ] 服务启动输出包含 WebSocket 地址
- [ ] 代码符合 PRD 目录结构
- [ ] 对应测试 UT-P11 通过

### 相关文件
- local_service/main.py
- local_service/app.py
- local_service/config.py
- local_service/requirements.txt

### 注意事项
- 禁止监听 0.0.0.0
- 禁止硬编码配置值
- 遵循 TDD：先写测试再写实现
```

---

#### P0-1.2 实现 WebSocket 连接管理与 Token 鉴权

| 属性 | 内容 |
|---|---|
| 任务ID | T002 |
| 阶段 | P0-1 |
| 模块 | 后端 Python 服务 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | T001 |

**任务描述**：
实现 WebSocket 连接管理：插件连接、断开、token 鉴权、消息收发。token 校验失败时关闭连接并返回 WS_AUTH_FAILED，日志中 token 只打印前4位和后4位。

**验收标准**：
- 正确 token 允许连接
- 错误 token 拒绝连接
- 日志中 token 脱敏显示
- 支持 PING/PONG 心跳

**AI 提示词**：
```markdown
## 任务: 实现 WebSocket 连接管理与 Token 鉴权

### 目标
在 FastAPI WebSocket 端点上实现连接管理和 URL 参数 token 鉴权。

### 要求
1. 在 `websocket_handler.py` 中实现 WebSocket 连接管理
2. 从 URL 参数 `?token=` 中提取 token 进行校验
3. token 来源为 `config.py` 中的 WS_TOKEN
4. 校验失败：关闭连接，返回 WS_AUTH_FAILED，不打印完整 token
5. 校验成功：保持连接，支持后续消息收发
6. 实现 PING/PONG 心跳机制
7. 连接断开时清理资源
8. 日志脱敏：token 只打印前4位和后4位（如 `mvpx...oken`）

### 验收标准
- [ ] 正确 token 可连接
- [ ] 错误 token 被拒绝
- [ ] 日志中不打印完整 token
- [ ] PING/PONG 正常工作
- [ ] 对应测试 UT-P10、IT-P01 通过

### 相关文件
- local_service/websocket_handler.py
- local_service/config.py

### 注意事项
- 禁止在日志中打印完整 token
- 禁止硬编码 token 值
- 鉴权失败不发送任何消息直接关闭连接
```

---

#### P0-1.3 实现浏览器插件 Background Script WebSocket 客户端

| 属性 | 内容 |
|---|---|
| 任务ID | T003 |
| 阶段 | P0-1 |
| 模块 | 浏览器插件 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | T001 |

**任务描述**：
实现插件 Background Script，启动后主动连接本地 WebSocket 服务，支持自动重连（3秒间隔，10次上限）。连接成功后发送 PLUGIN_CONNECTED 消息。

**验收标准**：
- 插件能成功连接本地 WebSocket
- 断线后自动重连
- 发送 PLUGIN_CONNECTED 消息格式正确
- 支持 PING/PONG 心跳

**AI 提示词**：
```markdown
## 任务: 实现浏览器插件 Background Script WebSocket 客户端

### 目标
创建浏览器插件 Background Script，实现与本地 Python 服务的 WebSocket 连接。

### 要求
1. 创建 `extension/manifest.json`，申请必要权限（tabs, scripting, storage）
2. 创建 `extension/background.js`，实现 WebSocket 客户端
3. 启动后主动连接 `ws://127.0.0.1:8765/ws/plugin?token={WS_TOKEN}`
4. 支持自动重连：间隔 3 秒，最多 10 次
5. 连接成功后发送 PLUGIN_CONNECTED 消息
6. 实现 PING/PONG 心跳响应
7. 连接状态变化时更新内部状态
8. 创建 `extension/utils/protocol.js` 定义消息构造工具
9. 创建 `extension/utils/state.js` 管理插件状态机
10. 创建 `extension/utils/logger.js` 实现日志工具

### 验收标准
- [ ] 插件能连接本地 WebSocket
- [ ] 断线后自动重连
- [ ] PLUGIN_CONNECTED 消息格式正确
- [ ] PING/PONG 正常工作
- [ ] 对应测试 IT-E01、IT-E02 通过

### 相关文件
- extension/manifest.json
- extension/background.js
- extension/utils/protocol.js
- extension/utils/state.js
- extension/utils/logger.js

### 注意事项
- host_permissions 只限定 `https://chat.deepseek.com/*`
- 禁止申请 `<all_urls>`
- WS_TOKEN 从配置文件读取，禁止硬编码
```

---

#### P0-1.4 实现插件 Popup 状态展示

| 属性 | 内容 |
|---|---|
| 任务ID | T004 |
| 阶段 | P0-1 |
| 模块 | 浏览器插件 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | T003 |

**任务描述**：
实现插件 Popup 页面，展示本地服务连接状态、DeepSeek 页面状态、当前任务状态和最近错误信息。

**验收标准**：
- Popup 显示 WebSocket 连接状态
- 状态变化实时更新
- 界面简洁清晰

**AI 提示词**：
```markdown
## 任务: 实现插件 Popup 状态展示

### 目标
创建浏览器插件 Popup 页面，展示插件各模块状态。

### 要求
1. 创建 `extension/popup.html` 和 `extension/popup.js`
2. 展示以下状态：
   - 本地服务连接状态（已连接/未连接/连接中）
   - DeepSeek 页面状态（未找到/已找到/就绪）
   - 当前任务状态（空闲/执行中/成功/失败）
   - 最近错误信息（错误码和描述）
   - 最近任务耗时
3. 从 Background Script 获取状态数据
4. 界面简洁，适合调试使用
5. 状态变化时刷新显示

### 验收标准
- [ ] Popup 正确显示连接状态
- [ ] 状态变化实时更新
- [ ] 界面无运行时错误

### 相关文件
- extension/popup.html
- extension/popup.js
- extension/background.js

### 注意事项
- MVP 阶段不要求复杂交互
- 禁止在 Popup 中打印敏感信息
```

---

### 阶段 P0-2：DeepSeek 固定 Prompt 测试（预计 24h）

> 目标：不接行情，发送固定 Prompt，验证页面操作和结果提取

#### P0-2.1 实现 DOM 选择器集中管理

| 属性 | 内容 |
|---|---|
| 任务ID | T005 |
| 阶段 | P0-2 |
| 模块 | 浏览器插件 |
| 预计工时 | 2h |
| 优先级 | P0 |
| 依赖 | T003 |

**任务描述**：
创建 `selectors.js` 集中管理 DeepSeek 页面 DOM 选择器，便于后续维护和调整。

**验收标准**：
- 包含输入框、发送按钮、消息列表、停止按钮等核心选择器
- 包含登录状态判断选择器
- 导出所有必需选择器

**AI 提示词**：
```markdown
## 任务: 实现 DOM 选择器集中管理

### 目标
创建 `extension/selectors.js` 集中管理 DeepSeek 页面所有 DOM 选择器。

### 要求
1. 定义 SELECTORS 对象，包含以下分类：
   - DeepSeek 页面核心元素：inputBox, sendButton, messageList, stopButton, newChatButton
   - 登录状态判断：loginButton, loginQRCode, loginPhoneInput
   - 对话区域：chatArea, userMessage, assistantMessage
2. 支持多个备选选择器，按优先级尝试
3. 导出 SELECTORS 供其他模块使用
4. 添加注释说明每个选择器的用途

### 验收标准
- [ ] 包含所有必需选择器
- [ ] 支持备选选择器
- [ ] 对应测试 UT-E01 通过

### 相关文件
- extension/selectors.js

### 注意事项
- 选择器失效时只需修改此文件
- 优先使用稳定的选择器
```

---

#### P0-2.2 实现 DeepSeek 页面识别与登录判断

| 属性 | 内容 |
|---|---|
| 任务ID | T006 |
| 阶段 | P0-2 |
| 模块 | 浏览器插件 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | T005 |

**任务描述**：
实现 Content Script 的页面识别和登录判断逻辑：通过 chrome.tabs.query 查询 DeepSeek 页面，发送 PING_CONTENT 检测 Content Script 可用性，检查输入框和登录特征判断登录状态。

**验收标准**：
- 能正确识别 DeepSeek 页面是否存在
- 能判断 Content Script 是否可用
- 能区分已登录、未登录、页面不可用状态
- 返回对应错误码

**AI 提示词**：
```markdown
## 任务: 实现 DeepSeek 页面识别与登录判断

### 目标
在 Content Script 中实现 DeepSeek 页面识别和登录状态判断逻辑。

### 要求
1. 在 `extension/content.js` 中实现页面检测逻辑
2. 通过 `chrome.tabs.query` 查询 `https://chat.deepseek.com/*` 域名页面
3. 向目标 tab 发送 `PING_CONTENT`，收到 `PONG_CONTENT` 即认为可注入
4. 检查输入框（textarea）和发送按钮（button[type="submit"]）判断已登录
5. 找不到输入框时，检查登录按钮、二维码、手机号输入等登录特征
6. 按以下流程返回状态：
   - 无匹配 tab → DS_PAGE_NOT_FOUND
   - PING_CONTENT 无响应 → CONTENT_SCRIPT_NOT_READY
   - 找到输入框 → DS_READY
   - 存在登录特征 → DS_NOT_LOGIN
   - 无登录特征 → DS_PAGE_NOT_READY
7. 状态变化时上报 STATUS_REPORT

### 验收标准
- [ ] 正确识别页面存在/不存在
- [ ] 正确判断登录状态
- [ ] 返回正确错误码
- [ ] 对应测试 IT-E07、IT-E08 通过

### 相关文件
- extension/content.js
- extension/background.js
- extension/selectors.js

### 注意事项
- 必须把判断依据写清楚，避免错误码失真
- 状态变化时及时上报
```

---

#### P0-2.3 实现 Prompt 输入与发送

| 属性 | 内容 |
|---|---|
| 任务ID | T007 |
| 阶段 | P0-2 |
| 模块 | 浏览器插件 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | T006 |

**任务描述**：
实现 Content Script 的 Prompt 输入和发送功能：定位输入框、清空内容、输入 Prompt、点击发送按钮。

**验收标准**：
- 能定位 DeepSeek 输入框
- 能输入完整 Prompt
- 能触发发送
- 发送后返回 ANALYZE_PROGRESS（stage: PROMPT_SENT）

**AI 提示词**：
```markdown
## 任务: 实现 Prompt 输入与发送

### 目标
在 Content Script 中实现 Prompt 输入和发送功能。

### 要求
1. 使用 `selectors.js` 中的选择器定位输入框
2. 清空输入框或确保当前输入区域为空
3. 输入本次任务 Prompt（文本内容）
4. 点击发送按钮触发发送
5. 发送成功后返回 `ANALYZE_PROGRESS`（stage: `PROMPT_SENT`）
6. 处理输入框未找到（DS_INPUT_NOT_FOUND）和发送按钮未找到（DS_SEND_BUTTON_NOT_FOUND）错误
7. 处理发送失败（DS_SEND_FAILED）错误

### 验收标准
- [ ] 能定位并清空输入框
- [ ] 能输入完整 Prompt
- [ ] 能触发发送
- [ ] 发送后返回正确进度消息
- [ ] 对应测试 IT-E03、IT-E04 通过

### 相关文件
- extension/content.js
- extension/selectors.js
- extension/utils/protocol.js

### 注意事项
- 输入框定位失败时返回明确错误码
- 发送操作需等待 DOM 响应
```

---

#### P0-2.4 实现回复等待与结果提取

| 属性 | 内容 |
|---|---|
| 任务ID | T008 |
| 阶段 | P0-2 |
| 模块 | 浏览器插件 |
| 预计工时 | 6h |
| 优先级 | P0 |
| 依赖 | T007 |

**任务描述**：
实现 Content Script 的回复等待和结果提取功能。使用 MutationObserver 或定时轮询监听最后一条 AI 回复文本变化。当文本长度 ≥ 20 字符且连续 5 秒未变化时认为完成。最大等待 180 秒。

**验收标准**：
- 能等待 DeepSeek 回复完成
- 5 秒文本稳定判定正确
- 180 秒超时返回 DS_RESPONSE_TIMEOUT
- 空结果返回 DS_RESPONSE_EMPTY
- 能提取最后一条 AI 回复

**AI 提示词**：
```markdown
## 任务: 实现回复等待与结果提取

### 目标
在 Content Script 中实现 DeepSeek 回复等待和结果提取功能。

### 要求
1. 使用 MutationObserver 或定时轮询监听最后一条 AI 回复
2. 实现组合判断策略：
   - 停止按钮消失（生成完成标志）
   - 文本连续 5 秒稳定（不再变化）
   - 文本长度 ≥ 20 字符（避免截断或空结果）
   - 最大等待 180 秒（兜底超时）
3. 回复完成后提取最后一条 assistantMessage 的文本内容
4. 超时返回 `DS_RESPONSE_TIMEOUT`
5. 完成后文本为空或 < 20 字符返回 `DS_RESPONSE_EMPTY`
6. 提取失败返回 `RESULT_EXTRACT_FAILED`
7. 等待过程中定期上报 `ANALYZE_PROGRESS`（stage: `WAITING_RESPONSE`）
8. 完成后上报 `ANALYZE_PROGRESS`（stage: `RESPONSE_DONE`）

### 验收标准
- [ ] 正确等待回复完成
- [ ] 5 秒稳定判定有效
- [ ] 180 秒超时正确触发
- [ ] 空结果正确识别
- [ ] 能提取最后一条回复
- [ ] 对应测试 IT-E05、IT-E06 通过

### 相关文件
- extension/content.js
- extension/selectors.js

### 注意事项
- 轮询间隔 1 秒
- MVP 不重试，直接报错
- 提取结果截断到 200 字符记录日志
```

---

#### P0-2.5 实现任务下发与结果回传流程

| 属性 | 内容 |
|---|---|
| 任务ID | T009 |
| 阶段 | P0-2 |
| 模块 | 后端 + 插件 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | T002, T008 |

**任务描述**：
打通完整任务流程：Python 服务发送 ANALYZE_REQUEST → Background Script 转发给 Content Script → Content Script 执行输入/发送/等待/提取 → 返回 ANALYZE_RESPONSE 或 ERROR → Python 服务接收结果。

**验收标准**：
- ANALYZE_REQUEST 消息格式正确
- ANALYZE_PROGRESS 各阶段上报正确
- ANALYZE_RESPONSE 包含结果和耗时
- ERROR 消息包含错误码、描述、是否可重试

**AI 提示词**：
```markdown
## 任务: 实现任务下发与结果回传流程

### 目标
打通 Python 服务到插件的完整任务下发和结果回传流程。

### 要求
1. Python 服务端：
   - 构造 `ANALYZE_REQUEST` 消息（含 stock_code, prompt, timeout_seconds）
   - 通过 WebSocket 发送给插件
   - 接收 `ANALYZE_PROGRESS` 并记录日志
   - 接收 `ANALYZE_RESPONSE` 或 `ERROR`
   - 超时未收到响应时标记任务失败
2. 插件端：
   - Background Script 接收 `ANALYZE_REQUEST`
   - 转发给 Content Script（通过 `chrome.tabs.sendMessage`）
   - Content Script 执行完整流程（输入→发送→等待→提取）
   - 返回 `ANALYZE_RESPONSE` 或 `ERROR`
   - Background Script 回传给 Python 服务
3. 消息格式严格遵循 PRD 第 6 章协议
4. 实现任务状态机转换（IDLE → TASK_RECEIVED → ... → RESULT_RETURNED_TO_SERVER）

### 验收标准
- [ ] ANALYZE_REQUEST 格式正确
- [ ] 各阶段 ANALYZE_PROGRESS 上报正确
- [ ] ANALYZE_RESPONSE 包含结果和耗时
- [ ] ERROR 消息包含 code, message, retryable
- [ ] 对应测试 IT-P03、IT-P04、WS-P01~WS-P08 通过

### 相关文件
- local_service/websocket_handler.py
- local_service/task_manager.py
- extension/background.js
- extension/content.js
- extension/utils/protocol.js

### 注意事项
- 消息必须包含 type, request_id, task_id, timestamp, payload
- request_id 用于关联请求和响应
- 任务状态变化时上报 STATUS_REPORT
```

---

#### P0-2.6 实现单任务锁与状态机

| 属性 | 内容 |
|---|---|
| 任务ID | T010 |
| 阶段 | P0-2 |
| 模块 | 后端 Python 服务 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | T009 |

**任务描述**：
实现单任务锁机制：维护当前任务状态，执行中拒绝新任务（返回 TASK_BUSY），任务完成或失败后恢复 IDLE 状态。WebSocket 断开时标记当前任务失败。

**验收标准**：
- 无任务时接收新任务
- 任务执行中拒绝新任务
- 任务完成后恢复 IDLE
- WebSocket 断开时任务标记失败

**AI 提示词**：
```markdown
## 任务: 实现单任务锁与状态机

### 目标
在 Python 服务中实现单任务锁和任务状态机管理。

### 要求
1. 在 `task_manager.py` 中实现任务状态机
2. 状态定义：IDLE, TASK_RECEIVED, DS_PAGE_CHECKING, DS_PAGE_READY, INPUTTING_PROMPT, PROMPT_SENT, WAITING_RESPONSE, RESPONSE_DONE, RESULT_EXTRACTED, RESULT_RETURNED_TO_SERVER, FEISHU_PUSHING, COMPLETED, ANALYSIS_SUCCESS_PUSH_FAILED, FAILED, TASK_BUSY
3. 单任务锁逻辑：
   - 当前无任务（IDLE）→ 接收新任务
   - 当前任务执行中 → 拒绝新任务，返回 TASK_BUSY
   - 当前任务失败 → 状态恢复 IDLE
   - 当前任务成功 → 状态恢复 IDLE
   - WebSocket 断开 → 当前任务标记 FAILED，状态恢复 IDLE
4. 状态转换校验：不允许非法状态跳转
5. 任务信息持久化：保存最近一次任务到内存（后续扩展到 `/tasks/latest` 接口）
6. 生成 task_id 格式：`task_{stock_code}_{YYYYMMDD}_{HHMMSS}`

### 验收标准
- [ ] 状态机转换正确
- [ ] 任务执行中拒绝新任务
- [ ] WebSocket 断开标记任务失败
- [ ] 对应测试 UT-P04、UT-P05、IT-P07 通过

### 相关文件
- local_service/task_manager.py
- local_service/websocket_handler.py

### 注意事项
- MVP 只支持单任务串行
- 任务状态变化时记录日志
- 状态转换需原子操作
```

---

### 阶段 P0-3：飞书推送测试（预计 12h）

> 目标：将固定 Prompt 的结果推送飞书，验证推送链路

#### P0-3.1 实现飞书文本消息推送

| 属性 | 内容 |
|---|---|
| 任务ID | T011 |
| 阶段 | P0-3 |
| 模块 | 后端 Python 服务 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | T009 |

**任务描述**：
实现飞书机器人文本消息推送功能。调用飞书 Webhook 发送文本消息，消息格式包含股票信息、行情数据、DeepSeek 分析结果。

**验收标准**：
- 能成功推送文本消息到飞书群
- 消息格式符合 PRD 要求
- 推送失败时返回错误码

**AI 提示词**：
```markdown
## 任务: 实现飞书文本消息推送

### 目标
在 Python 服务中实现飞书机器人文本消息推送功能。

### 要求
1. 在 `feishu_pusher.py` 中实现飞书推送
2. 使用飞书机器人 Webhook 发送文本消息
3. 消息格式：
   ```
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
4. Webhook URL 从 `config.py` 的 FEISHU_WEBHOOK_URL 读取
5. 推送成功返回成功状态
6. 推送失败返回 FEISHU_PUSH_FAILED 错误码
7. 日志中 Webhook URL 只记录域名和路径，不记录完整 URL
8. 推送耗时不超过 5 秒

### 验收标准
- [ ] 文本消息成功推送到飞书群
- [ ] 消息格式正确
- [ ] 推送失败返回正确错误码
- [ ] 对应测试 UT-P06、UT-P07 通过

### 相关文件
- local_service/feishu_pusher.py
- local_service/config.py

### 注意事项
- 禁止在日志中打印完整 Webhook URL
- 推送超时设为 5 秒
- MVP 只支持一个飞书群
```

---

#### P0-3.2 实现推送失败时结果保留

| 属性 | 内容 |
|---|---|
| 任务ID | T012 |
| 阶段 | P0-3 |
| 模块 | 后端 Python 服务 |
| 预计工时 | 2h |
| 优先级 | P0 |
| 依赖 | T011 |

**任务描述**：
实现推送失败时分析结果保留逻辑：分析成功但飞书推送失败时，任务状态标记为 ANALYSIS_SUCCESS_PUSH_FAILED，分析结果保留在本地，可通过 `/tasks/latest` 查询。

**验收标准**：
- 推送失败时分析结果不丢失
- 任务状态正确标记
- 错误信息记录完整

**AI 提示词**：
```markdown
## 任务: 实现推送失败时结果保留

### 目标
实现分析成功但飞书推送失败时的结果保留机制。

### 要求
1. 分析成功 + 飞书推送成功 → 任务状态 COMPLETED
2. 分析成功 + 飞书推送失败 → 任务状态 ANALYSIS_SUCCESS_PUSH_FAILED
3. 分析失败 → 任务状态 FAILED
4. 推送失败时：
   - 分析结果保留在内存中
   - 错误信息记录到 last_error
   - 可通过 `/tasks/latest` 查询到完整结果
   - 日志记录推送失败原因
5. 状态流转：RESULT_RETURNED_TO_SERVER → FEISHU_PUSHING → ANALYSIS_SUCCESS_PUSH_FAILED → IDLE

### 验收标准
- [ ] 推送失败时结果保留
- [ ] 任务状态正确标记
- [ ] `/tasks/latest` 可查询到结果
- [ ] 对应测试 UT-P08、UT-P09 通过

### 相关文件
- local_service/task_manager.py
- local_service/feishu_pusher.py

### 注意事项
- 分析结果必须在本地保留，不可丢失
- 错误信息要完整记录
```

---

#### P0-3.3 实现 `/tasks/latest` 接口

| 属性 | 内容 |
|---|---|
| 任务ID | T013 |
| 阶段 | P0-3 |
| 模块 | 后端 Python 服务 |
| 预计工时 | 3h |
| 优先级 | P0 |
| 依赖 | T012 |

**任务描述**：
实现 `GET /tasks/latest` 接口，返回最近一次任务的状态、结果、错误信息等。

**验收标准**：
- 返回最近一次任务的完整信息
- 支持四种场景：成功、分析成功推送失败、失败、无历史任务
- 返回格式符合 PRD 要求

**AI 提示词**：
```markdown
## 任务: 实现 `/tasks/latest` 接口

### 目标
实现 `GET /tasks/latest` 接口，查询最近一次任务状态。

### 要求
1. 在 `main.py` 或 `app.py` 中实现 `GET /tasks/latest`
2. 返回最近一次任务的完整信息：
   - task_id, status, stock_code, stock_name
   - started_at, finished_at, duration_seconds
   - analysis_result, feishu_push_status, last_error
3. 支持四种返回场景：
   - 任务成功完成 → status: COMPLETED
   - 分析成功推送失败 → status: ANALYSIS_SUCCESS_PUSH_FAILED
   - 任务失败 → status: FAILED
   - 无历史任务 → 返回提示信息
4. 时间字段使用 ISO 8601 格式
5. duration_seconds 为整数

### 验收标准
- [ ] 返回格式正确
- [ ] 四种场景都覆盖
- [ ] 对应测试 IT-P08 通过

### 相关文件
- local_service/main.py
- local_service/task_manager.py

### 注意事项
- 无历史任务时返回友好提示
- 时间格式统一
```

---

#### P0-3.4 P0-3 阶段联调与测试

| 属性 | 内容 |
|---|---|
| 任务ID | T014 |
| 阶段 | P0-3 |
| 模块 | 联调测试 |
| 预计工时 | 3h |
| 优先级 | P0 |
| 依赖 | T013 |

**任务描述**：
完成 P0-3 阶段联调：使用固定 Prompt 测试完整链路（下发 → DeepSeek 操作 → 结果回传 → 飞书推送），验证推送成功和失败场景。

**验收标准**：
- 固定 Prompt 结果能推送到飞书群
- 推送失败时结果保留
- `/tasks/latest` 返回正确
- 全部 P0-3 对应测试通过

**AI 提示词**：
```markdown
## 任务: P0-3 阶段联调与测试

### 目标
完成 P0-3 阶段联调，验证飞书推送链路和结果保留机制。

### 要求
1. 使用固定 Prompt 触发完整链路测试
2. 验证飞书推送成功场景
3. 验证飞书推送失败场景（Mock 错误响应）
4. 验证 `/tasks/latest` 返回正确
5. 运行全部 P0-3 对应测试：
   - UT-P06, UT-P07, UT-P08, UT-P09
   - IT-P08
6. 记录联调问题和解决方案

### 验收标准
- [ ] 飞书推送成功
- [ ] 推送失败结果保留
- [ ] `/tasks/latest` 正确
- [ ] 全部测试通过

### 相关文件
- 全部 P0-3 相关文件

### 注意事项
- 使用 Mock 数据测试
- 记录所有异常场景
```

---

### 阶段 P0-4：接入 Mock 行情（预计 12h）

> 目标：用 mock 行情生成 Prompt，验证 Prompt 生成和 `/tasks/analyze` 接口

#### P0-4.1 实现 Mock 行情数据模块

| 属性 | 内容 |
|---|---|
| 任务ID | T015 |
| 阶段 | P0-4 |
| 模块 | 后端 Python 服务 |
| 预计工时 | 3h |
| 优先级 | P0 |
| 依赖 | T010 |

**任务描述**：
实现 Mock 行情数据模块，提供固定测试数据，数据结构与实际行情一致。

**验收标准**：
- 提供固定 mock 行情数据
- 数据结构与真实行情一致
- 支持通过参数切换 mock/真实数据

**AI 提示词**：
```markdown
## 任务: 实现 Mock 行情数据模块

### 目标
创建 Mock 行情数据模块，提供固定测试数据。

### 要求
1. 在 `stock_analyzer.py` 中实现行情数据获取
2. Mock 数据格式：
   ```python
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
3. 支持 `use_mock_data: true` 参数启用 mock
4. Mock 数据与真实数据结构完全一致
5. 支持自定义字段覆盖
6. 真实行情接口预留（返回 NotImplementedError）

### 验收标准
- [ ] Mock 数据结构正确
- [ ] 支持参数切换
- [ ] 对应测试 UT-P03 通过

### 相关文件
- local_service/stock_analyzer.py
- tests/fixtures/mock_market_data.py

### 注意事项
- Mock 数据与真实数据结构必须一致
- 预留真实行情接口
```

---

#### P0-4.2 实现 Prompt 模板生成

| 属性 | 内容 |
|---|---|
| 任务ID | T016 |
| 阶段 | P0-4 |
| 模块 | 后端 Python 服务 |
| 预计工时 | 3h |
| 优先级 | P0 |
| 依赖 | T015 |

**任务描述**：
实现 Prompt 模板生成模块，根据行情数据填充模板，生成符合格式约束的 Prompt。

**验收标准**：
- Prompt 包含完整行情数据
- 输出格式约束正确（走势简述、短线关注点、风险提示、一句话结论）
- 语言简洁，控制在 500 字以内

**AI 提示词**：
```markdown
## 任务: 实现 Prompt 模板生成

### 目标
创建 Prompt 模板生成模块，根据行情数据生成分析 Prompt。

### 要求
1. 在 `prompt_builder.py` 中实现 Prompt 生成
2. 模板内容：
   ```
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
3. 支持字段填充：stock_code, stock_name, price, change_percent, volume, timestamp
4. 验证生成后的 Prompt 包含所有必需字段
5. 支持自定义模板（预留接口）

### 验收标准
- [ ] Prompt 包含完整行情数据
- [ ] 格式约束正确
- [ ] 对应测试 UT-P01、UT-P02 通过

### 相关文件
- local_service/prompt_builder.py

### 注意事项
- MVP 不强制 JSON 输出格式
- 固定文本标题更适合 MVP
```

---

#### P0-4.3 实现 `POST /tasks/analyze` 接口

| 属性 | 内容 |
|---|---|
| 任务ID | T017 |
| 阶段 | P0-4 |
| 模块 | 后端 Python 服务 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | T016 |

**任务描述**：
实现 `POST /tasks/analyze` 接口，接收股票代码和名称，获取行情数据（mock），生成 Prompt，通过 WebSocket 下发任务给插件。

**验收标准**：
- 接收 stock_code, stock_name, use_mock_data 参数
- 插件未连接时返回 PLUGIN_NOT_CONNECTED
- 任务执行中时返回 TASK_BUSY
- 成功时返回 accepted 和 task_id

**AI 提示词**：
```markdown
## 任务: 实现 `POST /tasks/analyze` 接口

### 目标
实现手动触发分析任务的 HTTP 接口。

### 要求
1. 实现 `POST /tasks/analyze`，接收 JSON 请求体：
   ```json
   {
       "stock_code": "000001",
       "stock_name": "平安银行",
       "use_mock_data": true
   }
   ```
2. 接口逻辑：
   - 检查插件是否连接 → 未连接返回 PLUGIN_NOT_CONNECTED
   - 检查是否有任务执行中 → 有则返回 TASK_BUSY
   - 获取行情数据（mock 或真实）
   - 生成 Prompt
   - 创建任务，生成 task_id
   - 通过 WebSocket 发送 ANALYZE_REQUEST
   - 返回 accepted
3. 成功返回：
   ```json
   {
       "status": "accepted",
       "task_id": "task_000001_20260511_184847",
       "message": "分析任务已创建"
   }
   ```
4. 错误返回格式统一

### 验收标准
- [ ] 参数解析正确
- [ ] 插件未连接返回正确错误
- [ ] 任务执行中返回 TASK_BUSY
- [ ] 成功返回 accepted
- [ ] 对应测试 IT-P05、IT-P06、IT-P07 通过

### 相关文件
- local_service/main.py
- local_service/task_manager.py
- local_service/stock_analyzer.py
- local_service/prompt_builder.py

### 注意事项
- 任务创建后立即返回，不等待执行完成
- task_id 格式：task_{stock_code}_{YYYYMMDD}_{HHMMSS}
```

---

#### P0-4.4 P0-4 阶段联调与测试

| 属性 | 内容 |
|---|---|
| 任务ID | T018 |
| 阶段 | P0-4 |
| 模块 | 联调测试 |
| 预计工时 | 2h |
| 优先级 | P0 |
| 依赖 | T017 |

**任务描述**：
完成 P0-4 阶段联调：使用 mock 行情数据触发完整链路，验证 Prompt 生成和任务下发。

**验收标准**：
- mock 行情数据正确生成 Prompt
- Prompt 完整发送到 DeepSeek
- 结果正确回传并推送飞书
- 全部 P0-4 对应测试通过

**AI 提示词**：
```markdown
## 任务: P0-4 阶段联调与测试

### 目标
完成 P0-4 阶段联调，验证 mock 行情和 Prompt 生成链路。

### 要求
1. 使用 `POST /tasks/analyze` 触发任务（use_mock_data: true）
2. 验证 mock 行情数据正确填充到 Prompt
3. 验证完整链路：HTTP 接口 → Prompt 生成 → WebSocket 下发 → 插件执行 → 结果回传 → 飞书推送
4. 运行全部 P0-4 对应测试：
   - UT-P01, UT-P02, UT-P03
   - IT-P05, IT-P06, IT-P07
5. 记录联调问题

### 验收标准
- [ ] Mock 行情正确生成 Prompt
- [ ] 完整链路跑通
- [ ] 全部测试通过

### 相关文件
- 全部 P0-4 相关文件

### 注意事项
- 使用 mock 数据，不接真实行情
- 验证 Prompt 内容完整性
```

---

### 阶段 P0-5：接入真实行情 + E2E（预计 16h）

> 目标：替换 mock 数据为通达信真实行情，完成 E2E 测试和稳定性验证

#### P0-5.1 接入通达信真实行情

| 属性 | 内容 |
|---|---|
| 任务ID | T019 |
| 阶段 | P0-5 |
| 模块 | 后端 Python 服务 |
| 预计工时 | 6h |
| 优先级 | P0 |
| 依赖 | T018 |

**任务描述**：
接入通达信 tqcenter 或其他行情工具，获取真实行情数据。支持通过 `use_mock_data: false` 切换。

**验收标准**：
- 能获取真实行情数据
- 数据结构统一（与 mock 一致）
- 获取失败时返回 MARKET_DATA_FAILED

**AI 提示词**：
```markdown
## 任务: 接入通达信真实行情

### 目标
接入通达信或其他本地行情数据源，获取真实行情数据。

### 要求
1. 在 `stock_analyzer.py` 中实现真实行情获取
2. 支持通达信 tqcenter 或其他本地行情工具
3. 真实数据格式与 mock 数据结构一致
4. 支持 `use_mock_data: false` 切换
5. 行情获取失败返回 `MARKET_DATA_FAILED`
6. 获取超时设为 5 秒
7. 数据字段：stock_code, stock_name, price, change_percent, volume, amount, open, high, low, pre_close, timestamp
8. 预留其他行情源接口

### 验收标准
- [ ] 能获取真实行情
- [ ] 数据格式统一
- [ ] 获取失败返回正确错误码

### 相关文件
- local_service/stock_analyzer.py

### 注意事项
- 真实行情只在 P0-5 接入
- 获取失败时降级处理
- 注意数据类型转换
```

---

#### P0-5.2 实现 E2E 测试（Mock 模式全链路）

| 属性 | 内容 |
|---|---|
| 任务ID | T020 |
| 阶段 | P0-5 |
| 模块 | 测试 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | T019 |

**任务描述**：
编写 E2E 测试，覆盖 mock 模式下完整链路：HTTP 触发 → 行情获取 → Prompt 生成 → WebSocket 下发 → 插件执行 → 结果回传 → 飞书推送。

**验收标准**：
- E2E 测试覆盖完整链路
- Mock DeepSeek 和 Mock 飞书 Webhook
- 测试可独立运行

**AI 提示词**：
```markdown
## 任务: 实现 E2E 测试（Mock 模式全链路）

### 目标
编写端到端测试，覆盖 mock 模式下完整业务链路。

### 要求
1. 在 `tests/e2e/test_full_pipeline.py` 中实现 E2E 测试
2. 测试流程：
   - 启动 FastAPI 服务
   - Mock WebSocket 插件连接
   - 调用 `POST /tasks/analyze`（use_mock_data: true）
   - Mock 插件返回 ANALYZE_RESPONSE
   - Mock 飞书 Webhook 返回成功
   - 验证 `/tasks/latest` 返回 COMPLETED
3. Mock 策略：
   - Mock 飞书 Webhook（使用 pytest mock）
   - Mock WebSocket 客户端（模拟插件行为）
4. 测试独立运行，不依赖外部服务
5. 验证所有关键节点状态

### 验收标准
- [ ] 覆盖完整链路
- [ ] 测试可独立运行
- [ ] 对应测试 E2E-01 通过

### 相关文件
- tests/e2e/test_full_pipeline.py
- tests/conftest.py

### 注意事项
- 使用 Mock 数据，不依赖真实 DeepSeek
- 测试环境隔离
```

---

#### P0-5.3 实现连续执行稳定性测试

| 属性 | 内容 |
|---|---|
| 任务ID | T021 |
| 阶段 | P0-5 |
| 模块 | 测试 |
| 预计工时 | 4h |
| 优先级 | P0 |
| 依赖 | T020 |

**任务描述**：
实现连续执行稳定性测试：连续触发 5 次分析任务，验证成功次数不少于 4 次（≥ 80%）。

**验收标准**：
- 连续 5 次执行
- 成功次数 ≥ 4 次
- 记录每次执行结果和耗时

**AI 提示词**：
```markdown
## 任务: 实现连续执行稳定性测试

### 目标
编写稳定性测试，验证系统连续执行的可靠性。

### 要求
1. 在 `tests/e2e/test_stability.py` 中实现稳定性测试
2. 测试流程：
   - 连续触发 5 次 `POST /tasks/analyze`
   - 每次任务间隔 5 秒
   - 记录每次执行结果（成功/失败）
   - 记录每次执行耗时
   - 统计成功率
3. 通过标准：成功次数 ≥ 4 次（≥ 80%）
4. 失败时记录错误码和原因
5. 支持 Mock 模式和真实模式
6. 输出测试报告

### 验收标准
- [ ] 连续 5 次执行
- [ ] 成功率 ≥ 80%
- [ ] 对应测试 E2E-02、S1 通过

### 相关文件
- tests/e2e/test_stability.py

### 注意事项
- 使用 Mock 数据测试
- 每次任务间隔避免冲突
- 详细记录失败原因
```

---

#### P0-5.4 P0-5 阶段联调与最终验收

| 属性 | 内容 |
|---|---|
| 任务ID | T022 |
| 阶段 | P0-5 |
| 模块 | 联调测试 |
| 预计工时 | 2h |
| 优先级 | P0 |
| 依赖 | T021 |

**任务描述**：
完成 P0-5 阶段联调和最终验收：接入真实行情，运行全部测试，验证所有验收项。

**验收标准**：
- 真实行情数据正确获取
- 完整链路跑通
- 全部验收项通过（A1-A10, E1-E5, S1-S5, X1-X4）
- 连续 5 次成功不少于 4 次

**AI 提示词**：
```markdown
## 任务: P0-5 阶段联调与最终验收

### 目标
完成 P0-5 阶段联调，验证真实行情接入和全部验收项。

### 要求
1. 接入真实通达信行情数据
2. 运行完整链路测试（真实行情 → Prompt → DeepSeek → 飞书）
3. 运行全部测试用例：
   - 单元测试：UT-P01~UT-P11, UT-E01~UT-E05
   - 集成测试：IT-P01~IT-P08, IT-E01~IT-E08
   - 协议测试：WS-P01~WS-P08
   - E2E 测试：E2E-01, E2E-02
4. 验证全部验收项：
   - 主流程：A1-A10
   - 异常：E1-E5
   - 稳定性：S1-S5
   - 排除项：X1-X4
5. 连续执行 5 次，统计成功率
6. 输出验收报告

### 验收标准
- [ ] 真实行情正确获取
- [ ] 全部测试通过
- [ ] 全部验收项通过
- [ ] 连续 5 次成功 ≥ 4 次

### 相关文件
- 全部项目文件

### 注意事项
- 真实行情测试需谨慎
- 记录所有问题和解决方案
- 输出完整验收报告
```

---

## 四、任务依赖图

```
T001 (FastAPI框架)
  ↓
T002 (WebSocket鉴权) ←→ T003 (Background Script)
  ↓                        ↓
T004 (Popup)              T005 (selectors)
                            ↓
                          T006 (页面识别)
                            ↓
                          T007 (Prompt输入)
                            ↓
                          T008 (等待提取)
                            ↓
T010 (单任务锁) ←→ T009 (任务下发回传)
  ↓
T011 (飞书推送)
  ↓
T012 (失败保留)
  ↓
T013 (/tasks/latest)
  ↓
T014 (P0-3联调)
  ↓
T015 (Mock行情)
  ↓
T016 (Prompt生成)
  ↓
T017 (/tasks/analyze)
  ↓
T018 (P0-4联调)
  ↓
T019 (真实行情)
  ↓
T020 (E2E测试)
  ↓
T021 (稳定性测试)
  ↓
T022 (P0-5联调验收)
```

---

## 五、里程碑与交付物

| 里程碑 | 时间 | 交付物 | 完成标准 |
|---|---|---|---|
| M1: P0-1 完成 | Day 1-2 | Python服务框架 + 插件连接 | 插件能连接，双向收发 PING/PONG |
| M2: P0-2 完成 | Day 3-5 | Content Script 页面操作 | 能发送固定 Prompt，提取结果 |
| M3: P0-3 完成 | Day 6-7 | 飞书推送 + 结果保留 | 结果能推送到飞书，失败保留 |
| M4: P0-4 完成 | Day 8-9 | Mock 行情 + 任务接口 | `/tasks/analyze` 使用 mock 跑通 |
| M5: P0-5 完成 | Day 10-12 | 真实行情 + E2E | 全部验收通过，连续 5 次成功 ≥ 4 次 |

---

## 六、测试覆盖矩阵

| 测试编号 | 任务ID | 验收项 | 测试类型 |
|---|---|---|---|
| UT-P01 | T016 | A5 | 单元测试 |
| UT-P02 | T016 | A5 | 单元测试 |
| UT-P03 | T015 | A5 | 单元测试 |
| UT-P04 | T010 | S2 | 单元测试 |
| UT-P05 | T010 | S2 | 单元测试 |
| UT-P06 | T011 | A10 | 单元测试 |
| UT-P07 | T011 | A10 | 单元测试 |
| UT-P08 | T012 | S4 | 单元测试 |
| UT-P09 | T013 | S4 | 单元测试 |
| UT-P10 | T002 | E3 | 单元测试 |
| UT-P11 | T001 | A1 | 单元测试 |
| UT-E01 | T005 | — | 单元测试 |
| UT-E02 | T003 | S2 | 单元测试 |
| UT-E03 | T003 | — | 单元测试 |
| UT-E04 | T003 | — | 单元测试 |
| UT-E05 | T003 | — | 单元测试 |
| IT-P01 | T002 | A2 | 集成测试 |
| IT-P02 | T002 | A2 | 集成测试 |
| IT-P03 | T009 | A4-A9 | 集成测试 |
| IT-P04 | T009 | E1-E4 | 集成测试 |
| IT-P05 | T017 | A4 | 集成测试 |
| IT-P06 | T017 | E1 | 集成测试 |
| IT-P07 | T017 | S2 | 集成测试 |
| IT-P08 | T013 | S5 | 集成测试 |
| IT-E01 | T003 | A2 | 集成测试 |
| IT-E02 | T003 | E3 | 集成测试 |
| IT-E03 | T009 | A4-A6 | 集成测试 |
| IT-E04 | T007 | A5-A8 | 集成测试 |
| IT-E05 | T008 | E4 | 集成测试 |
| IT-E06 | T008 | — | 集成测试 |
| IT-E07 | T006 | E1 | 集成测试 |
| IT-E08 | T006 | E2 | 集成测试 |
| WS-P01~P08 | T009 | — | 协议测试 |
| E2E-01 | T020 | A1-A10 | E2E测试 |
| E2E-02 | T021 | S1 | E2E测试 |

---

## 七、风险与应对

| 风险 | 影响 | 概率 | 应对策略 |
|---|---|---|---|
| DeepSeek 页面 DOM 变化 | 高 | 中 | selectors.js 集中管理，多备选选择器 |
| 回复完成判断不稳定 | 高 | 中 | 组合策略：文本稳定 + 按钮状态 + 超时 |
| WebSocket 连接不稳定 | 中 | 低 | 3秒重连，10次上限 |
| 飞书 Webhook 限流 | 中 | 低 | 本地保留结果，可手动重推 |
| 真实行情获取失败 | 中 | 中 | Mock 数据兜底，错误码明确 |
| 开发时间超预期 | 中 | 中 | 按 P0 阶段独立交付，每阶段可验证 |

---

## 八、评审检查清单

- [ ] 任务拆分覆盖 PRD 全部需求
- [ ] 每个任务有明确的验收标准
- [ ] 每个任务有对应的 AI 提示词
- [ ] 依赖关系清晰，无循环依赖
- [ ] 测试覆盖所有验收项
- [ ] 风险识别和应对策略完整
- [ ] 里程碑可验证、可交付
- [ ] 工时估算合理（总计 80h）

---

*文档结束*
