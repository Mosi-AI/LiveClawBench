# OpenClaw Thinking 档位与 Provider 配置

本文档描述 OpenClaw 的 thinking/reasoning 档位体系以及 LiveClawBench 评测中使用的
provider 配置。源码参考指向 openclaw 和 harbor 仓库。

---

## Thinking 档位

OpenClaw 通过统一的 `ThinkLevel` 抽象将不同 provider 的 API 参数映射为一致的档位
体系。档位控制模型在回答中投入的推理力度。

### 可用档位

| 档位       | 别名                                                 | 说明           | 适用范围                      |
|------------|------------------------------------------------------|----------------|-------------------------------|
| `off`      | —                                                    | 关闭推理       | 所有模型                      |
| `minimal`  | `think`, `min`                                       | 最低推理投入   | 支持推理的模型                |
| `low`      | `thinkhard`, `think-hard`                            | 低推理投入     | 支持推理的模型                |
| `medium`   | `thinkharder`, `think-harder`, `harder`, `mid`, `med`| 中等推理投入   | 支持推理的模型                |
| `high`     | `ultrathink`, `ultra`, `highest`, `max`              | 高推理投入     | 支持推理的模型                |
| `xhigh`    | `ultrathink+`, `extrahigh`, `x-high`                 | 超高推理投入   | 仅 OpenAI GPT-5.x / Codex    |
| `adaptive` | `auto`                                               | Provider 自适应| Anthropic Claude 4.6+         |

**xhigh 支持模型** (`XHIGH_MODEL_REFS`):

- `openai/gpt-5.4`, `openai/gpt-5.4-pro`, `openai/gpt-5.2`
- `openai-codex/gpt-5.4`, `openai-codex/gpt-5.3-codex`, `openai-codex/gpt-5.3-codex-spark`
- `openai-codex/gpt-5.2-codex`, `openai-codex/gpt-5.1-codex`
- `github-copilot/gpt-5.2-codex`, `github-copilot/gpt-5.2`

### 解析优先级

1. **行内指令**（inline directive），仅作用于当前消息
2. **会话覆盖**（session override），通过发送纯指令消息设置
3. **全局默认值**（`agents.defaults.thinkingDefault`，在 `openclaw.json` 中配置）
4. **兜底规则**：Claude 4.6+ 默认 `adaptive`，其他支持推理的模型默认 `low`，其余 `off`

---

## Provider 参数映射

不同 provider 使用不同的 API 字段来控制推理/思考。OpenClaw 在 `ThinkLevel` 抽象层
统一处理，在运行时注入正确的参数。

### 映射表

| ThinkLevel | Anthropic                | OpenAI / Codex  | OpenRouter  | Moonshot    | Google Gemini |
|-------------|--------------------------|-----------------|-------------|-------------|---------------|
| `off`       | thinking off             | *(省略)*         | `"none"`    | `"disabled"`| *(省略)*      |
| `minimal`   | minimal                  | —               | `"minimal"` | `"enabled"` | `"MINIMAL"`   |
| `low`       | low                      | `"low"`         | `"low"`     | `"enabled"` | `"LOW"`       |
| `medium`    | medium                   | `"medium"`      | `"medium"`  | `"enabled"` | `"MEDIUM"`    |
| `high`      | high                     | `"high"`        | `"high"`    | `"enabled"` | `"HIGH"`      |
| `xhigh`     | —                        | `"xhigh"`       | `"xhigh"`   | `"enabled"` | `"HIGH"`      |
| `adaptive`  | adaptive (Claude 4.6+)   | —               | `"medium"`  | `"enabled"` | `"MEDIUM"`    |

### 各 Provider API 字段

- **Anthropic** — `thinking` 对象（由 pi-agent-core 处理，非 openclaw wrapper）。
  Claude 4.6+ 支持真正的自适应推理，根据查询复杂度动态调整推理力度。
- **OpenAI / Codex** — `reasoning.effort`（`"low" | "medium" | "high"`；`"xhigh"` 仅
  GPT-5.x 支持）。支持 WebSocket 优先传输，SSE 兜底。
- **OpenRouter** — `reasoning.effort`（格式同 OpenAI，扩展了 `"none"` / `"minimal"` /
  `"xhigh"`）。对 `auto` 路由模型和 `x-ai/*` 模型跳过注入（它们会拒绝该参数）。
- **Moonshot** — `thinking.type`（`"enabled" | "disabled"`，二值，无梯度）。
  启用 thinking 时，`tool_choice` 被强制设为 `"auto"`。
- **Google Gemini** — `thinkingConfig.thinkingLevel`
  （`"MINIMAL" | "LOW" | "MEDIUM" | "HIGH"`）。
- **Custom** — 透传 OpenAI 兼容的 `reasoning.effort` 格式。

---

## Provider 配置

### API 端点

| Provider   | Base URL                              | API Type                   | 认证密钥环境变量      | 模型格式            |
|------------|---------------------------------------|----------------------------|-----------------------|---------------------|
| Anthropic  | `https://api.anthropic.com`           | `anthropic-messages`       | `ANTHROPIC_API_KEY`   | `anthropic/<model>` |
| OpenAI     | `https://api.openai.com/v1`           | `openai-completions` / `openai-responses` | `OPENAI_API_KEY` | `openai/<model>` |
| OpenRouter | `https://openrouter.ai/api/v1`        | `openai-completions`       | `OPENROUTER_API_KEY`（默认端点）/ `CUSTOM_API_KEY`（自定义端点） | `openrouter/<model>`|
| Moonshot   | `https://api.moonshot.ai/v1`          | `openai-completions`       | `MOONSHOT_API_KEY`（默认端点）/ `CUSTOM_API_KEY`（自定义端点） | `moonshot/<model>`  |
| Custom     | 通过 `CUSTOM_BASE_URL` 指定           | `openai-completions`（默认）| `CUSTOM_API_KEY`     | `custom/<model>`    |

> **OpenRouter / Moonshot 认证密钥说明**：设置了 `CUSTOM_BASE_URL` 时，harbor 将
> `"apiKey": "${CUSTOM_API_KEY}"` 写入 provider entry，openclaw 在加载配置时从 `env`
> 节替换 `CUSTOM_API_KEY` 的值。原生的 `OPENROUTER_API_KEY` / `MOONSHOT_API_KEY`
> 仅在 openclaw 内置自动发现路径下生效（即**未设置** `CUSTOM_BASE_URL` 时）。

### Base URL 自定义约束

Harbor 通过 `_build_provider_entry` 方法构建 openclaw.json 的 provider 配置。
并非所有 provider 都支持自定义 base URL：

| Provider                           | `CUSTOM_BASE_URL` | 行为                                              |
|------------------------------------|--------------------|---------------------------------------------------|
| `custom`                           | **必需**           | 缺失时抛出 `ValueError`                           |
| `openrouter`                       | 可选               | 未设置 → 返回 `None`，使用 openclaw 内置默认       |
| `moonshot`                         | 可选               | 未设置 → 返回 `None`，使用 openclaw 内置默认       |
| `volcengine` / `volcengine-plan`   | 不支持             | 使用 `_PROVIDER_CONFIGS` 中硬编码的 URL            |
| `anthropic` / `openai` / `gemini`  | 不支持             | 返回 `None`，使用 openclaw 自动发现               |

**关键设计**：provider name 决定 thinking 参数注入格式，而非 base URL。因此：

- `-m openrouter/<model> --ae CUSTOM_BASE_URL=https://...` 使用 `reasoning: { effort }`
  格式（OpenRouter wrapper）
- `-m moonshot/<model> --ae CUSTOM_BASE_URL=https://...` 使用 `thinking: { type }`
  格式（Moonshot wrapper）
- `-m custom/<model> --ae CUSTOM_BASE_URL=https://...` 使用 OpenAI 兼容透传

---

## Harbor 评测配置

### CLI Flags

openclaw harbor adapter 接受以下命令行参数：

| 参数        | CLI 参数       | 可选值                                                             | 环境变量兜底          |
|-------------|----------------|--------------------------------------------------------------------|-----------------------|
| `thinking`  | `--thinking`   | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `adaptive`     | `OPENCLAW_THINKING`   |
| `timeout`   | `--timeout`    | 整数（秒）                                                        | `OPENCLAW_TIMEOUT`    |
| `verbose`   | `--verbose`    | `on`, `off`                                                        | `OPENCLAW_VERBOSE`    |

### `CUSTOM_*` 环境变量

以下变量适用于 `custom`，也适用于设置了 `CUSTOM_BASE_URL` 的 `openrouter` /
`moonshot`（三条代码路径的逻辑完全对称）。通过 `--ae` 传入：

| 变量                    | 默认值                                                        | 说明                                                  |
|-------------------------|---------------------------------------------------------------|-------------------------------------------------------|
| `CUSTOM_BASE_URL`       | *(`custom` 必需；`openrouter`/`moonshot` 可选)*               | API 端点 URL                                          |
| `CUSTOM_API_KEY`        | *(设置了 `CUSTOM_BASE_URL` 时必需)*                           | 认证密钥                                              |
| `CUSTOM_CONTEXT_WINDOW` | `128000`                                                      | 上下文窗口（tokens，写入 model 定义）                 |
| `CUSTOM_MAX_TOKENS`     | `4096`                                                        | 最大输出 tokens（写入 model 定义）                    |
| `CUSTOM_REASONING`      | `false`                                                       | **双重效果**：① 将 `reasoning: true/false` 写入 model 定义（告知 openclaw 该模型是否支持推理）；② 在未显式设置 thinking 档位时触发自动注入 `--thinking medium` |
| `CUSTOM_API`            | `openai-completions`                                          | API 类型                                              |

### 自动注入 Thinking

当 `CUSTOM_REASONING=true` 时，harbor 检查 thinking 档位是否被显式配置。
如果未配置，自动注入 `--thinking medium`。

判断逻辑是 `"thinking" not in _resolved_flags`。`--ak thinking=<level>` 和
`--ae OPENCLAW_THINKING=<level>`（通过 `env_fallback`）都会写入 `_resolved_flags`，
因此两者均可阻止自动注入：

| 配置方式                              | 实际使用的 thinking 档位            |
|---------------------------------------|-------------------------------------|
| `--ak thinking=<level>`               | `<level>`（显式，最高优先级）       |
| `--ae OPENCLAW_THINKING=<level>`      | `<level>`（通过 env_fallback，效果等同 `--ak`）|
| 两者均未设置 + `CUSTOM_REASONING=true` | `medium`（自动注入）                |
| 两者均未设置 + `CUSTOM_REASONING=false`| `off` / provider 默认值            |

### Gateway Mode

Harbor 默认以 **gateway mode** 运行 openclaw（非 `--local`）。gateway 会预先启动并
轮询 `/ready` 端点，然后才启动 agent，避免早期 browser tool 调用因 WebSocket 1006
错误而失败。

退出 gateway mode：`--ae OPENCLAW_USE_LOCAL=true`。

---

## 使用示例

### Anthropic Claude

```bash
harbor run -a openclaw -m anthropic/claude-opus-4-6 \
  --ak thinking=high \
  --ae ANTHROPIC_API_KEY=sk-ant-...
```

### OpenAI

```bash
harbor run -a openclaw -m openai/gpt-5.4 \
  --ak thinking=high \
  --ae OPENAI_API_KEY=sk-...
```

### OpenRouter — 默认端点

使用 `OPENROUTER_API_KEY`（openclaw 自动发现，不设置 `CUSTOM_BASE_URL`）：

```bash
harbor run -a openclaw -m openrouter/anthropic/claude-sonnet-4-5 \
  --ak thinking=medium \
  --ae OPENROUTER_API_KEY=sk-or-...
```

### OpenRouter — 自定义端点

设置 `CUSTOM_BASE_URL` 后，harbor 构建显式 provider entry，`apiKey` 固定为
`"${CUSTOM_API_KEY}"`，需传 `CUSTOM_API_KEY` 而非 `OPENROUTER_API_KEY`。
provider name 保持 `openrouter`，`reasoning: { effort }` wrapper 照常生效：

```bash
harbor run -a openclaw -m openrouter/my-model \
  --ak thinking=medium \
  --ae CUSTOM_BASE_URL=https://my-openrouter-proxy.example.com/v1 \
  --ae CUSTOM_API_KEY=sk-... \
  --ae CUSTOM_REASONING=true
```

### Moonshot — 默认端点

使用 `MOONSHOT_API_KEY`（openclaw 自动发现，不设置 `CUSTOM_BASE_URL`）：

```bash
harbor run -a openclaw -m moonshot/kimi-k2.5 \
  --ak thinking=medium \
  --ae MOONSHOT_API_KEY=...
```

### Moonshot — 自定义端点

设置 `CUSTOM_BASE_URL` 后，需传 `CUSTOM_API_KEY`。provider name 保持 `moonshot`，
`thinking: { type }` wrapper 照常生效：

```bash
harbor run -a openclaw -m moonshot/kimi-k2.5 \
  --ak thinking=medium \
  --ae CUSTOM_BASE_URL=https://my-moonshot-proxy.example.com/v1 \
  --ae CUSTOM_API_KEY=sk-... \
  --ae CUSTOM_REASONING=true
```

### Custom Provider（OpenAI 兼容端点）

`CUSTOM_BASE_URL` 必须设置。默认不应用任何 thinking wrapper，使用 OpenAI 兼容透传：

```bash
harbor run -a openclaw -m custom/deepseek-chat \
  --ae CUSTOM_BASE_URL=https://api.deepseek.com/v1 \
  --ae CUSTOM_API_KEY=sk-... \
  --ae CUSTOM_REASONING=true \
  --ae CUSTOM_MAX_TOKENS=8192
```
