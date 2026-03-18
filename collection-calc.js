// ─────────────────────────────────────────────────────────────
// FILE:      collection-calc.js
// PURPOSE:   Generic DOM formula engine — evaluates inline expressions
//            on output cells using named variables scoped to boundary elements.
// DEPENDS:   Finsweet CMS List v2 (fs-attributes) for pagination re-render support
// PLACEMENT: Page-level script — before </body>, AFTER the Finsweet fs-attributes script
// ─────────────────────────────────────────────────────────────
//
// ── Attribute contract ──────────────────────────────────────
//
//  [data-calc-scope]                        ← calculation boundary (plain, no value needed)
//  │  [data-calc-var="name"]                ← registers cell value as named variable
//  │                                           same name on multiple cells = auto summed
//  │  [data-calc-output="expr"]             ← evaluates expression, writes result
//  │  [data-calc-output="expr"              ← evaluates, writes, AND exposes result
//  │   data-calc-var="name"]                   as "name" to outputs below it (chain)
//  └─ [data-calc-scope data-calc-as="name"] ← inner scope — exposes its first output
//                                              as "name" into parent scope
//
//  Webflow component cell states (value-based, not presence-based):
//    data-calc-output=""   data-calc-var="MC"       → pure var    — register only
//    data-calc-output="MC + VW"  data-calc-var=""   → pure output — evaluate only
//    data-calc-output="MC + VW"  data-calc-var="x"  → chained     — evaluate + register
//    data-calc-output=""   data-calc-var=""          → ignored     — empty placeholder
//
//  Per-output overrides:
//    data-calc-format="currency|number|integer"
//    data-calc-empty="—"
//
// ── Scenario 1 — Sibling cells, multiple outputs ─────────────
//
//  <div data-calc-scope>
//    <div data-calc-var="MC"  data-calc-output="">768</div>
//    <div data-calc-var="VW"  data-calc-output="">770</div>
//    <div data-calc-output="MC + VW"      data-calc-var="combined"></div>
//    <div data-calc-output="combined / 2" data-calc-var=""></div>
//  </div>
//
// ── Scenario 2 — Nested collection, bubble up ────────────────
//
//  <div data-calc-scope>
//    <div data-calc-scope data-calc-as="total_b">     ← hidden Collection B list
//      <div data-calc-var="amount" data-calc-output="">100</div>
//      <div data-calc-var="amount" data-calc-output="">250</div>
//      <div data-calc-output="amount" data-calc-var=""></div>
//    </div>
//    <div data-calc-var="rate" data-calc-output="">0.1</div>
//    <div data-calc-output="total_b * rate" data-calc-var=""></div>
//  </div>
//
// ── Scenario 3 — Grand total across all rows ─────────────────
//
//  <div data-calc-scope>                              ← outer wrapper
//    <div data-calc-scope>                            ← Collection A row (Webflow repeats)
//      <div data-calc-var="amount" data-calc-output="">100</div>
//      <div data-calc-output="amount" data-calc-var="row_total"></div>
//    </div>
//    <div data-calc-output="row_total" data-calc-var=""></div>  ← grand total
//  </div>
//
// ── Script order in Webflow ──────────────────────────────────
//
//  1. Finsweet fs-attributes <script> tag
//  2. collection-calc.js
//
// ── Global config override (set before this script runs) ─────
//
//  window.CollectionCalcConfig = {
//    emptyFallback : '—',
//    decimalPlaces : 2,
//    locale        : 'en-US',
//  };
//
// ── CSS required ─────────────────────────────────────────────
//
//  Hidden nested source lists must stay in DOM:
//    [data-calc-hidden] { display: none; }


const CollectionCalc = {

  // ─── CONFIG ─────────────────────────────────────────────────
  CONFIG: {
    emptyFallback      : '—',
    decimalPlaces      : 2,
    locale             : 'en-US',
    mutationDebounceMs : 50,              // Debounce delay (ms) before re-running after DOM mutations
    currencySymbols    : '$€£¥₹₩₪฿₫₺₴', // Recognised currency symbol characters
  },

  // ─── SEL ────────────────────────────────────────────────────
  SEL: {
    scope  : '[data-calc-scope]',
    varCell: '[data-calc-var]',
    output : '[data-calc-output]',
  },

  // ─── STATE ──────────────────────────────────────────────────
  STATE: {
    scopesProcessed   : 0,
    errorsEncountered : 0,
    observers         : [],  // Tracked MutationObservers — call disconnect() to clean up
    debounceTimer     : null,
  },

  // ─── INIT ───────────────────────────────────────────────────
  init() {
  if (window.CollectionCalcConfig) {
    Object.assign(this.CONFIG, window.CollectionCalcConfig);
  }

  // Run immediately for items already in the DOM
  this._processAll();

  // Watch every collection list for injected items — fires on pagination,
  // load more, and filter changes regardless of Finsweet version
  const collectionLists = document.querySelectorAll('[fs-list-element="list"]');

  if (!collectionLists.length) {
    console.warn('[CollectionCalc] No [fs-list-element="list"] containers found — pagination re-calc disabled.');
    return;
  }

  collectionLists.forEach((listElement) => {
    const observer = new MutationObserver(() => {
      // Debounce rapid successive mutations (e.g. bulk DOM inserts) into a single recalc
      clearTimeout(this.STATE.debounceTimer);
      this.STATE.debounceTimer = setTimeout(() => this._processAll(), this.CONFIG.mutationDebounceMs);
    });

    observer.observe(listElement, {
      childList: true,  // fires when Finsweet adds or removes row elements
    });

    this.STATE.observers.push(observer);
  });
},

  /**
   * Disconnects all MutationObservers and clears the debounce timer.
   * Call this on SPA page transitions to prevent memory leaks.
   */
  disconnect() {
    this.STATE.observers.forEach((observer) => observer.disconnect());
    this.STATE.observers = [];
    clearTimeout(this.STATE.debounceTimer);
    this.STATE.debounceTimer = null;
  },

  // ─── PROCESS ALL ────────────────────────────────────────────

  /**
   * Finds all scopes on the page and processes them innermost-first.
   * Safe to call multiple times — resets counters on each run.
   * Called on Finsweet's first render and on every renderitems event.
   */
  _processAll() {
    const allScopeElements = document.querySelectorAll(this.SEL.scope);

    if (!allScopeElements.length) {
      console.warn('[CollectionCalc] No [data-calc-scope] elements found on page.');
      return;
    }

    // Reset counters so logs are accurate per render cycle
    this.STATE.scopesProcessed   = 0;
    this.STATE.errorsEncountered = 0;

    // Innermost scopes first — ensures nested results exist before parents read them
    const scopesSortedInnermostFirst = this._sortByDOMDepthDescending(allScopeElements);
    scopesSortedInnermostFirst.forEach((scopeElement) => this._processScope(scopeElement));

    console.log(`[CollectionCalc] Done — ${this.STATE.scopesProcessed} scopes processed, ${this.STATE.errorsEncountered} errors.`);
  },

  // ─── PROCESS SCOPE ──────────────────────────────────────────

  /**
   * Resolves one [data-calc-scope] element.
   * 1. Cleans up any injected vars from previous render cycle.
   * 2. Collects static [data-calc-var] cells into a variable map.
   * 3. Walks [data-calc-output] cells in DOM order — evaluate → write → optionally chain.
   * 4. If scope has data-calc-as, injects first output result into parent scope's map.
   * @param {HTMLElement} scopeElement
   */
  _processScope(scopeElement) {
    // Clean up injected vars from any previous render cycle before re-processing
    delete scopeElement._calcInjectedVars;

    const variableMap    = this._collectStaticVars(scopeElement);
    const outputElements = this._getDirectChildren(scopeElement, this.SEL.output);

    if (!outputElements.length) {
      // Valid — scope may only exist to bubble up via data-calc-as
      this.STATE.scopesProcessed++;
      return;
    }

    let firstOutputValue = null;

    outputElements.forEach((outputElement) => {
      const expression = outputElement.dataset.calcOutput?.trim();

      // Empty data-calc-output="" — Webflow component placeholder, not a real output
      if (!expression) return;

      const emptyFallback  = outputElement.dataset.calcEmpty?.trim() || this.CONFIG.emptyFallback;
      const referencedVars = this._extractVariableNames(expression);
      const missingVars    = referencedVars.filter((variableName) => !(variableName in variableMap));

      if (missingVars.length) {
        console.warn(
          `[CollectionCalc] Expression "${expression}" references undefined variable(s): ${missingVars.join(', ')} — showing fallback.`,
          outputElement
        );
        outputElement.textContent = emptyFallback;
        this.STATE.errorsEncountered++;
        return;
      }

      let result;

      try {
        result = this._evaluate(expression, variableMap);
      } catch (evaluationError) {
        console.warn(
          `[CollectionCalc] Failed to evaluate "${expression}": ${evaluationError.message}`,
          outputElement
        );
        outputElement.textContent = emptyFallback;
        this.STATE.errorsEncountered++;
        return;
      }

      const formatOverride = outputElement.dataset.calcFormat?.trim() || null;
      const detectedSymbol = this._detectCurrencySymbol(scopeElement);
      const resolvedFormat = formatOverride ?? (detectedSymbol ? 'currency' : 'number');

      outputElement.textContent = this._formatOutput(result, resolvedFormat, detectedSymbol);

      if (firstOutputValue === null) firstOutputValue = result;

      // Non-empty data-calc-var on an output = chained — register for outputs below
      const chainedVarName = outputElement.dataset.calcVar?.trim();
      if (chainedVarName) {
        variableMap[chainedVarName] = (variableMap[chainedVarName] ?? 0) + result;
      }
    });

    // Bubble first output up to parent scope via data-calc-as
    const bubbleAsName = scopeElement.dataset.calcAs?.trim();
    if (bubbleAsName && firstOutputValue !== null) {
      this._injectIntoParentScope(scopeElement, bubbleAsName, firstOutputValue);
    }

    this.STATE.scopesProcessed++;
  },

  // ─── VARIABLE COLLECTION ────────────────────────────────────

  /**
   * Collects all static [data-calc-var] cells that belong directly to this scope
   * into a variable map. Same variable name = values are summed.
   *
   * A cell is a static var when:
   *   - data-calc-var has a non-empty value
   *   - data-calc-output is empty or absent (not a genuine chained output)
   *
   * Webflow components always render both attributes — the empty vs non-empty
   * value is the only signal we use.
   *
   * @param {HTMLElement} scopeElement
   * @returns {Object.<string, number>}
   */
  _collectStaticVars(scopeElement) {
    const directVarElements = this._getDirectChildren(scopeElement, this.SEL.varCell);
    const variableMap       = {};

    // Merge any vars injected by inner scopes via data-calc-as before static vars
    if (scopeElement._calcInjectedVars) {
      Object.assign(variableMap, scopeElement._calcInjectedVars);
    }

    directVarElements.forEach((varElement) => {
      const variableName  = varElement.dataset.calcVar?.trim();
      const hasExpression = varElement.dataset.calcOutput?.trim() !== '';

      // No var name — nothing to register (text/status cells with empty data-calc-var)
      if (!variableName) return;

      // Has a real expression — chained output, registered during the output walk instead
      if (hasExpression) return;

      const parsedValue = this._parseNumber(varElement.textContent);
      variableMap[variableName] = (variableMap[variableName] ?? 0) + parsedValue;
    });

    return variableMap;
  },

  /**
   * Injects a computed inner scope result into the parent scope's variable map.
   * Stored on the parent DOM element so it's available when the parent evaluates.
   * Same variable name from multiple inner scopes = values are summed (grand total pattern).
   * Called after inner scope finishes — before parent scope evaluates.
   * @param {HTMLElement} innerScopeElement
   * @param {string} variableName
   * @param {number} value
   */
  _injectIntoParentScope(innerScopeElement, variableName, value) {
    const parentScopeElement = innerScopeElement.parentElement?.closest(this.SEL.scope);

    if (!parentScopeElement) {
      console.warn(
        `[CollectionCalc] data-calc-as="${variableName}" found but no parent [data-calc-scope] exists.`,
        innerScopeElement
      );
      return;
    }

    if (!parentScopeElement._calcInjectedVars) {
      parentScopeElement._calcInjectedVars = {};
    }

    parentScopeElement._calcInjectedVars[variableName] =
      (parentScopeElement._calcInjectedVars[variableName] ?? 0) + value;
  },

  // ─── DOM HELPERS ────────────────────────────────────────────

  /**
   * Returns elements matching the selector that are direct members of this scope —
   * not nested inside any inner [data-calc-scope].
   * @param {HTMLElement} scopeElement
   * @param {string} selector
   * @returns {HTMLElement[]}
   */
  _getDirectChildren(scopeElement, selector) {
    return Array.from(scopeElement.querySelectorAll(selector)).filter((element) => {
      let cursor = element.parentElement;
      while (cursor && cursor !== scopeElement) {
        if (cursor.hasAttribute('data-calc-scope')) return false;
        cursor = cursor.parentElement;
      }
      return true;
    });
  },

  /**
   * Sorts a NodeList deepest-first by DOM depth.
   * Ensures inner scopes are always processed before their parents.
   * @param {NodeList} nodeList
   * @returns {HTMLElement[]}
   */
  _sortByDOMDepthDescending(nodeList) {
    return Array.from(nodeList).sort((elementA, elementB) => {
      return this._getDOMDepth(elementB) - this._getDOMDepth(elementA);
    });
  },

  /**
   * Returns the number of ancestors an element has.
   * @param {HTMLElement} element
   * @returns {number}
   */
  _getDOMDepth(element) {
    let depth  = 0;
    let cursor = element;
    while (cursor.parentElement) {
      depth++;
      cursor = cursor.parentElement;
    }
    return depth;
  },

  // ─── FORMULA PARSER ─────────────────────────────────────────
  // Hand-written tokeniser + recursive descent parser.
  // Supports: named variables, + - * /, parentheses, unary minus.
  // No eval() — safe for attribute-defined expressions.

  /**
   * Evaluates an expression string against a variable map.
   * @param {string} expression - e.g. "(MC + VW) / 2"
   * @param {Object.<string, number>} variableMap
   * @returns {number}
   */
  _evaluate(expression, variableMap) {
    const tokens = this._tokenise(expression);
    const parser = this._createParser(tokens, variableMap);
    const result = parser.parseExpression();

    if (isNaN(result)) {
      throw new Error(`Expression "${expression}" did not produce a number.`);
    }

    return result;
  },

  /**
   * Breaks an expression string into an array of typed tokens.
   * @param {string} expression
   * @returns {Array.<{type: string, value: string|number}>}
   */
  _tokenise(expression) {
    const tokens = [];
    let   cursor = 0;

    while (cursor < expression.length) {
      const char = expression[cursor];

      // Skip whitespace
      if (/\s/.test(char)) { cursor++; continue; }

      // Number literal
      if (/[0-9.]/.test(char)) {
        let numberString = '';
        while (cursor < expression.length && /[0-9.]/.test(expression[cursor])) {
          numberString += expression[cursor++];
        }
        tokens.push({ type: 'NUMBER', value: parseFloat(numberString) });
        continue;
      }

      // Variable name — starts with letter or underscore, then letters/digits/underscores
      if (/[a-zA-Z_]/.test(char)) {
        let nameString = '';
        while (cursor < expression.length && /[a-zA-Z0-9_]/.test(expression[cursor])) {
          nameString += expression[cursor++];
        }
        tokens.push({ type: 'VAR', value: nameString });
        continue;
      }

      // Operators and parentheses
      if ('+-*/()'.includes(char)) {
        tokens.push({ type: 'OP', value: char });
        cursor++;
        continue;
      }

      throw new Error(`Unexpected character "${char}" in expression.`);
    }

    tokens.push({ type: 'EOF', value: null });
    return tokens;
  },

  /**
   * Creates a recursive descent parser for the token stream.
   * Grammar:
   *   expression = term   (('+' | '-') term)*
   *   term       = factor (('*' | '/') factor)*
   *   factor     = NUMBER | VAR | '(' expression ')' | '-' factor
   * @param {Array} tokens
   * @param {Object.<string, number>} variableMap
   * @returns {{ parseExpression: function }}
   */
  _createParser(tokens, variableMap) {
    let position = 0;

    function peek()    { return tokens[position]; }
    function consume() { return tokens[position++]; }

    function parseExpression() {
      let leftValue = parseTerm();

      while (peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
        const operator   = consume().value;
        const rightValue = parseTerm();
        leftValue = operator === '+' ? leftValue + rightValue : leftValue - rightValue;
      }

      return leftValue;
    }

    function parseTerm() {
      let leftValue = parseFactor();

      while (peek().type === 'OP' && (peek().value === '*' || peek().value === '/')) {
        const operator   = consume().value;
        const rightValue = parseFactor();

        if (operator === '/' && rightValue === 0) {
          throw new Error('Division by zero.');
        }

        leftValue = operator === '*' ? leftValue * rightValue : leftValue / rightValue;
      }

      return leftValue;
    }

    function parseFactor() {
      const token = peek();

      // Parenthesised sub-expression
      if (token.type === 'OP' && token.value === '(') {
        consume();
        const innerValue = parseExpression();
        consume(); // closing paren
        return innerValue;
      }

      // Unary minus
      if (token.type === 'OP' && token.value === '-') {
        consume();
        return -parseFactor();
      }

      // Number literal
      if (token.type === 'NUMBER') {
        consume();
        return token.value;
      }

      // Variable name
      if (token.type === 'VAR') {
        consume();
        if (!(token.value in variableMap)) {
          throw new Error(`Variable "${token.value}" is not defined.`);
        }
        return variableMap[token.value];
      }

      throw new Error(`Unexpected token "${token.value}" (${token.type}).`);
    }

    return { parseExpression };
  },

  /**
   * Extracts all variable names referenced in an expression string.
   * Used to pre-validate the variable map before evaluating.
   * @param {string} expression
   * @returns {string[]}
   */
  _extractVariableNames(expression) {
    return expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
  },

  // ─── FORMATTING ─────────────────────────────────────────────

  /**
   * Scans only named [data-calc-var] cells in the scope for a currency symbol.
   * Skips empty-var cells (text/status fields) to avoid false symbol detection.
   * Returns null if all values are plain numbers.
   * @param {HTMLElement} scopeElement
   * @returns {string|null}
   */
  _detectCurrencySymbol(scopeElement) {
    const varElements = scopeElement.querySelectorAll(this.SEL.varCell);
    // Escape the symbol characters for use inside a character class
    const escaped = this.CONFIG.currencySymbols.replace(/[-[\]\\^]/g, '\\$&');
    const pattern = new RegExp(`^([${escaped}])|([${escaped}])$`);

    for (const varElement of varElements) {
      // Skip empty-var cells — they are CMS text fields, not numeric values
      const variableName = varElement.dataset.calcVar?.trim();
      if (!variableName) continue;

      const rawText = varElement.textContent.trim();
      const match   = rawText.match(pattern);
      if (match) return (match[1] || match[2]);
    }

    return null;
  },

  _parseNumber(rawText) {
    if (!rawText || !rawText.trim()) return 0;

    const numericString = rawText.replace(/[^0-9.]/g, '');
    const parsed        = parseFloat(numericString);

    if (isNaN(parsed)) {
      console.warn(`[CollectionCalc] Could not parse value: "${rawText}" — counted as 0.`);
      return 0;
    }

    return parsed;
  },

  _formatOutput(value, format, currencySymbol) {
    if (format === 'integer') {
      return Math.round(value).toLocaleString(this.CONFIG.locale);
    }

    const formatted = value.toLocaleString(this.CONFIG.locale, {
      minimumFractionDigits: this.CONFIG.decimalPlaces,
      maximumFractionDigits: this.CONFIG.decimalPlaces,
    });

    if (format === 'currency' && currencySymbol) {
      return `${currencySymbol}${formatted}`;
    }

    return formatted;
  },
};

CollectionCalc.init();
