/**
 * 语言定义模块 - 各编程语言的关键字和语法规则
 * 
 * 支持的语言：
 * - 系统级：C, C++, Rust, Go, Assembly
 * - JVM：Java, Kotlin, Scala, Groovy
 * - 脚本：JavaScript, TypeScript, Python, Ruby, PHP, Perl, Lua
 * - 函数式：Haskell, Elixir, Erlang, Clojure, F#
 * - 移动端：Swift, Objective-C, Dart
 * - 数据/配置：SQL, JSON, YAML, TOML, XML
 * - Shell：Bash, PowerShell, Batch
 * - 其他：R, MATLAB, Julia, Zig, Nim, Crystal
 */

// ============ 关键字定义 ============

export const KEYWORDS = {
    // JavaScript/TypeScript
    javascript: 'async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|let|new|return|static|super|switch|this|throw|try|typeof|var|void|while|with|yield|from|of|type|interface|enum|implements|namespace|declare|abstract|private|protected|public|readonly',
    
    // Python
    python: 'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|match|case',
    
    // Java
    java: 'abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|var|record|sealed|permits|non-sealed',
    
    // C
    c: 'auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|restrict|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|_Alignas|_Alignof|_Atomic|_Bool|_Complex|_Generic|_Imaginary|_Noreturn|_Static_assert|_Thread_local',
    
    // C++
    cpp: 'alignas|alignof|and|and_eq|asm|auto|bitand|bitor|bool|break|case|catch|char|char8_t|char16_t|char32_t|class|compl|concept|const|consteval|constexpr|constinit|const_cast|continue|co_await|co_return|co_yield|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|not|not_eq|nullptr|operator|or|or_eq|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while|xor|xor_eq',

    // Rust
    rust: 'as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while|abstract|become|box|do|final|macro|override|priv|try|typeof|unsized|virtual|yield',
    
    // Go
    go: 'break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var',
    
    // Swift
    swift: 'actor|any|as|associatedtype|async|await|break|case|catch|class|continue|convenience|default|defer|deinit|didSet|do|dynamic|else|enum|extension|fallthrough|false|fileprivate|final|for|func|get|guard|if|import|in|indirect|infix|init|inout|internal|is|isolated|lazy|let|mutating|nil|nonisolated|nonmutating|open|operator|optional|override|postfix|precedencegroup|prefix|private|protocol|public|repeat|required|rethrows|return|self|Self|set|some|static|struct|subscript|super|switch|throw|throws|true|try|typealias|unowned|var|weak|where|while|willSet',
    
    // Kotlin
    kotlin: 'abstract|actual|annotation|as|break|by|catch|class|companion|const|constructor|continue|crossinline|data|delegate|do|dynamic|else|enum|expect|external|false|field|file|final|finally|for|fun|get|if|import|in|infix|init|inline|inner|interface|internal|is|it|lateinit|noinline|null|object|open|operator|out|override|package|param|private|property|protected|public|receiver|reified|return|sealed|set|setparam|super|suspend|tailrec|this|throw|true|try|typealias|typeof|val|value|var|vararg|when|where|while',
    
    // Ruby
    ruby: 'BEGIN|END|__ENCODING__|__END__|__FILE__|__LINE__|alias|and|begin|break|case|class|def|defined?|do|else|elsif|end|ensure|false|for|if|in|module|next|nil|not|or|redo|rescue|retry|return|self|super|then|true|undef|unless|until|when|while|yield',
    
    // PHP
    php: 'abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|eval|exit|extends|final|finally|fn|for|foreach|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|new|or|print|private|protected|public|readonly|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|xor|yield|from',

    // Lua
    lua: 'and|break|do|else|elseif|end|false|for|function|goto|if|in|local|nil|not|or|repeat|return|then|true|until|while',
    
    // Perl
    perl: 'abs|accept|alarm|atan2|AUTOLOAD|BEGIN|bind|binmode|bless|break|caller|chdir|CHECK|chmod|chomp|chop|chown|chr|chroot|close|closedir|cmp|connect|continue|cos|crypt|dbmclose|dbmopen|default|defined|delete|DESTROY|die|do|dump|each|else|elsif|END|endgrent|endhostent|endnetent|endprotoent|endpwent|endservent|eof|eq|eval|exec|exists|exit|exp|fcntl|fileno|flock|for|foreach|fork|format|formline|ge|getc|getgrent|getgrgid|getgrnam|gethostbyaddr|gethostbyname|gethostent|getlogin|getnetbyaddr|getnetbyname|getnetent|getpeername|getpgrp|getppid|getpriority|getprotobyname|getprotobynumber|getprotoent|getpwent|getpwnam|getpwuid|getservbyname|getservbyport|getservent|getsockname|getsockopt|given|glob|gmtime|goto|grep|gt|hex|if|import|index|INIT|int|ioctl|join|keys|kill|last|lc|lcfirst|le|length|link|listen|local|localtime|lock|log|lstat|lt|m|map|mkdir|msgctl|msgget|msgrcv|msgsnd|my|ne|next|no|not|oct|open|opendir|or|ord|our|pack|package|pipe|pop|pos|print|printf|prototype|push|q|qq|qr|quotemeta|qw|qx|rand|read|readdir|readline|readlink|readpipe|recv|redo|ref|rename|require|reset|return|reverse|rewinddir|rindex|rmdir|s|say|scalar|seek|seekdir|select|semctl|semget|semop|send|setgrent|sethostent|setnetent|setpgrp|setpriority|setprotoent|setpwent|setservent|setsockopt|shift|shmctl|shmget|shmread|shmwrite|shutdown|sin|sleep|socket|socketpair|sort|splice|split|sprintf|sqrt|srand|stat|state|study|sub|substr|symlink|syscall|sysopen|sysread|sysseek|system|syswrite|tell|telldir|tie|tied|time|times|tr|truncate|uc|ucfirst|umask|undef|UNITCHECK|unlink|unpack|unshift|untie|until|use|utime|values|vec|wait|waitpid|wantarray|warn|when|while|write|x|xor|y',
    
    // Haskell
    haskell: 'as|case|class|data|default|deriving|do|else|family|forall|foreign|hiding|if|import|in|infix|infixl|infixr|instance|let|mdo|module|newtype|of|proc|qualified|rec|then|type|where',
    
    // Scala
    scala: 'abstract|case|catch|class|def|derives|do|else|enum|export|extends|extension|false|final|finally|for|forSome|given|if|implicit|import|infix|inline|lazy|match|new|null|object|opaque|open|override|package|private|protected|return|sealed|super|then|this|throw|trait|transparent|true|try|type|using|val|var|while|with|yield',
    
    // Elixir
    elixir: 'after|alias|and|case|catch|cond|def|defcallback|defdelegate|defexception|defguard|defguardp|defimpl|defmacro|defmacrop|defmodule|defoverridable|defp|defprotocol|defstruct|do|else|end|false|fn|for|if|import|in|nil|not|or|quote|raise|receive|require|rescue|true|try|unless|unquote|unquote_splicing|use|when|with',
    
    // SQL
    sql: 'ADD|ALL|ALTER|AND|ANY|AS|ASC|BACKUP|BETWEEN|BY|CASE|CHECK|COLUMN|CONSTRAINT|CREATE|DATABASE|DEFAULT|DELETE|DESC|DISTINCT|DROP|ELSE|END|ESCAPE|EXEC|EXISTS|FOREIGN|FROM|FULL|GROUP|HAVING|IF|IN|INDEX|INNER|INSERT|INTO|IS|JOIN|KEY|LEFT|LIKE|LIMIT|NOT|NULL|OFFSET|ON|OR|ORDER|OUTER|PRIMARY|PROCEDURE|REFERENCES|REPLACE|RIGHT|ROLLBACK|ROWNUM|SELECT|SET|TABLE|THEN|TOP|TRANSACTION|TRUNCATE|UNION|UNIQUE|UPDATE|VALUES|VIEW|WHEN|WHERE|WITH',

    // Shell/Bash
    bash: 'alias|bg|bind|break|builtin|caller|case|cd|command|compgen|complete|compopt|continue|coproc|declare|dirs|disown|do|done|echo|elif|else|enable|esac|eval|exec|exit|export|false|fc|fg|fi|for|function|getopts|hash|help|history|if|in|jobs|kill|let|local|logout|mapfile|popd|printf|pushd|pwd|read|readarray|readonly|return|select|set|shift|shopt|source|suspend|test|then|time|times|trap|true|type|typeset|ulimit|umask|unalias|unset|until|wait|while',
    
    // PowerShell
    powershell: 'Begin|Break|Catch|Class|Continue|Data|Define|Do|DynamicParam|Else|ElseIf|End|Enum|Exit|Filter|Finally|For|ForEach|From|Function|Hidden|If|In|InlineScript|Parallel|Param|Process|Return|Sequence|Static|Switch|Throw|Trap|Try|Until|Using|Var|While|Workflow',
    
    // R
    r: 'break|else|for|function|if|in|next|repeat|return|while|TRUE|FALSE|NULL|NA|NA_integer_|NA_real_|NA_complex_|NA_character_|Inf|NaN',
    
    // MATLAB/Octave
    matlab: 'break|case|catch|classdef|continue|else|elseif|end|enumeration|events|for|function|global|if|methods|otherwise|parfor|persistent|properties|return|spmd|switch|try|while',
    
    // Julia
    julia: 'abstract|baremodule|begin|break|catch|const|continue|do|else|elseif|end|export|finally|for|function|global|if|import|in|let|local|macro|module|mutable|outer|primitive|quote|return|struct|try|type|using|where|while',
    
    // Dart
    dart: 'abstract|as|assert|async|await|base|break|case|catch|class|const|continue|covariant|default|deferred|do|dynamic|else|enum|export|extends|extension|external|factory|false|final|finally|for|Function|get|hide|if|implements|import|in|interface|is|late|library|mixin|new|null|on|operator|part|required|rethrow|return|sealed|set|show|static|super|switch|sync|this|throw|true|try|typedef|var|void|when|while|with|yield',
    
    // Objective-C (额外关键字，基于 C)
    objc: 'auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|restrict|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|BOOL|Class|id|IMP|nil|Nil|NO|NULL|SEL|YES|self|super|in|out|inout|bycopy|byref|oneway|interface|implementation|protocol|end|private|protected|public|package|try|throw|catch|finally|synchronized|autoreleasepool|selector|encode|defs|class|property|synthesize|dynamic|optional|required',

    // Zig
    zig: 'addrspace|align|allowzero|and|anyframe|anytype|asm|async|await|break|callconv|catch|comptime|const|continue|defer|else|enum|errdefer|error|export|extern|false|fn|for|if|inline|linksection|noalias|noinline|nosuspend|null|opaque|or|orelse|packed|pub|resume|return|struct|suspend|switch|test|threadlocal|true|try|undefined|union|unreachable|var|volatile|while',
    
    // Nim
    nim: 'addr|and|as|asm|bind|block|break|case|cast|concept|const|continue|converter|defer|discard|distinct|div|do|elif|else|end|enum|except|export|finally|for|from|func|if|import|in|include|interface|is|isnot|iterator|let|macro|method|mixin|mod|nil|not|notin|object|of|or|out|proc|ptr|raise|ref|return|shl|shr|static|template|try|tuple|type|using|var|when|while|xor|yield',
    
    // Crystal
    crystal: 'abstract|alias|annotation|as|asm|begin|break|case|class|def|do|else|elsif|end|ensure|enum|extend|false|for|fun|if|in|include|instance_sizeof|is_a?|lib|macro|module|next|nil|nil?|of|offsetof|out|pointerof|private|protected|require|rescue|responds_to?|return|select|self|sizeof|struct|super|then|true|type|typeof|uninitialized|union|unless|until|verbatim|when|while|with|yield',
    
    // F#
    fsharp: 'abstract|and|as|assert|base|begin|class|default|delegate|do|done|downcast|downto|elif|else|end|exception|extern|false|finally|fixed|for|fun|function|global|if|in|inherit|inline|interface|internal|lazy|let|match|member|module|mutable|namespace|new|not|null|of|open|or|override|private|public|rec|return|select|static|struct|then|to|true|try|type|upcast|use|val|void|when|while|with|yield',
    
    // Clojure
    clojure: 'case|catch|cond|def|defmacro|defn|defonce|defprotocol|defrecord|defstruct|deftype|do|doseq|dotimes|doto|finally|fn|for|if|if-let|if-not|import|in-ns|let|letfn|loop|monitor-enter|monitor-exit|new|ns|or|quote|recur|refer|require|set!|throw|try|use|var|when|when-let|when-not|while',
    
    // Erlang
    erlang: 'after|and|andalso|band|begin|bnot|bor|bsl|bsr|bxor|case|catch|cond|div|end|fun|if|let|not|of|or|orelse|receive|rem|try|when|xor',
    
    // Groovy
    groovy: 'abstract|as|assert|boolean|break|byte|case|catch|char|class|const|continue|def|default|do|double|else|enum|extends|false|final|finally|float|for|goto|if|implements|import|in|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|threadsafe|throw|throws|trait|transient|true|try|void|volatile|while|with',

    // Assembly (通用汇编指令)
    assembly: 'mov|push|pop|call|ret|jmp|je|jne|jz|jnz|jg|jge|jl|jle|ja|jae|jb|jbe|cmp|test|add|sub|mul|div|inc|dec|and|or|xor|not|shl|shr|lea|nop|int|syscall|enter|leave|loop|rep|movs|stos|lods|cmps|scas|xchg|neg|adc|sbb|imul|idiv|cbw|cwd|cdq|cwde|movzx|movsx|bswap|rol|ror|rcl|rcr|bt|bts|btr|btc|bsf|bsr|sete|setne|setg|setge|setl|setle|cmove|cmovne|cmovg|cmovge|cmovl|cmovle|db|dw|dd|dq|resb|resw|resd|resq|equ|section|segment|global|extern|org|bits|use16|use32|use64',
    
    // WASM (WebAssembly Text Format)
    wasm: 'module|func|param|result|local|global|table|memory|elem|data|start|import|export|type|if|then|else|end|loop|block|br|br_if|br_table|return|call|call_indirect|drop|select|get_local|set_local|tee_local|get_global|set_global|load|store|current_memory|grow_memory|i32|i64|f32|f64|anyfunc|mut|offset|align',
    
    // Solidity (智能合约)
    solidity: 'abstract|address|after|alias|anonymous|apply|as|assembly|auto|bool|break|byte|bytes|calldata|case|catch|constant|constructor|continue|contract|copyof|days|default|define|delete|do|else|emit|enum|error|ether|event|external|fallback|false|final|finney|fixed|for|from|function|gwei|hours|if|immutable|implements|import|in|indexed|inline|int|interface|internal|is|let|library|macro|mapping|match|memory|minutes|modifier|mutable|new|null|of|override|partial|payable|pragma|private|promise|public|pure|receive|reference|relocatable|return|returns|revert|sealed|seconds|sizeof|static|storage|string|struct|supports|switch|szabo|this|throw|true|try|type|typedef|typeof|ufixed|uint|unchecked|using|var|view|virtual|weeks|wei|while|years',
    
    // GLSL (着色器语言)
    glsl: 'attribute|const|uniform|varying|buffer|shared|coherent|volatile|restrict|readonly|writeonly|atomic_uint|layout|centroid|flat|smooth|noperspective|patch|sample|break|continue|do|for|while|switch|case|default|if|else|subroutine|in|out|inout|float|double|int|void|bool|true|false|invariant|precise|discard|return|mat2|mat3|mat4|dmat2|dmat3|dmat4|mat2x2|mat2x3|mat2x4|dmat2x2|dmat2x3|dmat2x4|mat3x2|mat3x3|mat3x4|dmat3x2|dmat3x3|dmat3x4|mat4x2|mat4x3|mat4x4|dmat4x2|dmat4x3|dmat4x4|vec2|vec3|vec4|ivec2|ivec3|ivec4|bvec2|bvec3|bvec4|dvec2|dvec3|dvec4|uint|uvec2|uvec3|uvec4|lowp|mediump|highp|precision|sampler1D|sampler2D|sampler3D|samplerCube|sampler1DShadow|sampler2DShadow|samplerCubeShadow|sampler1DArray|sampler2DArray|sampler1DArrayShadow|sampler2DArrayShadow|isampler1D|isampler2D|isampler3D|isamplerCube|isampler1DArray|isampler2DArray|usampler1D|usampler2D|usampler3D|usamplerCube|usampler1DArray|usampler2DArray|sampler2DRect|sampler2DRectShadow|isampler2DRect|usampler2DRect|samplerBuffer|isamplerBuffer|usamplerBuffer|sampler2DMS|isampler2DMS|usampler2DMS|sampler2DMSArray|isampler2DMSArray|usampler2DMSArray|samplerCubeArray|samplerCubeArrayShadow|isamplerCubeArray|usamplerCubeArray|image1D|iimage1D|uimage1D|image2D|iimage2D|uimage2D|image3D|iimage3D|uimage3D|image2DRect|iimage2DRect|uimage2DRect|imageCube|iimageCube|uimageCube|imageBuffer|iimageBuffer|uimageBuffer|image1DArray|iimage1DArray|uimage1DArray|image2DArray|iimage2DArray|uimage2DArray|imageCubeArray|iimageCubeArray|uimageCubeArray|image2DMS|iimage2DMS|uimage2DMS|image2DMSArray|iimage2DMSArray|uimage2DMSArray|struct',
};


// ============ 字面量定义 ============

export const LITERALS = {
    javascript: 'true|false|null|undefined|NaN|Infinity',
    python: 'True|False|None',
    java: 'true|false|null',
    c: 'true|false|NULL',
    cpp: 'true|false|nullptr|NULL',
    rust: 'true|false',
    go: 'true|false|nil|iota',
    swift: 'true|false|nil',
    kotlin: 'true|false|null',
    ruby: 'true|false|nil',
    php: 'true|false|null|TRUE|FALSE|NULL',
    lua: 'true|false|nil',
    haskell: 'True|False',
    scala: 'true|false|null',
    elixir: 'true|false|nil',
    sql: 'TRUE|FALSE|NULL',
    bash: 'true|false',
    powershell: 'True|False|Null',
    r: 'TRUE|FALSE|NULL|NA|Inf|NaN',
    matlab: 'true|false|inf|nan|pi|eps',
    julia: 'true|false|nothing|missing|Inf|NaN|pi',
    dart: 'true|false|null',
    objc: 'YES|NO|nil|Nil|NULL|true|false',
    zig: 'true|false|null|undefined',
    nim: 'true|false|nil',
    crystal: 'true|false|nil',
    fsharp: 'true|false|null',
    clojure: 'true|false|nil',
    erlang: 'true|false',
    groovy: 'true|false|null',
    assembly: '',
    wasm: '',
    solidity: 'true|false',
    glsl: 'true|false',
    perl: '',
    json: 'true|false|null',
    css: '',
    html: '',
};


// ============ 内置函数/类型定义 ============

export const BUILTINS = {
    javascript: 'Array|Boolean|Date|Error|Function|JSON|Math|Number|Object|Promise|Proxy|RegExp|String|Symbol|Map|Set|WeakMap|WeakSet|console|window|document|parseInt|parseFloat|isNaN|isFinite|decodeURI|decodeURIComponent|encodeURI|encodeURIComponent|eval|setTimeout|setInterval|clearTimeout|clearInterval|fetch|alert|confirm|prompt|Intl|Reflect|ArrayBuffer|DataView|Float32Array|Float64Array|Int8Array|Int16Array|Int32Array|Uint8Array|Uint16Array|Uint32Array|BigInt|BigInt64Array|BigUint64Array',
    
    python: 'abs|all|any|ascii|bin|bool|breakpoint|bytearray|bytes|callable|chr|classmethod|compile|complex|delattr|dict|dir|divmod|enumerate|eval|exec|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|memoryview|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip|__import__|NotImplemented|Ellipsis|__debug__|quit|exit|copyright|credits|license',
    
    java: 'System|String|Integer|Long|Double|Float|Boolean|Character|Byte|Short|Object|Class|Math|Runtime|Thread|Runnable|Exception|Error|Throwable|StringBuilder|StringBuffer|ArrayList|LinkedList|HashMap|HashSet|TreeMap|TreeSet|Collections|Arrays|List|Map|Set|Queue|Deque|Stack|Vector|Iterator|Iterable|Comparable|Comparator|Optional|Stream|Collectors|Files|Path|Paths|Scanner|PrintStream|InputStream|OutputStream|Reader|Writer|File|URL|URI|Pattern|Matcher|Date|Calendar|LocalDate|LocalTime|LocalDateTime|Instant|Duration|Period|ZonedDateTime|DateTimeFormatter',
    
    c: 'printf|scanf|malloc|calloc|realloc|free|sizeof|strlen|strcpy|strcat|strcmp|strncpy|strncat|strncmp|memcpy|memmove|memset|memcmp|fopen|fclose|fread|fwrite|fprintf|fscanf|fgets|fputs|fseek|ftell|rewind|feof|ferror|perror|exit|abort|atexit|system|getenv|abs|labs|div|ldiv|rand|srand|atoi|atol|atof|strtol|strtoul|strtod|qsort|bsearch|isalpha|isdigit|isalnum|isspace|isupper|islower|toupper|tolower|assert|errno|stdin|stdout|stderr|NULL|EOF|FILE|size_t|ptrdiff_t|time_t|clock_t',
    
    cpp: 'std|cout|cin|cerr|clog|endl|string|vector|map|set|unordered_map|unordered_set|list|deque|queue|stack|priority_queue|pair|tuple|array|bitset|optional|variant|any|shared_ptr|unique_ptr|weak_ptr|make_shared|make_unique|move|forward|swap|sort|find|count|accumulate|transform|copy|fill|reverse|begin|end|size|empty|push_back|pop_back|front|back|insert|erase|clear|emplace|emplace_back|reserve|resize|capacity|at|data|c_str|substr|find|rfind|replace|append|compare|stoi|stol|stof|stod|to_string|getline|ifstream|ofstream|fstream|stringstream|istringstream|ostringstream|thread|mutex|lock_guard|unique_lock|condition_variable|future|promise|async|atomic|chrono|filesystem|regex|random|algorithm|numeric|functional|memory|utility|iterator|exception|stdexcept|typeinfo|type_traits|limits|cmath|cstdlib|cstdio|cstring|cctype|cassert|cerrno|climits|cfloat',

    rust: 'Copy|Send|Sized|Sync|Unpin|Drop|Fn|FnMut|FnOnce|drop|Box|ToOwned|Clone|PartialEq|PartialOrd|Eq|Ord|AsRef|AsMut|Into|From|Default|Iterator|Extend|IntoIterator|DoubleEndedIterator|ExactSizeIterator|Option|Some|None|Result|Ok|Err|String|ToString|Vec|vec|print|println|eprint|eprintln|dbg|format|panic|assert|assert_eq|assert_ne|debug_assert|debug_assert_eq|debug_assert_ne|unreachable|unimplemented|todo|cfg|include|include_str|include_bytes|concat|stringify|env|option_env|compile_error|line|column|file|module_path',
    
    go: 'append|cap|close|complex|copy|delete|imag|len|make|new|panic|print|println|real|recover|bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr',
    
    swift: 'print|debugPrint|dump|fatalError|precondition|preconditionFailure|assert|assertionFailure|abs|min|max|stride|zip|sequence|repeatElement|swap|withUnsafePointer|withUnsafeMutablePointer|withUnsafeBytes|withUnsafeMutableBytes|type|unsafeBitCast|numericCast|Array|Dictionary|Set|String|Int|Int8|Int16|Int32|Int64|UInt|UInt8|UInt16|UInt32|UInt64|Float|Double|Bool|Character|Optional|Result|Error|Never|Void|Any|AnyObject|AnyClass|Self|Type',
    
    kotlin: 'println|print|readLine|TODO|run|with|apply|also|let|takeIf|takeUnless|repeat|lazy|require|requireNotNull|check|checkNotNull|error|assert|arrayOf|arrayOfNulls|emptyArray|intArrayOf|doubleArrayOf|floatArrayOf|longArrayOf|shortArrayOf|byteArrayOf|charArrayOf|booleanArrayOf|listOf|listOfNotNull|mutableListOf|arrayListOf|emptyList|setOf|mutableSetOf|hashSetOf|linkedSetOf|sortedSetOf|emptySet|mapOf|mutableMapOf|hashMapOf|linkedMapOf|sortedMapOf|emptyMap|sequenceOf|emptySequence|generateSequence|Pair|Triple|to|compareTo|equals|hashCode|toString|copy|component1|component2|component3|component4|component5',
    
    ruby: 'puts|print|p|pp|gets|chomp|to_s|to_i|to_f|to_a|to_h|to_sym|length|size|count|empty?|nil?|include?|each|map|select|reject|find|reduce|inject|sort|sort_by|reverse|flatten|compact|uniq|first|last|take|drop|zip|join|split|gsub|sub|match|scan|upcase|downcase|capitalize|strip|chomp|chop|chars|bytes|lines|push|pop|shift|unshift|concat|delete|clear|replace|clone|dup|freeze|frozen?|taint|tainted?|untaint|class|is_a?|kind_of?|instance_of?|respond_to?|send|method|methods|public_methods|private_methods|protected_methods|instance_variables|instance_variable_get|instance_variable_set|attr|attr_reader|attr_writer|attr_accessor|require|require_relative|load|include|extend|prepend|module_function|public|private|protected|raise|rescue|ensure|catch|throw|lambda|proc|Proc|Method|Binding|block_given?|yield|caller|eval|exec|system|fork|spawn|exit|abort|at_exit|trap|sleep|rand|srand|Time|Date|DateTime|File|Dir|IO|Regexp|Range|Array|Hash|String|Symbol|Integer|Float|Rational|Complex|TrueClass|FalseClass|NilClass|Object|BasicObject|Module|Class|Struct|OpenStruct|Enumerator|Enumerable|Comparable|Kernel|Math|Process|Signal|Thread|Fiber|Mutex|Queue|ConditionVariable|Exception|StandardError|RuntimeError|TypeError|ArgumentError|NameError|NoMethodError|IndexError|KeyError|RangeError|IOError|EOFError|SystemCallError|Errno',
    
    php: 'echo|print|print_r|var_dump|var_export|debug_zval_dump|isset|unset|empty|is_null|is_bool|is_int|is_integer|is_long|is_float|is_double|is_real|is_numeric|is_string|is_array|is_object|is_callable|is_resource|gettype|settype|intval|floatval|strval|boolval|array|list|count|sizeof|in_array|array_search|array_key_exists|array_keys|array_values|array_merge|array_combine|array_push|array_pop|array_shift|array_unshift|array_slice|array_splice|array_reverse|array_flip|array_unique|array_filter|array_map|array_reduce|array_walk|sort|rsort|asort|arsort|ksort|krsort|usort|uasort|uksort|array_multisort|strlen|substr|strpos|strrpos|str_replace|str_ireplace|preg_match|preg_match_all|preg_replace|preg_split|explode|implode|join|trim|ltrim|rtrim|strtolower|strtoupper|ucfirst|ucwords|sprintf|printf|sscanf|number_format|date|time|mktime|strtotime|checkdate|date_create|date_format|date_modify|date_diff|file_exists|is_file|is_dir|is_readable|is_writable|file_get_contents|file_put_contents|fopen|fclose|fread|fwrite|fgets|fputs|feof|rewind|fseek|ftell|flock|copy|rename|unlink|mkdir|rmdir|scandir|glob|realpath|dirname|basename|pathinfo|json_encode|json_decode|serialize|unserialize|base64_encode|base64_decode|md5|sha1|hash|password_hash|password_verify|rand|mt_rand|array_rand|shuffle|header|setcookie|session_start|session_destroy|$_GET|$_POST|$_REQUEST|$_SESSION|$_COOKIE|$_SERVER|$_FILES|$_ENV|$GLOBALS',

    lua: 'assert|collectgarbage|dofile|error|getfenv|getmetatable|ipairs|load|loadfile|loadstring|module|next|pairs|pcall|print|rawequal|rawget|rawset|require|select|setfenv|setmetatable|tonumber|tostring|type|unpack|xpcall|coroutine|debug|io|math|os|package|string|table|bit32|utf8',
    
    sql: 'COUNT|SUM|AVG|MIN|MAX|COALESCE|NULLIF|CAST|CONVERT|CONCAT|SUBSTRING|LENGTH|UPPER|LOWER|TRIM|LTRIM|RTRIM|REPLACE|ROUND|FLOOR|CEILING|ABS|POWER|SQRT|NOW|CURDATE|CURTIME|DATE|TIME|YEAR|MONTH|DAY|HOUR|MINUTE|SECOND|DATEDIFF|DATEADD|GETDATE|SYSDATE|NVL|DECODE|CASE|WHEN|THEN|ELSE|END|OVER|PARTITION|ROW_NUMBER|RANK|DENSE_RANK|LEAD|LAG|FIRST_VALUE|LAST_VALUE',
    
    bash: 'echo|printf|read|cd|pwd|ls|cp|mv|rm|mkdir|rmdir|touch|cat|head|tail|grep|sed|awk|find|xargs|sort|uniq|wc|cut|tr|tee|diff|patch|tar|gzip|gunzip|zip|unzip|curl|wget|ssh|scp|rsync|chmod|chown|chgrp|ps|kill|top|df|du|free|uname|hostname|whoami|id|su|sudo|apt|yum|dnf|pacman|brew|pip|npm|git|docker|kubectl|systemctl|journalctl|crontab|at|nohup|screen|tmux|vim|nano|less|more|man|info|which|whereis|locate|alias|unalias|export|source|exec|eval|test|expr|seq|date|cal|bc|true|false|yes|sleep|wait|jobs|fg|bg|disown|trap|set|unset|shift|getopts|case|select|until|function|local|return|break|continue|exit',
    
    r: 'c|list|data.frame|matrix|array|factor|vector|numeric|character|logical|integer|double|complex|raw|as.numeric|as.character|as.logical|as.integer|as.double|as.complex|as.raw|is.numeric|is.character|is.logical|is.integer|is.double|is.complex|is.raw|is.na|is.null|is.finite|is.infinite|is.nan|length|nrow|ncol|dim|names|rownames|colnames|head|tail|str|summary|print|cat|paste|paste0|sprintf|format|nchar|substr|substring|strsplit|grep|grepl|sub|gsub|regexpr|gregexpr|match|pmatch|charmatch|tolower|toupper|chartr|abbreviate|make.names|make.unique|sum|prod|mean|median|var|sd|min|max|range|quantile|IQR|cor|cov|abs|sqrt|exp|log|log10|log2|sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|ceiling|floor|round|trunc|sign|cumsum|cumprod|cummax|cummin|diff|sort|order|rank|rev|unique|duplicated|table|cut|findInterval|which|which.min|which.max|any|all|identical|setdiff|union|intersect|is.element|match|merge|cbind|rbind|t|apply|lapply|sapply|vapply|mapply|tapply|by|aggregate|split|unsplit|stack|unstack|reshape|melt|cast|subset|transform|within|with|attach|detach|search|ls|rm|exists|get|assign|new.env|environment|globalenv|baseenv|emptyenv|parent.frame|sys.call|sys.function|sys.frame|sys.nframe|sys.parent|sys.parents|sys.on.exit|sys.status|sys.source|source|eval|parse|deparse|substitute|bquote|quote|enquote|noquote|call|match.call|match.arg|missing|nargs|args|formals|body|alist|do.call|Recall|tryCatch|try|stop|warning|message|suppressWarnings|suppressMessages|options|getOption|setOption|Sys.time|Sys.Date|Sys.timezone|Sys.getenv|Sys.setenv|Sys.getlocale|Sys.setlocale|Sys.sleep|Sys.info|R.version|sessionInfo|installed.packages|library|require|loadNamespace|attachNamespace|unloadNamespace|search|searchpaths|find.package|path.package|system.file|file.path|file.exists|file.info|file.access|file.create|file.remove|file.rename|file.copy|file.symlink|file.link|dir.create|dir.exists|list.files|list.dirs|getwd|setwd|normalizePath|basename|dirname|tools|utils|stats|graphics|grDevices|datasets|methods|grid|parallel|compiler|tcltk|splines|stats4|class|methods|setClass|setGeneric|setMethod|setRefClass|setValidity|new|initialize|show|print|summary|plot|lines|points|abline|text|legend|title|axis|box|par|layout|split.screen|screen|close.screen|erase.screen|dev.new|dev.off|dev.cur|dev.set|dev.list|dev.copy|dev.print|pdf|png|jpeg|bmp|tiff|svg|postscript|x11|windows|quartz',
    
    julia: 'println|print|show|display|repr|string|Symbol|typeof|isa|convert|promote|methods|methodswith|fieldnames|propertynames|getfield|setfield!|getproperty|setproperty!|hasfield|hasproperty|applicable|invoke|invokelatest|eval|include|require|import|using|export|module|baremodule|begin|end|let|local|global|const|function|macro|return|if|else|elseif|for|while|break|continue|try|catch|finally|throw|rethrow|error|@assert|@show|@info|@warn|@error|@debug|@time|@elapsed|@allocated|@timed|@inbounds|@simd|@threads|@spawn|@async|@sync|@distributed|@everywhere|@generated|@inline|@noinline|@nospecialize|@specialize|@doc|@enum|@kwdef|@NamedTuple|@view|@views|@. |@__FILE__|@__LINE__|@__MODULE__|@__DIR__',
    
    // 简化的内置（用于其他语言）
    dart: 'print|debugPrint|assert|identical|identityHashCode|List|Map|Set|Iterable|Iterator|String|int|double|num|bool|Object|dynamic|void|Null|Function|Symbol|Type|Future|Stream|Completer|StreamController|Duration|DateTime|Uri|RegExp|Match|Pattern|Error|Exception|StackTrace|Zone|Timer|Stopwatch|StringBuffer|StringSink|Expando|WeakReference|Finalizer',
    
    haskell: 'abs|acos|acosh|all|and|any|appendFile|asin|asinh|atan|atan2|atanh|break|ceiling|compare|concat|concatMap|const|cos|cosh|curry|cycle|decodeFloat|div|divMod|drop|dropWhile|either|elem|encodeFloat|enumFrom|enumFromThen|enumFromThenTo|enumFromTo|error|even|exp|exponent|fail|filter|flip|floatDigits|floatRadix|floatRange|floor|fmap|foldl|foldl1|foldr|foldr1|fromEnum|fromInteger|fromIntegral|fromRational|fst|gcd|getChar|getContents|getLine|head|id|init|interact|ioError|isDenormalized|isIEEE|isInfinite|isNaN|isNegativeZero|iterate|last|lcm|length|lex|lines|log|logBase|lookup|map|mapM|mapM_|max|maxBound|maximum|maybe|min|minBound|minimum|mod|negate|not|notElem|null|odd|or|otherwise|pi|pred|print|product|properFraction|putChar|putStr|putStrLn|quot|quotRem|read|readFile|readIO|readList|readLn|readParen|reads|readsPrec|realToFrac|recip|rem|repeat|replicate|return|reverse|round|scaleFloat|scanl|scanl1|scanr|scanr1|seq|sequence|sequence_|show|showChar|showList|showParen|showString|shows|showsPrec|significand|signum|sin|sinh|snd|span|splitAt|sqrt|subtract|succ|sum|tail|take|takeWhile|tan|tanh|toEnum|toInteger|toRational|truncate|uncurry|undefined|unlines|until|unwords|unzip|unzip3|userError|words|writeFile|zip|zip3|zipWith|zipWith3',
};


// ============ 扩展名到语言的映射 ============

export const ALIASES = {
    // JavaScript/TypeScript 家族
    js: 'javascript', ts: 'javascript', jsx: 'javascript', tsx: 'javascript',
    mjs: 'javascript', cjs: 'javascript', es6: 'javascript', es: 'javascript',
    
    // Python
    py: 'python', pyw: 'python', pyx: 'python', pxd: 'python', pxi: 'python',
    gyp: 'python', gypi: 'python', rpy: 'python', pyde: 'python',
    
    // Java/JVM
    java: 'java', jar: 'java', class: 'java',
    kt: 'kotlin', kts: 'kotlin', ktm: 'kotlin',
    scala: 'scala', sc: 'scala', sbt: 'scala',
    groovy: 'groovy', gvy: 'groovy', gy: 'groovy', gsh: 'groovy', gradle: 'groovy',
    
    // C/C++
    c: 'c', h: 'c', i: 'c',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', 'c++': 'cpp', hpp: 'cpp', hh: 'cpp',
    hxx: 'cpp', 'h++': 'cpp', ino: 'cpp', inl: 'cpp', ipp: 'cpp', tcc: 'cpp', tpp: 'cpp',
    
    // Rust
    rs: 'rust', rlib: 'rust',
    
    // Go
    go: 'go', mod: 'go',
    
    // Swift/Objective-C
    swift: 'swift',
    m: 'objc', mm: 'objc',
    
    // Ruby
    rb: 'ruby', rbw: 'ruby', rake: 'ruby', gemspec: 'ruby', podspec: 'ruby',
    thor: 'ruby', jbuilder: 'ruby', rabl: 'ruby', ru: 'ruby',
    
    // PHP
    php: 'php', php3: 'php', php4: 'php', php5: 'php', php7: 'php', php8: 'php',
    phtml: 'php', phps: 'php', inc: 'php',
    
    // Lua
    lua: 'lua', luau: 'lua', nse: 'lua', p8: 'lua', rockspec: 'lua',
    
    // Perl
    pl: 'perl', pm: 'perl', pod: 'perl', t: 'perl', psgi: 'perl',
    
    // Haskell
    hs: 'haskell', lhs: 'haskell', hsc: 'haskell',
    
    // Elixir/Erlang
    ex: 'elixir', exs: 'elixir', eex: 'elixir', heex: 'elixir', leex: 'elixir',
    erl: 'erlang', hrl: 'erlang', escript: 'erlang',
    
    // Clojure
    clj: 'clojure', cljs: 'clojure', cljc: 'clojure', edn: 'clojure',
    
    // F#
    fs: 'fsharp', fsi: 'fsharp', fsx: 'fsharp', fsscript: 'fsharp',
    
    // SQL
    sql: 'sql', ddl: 'sql', dml: 'sql', pgsql: 'sql', plsql: 'sql', tsql: 'sql',
    mysql: 'sql', sqlite: 'sql', sqlite3: 'sql',
    
    // Shell
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash', ksh: 'bash', csh: 'bash',
    tcsh: 'bash', ash: 'bash', dash: 'bash',
    ps1: 'powershell', psm1: 'powershell', psd1: 'powershell',
    bat: 'bash', cmd: 'bash',
    
    // R
    r: 'r', R: 'r', rdata: 'r', rds: 'r', rda: 'r',
    
    // MATLAB/Octave (注意：.m 冲突，优先 Objective-C，MATLAB 用 .mat/.mlx)
    mat: 'matlab', fig: 'matlab', mlx: 'matlab', mlapp: 'matlab',
    
    // Julia
    jl: 'julia',
    
    // Dart
    dart: 'dart',
    
    // Zig
    zig: 'zig', zon: 'zig',
    
    // Nim
    nim: 'nim', nims: 'nim', nimble: 'nim',
    
    // Crystal
    cr: 'crystal',
    
    // Assembly
    asm: 'assembly', s: 'assembly', S: 'assembly', nasm: 'assembly', masm: 'assembly',
    
    // WebAssembly
    wat: 'wasm', wast: 'wasm',
    
    // Solidity
    sol: 'solidity',
    
    // GLSL/Shaders
    glsl: 'glsl', vert: 'glsl', frag: 'glsl', geom: 'glsl', tesc: 'glsl',
    tese: 'glsl', comp: 'glsl', hlsl: 'glsl', fx: 'glsl', cg: 'glsl',
    shader: 'glsl', compute: 'glsl',
    
    // Web
    html: 'html', htm: 'html', xhtml: 'html', xml: 'html', svg: 'html',
    vue: 'html', svelte: 'html', astro: 'html', njk: 'html', ejs: 'html',
    hbs: 'html', handlebars: 'html', mustache: 'html', pug: 'html', jade: 'html',
    
    // CSS
    css: 'css', scss: 'css', sass: 'css', less: 'css', styl: 'css', stylus: 'css',
    pcss: 'css', postcss: 'css',
    
    // JSON/Config
    json: 'json', jsonc: 'json', json5: 'json', geojson: 'json', topojson: 'json',
    yaml: 'json', yml: 'json', toml: 'json', ini: 'json', cfg: 'json', conf: 'json',
    properties: 'json', env: 'json', editorconfig: 'json',
};


// ============ 文件名特殊检测 ============

export const FILENAME_PATTERNS = {
    // Makefiles
    'Makefile': 'bash', 'makefile': 'bash', 'GNUmakefile': 'bash',
    'Makefile.am': 'bash', 'Makefile.in': 'bash',
    
    // Docker
    'Dockerfile': 'bash', 'docker-compose.yml': 'json', 'docker-compose.yaml': 'json',
    
    // Git
    '.gitignore': 'bash', '.gitattributes': 'bash', '.gitmodules': 'json',
    
    // Node.js
    'package.json': 'json', 'package-lock.json': 'json', 'yarn.lock': 'json',
    'tsconfig.json': 'json', 'jsconfig.json': 'json', 'deno.json': 'json',
    '.npmrc': 'bash', '.nvmrc': 'bash', '.node-version': 'bash',
    
    // Linters/Formatters
    '.eslintrc': 'json', '.eslintrc.json': 'json', '.eslintrc.js': 'javascript',
    '.prettierrc': 'json', '.prettierrc.json': 'json', '.prettierrc.js': 'javascript',
    '.stylelintrc': 'json', '.stylelintrc.json': 'json',
    '.editorconfig': 'json', '.browserslistrc': 'bash',
    
    // Build tools
    'webpack.config.js': 'javascript', 'rollup.config.js': 'javascript',
    'vite.config.js': 'javascript', 'vite.config.ts': 'javascript',
    'babel.config.js': 'javascript', '.babelrc': 'json',
    'gulpfile.js': 'javascript', 'Gruntfile.js': 'javascript',
    
    // Ruby
    'Gemfile': 'ruby', 'Rakefile': 'ruby', 'Guardfile': 'ruby',
    'Vagrantfile': 'ruby', 'Berksfile': 'ruby', 'Capfile': 'ruby',
    '.ruby-version': 'bash', '.ruby-gemset': 'bash',
    
    // Python
    'requirements.txt': 'bash', 'Pipfile': 'json', 'pyproject.toml': 'json',
    'setup.py': 'python', 'setup.cfg': 'json', 'tox.ini': 'json',
    '.python-version': 'bash',
    
    // Rust
    'Cargo.toml': 'json', 'Cargo.lock': 'json',
    
    // Go
    'go.mod': 'go', 'go.sum': 'bash',
    
    // Java/Gradle/Maven
    'build.gradle': 'groovy', 'settings.gradle': 'groovy',
    'build.gradle.kts': 'kotlin', 'settings.gradle.kts': 'kotlin',
    'pom.xml': 'html', 'build.xml': 'html',
    
    // CI/CD
    '.travis.yml': 'json', '.gitlab-ci.yml': 'json',
    'Jenkinsfile': 'groovy', 'azure-pipelines.yml': 'json',
    '.github/workflows/*.yml': 'json', '.github/workflows/*.yaml': 'json',
    
    // Misc
    'CMakeLists.txt': 'bash', 'meson.build': 'python',
    '.env': 'bash', '.env.local': 'bash', '.env.development': 'bash',
    '.env.production': 'bash', '.env.test': 'bash',
    'LICENSE': 'bash', 'README': 'bash', 'CHANGELOG': 'bash',
    'AUTHORS': 'bash', 'CONTRIBUTORS': 'bash', 'COPYING': 'bash',
};

// ============ 注释风格定义 ============

export const COMMENT_STYLES = {
    // 单行注释前缀
    line: {
        javascript: '//', python: '#', java: '//', c: '//', cpp: '//',
        rust: '//', go: '//', swift: '//', kotlin: '//', ruby: '#',
        php: '//', lua: '--', perl: '#', haskell: '--', scala: '//',
        elixir: '#', sql: '--', bash: '#', powershell: '#', r: '#',
        matlab: '%', julia: '#', dart: '//', objc: '//', zig: '//',
        nim: '#', crystal: '#', fsharp: '//', clojure: ';', erlang: '%',
        groovy: '//', assembly: ';', wasm: ';;', solidity: '//', glsl: '//',
        css: '', html: '', json: '',
    },
    // 多行注释
    block: {
        javascript: ['/*', '*/'], python: ['"""', '"""'], java: ['/*', '*/'],
        c: ['/*', '*/'], cpp: ['/*', '*/'], rust: ['/*', '*/'], go: ['/*', '*/'],
        swift: ['/*', '*/'], kotlin: ['/*', '*/'], ruby: ['=begin', '=end'],
        php: ['/*', '*/'], lua: ['--[[', ']]'], perl: ['=pod', '=cut'],
        haskell: ['{-', '-}'], scala: ['/*', '*/'], elixir: ['"""', '"""'],
        sql: ['/*', '*/'], css: ['/*', '*/'], html: ['<!--', '-->'],
        dart: ['/*', '*/'], objc: ['/*', '*/'], groovy: ['/*', '*/'],
        solidity: ['/*', '*/'], glsl: ['/*', '*/'],
    },
};
