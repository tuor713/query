// Monarch token provider for Wvlet language
// Converted from: https://github.com/wvlet/wvlet/blob/main/vscode-wvlet/syntaxes/wvlet.tmLanguage.json

const def = {
  tokenizer: {
    root: [
      // Comments
      {
        regex: /---/,
        action: { token: "comment.block", next: "@blockComment" },
      },
      { regex: /--.*$/, action: "comment" },

      // Strings
      {
        regex: /"""/,
        action: { token: "string", next: "@tripleQuotedString" },
      },
      { regex: /"/, action: { token: "string.quote", next: "@string" } },
      { regex: /'[^']*'/, action: "string" },
      {
        regex: /`/,
        action: { token: "string.quote", next: "@backtickString" },
      },

      // Numbers
      { regex: /\b[0-9][0-9_]*\.[0-9]+\b/, action: "number.float" },
      { regex: /\b0[xX][0-9a-fA-F_]+\b/, action: "number.hex" },
      { regex: /\b[0-9][0-9_]*\b/, action: "number" },

      // Keywords - control
      { regex: /\b(if|then|else|end|case|when)\b/, action: "keyword.control" },

      // Keywords - logical operators
      { regex: /\b(and|or|not|is|like)\b/, action: "keyword.operator" },

      // Type keywords
      {
        regex:
          /\b(boolean|double|byte|int|short|char|void|long|float|string|array|map|date|decimal|interval)\b/,
        action: "type",
      },

      // Other keywords
      {
        regex:
          /\b(asof|test|should|be|contain|debug|def|inline|type|extends|native|show|sample|this|of|in|by|as|to|with|from|agg|select|for|let|where|group|having|order|limit|transform|pivot|distinct|asc|desc|join|on|left|right|full|inner|cross|add|prepend|exclude|rename|shift|drop|describe|concat|dedup|intersect|except|all|over|partition|unbounded|preceding|following|current|range|row|run|import|export|package|model|execute|val|save|append|delete|truncate|unnest|lateral|subscribe|watermark|incremental|insert|into|create)\b/,
        action: "keyword",
      },

      // Operators - arrows
      { regex: /(<-|->|=>)/, action: "operator.arrow" },

      // Operators - comparison
      { regex: /(!=|<=|>=|<|>|=)/, action: "operator.comparison" },

      // Operators - arithmetic
      { regex: /(\+|-|\*|\/|\/\/|%)/, action: "operator.arithmetic" },

      // Operators - logical
      { regex: /(!|&|\|)/, action: "operator.logical" },

      // Punctuation
      { regex: /[,:;]/, action: "delimiter" },
      { regex: /\./, action: "delimiter.accessor" },

      // Other operators
      { regex: /[@$*?#]/, action: "operator" },

      // Underscore as special variable
      { regex: /\b_\b/, action: "variable.language" },

      // Type identifiers (capitalized)
      {
        regex: /\b[A-Z][a-zA-Z_0-9][a-zA-Z_\.0-9]*\b/,
        action: "type.identifier",
      },

      // Regular identifiers
      { regex: /\b[a-z_][a-z_0-9\.]*\b/, action: "identifier" },

      // Whitespace
      { regex: /\s+/, action: "white" },
    ],

    blockComment: [
      { regex: /---/, action: { token: "comment.block", next: "@pop" } },
      { regex: /.*/, action: "comment.block" },
    ],

    string: [
      { regex: /\\./, action: "string.escape" },
      {
        regex: /\$\{/,
        action: { token: "delimiter.interpolation", next: "@interpolation" },
      },
      { regex: /"/, action: { token: "string.quote", next: "@pop" } },
      { regex: /[^"\\$]+/, action: "string" },
      { regex: /\$/, action: "string" },
    ],

    tripleQuotedString: [
      {
        regex: /\$\{/,
        action: { token: "delimiter.interpolation", next: "@interpolation" },
      },
      { regex: /"""/, action: { token: "string", next: "@pop" } },
      { regex: /[^$]+/, action: "string" },
      { regex: /\$/, action: "string" },
    ],

    backtickString: [
      {
        regex: /\$\{/,
        action: { token: "delimiter.interpolation", next: "@interpolation" },
      },
      { regex: /`/, action: { token: "string.quote", next: "@pop" } },
      { regex: /[^`$]+/, action: "string" },
      { regex: /\$/, action: "string" },
    ],

    interpolation: [
      {
        regex: /\}/,
        action: { token: "delimiter.interpolation", next: "@pop" },
      },
      { regex: /\b[0-9][0-9_]*\.[0-9]+\b/, action: "number.float" },
      { regex: /\b0[xX][0-9a-fA-F_]+\b/, action: "number.hex" },
      { regex: /\b[0-9][0-9_]*\b/, action: "number" },
      { regex: /(\+|-|\*|\/|\/\/|%)/, action: "operator.arithmetic" },
      { regex: /(!=|<=|>=|<|>|=)/, action: "operator.comparison" },
      { regex: /\b[a-z_][a-z_0-9\.]*\b/, action: "identifier" },
      { regex: /\./, action: "delimiter.accessor" },
      { regex: /\s+/, action: "white" },
    ],
  },
};

export default def;
