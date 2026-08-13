# dsh-all-search

给 DeepSeek Harness 加一个 **AnySearch** 搜索 provider,注册进 `ctx.web`。
AnySearch 是单 MCP 网关,一把 API key 聚合 exa / tavily / firecrawl /
context7 等多家搜索引擎。

> 由 [pi-all-search](https://github.com/RealAlexandreAI/pi-all-search) 移植。

## 为什么需要它

dsh 自带 Exa / Perplexity / DeepSeek 搜索。本插件补的是 **AnySearch**:
一把 key 多个后端,不用为每家单独配凭据。

## 安装

```sh
dsh plugin add dsh-all-search
```

provider 以 `anysearch` 注册到 `ctx.web`,内置的 `web_search` 工具会自动
识别,与自带 provider 并存。

## 配置

```yaml
- id: search
  name: dsh-all-search
  config:
    api_key_ref: ANYSEARCH_API_KEY   # 推荐:环境变量名
    # api_key: <直接填 key>          # 备用
    # base_url: https://api.anysearch.com/mcp
```

| 键 | 必填 | 说明 |
|---|---|---|
| `api_key_ref` | * | AnySearch key 的环境变量名(推荐,值不落配置) |
| `api_key` | * | 直接填 key(备用) |
| `base_url` | – | MCP 端点覆盖(默认官方) |

\* 二者填其一。没有 key 时 provider `available() = false`,seam 自动跳过。

## 隐私

- key 每次搜索经 `ctx.credentials` 解析,不写日志
- 只向 AnySearch 网关发送你的查询词和结果数量

## 开发

```bash
npm install
npm run typecheck
npm test          # 结果解析 / maxResults 截断 / HTTP 错误
npm run build
```

真实搜索集成测试:

```bash
ANYSEARCH_API_KEY=<key> node --import tsx tests/real/real-search.mjs
```

## License

MIT
