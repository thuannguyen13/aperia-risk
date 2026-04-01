// ─────────────────────────────────────────────────────────────
// FILE:      popover-anchor.js
// PURPOSE:   Toggles and positions popovers relative to their triggers
// DEPENDS:   FloatingUIDOM (must load before this file)
// PLACEMENT: Head embed — loads before all page scripts
// ─────────────────────────────────────────────────────────────
// <!-- FloatingUI — required by popover-anchor.js -->
// <script src="https://cdn.jsdelivr.net/npm/@floating-ui/core@1.7.4"></script>
// <script src="https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.7.5"></script>
// Load order in Head must be:**
// 1. @floating-ui/core
// 2. @floating-ui/dom
// 3. popover-anchor.js
// ── HTML required (data-attribute delegation) ───────────────
//
//  [data-split-menu="popoverId"]            ← trigger element
//  [popover id="popoverId"]                 ← popover target (at body level)
//
// ── HTML required (programmatic via create()) ───────────────
//
//  No specific attributes required — pass DOM refs directly
//
// ── CSS required ────────────────────────────────────────────
//
//  [popover] {
//    position: fixed;   ← required for FloatingUI coordinate injection
//    margin: 0;         ← prevents browser UA margin from offsetting position
//  }
//
// ── Public API ──────────────────────────────────────────────
//
//  PopoverAnchor.create({ triggerEl, popoverEl, placement? })
//    → { open(), close(), destroy() }
//
//  Placement values (FloatingUI):
//    'top' | 'top-start' | 'top-end'
//    'bottom' | 'bottom-start' | 'bottom-end'
//    'left' | 'left-start' | 'left-end'
//    'right' | 'right-start' | 'right-end'
//
// ============================================================

const PopoverAnchor = {

  // ─── CONFIG ──────────────────────────────────────────────────
  CONFIG: {
    defaultPlacement: 'bottom-start',
    offsetPx:         6,
    shiftPadding:     5,
  },

  // ─── SEL ─────────────────────────────────────────────────────
  SEL: {
    delegatedTrigger: '[data-split-menu]',      // data-split-menu="popoverId"
    openPopover:      '[popover]:popover-open',
  },

  // ─── STATE ───────────────────────────────────────────────────
  STATE: {
    // keyed by popover id — each value is a FloatingUI autoUpdate cleanup fn
    cleanupByPopoverId: {},
  },

  // ─── INIT ────────────────────────────────────────────────────
  init() {
    this._bindDelegatedClicks();
    this._bindBlur();
  },

  // ─── PUBLIC API ──────────────────────────────────────────────

  /**
   * Programmatically register a trigger/popover pair.
   * Use when markup delegation isn't available (e.g. inside an iframe, or
   * when the trigger doesn't carry a data-split-menu attribute).
   *
   * @param {Object}      options
   * @param {HTMLElement} options.triggerEl         - element that opens the popover
   * @param {HTMLElement} options.popoverEl         - the [popover] element to position
   * @param {string}      [options.placement]       - FloatingUI placement (overrides CONFIG default)
   * @returns {{ open: Function, close: Function, destroy: Function } | null}
   */
  create({ triggerEl, popoverEl, placement } = {}) {
    if (!triggerEl || !popoverEl) {
      console.warn('[PopoverAnchor] create() requires both triggerEl and popoverEl.');
      return null;
    }

    const onTriggerClick = () => this._toggle(triggerEl, popoverEl, placement);
    triggerEl.addEventListener('click', onTriggerClick);

    return {
      open:    () => this._open(triggerEl, popoverEl, placement),
      close:   () => this._close(popoverEl),
      destroy: () => {
        triggerEl.removeEventListener('click', onTriggerClick);
        this._cleanupPositioning(popoverEl.id);
      },
    };
  },

  // ─── EVENT HANDLERS ──────────────────────────────────────────

  _bindDelegatedClicks() {
    document.addEventListener('click', (clickEvent) => {
      const triggerEl = clickEvent.target.closest(this.SEL.delegatedTrigger);
      if (!triggerEl) return;

      clickEvent.preventDefault();

      const popoverEl = document.getElementById(triggerEl.dataset.splitMenu);
      if (!popoverEl) {
        console.warn('[PopoverAnchor] No popover found for id:', triggerEl.dataset.splitMenu);
        return;
      }

      this._toggle(triggerEl, popoverEl);
    });
  },

  _bindBlur() {
    // iframe clicks never bubble to the document so native light-dismiss never fires —
    // close all open popovers manually whenever the window loses focus
    window.addEventListener('blur', () => {
      document.querySelectorAll(this.SEL.openPopover).forEach((popoverEl) => {
        popoverEl.hidePopover();
      });
    });
  },

  // ─── POSITIONING ─────────────────────────────────────────────

  /**
   * Starts FloatingUI autoUpdate for a trigger/popover pair.
   * Registers a toggle listener that self-destructs on close.
   *
   * NOTE: style.left / style.top are set here intentionally — FloatingUI
   * requires injecting computed coordinates directly. This is the established
   * exception to the no-inline-styles rule.
   *
   * @param {HTMLElement} triggerEl
   * @param {HTMLElement} popoverEl
   * @param {string}      [placementOverride]
   */
  _startPositioning(triggerEl, popoverEl, placementOverride) {
    const popoverId = popoverEl.id;

    if (!popoverId) {
      console.warn('[PopoverAnchor] Popover has no id — cannot track cleanup.');
      return;
    }

    // stop any existing loop for this popover before starting a new one
    this._cleanupPositioning(popoverId);

    const placement = placementOverride || this.CONFIG.defaultPlacement;

    this.STATE.cleanupByPopoverId[popoverId] = FloatingUIDOM.autoUpdate(
      triggerEl,
      popoverEl,
      () => {
        FloatingUIDOM.computePosition(triggerEl, popoverEl, {
          placement,
          middleware: [
            FloatingUIDOM.offset(this.CONFIG.offsetPx),
            FloatingUIDOM.flip(),
            FloatingUIDOM.shift({ padding: this.CONFIG.shiftPadding }),
          ],
        }).then((positionData) => {
          popoverEl.style.left = `${positionData.x}px`;
          popoverEl.style.top  = `${positionData.y}px`;
        });
      }
    );

    // fires for both programmatic hidePopover() and native light-dismiss
    const onToggle = (toggleEvent) => {
      if (toggleEvent.newState !== 'closed') return;
      this._cleanupPositioning(popoverId);
      popoverEl.removeEventListener('toggle', onToggle);
    };

    popoverEl.addEventListener('toggle', onToggle);
  },

  // ─── UTILITIES ───────────────────────────────────────────────

  _toggle(triggerEl, popoverEl, placement) {
    if (popoverEl.matches(':popover-open')) {
      this._close(popoverEl);
    } else {
      this._open(triggerEl, popoverEl, placement);
    }
  },

  _open(triggerEl, popoverEl, placement) {
    if (popoverEl.matches(':popover-open')) return;
    popoverEl.showPopover();
    this._startPositioning(triggerEl, popoverEl, placement);
  },

  _close(popoverEl) {
    if (!popoverEl.matches(':popover-open')) return;
    popoverEl.hidePopover();
  },

  _cleanupPositioning(popoverId) {
    if (!this.STATE.cleanupByPopoverId[popoverId]) return;
    this.STATE.cleanupByPopoverId[popoverId]();
    delete this.STATE.cleanupByPopoverId[popoverId];
  },

};

document.addEventListener('DOMContentLoaded', () => PopoverAnchor.init());
