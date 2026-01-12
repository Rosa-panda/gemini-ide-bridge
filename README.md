# Gemini IDE Bridge

> 让 Gemini 直接操作你的本地文件系统

一个纯原生 JS 实现的 Chrome 扩展，零依赖，零构建工具链。

## 为什么做这个

想白嫖网页 Gemini，但每次都要手动复制粘贴代码太蠢了。这个插件让 AI 输出的代码可以一键应用到本地文件，支持增量修改、版本回退、语法检查。

## 特性

- **文件系统桥接** - 基于 File System Access API，浏览器原生能力
- **增量修改** - SEARCH/REPLACE 模式，精确匹配，保守策略
- **精准代码投喂** - READ 指令按需获取指定行号范围，避免上下文过载
- **输入无限制** - 绕过 Gemini 输入框字数限制，支持发送超长代码(可能无效)
- **语法防护** - 应用前静态分析括号匹配，拦截 AI 的语法错误
- **智能错误反馈** - 匹配失败时自动分析差异，给出具体修正建议
- **强制预览** - 语法检查失败时可强制预览并应用
- **版本控制** - IndexedDB 持久化，每文件 10 个历史版本
- **主题适配** - MutationObserver 实时跟随 Gemini 主题切换

## 💡 核心发现

**AI 不能吃太多代码！** 上下文过载会导致：
- 注意力分散，容易"自嗨式重构"
- 代码质量下降，幻觉增多
- 想改的太多，反而什么都改不好

**最佳实践：**
- 单次发送不超过 300 行代码
- 使用 READ 指令按需获取特定片段
- 先发项目结构概览，再发具体要改的文件
- 长对话后用"📦 交接"生成摘要，开新 chat 继续

## 🚀 AI 快速上手

如果你是 AI 助手，想要修改这个项目：

1. **先看 README**（就是这个文件），了解项目结构
2. **用 READ 指令**获取要改的文件片段，不要一次要太多
3. **用 SEARCH/REPLACE**做增量修改，不要整文件覆盖
4. **改完跑 `node build.js`**，确认构建成功

**关键文件速查：**
- 提示词相关 → `src/shared/prompt.js`
- 补丁匹配逻辑 → `src/core/patcher/matcher.js`
- 代码块按钮 → `src/gemini/actions.js`
- AI 输出解析 → `src/core/parser.js`
- 错误反馈 → `src/gemini/feedback.js`

## 更新日志

查看完整更新日志：[GitHub Releases](https://github.com/Rosa-panda/gemini-ide-bridge/releases)

## 安装

**无需任何构建环境！** 仓库已包含构建好的 `ide_core.js`，可直接使用。

1. 下载或克隆本项目
2. 打开 `chrome://extensions/` → 开启「开发者模式」
3. 点击「加载已解压的扩展程序」→ 选择本项目文件夹
4. 完成！

> 💡 仓库已包含构建好的 `ide_core.js`，可直接使用。如果修改了 `src/` 下的源码，运行 `npm install && node build.js` 重新构建。

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
├── build.js               # 构建脚本（esbuild 打包）
├── package.json           # npm 依赖配置
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
    │   ├── watcher.js     # 文件变化监听（轮询 + 智能优化）
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
    │   ├── editor.js      # 编辑器对话框入口
    │   ├── preview.js     # 变更预览对话框（Diff 展示）
    │   └── history.js     # 历史版本对话框（版本列表、回退）
    │
    ├── editor/            # 内嵌编辑器模块（VSCode 风格）
    │   ├── index.js       # 编辑器主入口，组装各组件
    │   ├── core.js        # 核心逻辑（UndoStack、光标操作）
    │   ├── highlight.js   # 语法高亮（DOM tokenizer）
    │   ├── languages.js   # 语言定义（30+语言关键字）
    │   ├── minimap.js     # 小地图组件（Canvas绘制）
    │   ├── folding.js     # 代码折叠（括号匹配+缩进检测）
    │   └── styles.js      # 样式模块（CSS集中管理）
    │
    └── gemini/            # Gemini 交互模块
        ├── index.js       # Gemini 类入口，组装与导出
        ├── input.js       # 输入框操作（Quill Patch、文本注入）
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
| `prompt.js` | 系统提示词 + 交接摘要提示词 |

### core/ - 核心功能
| 文件 | 功能 |
|------|------|
| `fs.js` | File System Access API 封装，文件读写、目录扫描 |
| `history.js` | 文件修改历史，IndexedDB 持久化 + 内存缓存双层存储 |
| `parser.js` | 解析 AI 输出的 SEARCH/REPLACE、FILE:、DELETE 指令 |
| `state.js` | 记录已应用的补丁，防止重复应用 |
| `deps.js` | 分析文件依赖关系，支持 JS/TS/Python/C++ |
| `watcher.js` | 文件变化监听（轮询 + 页面可见性 + requestIdleCallback + 防抖） |

### core/patcher/ - 补丁引擎
| 文件 | 功能 |
|------|------|
| `index.js` | `tryReplace` 主函数，协调各子模块，内置语法检查 |
| `matcher.js` | 模糊匹配：空白容差、缩进归一化、多候选评分、歧义拦截 |
| `indent.js` | 检测目标缩进，自动对齐替换内容，JSDoc 保护 |
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
| `editor.js` | 编辑器对话框入口（调用 editor 模块） |
| `preview.js` | Side-by-Side Diff 预览对话框，行级 + 字符级差异高亮 |
| `history.js` | 历史版本列表，支持预览和回退到指定版本 |

### editor/ - 内嵌编辑器（VSCode 风格）
| 文件 | 功能 |
|------|------|
| `index.js` | 编辑器主入口，组装各组件，窗口拖拽/调整大小 |
| `core.js` | 核心逻辑（UndoStack 撤销栈、光标位置计算） |
| `highlight.js` | 语法高亮（DOM tokenizer，绕过 Trusted Types） |
| `languages.js` | 语言定义（30+ 语言关键字、字面量、内置函数） |
| `minimap.js` | 小地图组件（Canvas 绘制，视口指示器可拖拽） |
| `folding.js` | 代码折叠（括号匹配 + 缩进检测，支持嵌套） |
| `styles.js` | 样式模块（CSS 集中管理） |

### gemini/ - Gemini 交互
| 文件 | 功能 |
|------|------|
| `index.js` | Gemini 对象入口，组装与导出 |
| `input.js` | 输入框操作（Quill Patch、文本注入、文件发送） |
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
# 首次需要安装依赖
npm install

# 构建（使用 esbuild 打包）
node build.js
```

> 💡 项目使用 esbuild 打包，自动处理模块依赖和作用域隔离。

## License

MIT
