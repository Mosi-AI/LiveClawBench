# LiveClawBench 文档

LiveClawBench：在复杂真实助手任务上评测 LLM Agent。

> [English Documentation](../en/README.md)

## 使用指南

运行和贡献 benchmark 的分步操作文档：

| 指南 | 描述 |
|------|------|
| [快速开始](guide/getting-started.md) | 前置要求、`setup.sh`、`.env` 配置、冒烟测试 |
| [运行任务](guide/running-tasks.md) | Harbor CLI 参数、API key 注入、`--dataset` 用法、结果查看、指标收集 |
| [添加任务](guide/adding-tasks.md) | 任务格式、评分合约、验证工具、提交清单 |

## 参考手册

任务格式和复杂度标注的技术参考：

| 参考文档 | 描述 |
|---------|------|
| [复杂度框架](reference/complexity-framework.md) | 因子定义、30 个 case 标注表、领域热力图、控制对 |
| [任务格式](reference/task-format.md) | Harbor 任务目录结构、`task.toml` 字段、评估规则 |
| [任务输出](reference/jobs-output.md) | `harbor run -o jobs` 目录结构、文件生命周期、关键字段、问题排查 |

## 背景与路线图

| 文档 | 描述 |
|------|------|
| [真实助手任务为何困难？](background/assistant_task_complexity.md) | 因子叠加效应、benchmark 对比、框架意义 |
| [未来 Factor 规划](roadmap/future_factors.md) | A3/A4/B3/C-axis 扩展路线图及优先级顺序 |

## 元数据

| 文件 | 描述 |
|------|------|
| [cases_registry_zh.csv](../../metadata/cases_registry_zh.csv) | 所有 case 元数据的唯一来源（中文） |
