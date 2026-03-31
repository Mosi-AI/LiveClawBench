# 快速开始

本指南将引导您完成 LiveClawBench 的环境配置并运行您的第一个评测任务。

## 前置要求

运行 `setup.sh` 前，请确保已安装以下工具：

| 工具 | 最低版本 | 安装方式 |
|------|----------|----------|
| Python | 3.12+ | [python.org](https://www.python.org/downloads/) 或 `uv python install 3.12` |
| [uv](https://docs.astral.sh/uv/) | 最新版 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Docker | 24+ | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| Git | 2.x | [git-scm.com](https://git-scm.com/downloads) |

> **注意：** 调用 `harbor run` 前，Docker 必须处于运行状态。

## 运行 `./setup.sh`

在仓库根目录执行：

```bash
./setup.sh
```

脚本分三步执行：

1. **前置检查** — 验证 git、uv、Docker 和 Python ≥ 3.12 均已安装。如有缺失，脚本将报错并给出安装提示。

2. **安装 Harbor** — 在 `LiveClawBench/` 下创建本地 `.venv`，并直接从 [claw-harbor](https://github.com/Mosi-AI/claw-harbor) GitHub 仓库安装 `harbor` CLI。该步骤具有幂等性：再次运行 `setup.sh` 时，若 `.venv` 已存在则跳过创建。

3. **配置 .env** — 如果 `.env` 不存在，将 `.env.example` 复制为 `.env`。如果 `.env` 已存在，脚本会提示您与模板对比，检查是否有新增变量。

## 编辑 `.env`

打开 `.env`，取消注释与您的服务商匹配的配置块：

```bash
# 示例：VolcEngine
VOLCANO_ENGINE_API_KEY=your-key-here
```

**API key 不会被提交到代码库。** `.env` 已加入 `.gitignore`。

### 选择服务商

- **VolcEngine**（`volcengine/` 或 `volcengine-plan/`）：通过 `--ae VOLCANO_ENGINE_API_KEY="$VOLCANO_ENGINE_API_KEY"` 传入 key
- **Anthropic**：设置 `ANTHROPIC_API_KEY`，OpenClaw 会自动识别
- **OpenAI**（`openai/<model-id>`）：设置 `OPENAI_API_KEY`，调用 `api.openai.com`，无需其他配置
- **任意 OpenAI 兼容端点**（DeepSeek、Moonshot、本地 vLLM 等）：使用 `custom/<model-id>` 作为模型名，通过 `--ae` 传入 base URL 和 API key：
  ```bash
  harbor run -p tasks/watch-shop -a openclaw \
    -m custom/deepseek-chat \
    -n 1 -o jobs \
    --ae CUSTOM_BASE_URL="https://api.deepseek.com/v1" \
    --ae CUSTOM_API_KEY="$DEEPSEEK_API_KEY"
  ```
  可选参数 `CUSTOM_CONTEXT_WINDOW`、`CUSTOM_MAX_TOKENS`、`CUSTOM_REASONING`、`CUSTOM_API` 允许无需修改代码即可调整模型参数——详见[运行任务 — 添加自定义服务商](running-tasks.md#添加自定义服务商)。
- **Gemini**：设置 `GEMINI_API_KEY`

所有 key 均在运行时通过 `--ae KEY="$KEY"` 注入 agent 容器。

## 验证安装

激活虚拟环境后，检查 harbor CLI 是否已正确安装：

```bash
source .venv/bin/activate
harbor --version
```

使用最简单的任务进行快速冒烟测试：

```bash
harbor run -p tasks/watch-shop -a openclaw \
  -m custom/<YOUR_MODEL_ID> \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="<YOUR_BASE_URL>" \
  --ae CUSTOM_API_KEY="<YOUR_API_KEY>" \
  --debug
```

例如，使用 DeepSeek：

```bash
harbor run -p tasks/watch-shop -a openclaw \
  -m custom/deepseek-chat \
  -n 1 -o jobs \
  --ae CUSTOM_BASE_URL="https://api.deepseek.com/v1" \
  --ae CUSTOM_API_KEY="$DEEPSEEK_API_KEY" \
  --debug
```

运行完成后，查看得分：

```bash
cat jobs/*/logs/verifier/reward.txt
```

`1.0` 表示任务已解决，`0.5` 表示获得部分分数。

## 故障排查

**`harbor: command not found`**
请先激活虚拟环境：`source .venv/bin/activate`。也可以直接调用 `.venv/bin/harbor`。

**`Cannot connect to the Docker daemon`**
启动 Docker Desktop（macOS/Windows）或运行 `sudo systemctl start docker`（Linux）。

**`Error: API key not found` / `401 Unauthorized`**
检查命令行中是否传入了 `--ae KEY="$KEY"`，以及 shell 中该环境变量是否已设置（如 `echo $CUSTOM_API_KEY`）。

**`allow_internet` 错误**
如果任务需要调用外部 API 但失败，检查 `task.toml`——`[environment]` 下必须设置 `allow_internet = true`。所有 OpenClaw 任务均已设置此项。

**难度较高的任务超时**
使用 `--timeout-multiplier 2.0`（或更高）来缩放所有 `task.toml` 超时时间。

**使用非标准 OpenAI 兼容服务商**
使用 `custom/<model-id>` 并传入 `--ae CUSTOM_BASE_URL` 和 `--ae CUSTOM_API_KEY`，无需修改代码。
如需永久注册，参见[运行任务 — 添加自定义服务商](running-tasks.md#添加自定义服务商)。

**`docker build` 报 `502` / 连接 `deb.debian.org` 失败**

您的 Docker daemon 通过本地代理路由，该代理支持 HTTPS CONNECT 隧道但不支持普通 HTTP 转发（常见于本地开发代理）。请在 Docker daemon 层级配置 HTTP/HTTPS 代理，使容器内的 `apt-get` 能通过 HTTPS 访问 `deb.debian.org`。

_macOS（Docker Desktop）_ — 编辑 `~/.docker/config.json`（不存在则新建），然后重启 Docker Desktop：

```json
{
  "proxies": {
    "default": {
      "httpProxy":  "http://host.docker.internal:<PORT>",
      "httpsProxy": "http://host.docker.internal:<PORT>",
      "noProxy":    "localhost,127.0.0.1"
    }
  }
}
```

`host.docker.internal` 从容器内解析到宿主机。将 `<PORT>` 替换为您的代理端口（如 `7897`）。

_Linux（systemd）_ — 创建 systemd drop-in 并重启 daemon：

```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/http-proxy.conf << 'EOF'
[Service]
Environment="HTTP_PROXY=http://<PROXY_HOST>:<PORT>"
Environment="HTTPS_PROXY=http://<PROXY_HOST>:<PORT>"
Environment="NO_PROXY=localhost,127.0.0.1"
EOF
sudo systemctl daemon-reload && sudo systemctl restart docker
```

**无代理？** 如果 `deb.debian.org` 可直接访问（开放网络），无需任何配置，`docker build` 可直接使用。
