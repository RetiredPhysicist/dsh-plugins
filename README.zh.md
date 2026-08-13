<p align="center">
  <img src="assets/readme/hero.zh.svg" alt="dsh-all-search —— 给 DeepSeek Harness 加 AnySearch 搜索" width="100%">
</p>

# dsh-all-search

给 DeepSeek Harness 加一个 **AnySearch** 搜索 provider,注册进 `ctx.web`。AnySearch 是单 MCP 网关,一把 API key 聚合 exa / tavily / firecrawl / context7 等多家搜索。

> 由 [pi-all-search](https://github.com/RealAlexandreAI/pi-all-search) 移植。

[English](README.md) · [中文](README.zh.md)

## 为什么需要它

dsh 自带 Exa / Perplexity / DeepSeek 搜索。本插件补 AnySearch:一把 key 多个后端,不用为每家单独配凭据。

## 快速开始

```sh
dsh plugin --profile web add dsh-all-search
```

provider 以 `anysearch` 注册到 `ctx.web`,内置的 `web_search` 工具会自动识别,与自带 provider 并存。

```yaml
- id: all-search
  name: dsh-all-search
  config:
    api_key: <你的 anysearch key>
```

| 键 | 必填 | 说明 |
|---|---|---|
| `api_key` | ✅ | 你的 AnySearch key |
| `base_url` | – | MCP 端点覆盖 |

\* 两个 key 键填其一。没有 key 时 provider `available() = false`,seam 自动跳过。

## 隐私

- key 只存在于你的配置文件——不写日志
- 只向 AnySearch 网关发送查询词和结果数量

## 开发

```bash
npm install
npm run typecheck
npm test          # 结果解析 / maxResults / HTTP 错误
npm run build
```

真实搜索测试:

```bash
node --import tsx tests/real/real-search.mjs
```

## License

MIT
