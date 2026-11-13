/* Motion and pointer hit-testing shared by the directory and lineup previews. */
window.strongholdPreviewUI = (() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motions = new Map();
  const rootTargets = new WeakMap();

  function cancel(popup) {
    const motion = motions.get(popup);
    if (!motion) return;
    motions.delete(popup);
    motion.animation.cancel();
  }

  function finishHide(popup) {
    popup.hidden = true;
    popup.inert = false;
    popup.replaceChildren();
    cancel(popup);
  }

  function fade(popup, from, to, id, closing) {
    const animation = popup.animate([{ opacity: from }, { opacity: to }], {
      duration: closing ? 140 : 180,
      easing: 'cubic-bezier(.22, .61, .36, 1)',
      fill: closing ? 'forwards' : 'none',
    });
    animation.id = id;
    motions.set(popup, { animation, closing });
    animation.onfinish = () => {
      if (motions.get(popup)?.animation !== animation) return;
      if (closing) finishHide(popup);
      else motions.delete(popup);
    };
  }

  function enter(popup, animate, id) {
    cancel(popup);
    popup.inert = false;
    popup.hidden = false;
    if (animate && !reducedMotion.matches) fade(popup, .82, 1, id, false);
  }

  function leave(popup, immediate = false) {
    if (popup.hidden) return;
    if (immediate || reducedMotion.matches) {
      finishHide(popup);
      return;
    }
    if (motions.get(popup)?.closing) return;
    const opacity = getComputedStyle(popup).opacity;
    cancel(popup);
    // A closing preview should release its pointer and focus targets immediately.
    popup.inert = true;
    fade(popup, opacity, 0, 'library-preview-exit', true);
  }

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    for (const [popup, motion] of motions) {
      if (motion.closing) finishHide(popup);
      else cancel(popup);
    }
  });

  function bindTarget(targets, anchor, activate) {
    anchor.setAttribute('data-preview-trigger', '');
    targets.set(anchor, activate);
  }

  function targetBehind(event, targets, current) {
    if (event.pointerType !== 'mouse' || event.buttons !== 0 ||
        event.target.closest('a, button, input, select, textarea, summary')) return;
    // An open preview can receive the pointer while another trigger is under it.
    for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
      const anchor = element.closest('[data-preview-trigger]');
      if (anchor !== current && targets.has(anchor)) return anchor;
    }
  }

  function switchBehind(event, targets, current) {
    targets.get(targetBehind(event, targets, current))?.();
  }

  return { enter, leave, bindTarget, targetBehind, switchBehind, rootTargets };
})();
