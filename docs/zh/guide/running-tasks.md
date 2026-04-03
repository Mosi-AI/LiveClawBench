# 运行任务

本指南介绍如何使用 Harbor CLI 运行 benchmark 任务、配置 API 凭证和查看评测结果。

## 前置要求

Harbor CLI 必须已安装。如果尚未运行 `./setup.sh`，请先执行：

```bash
./setup.sh
harbor --version   # 验证安装
```

## 运行单个任务

```bash
harbor run \
  -p tasks/<task-name> \
  -a openclaw \
  -m custom/<YOUR_MODEL_ID> \
  -n 1 \
  -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>" \
  --timeout-multiplier 2.0 \
  --debug
```

在 `LiveClawBench/` 目录下运行。任务路径为相对路径。

### 参数说明

| 参数 | 描述 |
|------|------|
| `-p <path>` | 任务目录路径（必须包含 `task.toml`） |
| `-a openclaw` | Agent 名称——ClawBench 任务始终使用 `openclaw` |
| `-m <provider>/<model-id>` | 待评测的模型（参见下方模型名称格式） |
| `-n <int>` | 每个任务的运行次数（单次评测用 `1`） |
| `-o <dir>` | 结果输出目录（不存在则自动创建） |
| `--ae KEY=VALUE` | 仅注入 **agent 进程**的环境变量（通过 `openclaw.json`）；可重复使用 |
| `--ee KEY=VALUE` | 注入**容器环境**的环境变量（对所有进程可见，包括 verifier）；可重复使用 |
| `--timeout-multiplier <float>` | 缩放 `task.toml` 中的所有超时时间（默认 `1.0`） |
| `--debug` | 详细日志；失败时保持容器运行以便检查 |

### `--ae` 与 `--ee` 的区别

两个参数都向 Docker 容器注入环境变量，但作用范围不同：

| 参数 | 注入方式 | 可见范围 |
|------|----------|----------|
| `--ae` | Harbor 将值写入 `~/.openclaw/openclaw.json`，仅 `openclaw` agent 进程读取 | 仅 OpenClaw agent 进程 |
| `--ee` | 通过 `docker run -e KEY=VALUE` 传入，设置在容器的 shell 环境中 | 容器内所有进程——agent、`test.sh`、`verify.py`、`llm_judge.py` |

**使用原则：** `--ae` 用于模型的 API key 和 base URL（agent 调用的凭证）。`--ee` 用于 verifier 需要读取的变量——特别是 LLM judge 凭证（参见下方 [LLM judge 任务](#llm-judge-任务)）。

## 传入 API Key

API key 在运行时通过 `--ae` 或 `--ee` 注入容器，永远不会内置到镜像中。

```bash
# 单一服务商
harbor run ... --ae VOLCANO_ENGINE_API_KEY="$VOLCANO_ENGINE_API_KEY"

# 多个服务商
harbor run ... \
  --ae ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --ae OPENAI_API_KEY="$OPENAI_API_KEY"
```

也可以在运行前 source `.env` 文件，使变量在 shell 中可用：

```bash
source .env
harbor run ... --ae VOLCANO_ENGINE_API_KEY="$VOLCANO_ENGINE_API_KEY"
```

## 模型名称格式

模型以 `<provider>/<model-id>` 格式指定：

| 格式 | 示例 |
|------|------|
| `volcengine-plan/<model-id>` | `volcengine-plan/kimi-k2.5` |
| `volcengine/<model-id>` | `volcengine/deepseek-v3-250324` |
| `moonshot/<model-id>` | `moonshot/kimi-k2.5` |
| `anthropic/<model-id>` | `anthropic/claude-opus-4-6` |
| `openai/<model-id>` | `openai/gpt-4o` |
| `custom/<model-id>` | `custom/deepseek-chat` |

`volcengine` 和 `volcengine-plan` 已在 OpenClaw adapter 中显式注册。标准服务商（Anthropic、OpenAI、Gemini）通过环境变量自动发现。对于其他 OpenAI 兼容端点，使用 `custom/`，并通过 `--ae` 传入 `CUSTOM_BASE_URL` 和 `CUSTOM_API_KEY`。

### 添加自定义服务商

**零代码方案：** 使用内置的 `custom/` 前缀测试任意 OpenAI 兼容端点，无需修改源码：

```bash
harbor run -p tasks/watch-shop -a openclaw \
  -m custom/deepseek-chat \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="https://api.deepseek.com/v1" \
  --ae CUSTOM_API_KEY="$DEEPSEEK_API_KEY"
```

**可选模型参数** — 通过额外的 `--ae` 参数覆盖默认值：

| `--ae` 变量 | 默认值 | 用途 |
|---|---|---|
| `CUSTOM_CONTEXT_WINDOW` | `128000` | 模型上下文窗口（token 数） |
| `CUSTOM_MAX_TOKENS` | `4096` | 每次响应的最大输出 token 数 |
| `CUSTOM_REASONING` | `false` | 启用推理/思考模式（`true`/`1`/`yes`） |
| `CUSTOM_API` | `openai-completions` | API 类型（`openai-completions` 或 `openai-responses`） |

使用大上下文推理模型的示例：

```bash
harbor run -p tasks/watch-shop -a openclaw \
  -m custom/my-model \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="https://api.example.com/v1" \
  --ae CUSTOM_API_KEY="$MY_API_KEY" \
  --ae CUSTOM_CONTEXT_WINDOW=256000 \
  --ae CUSTOM_MAX_TOKENS=16384 \
  --ae CUSTOM_REASONING=true
```

> **自动推断**：Harbor 根据 `CUSTOM_REASONING` 自动注入 `--thinking`：
> - `CUSTOM_REASONING=true` → `--thinking medium`（平衡思考深度与 token 成本）
> - `CUSTOM_REASONING=false` → `--thinking off`（显式关闭思考）
>
> 这使 `CUSTOM_REASONING` 成为统一管理评测默认值的单一入口。如需其他强度，通过 `--ak thinking=<level>` 显式覆盖（可选值：`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`adaptive`）。
>
> **优先级链**：`--ak thinking=X`（最高）> `CUSTOM_REASONING` 自动注入 > OpenClaw 内部默认值。显式 `--ak` 始终优先。
>
> **`--ak` 与 `--ae` 的区别**：使用 `--ak key=value`（agent kwarg）设置 agent CLI 参数（如 `thinking`）。使用 `--ae KEY=VALUE`（agent env）设置传入容器的环境变量（如 API key）。只有 `--ak` 会参与 CLI 参数生成；`--ae` 值仅注入容器进程环境。

**永久注册：** 如果希望使用命名服务商（如 `my-provider/model-id`）而无需每次传 `--ae CUSTOM_BASE_URL`，可在 `harbor/src/harbor/agents/installed/openclaw.py` 的 `_PROVIDER_CONFIGS` 中添加：

```python
"my-provider": {
    "baseUrl": "https://api.example.com/v1",
    "api": "openai-completions",
    "apiKey": "${MY_PROVIDER_API_KEY}",   # ${VAR} 由 OpenClaw 在运行时通过环境变量替换
},
```

然后将 `my-provider/model-id` 作为 `-m` 参数，并通过 `--ae MY_PROVIDER_API_KEY="your-key"` 传入 key。

### Provider 路由：Thinking/Reasoning 参数注入

不同 LLM API 使用不同的请求体字段来启用深度思考。Harbor 利用 OpenClaw 已有的 provider wrapper 注入正确的参数——根据端点支持的 API 字段选择 provider 名称：

| 场景 | Provider | 注入的 API 参数 |
|------|----------|----------------|
| 模型支持 `reasoning.effort` | `-m openrouter/<model>` | `reasoning: { effort: "<level>" }` |
| 模型支持 `thinking.type` | `-m moonshot/<model>` | `thinking: { type: "enabled" }` |
| Anthropic 原生模型 | `-m anthropic/<model>` | 原生 thinking API |
| 通用 OpenAI-compatible | `-m custom/<model>` | 无 thinking 参数注入 |

三种 provider（`openrouter`、`moonshot`、`custom`）共用相同的 `CUSTOM_*` 环境变量：

```bash
# 示例：支持 reasoning.effort 的火山引擎端点
harbor run -p tasks/<task> -a openclaw \
  -m openrouter/<model-id> -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="https://ark.cn-beijing.volces.com/api/v3" \
  --ae CUSTOM_API_KEY="$VOLCANO_ENGINE_API_KEY" \
  --ae CUSTOM_REASONING=true

# 示例：支持 thinking.type 的端点
harbor run -p tasks/<task> -a openclaw \
  -m moonshot/<model-id> -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="https://api.example.com/v1" \
  --ae CUSTOM_API_KEY="$API_KEY" \
  --ae CUSTOM_REASONING=true
```

未设置 `CUSTOM_BASE_URL` 时，`openrouter` 和 `moonshot` 会回退到各自的默认服务端点（OpenRouter 和 Moonshot）。

> **模型名称格式**：使用两段式名称，如 `openrouter/<model-id>`（例如 `openrouter/kimi-k2.5`）。三段式名称如 `openrouter/zai/glm-5` 无法正确路由，因为 Harbor 按最后一个 `/` 分割，provider 会变成 `openrouter/zai` 而非 `openrouter`。

## 查看结果

运行完成后，Harbor 将输出写入通过 `-o` 指定的目录：

```
jobs/
└── <job-id>/                          # 时间戳，如 2026-03-29__21-11-23
    ├── config.json                    # 任务级配置快照
    ├── result.json                    # 汇总奖励分布
    └── <task-name>__<random>/         # 每次 trial 一个子目录
        ├── verifier/
        │   ├── reward.txt             # 标量得分（0.0–1.0）
        │   └── test-stdout.txt        # verifier 的 stdout/stderr
        └── agent/
            ├── openclaw.txt           # 完整的 agent 会话日志
            └── trajectory.json        # ATIF 结构化轨迹
```

一次性查看所有得分：

```bash
find jobs -name reward.txt | sort | xargs -I{} sh -c 'echo "{}: $(cat {})"'
```

| 得分 | 含义 |
|------|------|
| `1.0` | 任务完全解决 |
| `0.5` | 有实质进展（部分分数） |
| `0.0` | 任务失败 |

## 运行多次 Trial

使用 `-n` 对同一任务运行多次独立 trial：

```bash
harbor run -p tasks/flight-seat-selection -a openclaw \
  -m anthropic/claude-opus-4-6 -n 3 -o jobs \
  --ae ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
```

## 运行完整数据集

LiveClawBench 在本地 `registry.json` 中将 30 个任务注册为数据集 `liveclawbench@1.0`。

### 方案一：本地 registry（推荐用于开发）

```bash
harbor run --dataset liveclawbench@1.0 \
  --registry-path ./registry.json \
  -a openclaw \
  -m custom/<YOUR_MODEL_ID> \
  --n-concurrent 4 \
  -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>" \
  --ee JUDGE_BASE_URL="<YOUR_JUDGE_BASE_URL>" \
  --ee JUDGE_API_KEY="<YOUR_JUDGE_API_KEY>" \
  --ee JUDGE_MODEL_ID="deepseek-v3.2"
```

> **为什么需要 `--registry-path`？** Harbor 的 `--dataset` 参数默认从 `github.com/laude-institute/harbor` 获取 registry。由于 `liveclawbench` 仅注册在本地 `registry.json` 中，必须传入 `--registry-path ./registry.json` 告知 Harbor 数据集定义的位置。

### 方案二：逐任务循环（可避免时间戳冲突）

对于不依赖 Harbor `--n-concurrent` 的并行运行，使用脚本为每个任务分配独立输出目录：

```bash
# 完整示例参见 scripts/run_runnability_check.sh
for task in tasks/*/; do
  harbor run -p "$task" -a openclaw \
    -m moonshot/kimi-k2.5 \
    -n 1 -o "jobs/$(basename $task)" \
    --ae CUSTOM_BASE_URL=... --ae CUSTOM_API_KEY=... &
done
wait
```

每次 `harbor run` 写入独立的 `jobs/<task-name>/` 目录，完全避免时间戳冲突。

> **提示：** 使用逐任务循环时，记得为 5 个 LLM judge 任务传入 `--ee JUDGE_*` 变量。详见 [LLM judge 任务](#llm-judge-任务)。

### 方案三：使用提供的脚本

```bash
bash scripts/run_dataset.sh
```

该脚本封装了 `--dataset` 命令，自动传入正确的 `--registry-path`、judge 凭证和合理的默认值（`--n-concurrent 4`、`--timeout-multiplier 2.0`）。

## 收集指标

运行完成后（单任务或完整数据集），得分位于 `jobs/` 下的 `reward.txt` 文件中。

### 快速得分汇总

```bash
# 打印每个完成 trial 的路径和得分
find jobs -name reward.txt | sort | xargs -I{} sh -c 'echo "{}: $(cat {})"'
```

### 结构化汇总表（Python）

```python
import glob, os

tasks = sorted(d for d in os.listdir("tasks") if os.path.isdir(f"tasks/{d}"))
print(f"{'Task':<45} {'Score':>6}  Status")
print("-" * 60)
for task in tasks:
    # 逐任务循环输出：jobs/<task-name>/*/verifier/reward.txt
    # 数据集运行输出：jobs/<timestamp>/<task-name>__/verifier/reward.txt
    files = sorted(glob.glob(f"jobs/**/{task}__*/verifier/reward.txt"))
    if not files:
        files = sorted(glob.glob(f"jobs/{task}/**/verifier/reward.txt"))
    if files:
        score_str = open(files[-1]).read().strip()
        try:
            score = float(score_str)
            status = "✅" if score >= 0.5 else "❌"
        except ValueError:
            status = "⚠️ parse error"
            score_str = "?"
    else:
        score_str, status = "missing", "⚠️ no result"
    print(f"{task:<45} {score_str:>6}  {status}")
```

### 得分缺失或异常时的排查方向

| 现象 | 首先检查 | 其次检查 |
|------|----------|----------|
| `reward.txt` 缺失 | `verifier/test-stdout.txt`——verifier 是否运行？`trial.log`——agent 是否超时？ | |
| 得分为 0.0 | `verifier/test-stdout.txt`——哪个断言失败了？ | |
| Agent 未启动 | `agent/command-0/return-code.txt`、`agent/command-1/return-code.txt` | |
| Harbor 层级崩溃 | `<trial>/result.json` → `exception_info` 字段 | |
| 每个任务有多个 `reward.txt` | 使用 `jobs/<task-name>/` 结构（逐任务循环），或按时间戳选最新的 | |

完整目录结构和字段说明，参见 [任务输出](../reference/jobs-output.md)。

## LLM judge 任务

五个任务使用 LLM-as-judge verifier（`llm_judge.py`）而非纯规则打分。这些任务需要一个**独立的 judge 模型 API**，verifier 在评分阶段调用——与被评测的模型分开。

### 必需的环境变量

judge 凭证必须通过 `--ee` 传入（而非 `--ae`），因为 `llm_judge.py` 作为独立进程在 verifier 阶段运行，不属于 OpenClaw agent：

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `JUDGE_BASE_URL` | judge 模型的 OpenAI 兼容 base URL | *（必填——无默认值）* |
| `JUDGE_MODEL_ID` | 用于评判的模型名称 | `deepseek-v3.2` |
| `JUDGE_API_KEY` | judge 端点的 API key | *（必填——无默认值）* |

`JUDGE_BASE_URL` 和 `JUDGE_API_KEY` 为**必填项**。`llm_judge.py` 在任一缺失时立即抛出 `RuntimeError`——无任何硬编码的兜底值。

### 示例

```bash
harbor run -p tasks/noise-filtering -a openclaw \
  -m custom/<YOUR_MODEL_ID> \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>" \
  --ee JUDGE_BASE_URL="<YOUR_BASE_URL>" \
  --ee JUDGE_MODEL_ID="qwen3-235b-a22b-instruct-2507" \
  --ee JUDGE_API_KEY="<YOUR_API_KEY>" \
  --timeout-multiplier 2.0 --debug
```

judge 模型可与被评测的 agent 模型使用同一端点，也可使用不同端点。常见做法是 judge 使用比 agent 更强但更便宜的模型。

### 涉及的任务

| 任务 | 难度 |
|------|------|
| `noise-filtering` | 中 |
| `incremental-update-ctp` | 中 |
| `conflict-repair-acb` | 中 |
| `mixed-tool-memory` | 难 |
| `live-web-research-sqlite-fts5` | 难 |

## 难度较高任务的技巧

- 对 `hard` 难度任务使用 `--timeout-multiplier 2.0`；部分任务可能需要 `3.0`
- `--debug` 在失败后保持容器运行，便于手动排查
- 在失败的容器内检查 `/tmp/*.log` 文件，排查服务启动错误

## 已知问题

### 并发运行时的时间戳冲突

Harbor 以运行开始的 UTC 秒数命名每个 job 目录（如 `jobs/2026-03-29__21-11-23`）。当多个 `harbor run -p tasks/<X>` 命令在同一秒内触发时——例如并行 shell 循环——部分进程可能发现目录已被另一任务创建，并报错：

```
FileExistsError: Job directory jobs/<timestamp> already exists and
cannot be resumed with a different config.
```

**解决方案：** 重试时使用不同的 `-o` 目录：

```bash
harbor run -p tasks/<task> ... -o jobs_retry
```

或者，如果现有目录已过期，先删除它：

```bash
# ⚠ 仅在不介意丢失之前结果时使用
rm -rf jobs/<conflicting-timestamp>
harbor run -p tasks/<task> ... -o jobs
```

脚本化并行运行时，可用以下方案完全避免冲突：

1. **逐任务输出目录**（`-o "jobs/<task-name>"`）——`scripts/run_runnability_check.sh` 采用此方式
2. **`--dataset` 配合 `--registry-path`** — Harbor 内部管理 job 目录（`scripts/run_dataset.sh`）
3. 在任务启动之间加入短暂延迟，串行化启动
