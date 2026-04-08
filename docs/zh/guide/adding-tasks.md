# 添加任务

本指南说明如何为 LiveClawBench 创建新的 benchmark 任务并通过 pull request 提交。

## 任务目录结构

在 `tasks/<task-name>/` 下创建目录，遵循以下布局：

```
tasks/<task-name>/
├── task.toml           # 必需：元数据、超时时间、资源限制
├── instruction.md      # 必需：面向 agent 的任务描述
├── environment/
│   └── Dockerfile      # 必需：容器构建定义
├── solution/
│   └── solve.sh        # 参考解：证明任务可解 + 验证 verifier 逻辑
│                       # 使用 --agent oracle 运行；正常评测时不执行
└── tests/
    ├── test.sh         # 必需：验证入口（Harbor 在运行时上传此文件）
    └── verify.py       # 必需：评分逻辑
```

命名规范：使用从任务逻辑名称派生的 `kebab-case`（如 `flight-seat-selection`）。

## 执行生命周期

了解每个任务文件的运行时机，有助于编写正确的 Dockerfile、启动脚本和 verifier。

```
阶段 1  容器构建    Dockerfile → 镜像（environment/Dockerfile）
阶段 2  环境初始化  /entrypoint.sh → startup.sh（后台）→ sleep 5s → 服务就绪
阶段 3  Agent 配置  Harbor 将 LLM 服务商配置写入 ~/.openclaw/openclaw.json
阶段 4  任务执行    openclaw agent --session-id harbor --message "<instruction.md 内容>"
阶段 5  Verifier 初始化  Harbor 将 tests/ 上传到容器，创建 /logs/verifier/
阶段 6  验证        bash /tests/test.sh → verify.py → 写入 reward.json + reward.txt
阶段 7  结果收集    Harbor 读取 /logs/verifier/reward.txt，保存 result.json
阶段 8  清理        容器停止并移除
```

文件对应关系：
- **阶段 1** → `environment/Dockerfile`
- **阶段 2** → `environment/entrypoint.sh` + `environment/startup.sh`
- **阶段 3** → Harbor OpenClaw adapter（自动）
- **阶段 4** → agent 读取 `instruction.md` 内容
- **阶段 5–6** → `tests/test.sh` + `tests/verify.py`
- **`solution/solve.sh`** → 仅在使用 `--agent oracle` 时的阶段 4 执行；正常评测不运行

> **重要：** `tests/` 目录由 Harbor 在运行时上传——**不会**在 `docker build` 阶段打包进镜像。不要依赖 `tests/` 在构建阶段存在。

## `task.toml` 字段参考

```toml
version = "1.0"

[metadata]
difficulty = "medium"          # easy | medium | hard
category = "open-world"
tags = ["e-commerce_daily_svcs", "communication_email"]

domain = "E-commerce & Daily Svcs"
domains_multi = ["E-commerce & Daily Svcs", "Communication & Email"]

# 三轴复杂度因子（0 = 不存在，1 = 存在）
factor_a1 = 1   # A1：跨服务依赖——任务横跨多个服务/API
factor_a2 = 0   # A2：初始状态污染——有预先存在的噪声需要 agent 解决
factor_b1 = 0   # B1：隐式目标解析——目标未明确说明，agent 需推断意图
factor_b2 = 0   # B2：知识系统维护——agent 需持久化或更新结构化知识

case_id = 99    # 所有任务中唯一的整数（检查 ../../metadata/cases_registry_zh.csv）

[verifier]
timeout_sec = 900.0    # verify.py 在 agent 完成后的最大运行时间

[agent]
timeout_sec = 1800.0   # agent 完成任务的最大时间

[environment]
build_timeout_sec = 600.0
cpus = 2
memory_mb = 4096
storage_mb = 10240
allow_internet = true  # 所有 OpenClaw 任务必须设置（agent 需调用 LLM API）
```

> **关键：** `allow_internet = true` 对于 agent 在容器内使用 LLM API 的所有任务（即所有 OpenClaw 任务）都是必须的。

## Dockerfile 要求

所有任务 Dockerfile 继承自 `liveclawbench-base:latest`，该基础镜像已预装 HTTPS apt source 修复、`python3 python3-pip python3-venv curl`、`/usr/bin/chromium` 的 Playwright Chromium 以及 `/workspace/output`。**构建任意任务镜像前，必须先构建基础镜像：**

```bash
docker build -t liveclawbench-base:latest docker/base/
```

30 个现有任务使用四种模式——选择与您的任务类型匹配的：

### 模式 1：静态文件（skill-\*、blog-site-\*、vue-project-\*）

无后台服务。Agent 直接读写 `/workspace/environment/` 下的文件。无需 `ENTRYPOINT`。

```dockerfile
FROM liveclawbench-base:latest

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true
USER root

# 仅安装任务特定工具（python3/pip/venv/curl 已在基础镜像中）
RUN apt-get update && apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

COPY . /workspace/environment/
```

### 模式 2：Python 后端服务（shop-app 系列）

单个 Python 后端；`startup.sh` 位于 `/workspace/environment/startup.sh`。

```dockerfile
FROM liveclawbench-base:latest

COPY . /workspace/environment/
# --no-cache-dir: 减少镜像层大小
# --break-system-packages: Debian Bookworm（PEP 668）必需——系统 Python 被标记为
#   "externally managed"，不加此参数 pip install 会失败
RUN cd /workspace/environment/shop-app/backend && pip install --no-cache-dir --break-system-packages -r requirements.txt

COPY startup.sh /workspace/environment/startup.sh
RUN chmod +x /workspace/environment/startup.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "sleep infinity"]
```

### 模式 3：全栈服务（airline-app / email-app 系列）

Python 后端 + Node.js 前端；`startup.sh` 位于 `/workspace/startup.sh`。

```dockerfile
FROM liveclawbench-base:latest

COPY . /workspace/environment/
# --no-cache-dir: 减少镜像层大小
# --break-system-packages: Debian Bookworm（PEP 668）必需
RUN cd /workspace/environment/your-app/backend && pip install --no-cache-dir --break-system-packages -r requirements.txt
RUN cd /workspace/environment/your-app/frontend && npm install

COPY startup.sh /workspace/startup.sh
RUN chmod +x /workspace/startup.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "sleep infinity"]
```

### 模式 4：ARG 覆盖（知识/研究任务）

工作目录为 `/home/node/.openclaw/`；以 `node` 用户运行；`ARG OPENCLAW_BASE_IMAGE` 允许 Harbor 在运行时替换基础镜像。

```dockerfile
ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

ENV HOME=/home/node \
    OPENCLAW_ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3 \
    OPENCLAW_ARK_MODEL=kimi-k2.5
WORKDIR /home/node/.openclaw

USER root
RUN mkdir -p /home/node/.openclaw/output /home/node/.openclaw/workspace/memory \
             /home/node/.openclaw/tests /home/node/.openclaw/tools /home/node/.openclaw/solution \
    && chown -R node:node /home/node

COPY corpus/ /home/node/.openclaw/corpus/
COPY workspace_seed/ /home/node/.openclaw/workspace/

USER node
```

- 服务通过 `localhost:<port>` 对 agent 可访问

## `verify.py` 合约

### 输出格式

Harbor 支持 `test.sh` 并行写入的两个输出文件：

| 文件 | 格式 | 用途 |
|------|------|------|
| `/logs/verifier/reward.txt` | 纯标量 | 必需；Harbor 读取此文件获取最终得分 |
| `/logs/verifier/reward.json` | 结构化 JSON | 推荐；用于事后分析的子维度得分和元数据 |

**推荐模式：双写。** 同时写两个文件。`reward.txt` 是权威的标量；`reward.json` 保留每个维度的细节用于分析。Harbor 优先读 `reward.txt`；仅当 `reward.txt` 缺失时才以 `reward.json` 作为兜底。

`reward.json` schema——两条硬性规则，其余字段因任务类型而异：

```json
{
  "dimension_a": 0.75,
  "dimension_b": 1.0,
  "_meta_rationale": "The agent correctly identified ...",
  "_meta_judge_model": "kimi-k2.5",
  "reward": 0.875
}
```

**`reward.json` 规则：**

1. **`reward` 是必填字段** — 规范的汇总得分，`float ∈ [0.0, 1.0]`，所有子维度的归一化加权和。Harbor 使用此 key 进行数据集级别的指标统计。
2. **非 float 字段使用 `_meta_` 前缀** — 任何字符串或嵌套对象字段（说明、模型名、模式标志）必须使用 `_meta_` 前缀。Harbor 的 `VerifierResult` 模型强制要求 `rewards: dict[str, float | int]`；未加前缀的字符串值会在 Harbor 将 `reward.json` 作为唯一 reward 文件读取时引发 Pydantic `ValidationError`，导致 trial 以异常中止。（双写时，Harbor 读取 `reward.txt` 而从不解析 `reward.json`，因此此约束仅对仅 JSON 的任务有影响——但使用前缀是良好的规范习惯。）
3. **其他 `float | int` key 因任务类型而异** — 子维度得分（如 `answer_accuracy`、`contract_valid`、`db_integrity`）不受限制。所有数值 key 在 `reward_stats` 中独立追踪；通过 `rubric.json` 中的权重从中计算 `reward`。

`reward.txt` 仅包含 `reward` 值：

```
0.875
```

### 合约要求

`verify.py` **必须**：
1. 打印匹配 `Score: X.X/1.0` 的行（如 `Score: 1.0/1.0` 或 `Score: 0.5/1.0`）
2. 得分 ≥ 0.5 时以代码 `0` 退出（通过阈值）
3. 得分 < 0.5 时以非零代码退出

`test.sh` **必须**：
1. 调用 `verify.py`（或等效的评分逻辑）
2. 将标量得分写入 `/logs/verifier/reward.txt`
3. 对于有子维度评分的任务，还需按上述规则写入 `/logs/verifier/reward.json`

评分规范：
- `1.0` — 任务完全完成
- `0.5` — 有实质进展（部分分数）
- `0.0` — 任务失败

### 最小 verify.py 示例

```python
#!/usr/bin/env python3
"""Task verification script."""

def evaluate() -> float:
    # ... 评分逻辑 ...
    return score

if __name__ == "__main__":
    score = evaluate()
    print(f"Score: {score:.1f}/1.0")
    import sys
    sys.exit(0 if score >= 0.5 else 1)
```

### 双写 test.sh 示例

```bash
#!/usr/bin/env bash
set -euo pipefail
mkdir -p /logs/verifier

SCORE=$(python3 /tests/verify.py 2>&1 | grep -oP 'Score:\s*\K[0-9.]+' | tail -1)
echo "$SCORE" > /logs/verifier/reward.txt

# 可选：写入结构化 JSON 用于子维度分析
python3 -c "
import json
score = float('$SCORE')
result = {'reward': score}
json.dump(result, open('/logs/verifier/reward.json', 'w'), indent=2)
"
echo "Verification score: $SCORE"
```

## `solve.sh` — 参考解基准

`solution/solve.sh` 有两个用途：

1. **验证任务可解性** — 证明任务可以解决，且 `verify.py` 逻辑正确。在任务开发过程中运行，确认 `verify.py` 对正确解给出满分（1.0）。
2. **提供参考解** — 在运行 oracle agent 时建立基准得分。oracle 得分与 agent 得分之间的差距量化了任务难度。

`solve.sh` **仅在** `harbor run` 传入 `--agent oracle` 时执行。正常使用 `-a openclaw` 评测时不运行。

```bash
# 运行 oracle agent 验证任务并建立基准
harbor run -p tasks/<task-name> --agent oracle -n 1 -o jobs
```

## 提交前验证

运行任务验证器检查结构性问题：

```bash
python scripts/validate_tasks.py
```

验证器检查：
- 所有必需文件是否存在
- 目录名是否符合 `kebab-case` 规范
- `task.toml` 是否包含必填字段（`version`、`difficulty`、`case_id`、`domain`、`allow_internet`）
- `case_id` 在所有任务中是否唯一
- 存根警告：`instruction.md` 太短、`test.sh` 仅含 echo、`solve.sh` 缺失

所有 30 个现有任务必须继续通过验证。

## 提交清单

1. 创建 `tasks/<task-name>/`，包含所有必需文件
2. 在 `task.toml` 的 `[environment]` 下设置 `allow_internet = true`
3. 分配唯一的 `case_id`（检查 `../../metadata/cases_registry_zh.csv`）
4. 在 `registry.json` 中添加条目
5. 在 `../../metadata/cases_registry_zh.csv` 中添加一行
6. 运行 `python scripts/validate_tasks.py`——所有任务必须通过
7. Fork 仓库并创建分支：`task/<task-name>`
8. 提交 pull request，简要描述任务内容

## 常见陷阱

**服务启动竞态条件**
如果 Dockerfile 启动后台服务，在 entrypoint 中发出就绪信号前需加入 `sleep`。标准模式是在 `startup.sh` 中、agent 开始前 sleep 5 秒。

**case_id 冲突**
选择 `case_id` 前务必检查 `../../metadata/cases_registry_zh.csv`。验证器会捕获重复项，但事后解决冲突会比较麻烦。

**静态任务不需要 Entrypoint**
只有运行后台服务（Web 服务器、数据库）的任务才需要 `startup.sh`、`entrypoint.sh`、`ENTRYPOINT` 和 `CMD`。静态文件任务（skill-\*、blog-site-\*、vue-project-\*）不需要这些——agent 直接访问 `/workspace/environment/`。为静态任务添加不必要的 entrypoint 样板代码不会造成破坏，但会浪费构建时间并让阅读者困惑。

**Agent 文件路径解析：相对路径 vs 绝对路径（模式 4 任务）**

对于在 `/home/node` 下运行的模式 4 任务（知识/研究任务），OpenClaw 将 agent 的工作区根目录解析为：

```
$HOME/.openclaw/workspace/         # 默认
$HOME/.openclaw/workspace-${OPENCLAW_PROFILE}/   # 如果设置了 OPENCLAW_PROFILE
```

这意味着 `instruction.md` 中的裸路径如 `output/result.json` 会被 agent 解释为 `$HOME/.openclaw/workspace/output/result.json`，**而非** `$HOME/.openclaw/output/result.json`。这是两个不同的目录。

**任务设计决策：** 以下两种方式均有效，选择一种并保持一致：

- **选项 A — Verifier 适配**：保持 `instruction.md` 自然描述（如 `output/result.json`），让 verifier（`deterministic_checks.py` / `llm_judge.py`）同时检查两个候选路径：
  ```python
  candidates = [
      Path.home() / ".openclaw/output/result.json",
      Path.home() / ".openclaw/workspace/output/result.json",
  ]
  result_path = next((p for p in candidates if p.exists()), None)
  ```
  这种方式对用户更友好，更具容错性——**新任务推荐此方式**。

- **选项 B — instruction 中使用绝对路径**：在 `instruction.md` 中使用完整的绝对路径（`/home/node/.openclaw/output/result.json`）。消除歧义，但冗长且将容器内部细节暴露在任务描述中。

现有 PKB 任务目前使用选项 B。新任务应优先使用选项 A——让 verifier 处理两个位置，使指令保持可读性。
