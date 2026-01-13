# Gemini IDE Bridge

English | **[中文](./README_ZH.md)**

> Let Gemini directly operate your local file system

A pure native JS Chrome extension with zero dependencies and zero build toolchain.

## Why This Project

Want to use web Gemini for free, but manually copying and pasting code every time is tedious. This extension allows AI-generated code to be applied to local files with one click, supporting incremental modifications, version rollback, and syntax checking.

## Features

- **File System Bridge** - Based on File System Access API, native browser capability
- **Incremental Modification** - SEARCH/REPLACE mode, precise matching, conservative strategy
- **Precise Code Feeding** - READ directive fetches specific line ranges on demand, avoiding context overload
- **Unlimited Input** - Bypass Gemini input box character limit, support sending very long code (may not work)
- **Syntax Protection** - Static analysis of bracket matching before applying, intercept AI syntax errors
- **Smart Error Feedback** - Automatically analyze differences on match failure, provide specific correction suggestions
- **Force Preview** - Force preview and apply when syntax check fails
- **Version Control** - IndexedDB persistence, 10 history versions per file
- **Theme Adaptation** - MutationObserver real-time following Gemini theme switching
- **Built-in Editor** - VSCode style, syntax highlighting, minimap, code folding, 30+ language support
- **Auto-close Brackets** - Smart context judgment, support backspace delete and skip
- **Ask AI with Selected Text** - Select code in editor, one-click send to Gemini for analysis
- **Project Skeleton** - One-click generate project structure to send to AI, quickly understand the project
- **Diff Ask AI** - Ask AI to analyze code changes during change preview

## 💡 Core Discovery

**AI can't eat too much code!** Context overload leads to:
- Scattered attention, prone to "self-indulgent refactoring"
- Decreased code quality, more hallucinations
- Want to change too much, end up changing nothing well

**Best Practices:**
- Send no more than 300 lines of code at a time
- Use READ directive to fetch specific snippets on demand
- Send project structure overview first, then specific files to modify
- Use "📦 Handover" to generate summary after long conversations, continue in new chat

## 🚀 AI Quick Start

If you're an AI assistant wanting to modify this project:

1. **Read README first** (this file), understand project structure
2. **Use READ directive** to get file snippets to modify, don't request too much at once
3. **Use SEARCH/REPLACE** for incremental modifications, don't overwrite entire files
4. **Run `node build.js` after changes**, confirm build success

**Key Files Quick Reference:**
- Prompts related → `src/shared/prompt.js`
- Patch matching logic → `src/core/patcher/matcher.js`
- Code block buttons → `src/gemini/actions.js`
- AI output parsing → `src/core/parser.js`
- Error feedback → `src/gemini/feedback.js`

## Changelog

View full changelog: [GitHub Releases](https://github.com/Rosa-panda/gemini-ide-bridge/releases)

## Installation

**No build environment needed!** Repository includes pre-built `ide_core.js`, ready to use.

1. Download or clone this project
2. Open `chrome://extensions/` → Enable "Developer mode"
3. Click "Load unpacked" → Select this project folder
4. Done!

> 💡 Repository includes pre-built `ide_core.js`, ready to use. If you modify source code under `src/`, run `npm install && node build.js` to rebuild.

## Usage

1. Open [gemini.google.com](https://gemini.google.com)
2. Click `⚡️` in bottom right → Connect folder
3. `🤖 Prompt` to teach Gemini the collaboration format

## AI Collaboration Format

```
<<<<<<< SEARCH [path/to/file.js]
code to replace
=======
new code
>>>>>>> REPLACE
```

```javascript
// FILE: path/to/new-file.js
new file content
```


## Project Structure

```
gemini-ide-bridge/
├── manifest.json          # Chrome extension config
├── content.js             # Content script entry, injects ide_core.js
├── build.js               # Build script (esbuild bundler)
├── package.json           # npm dependencies
├── ide_core.js            # Build output, core logic running in page
│
└── src/                   # Source directory (modular)
    ├── main.js            # Entry file, exports global object
    │
    ├── shared/            # Shared utility modules
    │   ├── utils.js       # Common utilities (Toast, Token estimation, language detection)
    │   ├── theme.js       # Theme detection & CSS variable management
    │   ├── prompt.js      # System prompt generation
    │   ├── diff.js        # Diff algorithm (line + character level), color schemes
    │   ├── undo.js        # UndoStack undo/redo stack
    │   ├── caret.js       # Cursor operations (contenteditable cursor management)
    │   └── i18n.js        # Internationalization (Chinese/English)
    │
    ├── core/              # Core functionality modules
    │   ├── fs.js          # File system operations (read, write, create, delete)
    │   ├── history.js     # File history version management (IndexedDB + memory cache)
    │   ├── parser.js      # AI output parsing (SEARCH/REPLACE, FILE:, DELETE)
    │   ├── state.js       # Patch application state persistence (localStorage)
    │   ├── deps.js        # Dependency analysis (JS/Python/C import parsing)
    │   ├── watcher.js     # File change monitoring (polling + smart optimization)
    │   ├── skeleton.js    # Project skeleton generation (AST-based approach)
    │   │
    │   └── patcher/       # Patch application engine
    │       ├── index.js   # Patch entry, tryReplace main function
    │       ├── matcher.js # Fuzzy matching algorithm (whitespace tolerance, indent normalization)
    │       ├── indent.js  # Indent detection & auto-alignment
    │       ├── literals.js# String literal protection (prevent false matches)
    │       ├── syntax.js  # JS/TS syntax check (bracket matching)
    │       └── lineEnding.js # Line ending style preservation (CRLF/LF)
    │
    ├── ui/                # User interface modules
    │   ├── index.js       # UI class entry, initialization & state management
    │   ├── sidebar.js     # Sidebar components (trigger button, panel, empty state)
    │   ├── tree.js        # File tree rendering & search filtering
    │   ├── menu.js        # Context menu (file/folder operations)
    │   └── icons.js       # SVG icon generation (Trusted Types safe)
    │
    ├── dialog/            # Dialog modules
    │   ├── index.js       # Dialog entry
    │   ├── editor.js      # Editor dialog entry
    │   ├── preview.js     # Change preview dialog (Diff display)
    │   └── history.js     # History version dialog (version list, rollback)
    │
    ├── editor/            # Built-in editor module (VSCode style)
    │   ├── index.js       # Editor main entry, assembles components
    │   ├── core.js        # Core logic (UndoStack, cursor operations)
    │   ├── highlight.js   # Syntax highlighting (DOM tokenizer)
    │   ├── languages.js   # Language definitions (30+ language keywords)
    │   ├── minimap.js     # Minimap component (Canvas rendering)
    │   └── styles.js      # Style module (centralized CSS management)
    │
    └── gemini/            # Gemini interaction modules
        ├── index.js       # Gemini object entry, assembly & export
        ├── input.js       # Input box operations (Quill Patch, text injection)
        ├── watcher.js     # Code block listener (MutationObserver)
        ├── actions.js     # Code block action bar injection (apply, undo buttons)
        ├── diff.js        # Diff analysis tools (similarity, candidate search)
        └── feedback.js    # Error feedback generation (detailed error info for AI)
```

## Development

```bash
# Install dependencies first time
npm install

# Build (using esbuild bundler)
node build.js
```

> 💡 Project uses esbuild for bundling, automatically handles module dependencies and scope isolation.

## License

GPL-3.0
