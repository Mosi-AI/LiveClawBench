# What Makes Real Assistant Tasks Hard?

> LiveClawBench Paper §2 — Triple-Axis Complexity Framework

## 1. Opening Argument: 复杂度的叠加效应

现有 benchmark 的核心局限不在于任务太简单，而在于**只测单一维度的难度**。

SWE-bench 测 code editing，WebArena 测 web navigation，GAIA 测 multi-source retrieval——每个都在各自维度上做到了高质量，但它们共享一个隐含假设：**任务难度是单因子的**。

真实 assistant 场景不是这样运作的。一个用户说"帮我把上周那个订单退了，用退款买张下周三去上海的机票"，这句话同时触发了：

- **Cross-service data flow**: 订单系统 → 退款系统 → 航班系统 → 日历系统
- **Implicit goal resolution**: "上周那个订单"需要 agent 自行定位；"下周三"需要推算日期
- **State contamination**: 退款可能失败、航班可能售罄，agent 必须处理非理想初始状态

单独测任何一个因子都不难。**难的是它们叠在一起时，错误会级联放大**——一个环节的误判会污染下游所有决策。这就是 factor stacking effect。

LiveClawBench 的设计目标是：构建一个能**系统性测量复杂度叠加效应**的 benchmark，而不是又一个单维度排行榜。

---

## 2. Triple-Axis Complexity Framework

我们将 assistant task 的复杂度分解为三个正交轴（orthogonal axes），每个轴包含可独立操控的 complexity factors。

### Axis A: Environment Complexity（外部世界的复杂性）

这个轴衡量的是 agent 需要与多少个、多复杂的外部系统交互。

| Factor | Definition | Core Test Point | Coverage |
|--------|-----------|----------------|----------|
| **A1: Cross-Service Dependency** | Task requires data flow across ≥2 heterogeneous services | Schema mapping (e.g., email order ID → logistics tracking API) | 10 cases |
| **A2: Contaminated Initial State** | Environment contains faulty, outdated, or inconsistent initial state | Diagnosis before execution — agent must detect and correct before proceeding | 6 cases |
| **A3: Temporal & Resource Constraints** | Task has time windows, quota limits, or rate-limiting | Opportunity cost reasoning under scarcity | *roadmap* |
| **A4: Cross-Modal Interaction** | Key task information is embedded in non-text modalities (images, PDFs, screenshots, CAPTCHAs) | Modality bridging — extract and integrate information across input types | *roadmap* |

A1 是最基础也最普遍的复杂度来源。关键测试点不是"能不能调两个 API"，而是 **schema mapping 的准确性**——email 里的 order ID 格式和物流系统的 tracking number 格式不同，agent 需要正确转换。10 个 cases 覆盖了 2-service 到 4-service 的梯度。

A2 更加隐蔽。传统 benchmark 假设环境是 clean state——agent 拿到的初始条件都是正确的。但现实中，数据库里可能有脏数据、配置文件可能过期、上一个操作可能留下了半完成的状态。A2 要求 agent 先 **diagnose** 再 execute，这是一个质变。

A3 目前在 roadmap 阶段。时间窗口和资源配额引入了 opportunity cost——agent 不仅要做对，还要在约束内做对。这需要 planning 能力的本质提升。

### Axis B: Cognitive Demand（内部推理的深度）

这个轴衡量的是 agent 内部推理链的深度和持久性。

| Factor | Definition | Core Test Point | Coverage |
|--------|-----------|----------------|----------|
| **B1: Implicit Goal Resolution** | User instruction lacks key preconditions or sub-goals | Proactive clarification / common-sense completion | 4 cases |
| **B2: Knowledge System Maintenance** | Task involves creating, updating, or maintaining persistent knowledge/skills | State tracking + delta update across sessions | 11 cases |
| **B3: Multi-Agent Delegation** | Requires an orchestrator to coordinate multiple sub-agents | Task decomposition, delegation, and synthesis | *roadmap* |

B1 测试的是 agent 能否从模糊指令中提取完整的执行计划。"帮我订个餐厅"——几个人？什么菜系？什么价位？什么时间？agent 需要判断哪些信息必须追问，哪些可以用 common sense 填充。4 个 cases 目前覆盖了从轻度模糊到严重缺失的梯度。

B2 是 LiveClawBench 最独特的贡献之一。现有 benchmark 几乎都是 stateless 的——每个 task 独立，不需要维护跨任务的知识。但真实 assistant 需要管理 skill library、更新 knowledge base、处理 schema evolution。11 个 cases 覆盖了 skill creation、skill update、skill merge、conflict resolution 等场景。

B3 目前在 roadmap 阶段。Multi-agent delegation 需要 orchestrator 具备 task decomposition 和 result synthesis 能力，这是当前 LLM agent 的前沿挑战。

### Axis C: Runtime Adaptability（执行中的动态应变）

> **Status: Next Priority Expansion Direction**

Axis C 关注的是**同一任务场景下正常流程与异常流程的对照**。与 A 轴和 B 轴不同，C 轴的核心不是环境数量或推理深度，而是**确定性的环境状态差异**——同一个任务场景，预设正常状态 vs 预设异常状态，完全可复现。

当前有两个 case 初步验证了这个维度：

- `flight-seat-selection`（正常流程）vs `flight-seat-selection-failed`（异常流程）：同一个选座场景，后者的环境预设了座位不可用状态，agent 需要检测失败并切换到备选方案
- `noise-filtering`: 环境返回的数据中混入了结构化噪声，agent 需要在处理过程中过滤

这两个 case 验证了两个 sub-factor 的可测性：

- **C1: Environmental State Invalidation** — 在 agent 开始执行后，环境状态因外部原因发生变化（服务限流、资源被抢占、安全机制触发等），导致 agent 已建立的状态假设被推翻，必须放弃原路径并重新规划。关键特征：变化发生在执行中途（区别于 A2 的初始损坏），来源于 agent 控制范围之外，在 mock 环境中通过确定性触发时机实现可复现性
- **C2: Outcome Verification under Altered State** — 在环境状态被改变的条件下，agent 必须主动观察环境来判断任务是否真正完成，而非依赖简单的 success flag

C 轴的设计优势在于**公平性和可复现性**——每次运行的环境状态完全相同，评估结果不受随机因素影响。这与传统 "non-deterministic testing" 的思路不同：我们通过确定性地注入不同的环境状态来测试 agent 的应变能力，而非引入运行时随机性。

---

## 3. Benchmark Comparison

| Benchmark | A: Env Complexity | B: Cognitive Demand | C: Runtime Adapt. | Controlled Pairs |
|-----------|-------------------|---------------------|--------------------|------------------|
| SWE-bench | single repo env | fully specified goals | clean initial state | ✗ |
| WebArena | single web env | fully specified goals | clean initial state | ✗ |
| TerminalBench | single terminal env | long-horizon planning | some diagnosis tasks | ✗ |
| GAIA | multi-source retrieval | implicit sub-goals | clean initial state | ✗ |
| τ-bench | single service env | implicit preferences | dynamic user feedback | ✗ |
| **LiveClawBench** | **multi-service (2-4 svcs)** | **implicit + persistent knowledge** | **partial → roadmap** | **✓** |

关键差异点：

1. **Multi-service vs. single env**: SWE-bench/WebArena/TerminalBench 都在单一环境内操作。GAIA 虽然涉及多数据源，但不涉及跨服务的 write 操作和 schema mapping。LiveClawBench 的 cases 需要在多个 Docker 化服务之间完成完整的 read-transform-write 数据流。

2. **Persistent knowledge**: 除 LiveClawBench 外，没有 benchmark 测试 agent 维护和演化 persistent skill/knowledge 的能力。这是 B2 维度的独占优势。

3. **Controlled pairs**: 这是 LiveClawBench 的方法论创新。我们设计了 natural contrast groups——同一个 base task 的不同变体，每个变体只改变一个 complexity factor。这使得我们可以通过 controlled experiment 精确测量单个 factor 对 agent performance 的边际影响，而非只能报告一个 aggregate score。

---

## 4. Why This Framework Matters

### 4.1 Grounded in Real Usage, Not Theory

这个 framework 不是从论文里推导出来的。它来自对 **1000+ 真实 OpenClaw 用户交互记录**的系统性分析。

我们的方法是 bottom-up 的：先标注真实 failure cases，再归纳 failure patterns，最后抽象为 complexity factors。每个 factor 都有明确的 empirical grounding——不是"我们认为这很重要"，而是"我们观察到 agent 在这里系统性地失败"。

### 4.2 Enables Controlled Experiments via Natural Contrast Groups

传统 benchmark 只能告诉你"Model A 在 Task X 上得了 72 分"。但你无法知道：是因为 cross-service mapping 做错了？还是因为没有识别出 contaminated state？还是因为 implicit goal 没有正确展开？

LiveClawBench 的 controlled pairs 设计解决了这个问题。例如：

```
Base task:     "退订单 + 买机票"  (A1 + B1)
Variant 1:    "退订单 + 买机票"  (A1 only, goals fully specified)
Variant 2:    "退订单 + 买机票"  (B1 only, single service)
```

通过比较 base task 和 variants 的 performance delta，我们可以精确量化 factor stacking 的 compounding effect：

```
Stacking penalty = Score(base) - min(Score(v1), Score(v2))
```

如果 stacking penalty 显著为负，说明 factors 之间存在 negative interaction——agent 在同时面对多个 complexity factors 时的表现，比面对最难的单个 factor 时还要差。

### 4.3 First Framework to Measure Factor Stacking

据我们所知，LiveClawBench 是第一个将 **factor stacking effect** 作为一等公民（first-class citizen）来测量的 agent benchmark。

这不仅是一个 evaluation 工具，更是一个 **diagnostic 工具**——它能告诉 agent 开发者，你的 agent 到底在哪个 complexity axis 上最脆弱，以及 factors 之间的哪些组合会导致 catastrophic performance degradation。

---

## Appendix: Axis C Expansion Roadmap

Axis C 的扩展计划分三步：

1. **Phase 1 — Environmental State Invalidation**: 在现有 multi-service cases 中注入确定性的执行中状态失效（API 返回特定错误码、资���标记为不可用、数据预设已知缺陷），构建正常/异常流程对照组，观察 agent 的 recovery behavior
2. **Phase 2 — Graduated Failure Severity**: 为同一个 task 构建多个 failure severity 等级（轻度异常 → 严重异常），测试 agent 在不同异常强度下的 robustness，所有变体均为确定性可复现
3. **Phase 3 — Adaptive Verification**: 开发基于 environment state observation 的 test oracle，验证 agent 在异常状态下是否采取了合理的恢复策略
