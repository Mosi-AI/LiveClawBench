# 未来 Factor 设计规划：A3, A4, B3, C-axis

## 优先级顺序

| 优先级 | Factor | 理由 |
|:------:|--------|------|
| 1 | **C1** — Environmental State Invalidation | 可复现性设计最清晰；现有 case 已验证可测性，基础设施最成熟 |
| 2 | **A3** — Temporal & Resource Constraints | 有具体 pilot case 设计；主要瓶颈是 mock 时钟基础设施 |
| 3 | **B3** — Multi-Agent Delegation | 依赖 OpenClaw sub-agent 架构成熟度 |
| 4 | **A4** — Cross-Modal Interaction | 建设成本高；建议先积累 pilot case，再正式入框；需要 vision-capable model |
| 5 | **C2** — Outcome Verification under Altered State | 推迟到 C1 pilot case 验证 C-axis 评估基础设施后再启动 |

---

## A3: Temporal & Resource Constraints（时间窗口与资源配额）

**Status:** Roadmap — pilot case design needed.

### 定义

任务存在时间窗口或配额限制，错过即无法完成。

### Core Test Point

Opportunity Cost — agent 必须判断"现在不做就来不及了"。

### 设计思路

- 在 mock environment 中注入实时 deadline
  （例：航班 check-in 窗口 2 小时后关闭）
- 设置资源配额（例：仅允许 3 次 API 调用、购物预算上限）
- 引入会过期的时效性信息（例：flash sale 价格）

### 计划案例

1. 航班 check-in 窗口即将关闭 + 座位偏好协商
2. 限时折扣购物 + 预算约束
3. 会议排期：重叠时间段 + 优先级规则

### 技术挑战

- 需要在 mock environment 中集成实时时钟
- 评估必须考虑时序（agent 是否在窗口内完成操作？）
- 可复现性：使用相对时间偏移，而非绝对时间戳

---

## A4: Cross-Modal Interaction（跨模态交互）

**Status:** Roadmap (extension direction) — 建设成本高于 A3；建议先积累 pilot case，再作为正式 factor 入框。需要 vision-capable model。

### 定义

任务涉及异构模态的输入或输出（如图片、PDF、截图、验证码、语音），agent 必须跨模态感知并将信息整合进文本决策流程。

### Core Test Point

Modality Bridging — agent 能否准确提取非文本模态中的关键信息，并与文本服务流打通？

### 设计思路

- 任务信息关键部分嵌入图片/PDF（如截图中的订单号、PDF 中的合同条款）
- 需要解析验证码、图形化表单，或理解页面截图而非 DOM
- 以 Playwright 浏览器工具为基础，利用已有的 Chromium 基础设施

### 计划案例

1. 从 PDF 合同中提取关键条款 + 填写在线表单
2. 识别页面截图中的商品信息 + 完成下单流程
3. 解析含图片的邮件附件 + 触发后续服务操作

### 技术挑战

- 需要 agent 具备 vision 能力（multimodal LLM）
- 评估需区分「看到了但理解错」vs「根本没看」
- 建设成本高于 A3；建议先积累 pilot case，再作为正式 factor 入框

### 与其他因子的关系

- 与 A1 正交：A1 关注服务数量，A4 关注输入媒介的异质性
- 可与 A1 叠加：跨服务任务 + 关键信息藏在图片里

---

## B3: Multi-Agent Delegation（多 Agent 协调）

**Status:** Roadmap — 依赖 OpenClaw sub-agent 架构成熟度。

### 定义

需要 orchestrator 协调多个 sub-agent 完成任务。

### Core Test Point

Delegation & Synthesis — orchestrator 如何分配子任务、合并结果、处理冲突。

### 设计思路

- 以 OpenClaw 内部 sub-agent 架构为基础
- 设计天然可分解为并行子任务的场景
- 构造 sub-agent 产出冲突结果的情境

### 计划案例

1. 调研报告：从多个来源并行收集信息，然后综合
2. 多服务预订（酒店 + 航班 + 餐厅），跨 agent 约束满足
3. Code review + testing + deployment pipeline，各环节由专用 agent 负责

### 技术挑战

- 评估编排质量（不仅看最终结果）
- 衡量协调开销 vs. single-agent baseline
- 处理 sub-agent 的非确定性行为

---

## Axis C: Runtime Adaptability（执行中的动态应变）

### 现状

覆盖较薄 — 目前仅 `flight-seat-selection-failed` 和
`noise-filtering` 部分涉及此维度。

### C1: Environmental State Invalidation（环境状态失效）

**Status:** 下一优先扩展方向。

**在 agent 开始执行后**，环境状态因外部原因发生变化，导致 agent 已建立的状态假设被推翻，必须放弃原路径并重新规划。

**与 A2 的关键区别**：A2 = 环境一开始就已损坏（静态）；C1 = 环境在执行中途才发生变化（动态，外生原因触发）。

关键特征：
- 状态变化发生在**执行中途**，而非初始状态（初始损坏属于 A2）
- 变化来源于 agent 控制范围之外（服务侧限流、资源被第三方抢占、安全机制触发等）
- 与 A2 形成干净的时序切割：A2 是「一开始就坏了」，C1 是「中途才坏」

典型场景：
- 抢购过程中库存被清零（agent 确认有货 → 提交时已无库存）
- API rate limit 触发（前几次调用成功 → 后续调用被拒）
- 重访 URL 时弹出验证码（首次访问正常 → 再次访问需验证）
- 服务在任务执行过程中临时下线

> **命名演进记录**：原名 "Dynamic Feedback Handling"（过于宽泛）→ "Deterministic Failure Injection"
> （与 A2 高度重叠，且「确定性注入」限制了场景范围）→ 当前名 "Environmental State Invalidation"
> （强调「agent 建立的状态假设被推翻」，与 A2 在时序上形成干净切割，覆盖 rate limit、抢购、
> 验证码等更广泛的外生变化场景）。

**可复现性设计**：mock 环境须在第 N 次特定操作时确定性地触发状态失效
（如「第 2 次 POST /checkout 返回 409 Sold Out」），而非引入随机性。

### C2: Outcome Verification under Altered State（变化状态下的结果验证）

**Status:** Roadmap — 优先级低于 C1；推迟到 C1 pilot case 验证 C-axis 评估基础设施后再启动。

agent 必须观察环境状态来判断是否成功，没有简单的 pass/fail 信号。

典型场景：
- "邮件是否传达了正确的语气？"需要 agent 自我评估
- 操作后验证服务状态确实已更新，而非仅凭 API 返回值判断

### 扩展方向

- 在任务执行过程中确定性地注入状态失效（指定触发时机，而非随机）
- 要求 agent 实现 retry/fallback 策略
- 测试最优路径被阻断时的 graceful degradation
