# `jobs/` 输出结构参考

本文档描述 `harbor run -o jobs` 产生的每个文件和目录、各文件的创建方式，以及调试评测结果时的使用方法。

## 概览

`-o jobs` 设置**输出根目录**。每次 `harbor run` 调用创建一个 `<job-id>/` 子目录（以 UTC 启动时间命名，格式 `YYYY-MM-DD__HH-MM-SS`）。在 job 目录内，每个 **trial**——agent 在某个任务上的一次运行——有自己的 `<trial-name>/` 子目录（格式：`<task-name>__<random-suffix>`）。

```
jobs/
└── 2026-03-21__12-37-54/       ← job 目录（每次 harbor run 一个）
    └── baggage-tracking-application__2hoJ9jE/   ← trial 目录
```

---

## 完整目录树

```
jobs/
└── <job-id>/                             # 如 2026-03-21__12-37-54
    ├── config.json                       # 完整的任务配置快照
    ├── result.json                       # 任务级汇总结果（奖励分布、错误计数）
    ├── job.log                           # Harbor 编排器日志
    └── <trial-name>/                     # 如 baggage-tracking-application__2hoJ9jE
        ├── config.json                   # 完整的 trial 配置（agent/env/超时/模型）
        ├── result.json                   # 完整的 trial 结果（得分、token 用量、异常）
        ├── trial.log                     # Harbor trial 层日志
        ├── exception.txt                 # trial 崩溃时的异常堆栈（可能不存在）
        │
        ├── agent/                        # 绑定挂载 → 容器内 /logs/agent/
        │   ├── install.sh                # agent 安装脚本的副本
        │   ├── setup/                    # 安装阶段的输出
        │   │   ├── stdout.txt            # 安装命令的合并 stdout
        │   │   └── return-code.txt       # 安装阶段的退出码
        │   ├── command-0/                # 第一个执行的命令（MCP/模型/环境注入）
        │   │   ├── command.txt           # 执行的确切 shell 命令
        │   │   └── return-code.txt       # 退出码
        │   ├── command-1/                # 第二个命令（agent 主进程）
        │   │   ├── command.txt           # 执行的确切 shell 命令
        │   │   ├── stdout.txt            # Agent stdout
        │   │   └── return-code.txt       # 退出码（0 = 正常退出，非零 = 错误/超时终止）
        │   ├── openclaw.txt              # 通过 tee 捕获的 openclaw stdout + stderr
        │   ├── trajectory.json           # ATIF v1.2 轨迹（找到会话 JSONL 时生成）
        │   └── openclaw-state/           # openclaw 内部状态（OPENCLAW_STATE_DIR）
        │       └── agents/main/sessions/
        │           └── harbor.jsonl      # 原始会话 JSONL——每行一个 JSON 对象
        │
        ├── verifier/                     # 绑定挂载 → 容器内 /logs/verifier/
        │   ├── reward.txt                # test.sh 写入的浮点奖励值（0.0/0.5/1.0）；使用文本格式时存在
        │   ├── reward.json               # test.sh 写入的 JSON 奖励；使用 JSON 格式时存在（如多维度得分）
        │   └── test-stdout.txt           # test.sh 的 stdout + stderr（通过 2>&1 重定向）
        │
        └── artifacts/                    # 绑定挂载 → 容器内 /logs/artifacts/
                                          # 任务特定输出（截图、导出文件等）
```

---

## 文件生命周期：容器挂载机制

了解文件*何时*以及*如何*出现在宿主机上，对调试至关重要。

### 1. 容器启动前创建宿主机目录

`Trial.__init__` 在 Docker 容器启动**前**调用 `TrialPaths.mkdir()`。这会在宿主机上创建 `agent/`、`verifier/` 和 `artifacts/` 子目录，使绑定挂载有目标可连接。

### 2. 绑定挂载（仅限本地 Docker）

`DockerEnvironment` 读取 `docker-compose-base.yaml`，配置三个绑定挂载：

| 宿主机路径（在 `<trial-name>/` 下） | 容器路径 |
|-------------------------------------|----------|
| `agent/`                            | `/logs/agent/` |
| `verifier/`                         | `/logs/verifier/` |
| `artifacts/`                        | `/logs/artifacts/` |

容器内对 `/logs/` 的任何写操作都会**立即**在宿主机上可见——无需 `docker cp` 步骤。

### 3. 实时磁盘写入

由于绑定挂载，可以在 trial 仍在运行时 `tail -f` 日志文件：

```bash
tail -f jobs/<job-id>/<trial-name>/agent/openclaw.txt
```

### 4. 容器停止后的权限修复

容器退出后，Harbor 对 `/logs/` 树执行一次 `chown`，将所有权从 `root`（容器用户）转移到宿主机用户，避免后续读取或删除文件时的权限问题。

### 5. 非 Docker 环境（Daytona / Modal / E2B）

这些环境返回 `is_mounted = False`。Harbor 检测到此情况后，在 trial 完成后调用 `environment.download_dir()` 将日志下载到宿主机。磁盘上的结构相同；仅*传输机制*不同。

---

## 关键文件字段参考

### `<job-id>/result.json`

该 job 中所有 trial 的汇总统计。

| JSON 路径 | 含义 |
|-----------|------|
| `stats.evals.<agent>__<model>__<dataset>.reward_stats` | 奖励频次分布：`{reward_key: {reward_value: [trial_name, ...]}}`。`rewards` 中所有奖励 key 均独立追踪；约定 key 为 `"reward"`。 |
| `stats.evals.<agent>__<model>__<dataset>.n_errors` | 抛出异常的 trial 数量 |

### `<trial-name>/result.json`

单次 trial 结果。

| JSON 路径 | 含义 |
|-----------|------|
| `verifier_result.rewards` | `test.sh` 写入的所有奖励 key 的字典（如 `{"reward": 1.0}` 对应 `reward.txt`，或 `{"reward": 0.8, "accuracy": 0.9}` 对应多维度 `reward.json`）。Harbor 独立追踪每个 key。 |
| `exception_info` | Harbor 本身在 trial 期间崩溃时的结构化异常 |
| `agent_result.n_input_tokens` | agent 报告的输入 token 数 |
| `agent_result.n_output_tokens` | agent 报告的输出 token 数 |

### `agent/openclaw.txt`

`openclaw` 进程的完整 stdout + stderr，通过 `tee` 捕获。使用 `--json` 运行时，最后一行包含完整的 JSON 对象：

```jsonc
{
  "meta": {
    "agentMeta": {
      "usage": { "inputTokens": 12345, "outputTokens": 678 }
    }
  }
}
```

当 `trajectory.json` 缺失时，这是 **token 用量的兜底来源**。

### `agent/trajectory.json`

ATIF v1.2 轨迹。仅当 openclaw 会话 JSONL（`harbor.jsonl`）被成功找到并转换时才存在。包含所有步骤及每步的 token 用量。如果此文件**缺失**，请先检查 `harbor.jsonl`。

### `agent/openclaw-state/…/harbor.jsonl`

原始 OpenClaw 会话文件——每行一个 JSON 对象。这是 `trajectory.json` 的主要数据源。每个消息对象可能包含带 token 计数的 `usage` 字段。

### `verifier/reward.txt`

单行包含一个浮点数（如 `1.0`、`0.5`、`0.0`）。由容器内的 `test.sh` 写入。如果文件**缺失**，在得出 verifier 未运行的结论前，请先检查 `reward.json`（agent 可能超时，或任务使用 JSON 格式）。

### `verifier/reward.json`

当任务使用多维度评分时，`test.sh` 写入的 JSON 对象（如 `{"reward": 0.8, "accuracy": 0.9}`）。仅当 `reward.txt` 缺失时，Harbor 才读取此文件。每个 `float | int` key 在 `reward_stats` 中独立追踪。非数值字段必须使用 `_meta_` 前缀——Harbor 的 verifier 模型强制要求 `dict[str, float | int]`，未加前缀的字符串值会在解析时导致 `ValidationError`。参见[添加任务指南中的 reward.json 规则](../guide/adding-tasks.md#verifypy-合约)。

---

## 故障排查快速参考

| 现象 | 首先检查 | 其次检查 |
|------|----------|----------|
| 得分为 0.0 | `verifier/test-stdout.txt`（哪个测试断言失败？） | `verifier/reward.txt` 确认值已写入 |
| `trajectory.json` 缺失 | `agent/openclaw-state/…/harbor.jsonl` 是否存在？ | `agent/openclaw.txt` 排查 agent 启动错误 |
| Trial 有异常 | `<trial>/result.json` → `exception_info` | `trial.log` 获取 Harbor 层的堆栈跟踪 |
| Agent 未启动/超时 | `agent/command-0/return-code.txt`（配置注入失败？） | `agent/command-1/return-code.txt`（主进程退出码） |
| 环境构建失败 | `trial.log`——搜索 `DockerBuild` | `agent/install.sh` 检查安装脚本 |
| Token 用量为 null | `agent/openclaw.txt`——最后一行 JSON `usage` 字段 | `harbor.jsonl`——每条消息的 `usage` 字段 |
| `verifier/reward.txt` 缺失 | 检查 `verifier/reward.json`（任务可能使用 JSON 格式） | 两者都缺失则 agent 在 verifier 阶段前超时——通过 `trial.log` 确认 |

---

## 示例：读取 Trial 结果

```bash
JOB=jobs/2026-03-21__12-37-54
TRIAL=$JOB/baggage-tracking-application__2hoJ9jE

# 快速查看得分
cat $TRIAL/verifier/reward.txt

# 测试套件输出了什么？
cat $TRIAL/verifier/test-stdout.txt

# 是否有 Harbor 层级的异常？
python3 -c "import json; d=json.load(open('$TRIAL/result.json')); print(d.get('exception_info'))"

# 实时跟踪 agent（trial 仍在运行时）
tail -f $TRIAL/agent/openclaw.txt
```
