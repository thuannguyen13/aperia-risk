// ─────────────────────────────────────────────────────────────
// FILE:      popover-anchor.js
// PURPOSE:   Toggles and positions popovers relative to their triggers
// DEPENDS:   FloatingUIDOM (must load before this file)
// PLACEMENT: Head — loads before all page scripts
// ─────────────────────────────────────────────────────────────
//
// ── HTML required ───────────────────────────────────────────
//
//  [data-split-menu="popoverId"]            ← trigger button
//  [popover id="popoverId"]                 ← popover target
//
// ── CSS required ────────────────────────────────────────────
//
//  [popover] {
//    position: fixed;
//    margin: 0;
//  }
//
// ============================================================

var PopoverAnchor = {

  CONFIG: {
    placement:    'bottom-start',
    offsetPx:     6,
    shiftPadding: 5,
  },

  STATE: {
    cleanupByPopoverId: {},
  },

  init: function () {
    this._bindClicks();
    this._bindBlur();
  },

  // ─── EVENTS ──────────────────────────────────────────────────────────────────

  _bindClicks: function () {
    document.addEventListener('click', function (clickEvent) {
      var triggerEl = clickEvent.target.closest('[data-split-menu]');
      if (!triggerEl) return;

      clickEvent.preventDefault();

      var popoverEl = document.getElementById(triggerEl.dataset.splitMenu);
      if (!popoverEl) return;

      popoverEl.showPopover();
      PopoverAnchor._startPositioning(triggerEl, popoverEl);
    }, true);
  },

  _bindBlur: function () {
    // Iframe clicks never bubble to the document so light-dismiss never fires.
    // Close all open popovers manually whenever the window loses focus.
    window.addEventListener('blur', function () {
      document.querySelectorAll('[popover]:popover-open').forEach(function (popoverEl) {
        popoverEl.hidePopover();
      });
    });
  },

  // ─── POSITIONING ─────────────────────────────────────────────────────────────

  _startPositioning: function (triggerEl, popoverEl) {
    var popoverId = popoverEl.id;
    if (!popoverId) {
      console.warn('[PopoverAnchor] Popover has no id — cannot track cleanup.');
      return;
    }

    if (this.STATE.cleanupByPopoverId[popoverId]) {
      this.STATE.cleanupByPopoverId[popoverId]();
    }

    var self = this;

    this.STATE.cleanupByPopoverId[popoverId] = FloatingUIDOM.autoUpdate(triggerEl, popoverEl, function () {
      FloatingUIDOM.computePosition(triggerEl, popoverEl, {
        placement:  self.CONFIG.placement,
        middleware: [
          FloatingUIDOM.offset(self.CONFIG.offsetPx),
          FloatingUIDOM.flip(),
          FloatingUIDOM.shift({ padding: self.CONFIG.shiftPadding }),
        ],
      }).then(function (positionData) {
        popoverEl.style.left = positionData.x + 'px';
        popoverEl.style.top  = positionData.y + 'px';
      });
    });

    // Fires for both programmatic hidePopover() and light-dismiss
    popoverEl.addEventListener('toggle', function onToggle(toggleEvent) {
      if (toggleEvent.newState === 'closed') {
        if (self.STATE.cleanupByPopoverId[popoverId]) {
          self.STATE.cleanupByPopoverId[popoverId]();
          delete self.STATE.cleanupByPopoverId[popoverId];
        }
        popoverEl.removeEventListener('toggle', onToggle);
      }
    });
  },

};

document.addEventListener('DOMContentLoaded', function () { PopoverAnchor.init(); });
