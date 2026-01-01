# Gemini IDE Bridge

> 让 Gemini 直接操作你的本地文件系统

一个纯原生 JS 实现的 Chrome 扩展，零依赖，零构建工具链。

## 为什么做这个

Gemini 很强，但每次都要手动复制粘贴代码太蠢了。这个插件让 AI 输出的代码可以一键应用到本地文件，支持增量修改、版本回退、语法检查。

## 特性

- **文件系统桥接** - 基于 File System Access API，浏览器原生能力
- **增量修改** - SEARCH/REPLACE 模式，精确匹配，保守策略
- **语法防护** - 应用前静态分析括号匹配，拦截 AI 的语法错误
- **智能错误反馈** - 匹配失败时自动分析差异，给出具体修正建议
- **强制预览** - 语法检查失败时可强制预览并应用
- **版本控制** - IndexedDB 持久化，每文件 10 个历史版本
- **主题适配** - MutationObserver 实时跟随 Gemini 主题切换

## 更新日志

### V0.0.2 (当前)
- **错误反馈系统大幅强化**
  - 相似度匹配：找到最相似的代码位置
  - 逐行差异分析：精确到哪一行、哪个字符不对
  - 直接给出正确的 SEARCH 块，让 AI 复制粘贴
  - 具体修正指令：告诉 AI "第3行把Tab改成4个空格"
  - 省略号检测：禁止 AI 用 `// ...` 偷懒
- **自动错误反馈**
  - 文件不存在时自动反馈，并提示相似文件名
  - 语法错误时自动反馈 + 按钮变成"强制预览"
  - 预览对话框支持显示语法警告横幅
- **主题监听优化**
  - 从 2 秒轮询改为 MutationObserver 即时响应
- **版本号管理**
  - 单一数据源：只需改 manifest.json
- **Bug 修复**
  - 修复 parseSearchReplace 不支持无方括号路径格式
  - 修复删除目录时子目录句柄残留的内存泄漏
  - 修复正则表达式 `split(/,/)` 被误判为除法

### V0.0.1
- 初始版本
- 模块化重构

## 安装

```bash
# 没有 npm install，没有 node_modules
# 直接加载到 Chrome 扩展即可
```

1. `chrome://extensions/` → 开发者模式
2. 加载已解压的扩展程序 → 选择本项目

## 使用

1. 打开 [gemini.google.com](https://gemini.google.com)
2. 右下角 `⚡️` → 连接文件夹
3. `🤖 提示词` 让 Gemini 学会协作格式

## AI 协作格式

```
<<<<<<< SEARCH [path/to/file.js]
要替换的代码
=======
新代码
>>>>>>> REPLACE
```

```javascript
// FILE: path/to/new-file.js
新文件内容
```

## 项目结构

```
gemini-ide-bridge/
├── manifest.json          # Chrome 扩展配置
├── content.js             # 内容脚本入口，注入 ide_core.js
├── build.js               # 构建脚本，合并模块为单文件
├── ide_core.js            # 构建产物，运行在页面中的核心逻辑
│
└── src/                   # 源码目录（模块化）
    ├── main.js            # 入口文件，导出全局对象
    │
    ├── shared/            # 共享工具模块
    │   ├── utils.js       # 通用工具函数（Toast、Token 估算、语言检测）
    │   ├── theme.js       # 主题检测与 CSS 变量管理
    │   └── prompt.js      # 系统提示词生成
    │
    ├── core/              # 核心功能模块
    │   ├── fs.js          # 文件系统操作（读写、创建、删除）
    │   ├── history.js     # 文件历史版本管理（IndexedDB + 内存缓存）
    │   ├── parser.js      # AI 输出解析（SEARCH/REPLACE、FILE:、DELETE）
    │   ├── state.js       # 补丁应用状态持久化（localStorage）
    │   ├── deps.js        # 依赖分析（JS/Python/C 的 import 解析）
    │   │
    │   └── patcher/       # 补丁应用引擎
    │       ├── index.js   # 补丁入口，tryReplace 主函数
    │       ├── matcher.js # 模糊匹配算法（空白容差、缩进归一化）
    │       ├── indent.js  # 缩进检测与自动对齐
    │       ├── literals.js# 字符串字面量保护（防止误匹配）
    │       ├── syntax.js  # JS/TS 语法检查（括号匹配）
    │       └── lineEnding.js # 换行符风格保持（CRLF/LF）
    │
    ├── ui/                # 用户界面模块
    │   ├── index.js       # UI 类入口，初始化与状态管理
    │   ├── sidebar.js     # 侧边栏组件（触发按钮、面板、空状态）
    │   ├── tree.js        # 文件树渲染与搜索过滤
    │   ├── menu.js        # 右键菜单（文件/文件夹操作）
    │   └── icons.js       # SVG 图标生成（Trusted Types 安全）
    │
    ├── dialog/            # 对话框模块
    │   ├── index.js       # 对话框入口
    │   ├── preview.js     # 变更预览对话框（Diff 展示）
    │   └── history.js     # 历史版本对话框（版本列表、回退）
    │
    └── gemini/            # Gemini 交互模块
        ├── index.js       # Gemini 类入口，输入框操作
        ├── watcher.js     # 代码块监听器（MutationObserver）
        ├── actions.js     # 代码块操作栏注入（应用、撤销按钮）
        ├── diff.js        # 差异分析工具（相似度、候选搜索）
        └── feedback.js    # 错误反馈生成（给 AI 的详细错误信息）
```

## 模块说明

### shared/ - 共享工具
| 文件 | 功能 |
|------|------|
| `utils.js` | Toast 通知、Token 数量估算、文件语言检测 |
| `theme.js` | 检测页面亮/暗主题，生成对应 CSS 变量 |
| `prompt.js` | 生成发送给 Gemini 的系统协作提示词 |

### core/ - 核心功能
| 文件 | 功能 |
|------|------|
| `fs.js` | File System Access API 封装，文件读写、目录扫描 |
| `history.js` | 文件修改历史，IndexedDB 持久化 + 内存缓存双层存储 |
| `parser.js` | 解析 AI 输出的 SEARCH/REPLACE、FILE:、DELETE 指令 |
| `state.js` | 记录已应用的补丁，防止重复应用 |
| `deps.js` | 分析文件依赖关系，支持 JS/TS/Python/C++ |

### core/patcher/ - 补丁引擎
| 文件 | 功能 |
|------|------|
| `index.js` | `tryReplace` 主函数，协调各子模块 |
| `matcher.js` | 模糊匹配：空白容差、缩进归一化、多候选评分 |
| `indent.js` | 检测目标缩进，自动对齐替换内容 |
| `literals.js` | 保护字符串/模板字面量，防止内部内容被误匹配 |
| `syntax.js` | JS/TS 语法检查，括号/引号匹配验证 |
| `lineEnding.js` | 检测并保持原文件的换行符风格 |

### ui/ - 用户界面
| 文件 | 功能 |
|------|------|
| `index.js` | UI 类，管理侧边栏状态和文件树 |
| `sidebar.js` | 创建触发按钮、侧边栏面板、空状态提示 |
| `tree.js` | 渲染文件树、搜索过滤、高亮匹配 |
| `menu.js` | 文件/文件夹右键菜单，支持发送、删除、历史等操作 |
| `icons.js` | SVG 图标工厂，Trusted Types 安全 |

### dialog/ - 对话框
| 文件 | 功能 |
|------|------|
| `index.js` | 对话框模块入口 |
| `preview.js` | 变更预览对话框，左右对比 SEARCH/REPLACE |
| `history.js` | 历史版本列表，支持预览和回退到指定版本 |

### gemini/ - Gemini 交互
| 文件 | 功能 |
|------|------|
| `index.js` | Gemini 对象，输入框操作、文件发送 |
| `watcher.js` | MutationObserver 监听 AI 输出的代码块 |
| `actions.js` | 为代码块注入操作栏（应用、撤销、删除按钮） |
| `diff.js` | 差异分析工具（相似度计算、候选搜索、逐行对比） |
| `feedback.js` | 错误反馈生成（匹配失败、语法错误、重复匹配等） |

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Gemini 网页 (gemini.google.com)           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    注入     ┌─────────────────────────┐    │
│  │ content.js  │ ─────────▶ │     ide_core.js         │    │
│  │ (桥接脚本)   │            │  (核心逻辑,运行在页面)    │    │
│  └─────────────┘            └───────────┬─────────────┘    │
│                                         │                   │
│                              ┌──────────▼──────────┐        │
│                              │   侧边栏 UI 组件     │        │
│                              │  - 文件树           │        │
│                              │  - 操作按钮         │        │
│                              └──────────┬──────────┘        │
└─────────────────────────────────────────┼───────────────────┘
                                          │
                          File System Access API
                                          │
                              ┌───────────▼───────────┐
                              │     本地文件系统       │
                              │   (你的项目文件夹)     │
                              └───────────────────────┘
```

## 开发

```bash
node build.js  # 合并 src/ 下所有模块为 ide_core.js
```

## License

MIT
