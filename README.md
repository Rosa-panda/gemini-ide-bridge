# Gemini IDE Bridge

> 🚀 将 Google Gemini 网页变成本地 IDE 的浏览器插件

一个零依赖的 Chrome 扩展，让你直接在 Gemini 网页上进行代码开发、文件管理和项目操作。

## 功能特性

- 📁 **本地文件夹连接** - 基于 File System Access API
- 🌲 **文件树浏览** - 带连接线的树形结构，自动忽略 node_modules 等
- ✏️ **增量修改** - SEARCH/REPLACE 格式，精确匹配 + 模糊匹配
- 🛡️ **语法检查** - 应用前检查括号匹配，防止错误代码被应用
- ⏪ **版本回退** - IndexedDB 持久化，每文件保留 10 个版本
- 🔗 **依赖分析** - 自动解析 import/require，一键发送文件及依赖
- 🎨 **主题适配** - 自动跟随 Gemini 亮/暗主题

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目文件夹

## 使用

1. 访问 [gemini.google.com](https://gemini.google.com)
2. 点击左下角 `⚡️ IDE` 悬浮球
3. 点击「连接文件夹」选择本地项目
4. 点击「🤖 教导AI」让 Gemini 了解协作格式

### 文件操作

- **左键点击文件** - 发送文件内容到 Gemini
- **右键点击文件** - 历史版本、撤销、删除、发送文件+依赖
- **右键点击文件夹** - 发送目录结构、新建文件、删除

## AI 协作格式

### 修改文件

```
<<<<<<< SEARCH [src/utils.js]
要被替换的原始代码
=======
替换后的新代码
>>>>>>> REPLACE
```

### 创建文件

```javascript
// FILE: src/newFile.js
完整的文件内容...
```

### 覆盖文件

```javascript
// FILE: src/utils.js [OVERWRITE]
完整的新文件内容...
```

### 删除文件

```
<<<<<<< DELETE [src/old.js]
>>>>>>> END
```

## 项目结构

```
gemini-ide-bridge/
├── manifest.json      # 插件配置 (MV3)
├── content.js         # 内容脚本（桥接）
├── ide_core.js        # 构建产物
├── build.js           # 构建脚本
└── src/
    ├── main.js        # 入口
    ├── fs.js          # 文件系统
    ├── ui.js          # 界面
    ├── gemini.js      # Gemini 交互
    ├── dialog.js      # 对话框
    ├── theme.js       # 主题
    ├── history.js     # 版本历史
    ├── parser.js      # 指令解析
    ├── patcher.js     # 代码匹配 + 语法检查
    ├── state.js       # 状态持久化
    ├── deps.js        # 依赖分析
    ├── prompt.js      # 提示词
    └── utils.js       # 工具函数
```

## 开发

```bash
node build.js
```

然后在 Chrome 扩展页面刷新插件。

## License

MIT
