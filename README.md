# dsh-cloudflare-browser-run

给 DeepSeek Harness 提供**真浏览器网页访问**能力:headless Chrome 跑在
Cloudflare 网络上,JS 渲染的页面、SPA、截图、PDF 都能处理。

> 由 [pi-cloudflare-browser-run](https://github.com/RealAlexandreAI/pi-cloudflare-browser-run) 移植,
> 完全符合 dsh 的 Cordis 插件规范。

## 为什么需要它

dsh 内置的 `web_fetch` 只是普通 HTTP fetch——JS 渲染的页面拿到的是空壳,
官方也标注 SSRF 防护待补。本插件补上:

- 真浏览器渲染(JS/SPA 页面也能读)
- 干净的 markdown 文本提取
- 截图(PNG)和 PDF
- 登录态会话、WebMCP 站点

## 工具

| 工具 | 说明 |
|---|---|
| `browse` | 抓取公开 URL,返回干净 markdown(默认);`action` 可选 `screenshot` / `pdf` |
| `screenshot` | 页面截图存为 PNG,返回本地路径 |
| `pdf` | 页面渲染为 PDF,返回本地路径 |

## 安装

```sh
dsh plugin add dsh-cloudflare-browser-run
```

或在 `cordis.yml` 组合中:

```yaml
- id: browser-run
  name: dsh-cloudflare-browser-run
  config:
    cf_api_token_ref: CF_API_TOKEN   # 推荐:环境变量名,经 ctx.credentials 解析
    cf_account_id: <你的 account id>
```

## 配置

| 键 | 必填 | 说明 |
|---|---|---|
| `cf_api_token_ref` | * | CF API token 的环境变量名(推荐,值不落配置) |
| `cf_api_token` | * | 直接填 token 值(备用) |
| `cf_account_id` | ✅ | 你的 Cloudflare 账号 ID |
| `cf_api_base` | – | API 地址覆盖(默认官方 v4) |
| `output_dir` | – | 截图/PDF 输出目录(默认系统临时目录) |

\* 二者填其一。

### 创建 token

1. [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → 模板选 **Browser Rendering: Edit**
2. account id 在 `dash.cloudflare.com/<ACCOUNT_ID>/...`
3. 导出环境变量,或直接写在配置里

### 快速验证

```bash
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/browser-rendering/markdown" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## 隐私

- **只访问公网**:所有 URL 先过 SSRF 防护(拒绝 localhost/内网 IP/IPv6/userinfo)
- token 每次操作经 `ctx.credentials` 解析,不写日志、不落盘
- Browser Run 以合规 bot 身份访问,是正规的抓取方式

## 开发

```bash
npm install
npm run typecheck
npm test          # SSRF 防护 / 配置解析 / API 调用形状
npm run build
```

真实 API 集成测试(不参与 `npm test`):

```bash
DSH_TEST_CF_TOKEN=<token> DSH_TEST_CF_ACCOUNT=<account> node --import tsx tests/real/real-cf.mjs
```

## License

MIT
