# Harbor 任务格式

本文档描述 LiveClawBench 使用的 Harbor 任务格式和混合评估规则设计。

---

## 任务目录结构

每个任务遵循以下标准化目录布局：

```
<task_name>/
├── task.toml               # 任务元数据和资源配置
├── instruction.md          # 面向 agent 的任务描述
├── environment/
│   └── Dockerfile          # 构建环境
├── solution/
│   └── solve.sh            # 参考解
└── tests/
    └── test.sh             # 验证脚本
```

**各文件职责：**

- `task.toml` — 声明任务元数据（难度、领域、复杂度因子）和资源配置（CPU、内存、超时时间）
- `instruction.md` — 展示给 agent 的任务描述，模拟用户的自然语言请求
- `Dockerfile` — 基于 `liveclawbench-base:latest` 构建任务运行环境，包括应用依赖安装、数据库初始化和启动脚本
- `solve.sh` — 参考解脚本，用于验证任务可解性（不暴露给 agent）
- `test.sh` — 验证入口；评分文件因任务而异（参见下方[评估模式](#评估模式)）

---

## task.toml 模板

```toml
version = "1.0"

[metadata]
difficulty = "medium"          # easy | medium | hard
category = "open-world"
tags = ["e-commerce_daily_svcs", "communication_email"]

domain = "E-commerce & Daily Svcs"
domains_multi = ["E-commerce & Daily Svcs", "Communication & Email"]

# 三轴复杂度因子（0 = 不存在，1 = 存在）
factor_a1 = 1   # A1：跨服务依赖
factor_a2 = 0   # A2：初始状态污染
factor_b1 = 0   # B1：隐式目标解析
factor_b2 = 0   # B2：知识系统维护

case_id = 99    # 所有任务中唯一的整数（检查 ../../metadata/cases_registry_zh.csv）

[verifier]
timeout_sec = 900.0

[agent]
timeout_sec = 1800.0

[environment]
build_timeout_sec = 600.0
cpus = 2
memory_mb = 4096
storage_mb = 10240
allow_internet = true   # 如果 agent 需要访问 LLM API 则必须设置
```

**关键字段：**

| 字段 | 描述 |
|------|------|
| `case_id` | 唯一整数标识符；分配前检查 `../../metadata/cases_registry_zh.csv` |
| `domain` | 主要任务领域（如 `E-commerce & Daily Svcs`） |
| `domains_multi` | 任务涉及的所有领域，包括主要领域 |
| `factor_a1` .. `factor_b2` | 三轴框架复杂度因子标志 |
| `verifier.timeout_sec` | 验证脚本的最大执行时间 |
| `agent.timeout_sec` | agent 完成任务的最大时间 |
| `environment.build_timeout_sec` | Docker 环境构建超时时间 |
| `allow_internet` | 如果 agent 必须调用外部 LLM API，设置为 `true` |

**复杂度因子字段**（因子适用时设为 `1`，不适用时设为 `0`）：

| 字段 | 因子 |
|------|------|
| `factor_a1` | A1 — 跨服务依赖 |
| `factor_a2` | A2 — 初始状态污染 |
| `factor_b1` | B1 — 隐式目标解析 |
| `factor_b2` | B2 — 知识系统维护 |

---

## 混合评估规则

LiveClawBench 使用结果驱动的混合评估策略，在确定性和灵活性之间取得平衡。

**基于规则的验证（`test.sh`）：**

验证脚本在任务完成后检查环境状态：

- **数据库状态** — 查询 SQLite 数据库，验证预期记录是否存在（订单、邮件、日程等）
- **文件内容** — 检查生成文件的预期内容（技能文件、代码、报告等）
- **API 响应** — 调用 mock 服务 API，验证服务状态是否符合预期

**结果驱动原则：**

- Verifier 检查最终状态，而非 agent 的操作序列
- Agent 可通过任何策略达成目标：直接 API 调用、Web UI 操作、脚本等
- 这确保评估反映的是 agent 的真实能力，而非对操作路径的记忆

**部分分数：**

- 对于多步骤任务，verifier 将任务分解为独立的检查点
- 每个检查点独立评分；完成部分步骤可获得部分分数
- 示例：flight-info-change-notice 任务有三个检查点——"识别变更邮件"、"找到受影响的日程"、"发送通知"
- 这提供了细粒度的能力测量，避免全有或全无的评分

### 评估模式

LiveClawBench 任务使用三种评估模式之一，各适用于不同的验证需求：

| 模式 | `tests/` 中的文件 | 得分来源 | 使用任务 |
|------|-------------------|---------|---------|
| **verify.py** | `test.sh` + `verify.py` | `Score: X.X/1.0` | 电商、邮件、航班、日历、博客、vue 任务（18 个） |
| **evaluate.py** | `test.sh` + `evaluate.py` + `run_benchmark.sh` [+ `reference/`] | `TOTAL SCORE: X / 100` → 归一化为 0.0–1.0 | skill-* 任务（5 个） |
| **LLM judge** | `test.sh` + `deterministic_checks.py` + `llm_judge.py` + `answer_key.json` + `rubric.json` | 结构化 JSON → `reward.txt` | 研究/复杂任务（6 个） |

所有模式最终都向 `/logs/verifier/reward.txt` 写入标量得分。新任务推荐使用 `verify.py` 模式（完整合约参见[添加任务](../guide/adding-tasks.md)）。

### LLM judge 实现合约

使用 LLM judge 模式的任务必须遵循以下规范。

**凭证变量** — 在运行时通过 `--ee` 传入（而非 `--ae`；区别参见[运行任务](../guide/running-tasks.md#--ae-与---ee-的区别)）：

| 变量 | 是否必需 | 默认值 |
|------|----------|--------|
| `JUDGE_BASE_URL` | 是 | — |
| `JUDGE_API_KEY` | 是 | — |
| `JUDGE_MODEL_ID` | 否 | `deepseek-v3.2` |

`llm_judge.py` 在 `JUDGE_BASE_URL` 或 `JUDGE_API_KEY` 未设置时必须立即抛出 `RuntimeError`。不允许硬编码的兜底 URL 或模型名称——静默兜底会在评估时掩盖配置错误。

**变量命名** — 使用 `JUDGE_*` 前缀，全大写，无服务商特定前缀（不要用 `OPENCLAW_ARK_API_KEY` 等）。这使 verifier 接口与服务商无关。

**输出路径** — `llm_judge.py` 必须直接将 reward 文件写入 `/logs/verifier/`：

```python
import json, pathlib

verifier_dir = pathlib.Path("/logs/verifier")
verifier_dir.mkdir(parents=True, exist_ok=True)
(verifier_dir / "reward.json").write_text(json.dumps(reward_json, indent=2))
(verifier_dir / "reward.txt").write_text(str(final_score))
```

**不要**写入 `~/.openclaw/reward.*` 再依赖 `test.sh` 复制——这个中间步骤是多余的，会产生两份不一致的副本。Harbor 在 `test.sh` 运行前（阶段 5）已创建 `/logs/verifier/`，所以从 `test.sh`（阶段 6）调用的 `llm_judge.py` 始终可以直接写入。

> **注意**：现有 PKB 任务（noise-filtering、conflict-repair-acb、mixed-tool-memory、incremental-update-ctp、live-web-research-sqlite-fts5）仍使用 `~/.openclaw/reward.*` → `cp` 模式，将在未来清理；新任务必须遵循此规范。

**HTTP 客户端** — 当前实现使用 `urllib.request`（零外部依赖）。未来计划替换为 [LiteLLM](https://github.com/BerrtyCo/litellm)，提供跨 OpenAI 兼容、Anthropic、Gemini 等服务商的统一接口。优先级：OpenAI 兼容端点优先；其他格式可逐步验证。

<!-- TODO: 将 llm_judge.py 中的 urllib.request 替换为 litellm，待 LiteLLM 加入基础镜像（docker/base/Dockerfile）后执行。替换后可移除双端点兜底（chat/completions → responses），改用 litellm 内置的服务商路由。-->

---

### `reward.json` 结构

产生子维度得分的任务在 `reward.txt` 旁边写入 `/logs/verifier/reward.json`。两条通用规则，其余字段因任务类型而异：

| 规则 | 描述 |
|------|------|
| **`reward` 是必填字段** | 规范的汇总得分——`float ∈ [0.0, 1.0]`，所有子维度的归一化加权和。Harbor 使用此 key 进行数据集级别的指标统计。 |
| **非 float 字段使用 `_meta_` 前缀** | 任何字符串或嵌套对象字段（说明、模型名、模式标志）必须带 `_meta_` 前缀。Harbor 在 `reward_stats` 中独立追踪所有 `float \| int` key；未加前缀的字符串值会破坏数据集级别的聚合。 |

其他所有 `float | int` key 不受限制，因任务类型而异（如 `answer_accuracy`、`contract_valid`、`db_integrity`）。Harbor 在 `reward_stats` 中独立追踪每个数值 key；通过 `rubric.json` 中声明的权重汇总得到 `reward`。

最小示例：

```json
{
  "contract_valid":   1.0,
  "answer_accuracy":  0.75,
  "_meta_rationale":  "The agent correctly identified ...",
  "_meta_judge_model": "kimi-k2.5",
  "reward":           0.80
}
```

`reward.txt` 必须精确包含 `reward` 的值：

```
0.8
```
