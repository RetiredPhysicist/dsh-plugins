<p align="center">
  <img src="assets/readme/hero.zh.svg" alt="dsh-dejavu-memory —— 给 DeepSeek Harness 接上长期记忆" width="100%">
</p>

# dsh-dejavu-memory

给 DeepSeek Harness 接上 **DejaVu** 长期记忆:会话开始 boot + 每日简报,记忆读写/搜索/更新/删除,后端是部署在 Cloudflare 上的 DejaVu MCP 服务器。

> 由 [pi-dejavu-memory](https://github.com/RetiredPhysicist/pi-plugins/tree/main/packages/pi-dejavu-memory) 移植,协议与工具名完全一致。

可交互的记忆图只由 [OpenAI/Codex 插件](https://github.com/RetiredPhysicist/openai-plugins/tree/main/plugins/dejavu-memory) 打开。dsh 通过同一服务的工具接入,没有图界面,也不需要让最终用户手工配 MCP。

<p align="center">
  <img src="assets/readme/dejavu-memory-graph.webp" width="100%" alt="OpenAI/Codex 的 DejaVu Memory 插件：整棵记忆树的可交互图，节点按类型着色、按优先级决定大小">
</p>

<p align="center">
  <img src="assets/readme/dejavu-memory-inspector.webp" width="100%" alt="OpenAI/Codex 的 DejaVu Memory 插件选中节点后的详情面板：记忆 URI、类型、优先级、正文和子树">
</p>

[English](README.md) · [中文](README.zh.md)

## 工具

| 工具 | 说明 |
|---|---|
| `dejavu_boot` | 会话开始加载：`system://boot`、`system://recent/5`、`system://triggers`，再 best-effort 读 `system://briefing`；随后读 `system://focus`（`recent` 是 briefing 子集——boot 之后不必再单独读） |
| `dejavu_read` | 按 URI 读记忆(`system://…`、`dejavu://agent`…) |
| `dejavu_search` | 搜记忆(语义 + 关键词 / 触发词召回，服务端 `search_memory`) |
| `dejavu_create` | 新建记忆节点(支持 `[Baseline]`/`[Deviation]`/`[Result]`/`[Reusable judgment]`) |
| `dejavu_update` | 全文替换、patch(old_string/new_string)或 append;可选 `relation` |
| `dejavu_delete` | 按 URI 删除记忆(`delete_memory`) |

## 快速开始

```sh
dsh plugin --profile web add dsh-dejavu-memory
```

需要你能连到自己的 DejaVu MCP 服务器。

```yaml
- id: dejavu
  name: dsh-dejavu-memory
  config:
    mcp_url: https://dejavu.example.com/mcp
    mcp_auth: ""  # 优先用 mcp_headers 传 Access service token
```

若服务器在 Cloudflare Access 后（例如 `dejavu.example.com`），用 **service token** 头替代 `mcp_auth`：

```yaml
- id: dejavu
  name: dsh-dejavu-memory
  config:
    mcp_url: https://dejavu.example.com/mcp
    mcp_headers:
      CF-Access-Client-Id: <your client id>
      CF-Access-Client-Secret: <your client secret>
```

| 键 | 必填 | 含义 |
|---|---|---|
| `mcp_url` | 是 | 你的 DejaVu MCP 端点(Streamable HTTP) |
| `mcp_auth` | 否 | 遗留字段；优先用 `mcp_headers` 传 Cloudflare Access service token |

## 工具命名

`dejavu_boot` / `dejavu_read` 前缀让记忆工具在工具列表和 boot 协议里含义明确,模型会直接调用,无需先探测通用 resource。

## License

MIT

## 相关

- [dejavu-memory(ChatGPT / Codex 版)](https://github.com/RetiredPhysicist/openai-plugins/tree/main/plugins/dejavu-memory) — 同一个记忆服务器,另有可交互的图界面
- [pi-dejavu-memory](https://github.com/RetiredPhysicist/pi-plugins/tree/main/packages/pi-dejavu-memory) — 面向 Pi 的同一套记忆工具
