# 待解决问题追踪

## 🔴 进行中

### ISSUE-011: 编辑器体验增强 - 超越 Quarkonix
**状态**: 🔴 进行中

**目标**: 在保持零依赖、轻量化的前提下，实现比 Quarkonix（React + CodeMirror）更好的编辑体验

**竞品分析**:
- **Quarkonix 优势**: CodeMirror 编辑器（自动补全、多光标）、Skeleton 骨架图、选中文本悬浮按钮
- **我们的优势**: 零依赖、非阻塞 IO、matcher 算法更稳健、更轻量

**待实现功能**:

1. **自动闭合括号** ⏳
   - 输入 `(` 自动补 `)`，支持 `[]`、`{}`、`""`、`''`
   - 智能退格删除（删除左括号时同时删除右括号）
   - 智能跳过（输入右括号时如果后面已有则跳过）
   - 参考：VSCode 的 `autoClosingBrackets` 策略
   - 向量库发现：需要处理 `autoClosingDelete` 和 `autoClosingOvertype`

2. **项目骨架图生成** ⏳
   - 新增 `src/core/skeleton.js` - 基于 `getLogicSignature` 的语义级骨架生成
   - 编辑器工具栏加 "🗺️ 投喂项目地图" 按钮
   - 一键生成所有文件的结构图发给 Gemini
   - 优势：比 Quarkonix 的正则替换更准确（基于逻辑签名而非暴力截断）
   - 向量库发现：LLVM AST 生成的结构化思路可借鉴

3. **选中文本悬浮按钮** ⏳
   - 监听 `selectionchange` 事件
   - 选中代码时弹出 "✨ Ask AI" 悬浮按钮
   - 点击后将选中内容发送给 Gemini
   - 参考：Chromium 的 `SelectionPopupController`
   - 向量库发现：需要加防抖避免频繁触发

**技术要点**:
- 所有功能基于原生 API，不引入新依赖
- 利用现有的 `getLogicSignature` 做语义分析
- 保持代码体积在合理范围（目标 < 500KB）

**文件变更**:
- ✅ `src/core/skeleton.js` - 已创建，待集成
- ⏳ `src/editor/index.js` - 待添加自动闭合、投喂按钮、悬浮按钮

---

## ✅ 已完成

### ISSUE-010: 编辑器增强 - VSCode 风格
**状态**: ✅ 已完成

**实现功能**:
- 8方向拖拽调整窗口大小
- 语法高亮（DOM方式绕过Trusted Types）
- 当前行高亮 + 行号高亮
- 小地图（VSCode风格，Canvas绘制，视口指示器可拖拽）
- 代码折叠（括号匹配 + 缩进检测）
- 30+ 编程语言支持

**架构设计**:
```
src/editor/
├── index.js        # 主入口，组装各模块 (~350行)
├── core.js         # 核心编辑逻辑（UndoStack、光标操作）
├── highlight.js    # 语法高亮（DOM tokenizer方案）
├── languages.js    # 语言定义（30+语言关键字、别名映射）
├── minimap.js      # 小地图组件（VSCode风格Canvas绘制）
├── folding.js      # 代码折叠（重量级实现）
└── styles.js       # 样式模块（CSS集中管理）
```

**多语言支持**:
- 系统级：C, C++, Rust, Go, Assembly, Zig, Nim, Crystal
- JVM：Java, Kotlin, Scala, Groovy
- 脚本：JavaScript, TypeScript, Python, Ruby, PHP, Perl, Lua
- 函数式：Haskell, Elixir, Erlang, Clojure, F#
- 移动端：Swift, Objective-C, Dart
- 数据/配置：SQL, JSON, YAML, TOML, XML, CSS, HTML
- Shell：Bash, PowerShell
- 其他：R, MATLAB, Julia, WASM, Solidity, GLSL
- 100+ 文件扩展名自动识别

### ISSUE-009: 构建系统迁移到 esbuild
**解决方案**: 迁移到 esbuild 打包器，自动处理模块作用域隔离

### ISSUE-008: 历史版本对比 Diff 高亮
**实现**: Myers Diff 算法，行级差异高亮

### ISSUE-007: 文件右键菜单编辑功能
**实现**: 独立编辑器对话框，Undo/Redo、Tab 缩进、中文输入法兼容

### ISSUE-006: 预览对话框可编辑
**实现**: Diff/编辑模式切换，可微调 AI 生成的代码

### ISSUE-005: 内嵌编辑器（基础版）
**实现**: 基于 zserge 方案的轻量编辑器

---

## 🗄️ 历史记录

### ISSUE-001: 补丁状态检测失效
**解决方案**: 三层递进检测策略

### ISSUE-002: 触发按钮 hover 展开时文字换行
**解决方案**: 移除 hover 展开文字，改为简单 scale 效果

### ~~ISSUE-003: 断开连接功能~~
**状态**: ❌ 已放弃（刷新网页即可）
