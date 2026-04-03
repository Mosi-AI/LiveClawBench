# OpenClaw Thinking Levels & Provider Configuration

This document describes OpenClaw's thinking/reasoning gear system and the provider
configuration used in LiveClawBench evaluations. Source references point to the
openclaw and harbor repositories.

---

## Thinking Levels

OpenClaw exposes a unified `ThinkLevel` abstraction that maps to provider-specific
API parameters. The level controls how much reasoning effort the model devotes to
a response.

### Available Levels

| Level      | Aliases                                              | Description            | Scope                          |
|------------|------------------------------------------------------|------------------------|--------------------------------|
| `off`      | —                                                    | No reasoning           | All models                     |
| `minimal`  | `think`, `min`                                       | Minimal reasoning      | Reasoning-capable models       |
| `low`      | `thinkhard`, `think-hard`                            | Low reasoning          | Reasoning-capable models       |
| `medium`   | `thinkharder`, `think-harder`, `harder`, `mid`, `med`| Medium reasoning       | Reasoning-capable models       |
| `high`     | `ultrathink`, `ultra`, `highest`, `max`              | High / max reasoning   | Reasoning-capable models       |
| `xhigh`    | `ultrathink+`, `extrahigh`, `x-high`                 | Extra-high reasoning   | OpenAI GPT-5.x / Codex only    |
| `adaptive` | `auto`                                               | Provider-adaptive      | Anthropic Claude 4.6+          |

**xhigh models** (`XHIGH_MODEL_REFS`):

- `openai/gpt-5.4`, `openai/gpt-5.4-pro`, `openai/gpt-5.2`
- `openai-codex/gpt-5.4`, `openai-codex/gpt-5.3-codex`, `openai-codex/gpt-5.3-codex-spark`
- `openai-codex/gpt-5.2-codex`, `openai-codex/gpt-5.1-codex`
- `github-copilot/gpt-5.2-codex`, `github-copilot/gpt-5.2`

### Resolution Priority

1. **Inline directive** on the message (single-message scope only)
2. **Session override** (set by a directive-only message)
3. **Global default** (`agents.defaults.thinkingDefault` in `openclaw.json`)
4. **Fallback**: `adaptive` for Claude 4.6+, `low` for other reasoning-capable
   models, `off` otherwise

---

## Provider Parameter Mapping

Different providers use different API fields for reasoning/thinking. OpenClaw
abstracts these behind `ThinkLevel` and injects the correct parameter at runtime.

### Mapping Table

| ThinkLevel | Anthropic                | OpenAI / Codex  | OpenRouter  | Moonshot    | Google Gemini |
|------------|--------------------------|-----------------|-------------|-------------|---------------|
| `off`      | thinking off             | *(omitted)*     | `"none"`    | `"disabled"`| *(omitted)*   |
| `minimal`  | minimal                  | —               | `"minimal"` | `"enabled"` | `"MINIMAL"`   |
| `low`      | low                      | `"low"`         | `"low"`     | `"enabled"` | `"LOW"`       |
| `medium`   | medium                   | `"medium"`      | `"medium"`  | `"enabled"` | `"MEDIUM"`    |
| `high`     | high                     | `"high"`        | `"high"`    | `"enabled"` | `"HIGH"`      |
| `xhigh`    | —                        | `"xhigh"`       | `"xhigh"`   | `"enabled"` | `"HIGH"`      |
| `adaptive` | adaptive (Claude 4.6+)   | —               | `"medium"`  | `"enabled"` | `"MEDIUM"`    |

### Provider API Fields

- **Anthropic** — `thinking` object (handled by pi-agent-core, not an openclaw wrapper).
  Claude 4.6+ supports true adaptive reasoning that dynamically adjusts effort.
- **OpenAI / Codex** — `reasoning.effort` (`"low" | "medium" | "high"`; `"xhigh"` for
  GPT-5.x only). Supports WebSocket-first transport with SSE fallback.
- **OpenRouter** — `reasoning.effort` (same format as OpenAI, extended with
  `"none"` / `"minimal"` / `"xhigh"`). Skips injection for the `auto` routing
  model and `x-ai/*` models (they reject the parameter).
- **Moonshot** — `thinking.type` (`"enabled" | "disabled"`, binary, no gradation).
  When thinking is enabled, `tool_choice` is forced to `"auto"`.
- **Google Gemini** — `thinkingConfig.thinkingLevel`
  (`"MINIMAL" | "LOW" | "MEDIUM" | "HIGH"`).
- **Custom** — transparently passes OpenAI-compatible `reasoning.effort` format.

---

## Provider Configuration

### API Endpoints

| Provider   | Base URL                              | API Type                   | Auth key env var    | Model Format       |
|------------|---------------------------------------|----------------------------|---------------------|--------------------|
| Anthropic  | `https://api.anthropic.com`           | `anthropic-messages`       | `ANTHROPIC_API_KEY` | `anthropic/<model>`|
| OpenAI     | `https://api.openai.com/v1`           | `openai-completions` / `openai-responses` | `OPENAI_API_KEY` | `openai/<model>` |
| OpenRouter | `https://openrouter.ai/api/v1`        | `openai-completions`       | `OPENROUTER_API_KEY` (default endpoint) / `CUSTOM_API_KEY` (custom endpoint) | `openrouter/<model>`|
| Moonshot   | `https://api.moonshot.ai/v1`          | `openai-completions`       | `MOONSHOT_API_KEY` (default endpoint) / `CUSTOM_API_KEY` (custom endpoint) | `moonshot/<model>` |
| Custom     | User-defined via `CUSTOM_BASE_URL`    | `openai-completions` (default) | `CUSTOM_API_KEY`| `custom/<model>`   |

> **OpenRouter / Moonshot auth key note**: when `CUSTOM_BASE_URL` is set, harbor
> writes `"apiKey": "${CUSTOM_API_KEY}"` into the provider entry — openclaw
> substitutes `CUSTOM_API_KEY` from the `env` section at config load time. The
> native `OPENROUTER_API_KEY` / `MOONSHOT_API_KEY` variables are only used by
> openclaw's built-in auto-discovery path (i.e. when `CUSTOM_BASE_URL` is **not**
> set).

### Base URL Customization Constraints

Harbor builds the openclaw.json provider entry via `_build_provider_entry`. Not all
providers support custom base URLs:

| Provider                           | `CUSTOM_BASE_URL` | Behavior                                         |
|------------------------------------|--------------------|--------------------------------------------------|
| `custom`                           | **Required**       | Raises `ValueError` if missing                   |
| `openrouter`                       | Optional           | Not set → returns `None`, uses openclaw defaults |
| `moonshot`                         | Optional           | Not set → returns `None`, uses openclaw defaults |
| `volcengine` / `volcengine-plan`   | Not supported      | Uses hardcoded `_PROVIDER_CONFIGS` URL           |
| `anthropic` / `openai` / `gemini`  | Not supported      | Returns `None`, uses openclaw auto-discovery     |

**Key design**: the provider name determines the thinking parameter format, not the
base URL. This means:

- `-m openrouter/<model> --ae CUSTOM_BASE_URL=https://...` uses `reasoning: { effort }`
  format (OpenRouter wrapper)
- `-m moonshot/<model> --ae CUSTOM_BASE_URL=https://...` uses `thinking: { type }`
  format (Moonshot wrapper)
- `-m custom/<model> --ae CUSTOM_BASE_URL=https://...` uses OpenAI-compat passthrough

---

## Harbor Evaluation Configuration

### CLI Flags

The openclaw harbor adapter accepts these flags:

| Flag        | CLI Flag       | Values                                                             | Env Fallback          |
|-------------|----------------|--------------------------------------------------------------------|-----------------------|
| `thinking`  | `--thinking`   | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `adaptive`     | `OPENCLAW_THINKING`   |
| `timeout`   | `--timeout`    | integer (seconds)                                                  | `OPENCLAW_TIMEOUT`    |
| `verbose`   | `--verbose`    | `on`, `off`                                                        | `OPENCLAW_VERBOSE`    |

### `CUSTOM_*` Environment Variables

These variables apply to `custom`, and also to `openrouter` / `moonshot` when
`CUSTOM_BASE_URL` is set (all three code paths share identical logic). Set via
`--ae`:

| Variable                | Default                                      | Description                                      |
|-------------------------|----------------------------------------------|--------------------------------------------------|
| `CUSTOM_BASE_URL`       | *(required for `custom`; optional for `openrouter`/`moonshot`)* | API endpoint URL |
| `CUSTOM_API_KEY`        | *(required when `CUSTOM_BASE_URL` is set)*   | Authentication key                               |
| `CUSTOM_CONTEXT_WINDOW` | `128000`                                     | Context window in tokens (written to model definition) |
| `CUSTOM_MAX_TOKENS`     | `4096`                                       | Max output tokens (written to model definition)  |
| `CUSTOM_REASONING`      | `false`                                      | **Two effects**: ① sets `reasoning: true/false` in the model definition (tells openclaw whether this model supports reasoning); ② triggers auto-injection of `--thinking medium` when no thinking level is explicitly set |
| `CUSTOM_API`            | `openai-completions`                         | API type                                         |

### Auto-Thinking Injection

When `CUSTOM_REASONING=true` is set, harbor checks whether a thinking level was
explicitly configured. If not, it auto-injects `--thinking medium`.

The check is `"thinking" not in _resolved_flags`. Both `--ak thinking=<level>` and
`--ae OPENCLAW_THINKING=<level>` (via `env_fallback`) write into `_resolved_flags`,
so either one suppresses the auto-injection:

| Configuration                      | Thinking level used            |
|------------------------------------|--------------------------------|
| `--ak thinking=<level>`            | `<level>` (explicit, highest priority) |
| `--ae OPENCLAW_THINKING=<level>`   | `<level>` (via env_fallback, same effect as `--ak`) |
| Neither set + `CUSTOM_REASONING=true` | `medium` (auto-injected)    |
| Neither set + `CUSTOM_REASONING=false` | `off` / provider default  |

### Gateway Mode

Harbor runs openclaw in **gateway mode** by default (not `--local`). The gateway
pre-starts and polls `/ready` before launching the agent, avoiding a race condition
where early browser tool calls fail with WebSocket 1006 errors.

To opt out: `--ae OPENCLAW_USE_LOCAL=true`.

---

## Usage Examples

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

### OpenRouter — default endpoint

Uses `OPENROUTER_API_KEY` (openclaw auto-discovery, no `CUSTOM_BASE_URL`):

```bash
harbor run -a openclaw -m openrouter/anthropic/claude-sonnet-4-5 \
  --ak thinking=medium \
  --ae OPENROUTER_API_KEY=sk-or-...
```

### OpenRouter — custom endpoint

When `CUSTOM_BASE_URL` is set, harbor builds an explicit provider entry with
`apiKey: "${CUSTOM_API_KEY}"`. Use `CUSTOM_API_KEY` instead of `OPENROUTER_API_KEY`.
The provider name `openrouter` is preserved so the `reasoning: { effort }` wrapper
still applies:

```bash
harbor run -a openclaw -m openrouter/my-model \
  --ak thinking=medium \
  --ae CUSTOM_BASE_URL=https://my-openrouter-proxy.example.com/v1 \
  --ae CUSTOM_API_KEY=sk-... \
  --ae CUSTOM_REASONING=true
```

### Moonshot — default endpoint

Uses `MOONSHOT_API_KEY` (openclaw auto-discovery, no `CUSTOM_BASE_URL`):

```bash
harbor run -a openclaw -m moonshot/kimi-k2.5 \
  --ak thinking=medium \
  --ae MOONSHOT_API_KEY=...
```

### Moonshot — custom endpoint

When `CUSTOM_BASE_URL` is set, use `CUSTOM_API_KEY`. The provider name `moonshot`
is preserved so the `thinking: { type }` wrapper still applies:

```bash
harbor run -a openclaw -m moonshot/kimi-k2.5 \
  --ak thinking=medium \
  --ae CUSTOM_BASE_URL=https://my-moonshot-proxy.example.com/v1 \
  --ae CUSTOM_API_KEY=sk-... \
  --ae CUSTOM_REASONING=true
```

### Custom Provider (OpenAI-compatible endpoint)

`CUSTOM_BASE_URL` is required. Uses OpenAI-compat passthrough — no thinking wrapper
is applied by default:

```bash
harbor run -a openclaw -m custom/deepseek-chat \
  --ae CUSTOM_BASE_URL=https://api.deepseek.com/v1 \
  --ae CUSTOM_API_KEY=sk-... \
  --ae CUSTOM_REASONING=true \
  --ae CUSTOM_MAX_TOKENS=8192
```
