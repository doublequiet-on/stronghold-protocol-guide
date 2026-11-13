/* Shared portraits and reference previews for the lineup list, detail and draft. */
window.createSklandArt = function ({ mode, directoryLinks, linkTo, blockReason, isBanned, make, memberBanText, operatorPreviewContent, previewUI, beforePreviewOpen }) {
  const bondCards = new Map([...document.querySelectorAll('#bonds .library-card')].map(card => [
    card.id.slice(5), card,
  ]));
  const bondMembers = new Map();
  for (const [name, entry] of Object.entries(mode.operators)) {
    for (const bond of entry.bonds) {
      if (!bondMembers.has(bond)) bondMembers.set(bond, []);
      bondMembers.get(bond).push({ name, tier: entry.tier });
    }
  }
  for (const members of bondMembers.values()) members.sort((a, b) => a.tier - b.tier);

  const [primary, nested] = ['skland-bond-popover', 'skland-nested-popover'].map((id, depth) => {
    const popup = make('aside', 'skland-popover');
    popup.id = id;
    popup.hidden = true;
    popup.tabIndex = -1;
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-labelledby', id + '-title');
    document.body.append(popup);
    return { popup, anchor: null, pinned: false, targets: depth === 0 ? previewUI.rootTargets : new WeakMap() };
  });
  let restoringFocus;
  let positionFrame;
  const masthead = document.querySelector('.masthead');
  const nestedPreviewDwell = 120;

  function cdn(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && ['bbs.hycdn.cn', 'web.hycdn.cn'].includes(url.hostname) ? url.href : '';
    } catch {
      return '';
    }
  }

  function image(src, className) {
    const img = make('img', className);
    img.src = src;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    return img;
  }

  function stamp(src, className, name) {
    const box = make('span', className);
    box.setAttribute('aria-hidden', 'true');
    const fallback = make('span', '', Array.from(name)[0] || '·');
    box.append(fallback);
    if (src) {
      const img = image(src, '');
      img.addEventListener('load', () => { fallback.hidden = true; }, { once: true });
      img.addEventListener('error', () => img.remove(), { once: true });
      box.append(img);
    }
    return box;
  }

  function eligibility(name) {
    const affiliations = mode.operators[name]?.bonds ?? mode.diyCandidates[name];
    return {
      affiliations,
      reason: blockReason(name, affiliations ?? [], isBanned),
      hits: (affiliations ?? []).filter(bond => isBanned.has(bond)),
    };
  }

  function markPortrait(tile) {
    const name = tile.dataset.name;
    const result = eligibility(name);
    const { reason } = result;
    const title = tile.dataset.label + (reason ? ' · ' + reason.text : '');
    tile.dataset.banned = Boolean(reason);
    tile.setAttribute('aria-label', title);
    return result;
  }

  function portrait(member, source, { large = false, preview = primary } = {}) {
    const local = directoryLinks.get(member.name);
    const op = mode.operators[member.name];
    const tier = op?.tier ?? source?.shopLevel;
    const label = member.name + (member.mergeLevel === 1 ? ' · 精锐' : member.mergeLevel === 0 ? ' · 初始' : '');
    const tile = local && preview !== nested
      ? linkTo(local.hash, '', 'skland-op-tile')
      : make(preview ? 'button' : 'span', 'skland-op-tile');
    const square = local?.querySelector('.portrait')?.getAttribute('src') || cdn(source?.avatarUrl);
    const full = large && cdn(source?.halfBodyUrl);
    tile.dataset.name = member.name;
    tile.dataset.label = label;
    tile.classList.toggle('is-elite', member.mergeLevel === 1);
    const portraitArt = stamp(square, 'skland-op-art', member.name);
    if (full && full !== square) {
      portraitArt.classList.add('has-full-art');
      const img = image(full, 'skland-full-art');
      img.addEventListener('load', () => portraitArt.classList.add('full-art-loaded'), { once: true });
      img.addEventListener('error', () => img.remove(), { once: true });
      portraitArt.append(img);
    }
    tile.append(portraitArt);
    if (mode.tierIcons[tier]) tile.append(image(mode.tierIcons[tier], 'skland-tier'));
    if (large) tile.append(make('span', 'skland-op-rank', member.mergeLevel === 1 ? '精锐' : '初始'));
    markPortrait(tile);
    if (preview) {
      bindPopover(tile, () => {
        const status = eligibility(member.name);
        const hasDirectoryCard = local && op;
        const rank = member.mergeLevel === 1 ? '精锐' : member.mergeLevel === 0 ? '初始' : '';
        const loadout = rank || member.skill || member.module
          ? make('div', 'skland-popover-row') : null;
        if (loadout) {
          loadout.append(make('strong', '', rank ? '阵容配置 · ' + rank : '阵容配置'));
          if (member.skill || member.module) {
            loadout.append(configuration(member, source, { preview: preview === primary ? nested : null }));
          }
        }
        return {
          operator: true,
          sheet: hasDirectoryCard ? operatorPreviewContent(local, member.name, op) : null,
          tierSource: local,
          title: member.name,
          category: tier ? 'ⅠⅡⅢⅣⅤⅥ'[tier - 1] + ' 阶' : '',
          icon: square,
          body: [
            !hasDirectoryCard && previewRow('盟约', status.affiliations?.join('／')),
            previewRow('本局', memberBanText(status)),
            loadout,
            local && linkTo(local.hash, '查看干员档案'),
          ],
        };
      }, preview);
    } else tile.title = tile.getAttribute('aria-label');
    return tile;
  }

  function strategyStamp(strategy) {
    const art = strategy && document.getElementById('strategy-' + strategy.id)
      ?.querySelector('summary img')?.getAttribute('src');
    return stamp(art, 'skland-strategy-stamp', strategy?.name ?? '阵');
  }

  function equipmentTile(item, id) {
    const card = document.getElementById(id);
    const tile = card ? linkTo('#' + id, '', 'skland-gear-tile') : make('span', 'skland-gear-tile');
    const art = card?.querySelector('summary img')?.getAttribute('src');
    const tier = mode.tierIcons[card?.dataset.tier];
    const square = stamp(art, 'skland-gear-art', item.name);
    if (tier) square.append(image(tier, 'skland-tier'));
    tile.append(square, make('span', 'skland-tile-name', item.name));
    if (card) bindPopover(tile, () => ({
      title: item.name,
      category: card.querySelector('.gear-tier')?.textContent.trim(),
      icon: art,
      body: [
        ...Array.from(card.querySelectorAll('[data-grade]'), effect =>
          previewRow(effect.previousElementSibling?.textContent, effect.textContent)),
        linkTo(tile.hash, '查看装备档案'),
      ],
    }));
    return tile;
  }

  function strategyLink(item) {
    const card = document.getElementById('strategy-' + item.id);
    if (!card) return make('span', '', item.name);
    const link = linkTo('#' + card.id, item.name);
    const copy = card.querySelector('[data-library-copy]')?.textContent;
    if (copy) bindPopover(link, () => ({
      title: item.name,
      category: card.querySelector('summary small')?.textContent,
      icon: card.querySelector('summary img')?.getAttribute('src'),
      body: [previewRow('效果', copy), linkTo(link.hash, '查看策略档案')],
    }));
    return link;
  }

  function configuration(member, source, { preview = primary, directory = false } = {}) {
    const options = make('div', 'skland-configuration');
    const op = mode.operators[member.name];
    const modules = [op?.talentRanks?.[1]?.module, ...(op?.eliteModuleAlternatives ?? [])];
    const module = member.module && modules.find(item => item?.id === member.module.id);
    const skillSlot = member.skill && op ? op.skills.indexOf(member.skill.name) + 1 : 0;
    const rows = [
      [directory ? '默认技能' : '技能', '技', member.skill, mode.skillIcons[member.skill?.name] ||
        cdn(source?.skills?.find(item => item.skillId === member.skill?.id)?.iconUrl),
      op?.skillDescriptions?.[skillSlot]?.map(effect => ['等级 ' + effect.level, effect.text])],
      [directory ? '精锐模组' : '模组', '模', member.module, mode.moduleIcons[module?.type] ||
        cdn(source?.modules?.find(item => item.moduleId === member.module?.id)?.icon?.type),
      module?.effects?.map((effect, index) => [index === 0 ? '效果 · 等级 ' + module.level : '', effect])],
    ];
    for (const [label, glyph, entry, icon, effects] of rows) {
      if (!entry) continue;
      const row = make(preview ? 'button' : 'span', 'skland-config-item');
      row.classList.toggle('is-module', glyph === '模');
      row.setAttribute('aria-label', label + ' · ' + entry.name);
      row.append(stamp(icon, 'skland-config-icon', glyph));
      if (preview) bindPopover(row, () => ({
        title: entry.name, category: label, icon,
        body: (effects ?? []).map(([name, copy]) => previewRow(name, copy)),
      }), preview);
      else row.title = label + ' · ' + entry.name;
      options.append(row);
    }
    return options;
  }

  function directoryConfiguration(name, entry) {
    const skill = entry.skills[entry.default - 1];
    return configuration({
      name,
      skill: skill ? { name: skill } : null,
      module: entry.talentRanks?.[1]?.module,
    }, undefined, { directory: true });
  }

  function previewRow(label, copy) {
    if (!copy) return null;
    const row = make('div', 'skland-popover-row');
    if (label) row.append(make('strong', '', label));
    row.append(make('p', 'game-copy', copy));
    return row;
  }

  function position(layer) {
    const { anchor, popup } = layer;
    if (!anchor || popup.hidden) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 8;
    const width = document.documentElement.clientWidth;
    const top = Math.max(gap, (masthead?.getBoundingClientRect().bottom ?? 0) + gap);
    const bottom = document.documentElement.clientHeight - gap;
    const parent = layer === nested ? primary.popup.getBoundingClientRect() : null;
    const visibleTop = parent ? Math.max(top - gap, parent.top) : top - gap;
    const visibleBottom = parent ? Math.min(bottom + gap, parent.bottom) : bottom + gap;
    if (!anchor.getClientRects().length || rect.bottom <= visibleTop || rect.top >= visibleBottom) {
      hideLayer(layer, layer.pinned, true);
      return;
    }
    const lane = parent ?? rect;
    const popupWidth = popup.offsetWidth;
    const right = lane.right + gap;
    const left = lane.left - popupWidth - gap;
    let x;
    let y;
    if (right + popupWidth <= width - gap || left >= gap) {
      x = right + popupWidth <= width - gap ? right : left;
      popup.style.setProperty('--skland-popover-room', Math.max(0, bottom - top) + 'px');
      y = Math.max(top, Math.min(rect.top, bottom - popup.offsetHeight));
      popup.dataset.side = x === right ? 'right' : 'left';
    } else {
      x = Math.max(gap, Math.min(rect.left, width - popupWidth - gap));
      const below = Math.max(0, bottom - rect.bottom - gap);
      const above = Math.max(0, rect.top - gap - top);
      const contentHeight = popup.scrollHeight + popup.offsetHeight - popup.clientHeight;
      const placeBelow = below >= contentHeight || below >= above;
      const room = placeBelow ? below : above;
      if (room < 54) {
        hideLayer(layer, layer.pinned, true);
        return;
      }
      popup.style.setProperty('--skland-popover-room', room + 'px');
      y = placeBelow ? rect.bottom + gap : rect.top - gap - popup.offsetHeight;
      popup.dataset.side = placeBelow ? 'below' : 'above';
    }
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
  }

  function focusAfterNavigation(target) {
    restoringFocus = true;
    target.focus({ preventScroll: true });
    restoringFocus = false;
  }

  function hideLayer(layer, restoreFocus = false, immediate = false) {
    if (layer === primary) hideLayer(nested, false, immediate);
    clearTimeout(layer.openTimer);
    clearTimeout(layer.closeTimer);
    clearTimeout(layer.switchTimer);
    stopTransit(layer);
    const { anchor: previous, popup } = layer;
    layer.anchor = null;
    layer.pinned = false;
    if (previous?.hasAttribute('aria-expanded')) previous.setAttribute('aria-expanded', 'false');
    previous?.removeAttribute('aria-details');
    previewUI.leave(popup, immediate);
    if (restoreFocus && previous?.isConnected) focusAfterNavigation(previous);
  }

  function close() {
    hideLayer(primary, false, true);
  }

  function releaseForDirectoryPreview() {
    if (!hoverAllowed(primary) || primary.transiting || nested.transiting) return false;
    close();
    return true;
  }

  function show(layer, trigger, render, pin) {
    const { popup } = layer;
    clearTimeout(layer.closeTimer);
    if (layer === primary && !beforePreviewOpen()) return false;
    if (layer === nested) {
      if (!primary.anchor || !primary.popup.contains(trigger)) return false;
      clearTimeout(primary.closeTimer);
      clearTimeout(primary.switchTimer);
    }
    if (layer.anchor !== trigger) {
      const animate = popup.hidden;
      hideLayer(layer, false, true);
      const { title, category, icon, body, closeLabel, bondIcon, operator, sheet, tierSource } = render();
      const dismiss = operator ? null : make('button', 'skland-popover-close', '×');
      if (dismiss) {
        dismiss.type = 'button';
        dismiss.setAttribute('aria-label', closeLabel ?? '关闭浮窗');
        dismiss.addEventListener('click', () => hideLayer(layer, true));
      }
      popup.classList.toggle('skland-operator-preview', !!sheet);
      popup.style.removeProperty('--preview-tier');
      if (sheet) {
        sheet.querySelector('.directory-preview-name').id = popup.id + '-title';
        sheet.append(...body.filter(Boolean));
        popup.style.setProperty('--preview-tier', getComputedStyle(tierSource).getPropertyValue('--tier-color'));
        popup.append(sheet);
      } else {
        const heading = make('h3', '', title);
        heading.id = popup.id + '-title';
        const name = make('div', 'skland-popover-title');
        name.append(heading);
        if (category) name.append(make('small', '', category));
        const header = make('div', 'skland-popover-header');
        if (icon) header.append(stamp(icon, bondIcon ? 'skland-bond-stamp is-bond-icon' : 'skland-bond-stamp', title));
        header.append(name);
        if (dismiss) header.append(dismiss);
        popup.append(header, ...body.filter(Boolean));
      }
      layer.anchor = trigger;
      if (trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-details', popup.id);
      previewUI.enter(popup, animate, 'skland-preview-entrance');
      popup.scrollTop = 0;
      position(layer);
    }
    layer.pinned = pin && !!layer.anchor;
    if (layer.pinned) (popup.querySelector('.skland-popover-close') ?? popup).focus({ preventScroll: true });
    return !!layer.anchor;
  }

  function contains(layer, target) {
    return layer.anchor?.contains(target) || layer.popup.contains(target) ||
      layer === primary && nested.popup.contains(target);
  }

  function scheduleClose(layer) {
    if (layer.pinned) return;
    clearTimeout(layer.closeTimer);
    layer.closeTimer = setTimeout(() => {
      const focus = document.activeElement;
      const overChild = layer === primary && (nested.pinned || nested.transiting || nested.popup.matches(':hover'));
      if (layer.pinned || layer.transiting || overChild || layer.anchor?.matches(':hover, :focus-visible') ||
          layer.popup.matches(':hover') || (focus !== layer.anchor && contains(layer, focus))) return;
      hideLayer(layer);
    }, 180);
  }

  function hoverAllowed(layer) {
    return !layer.pinned && (layer !== primary || !nested.pinned);
  }

  function needsHoverDwell(layer) {
    return !!layer.anchor && (layer === nested || !!layer.popup.querySelector('[data-preview-trigger]'));
  }

  function stopTransit(layer) {
    clearTimeout(layer.transitTimer);
    layer.transiting = false;
  }

  function onPreviewPath(layer, x, y) {
    const trigger = layer.anchor.getBoundingClientRect();
    const popup = layer.popup.getBoundingClientRect();
    const side = layer.popup.dataset.side;
    const horizontal = side === 'right' || side === 'left';
    const startEdge = horizontal ? (side === 'right' ? 'left' : 'right') : (side === 'below' ? 'top' : 'bottom');
    const start = trigger[startEdge];
    const end = popup[startEdge];
    const axis = horizontal ? x : y;
    const cross = horizontal ? y : x;
    const progress = (axis - start) / (end - start);
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) return false;
    const low = horizontal ? 'top' : 'left';
    const high = horizontal ? 'bottom' : 'right';
    const interpolate = edge => trigger[edge] + (popup[edge] - trigger[edge]) * progress;
    return cross >= interpolate(low) - 8 && cross <= interpolate(high) + 8;
  }

  function releaseTransit(layer) {
    stopTransit(layer);
    scheduleClose(layer);
    if (layer === nested) scheduleClose(primary);
  }

  function trackTransit(layer, event) {
    if (!needsHoverDwell(layer) || layer.pinned) return;
    if (layer.anchor.contains(event.target) || layer.popup.contains(event.target)) {
      stopTransit(layer);
      clearTimeout(layer.closeTimer);
      if (layer === nested) clearTimeout(primary.closeTimer);
    } else if (onPreviewPath(layer, event.clientX, event.clientY)) {
      layer.transiting = true;
      clearTimeout(layer.closeTimer);
      clearTimeout(layer.transitTimer);
      if (layer === nested) clearTimeout(primary.closeTimer);
      layer.transitTimer = setTimeout(() => releaseTransit(layer), 300);
    } else if (layer.transiting) releaseTransit(layer);
  }

  function queueHover(layer, trigger, render, delay) {
    clearTimeout(layer.openTimer);
    layer.openTimer = setTimeout(() => {
      if (!trigger.matches(':hover') || !hoverAllowed(layer)) return;
      if (layer.transiting || layer === primary && nested.transiting) queueHover(layer, trigger, render, delay);
      else show(layer, trigger, render, false);
    }, delay);
  }

  function switchCoveredPreview(layer, event) {
    clearTimeout(layer.switchTimer);
    const current = layer.anchor;
    if (!current || !hoverAllowed(layer) || layer === primary && nested.anchor) return;
    const { targets, popup } = layer;
    if (!needsHoverDwell(layer)) {
      previewUI.switchBehind(event, targets, current);
      return;
    }
    const candidate = previewUI.targetBehind(event, targets, current);
    if (!candidate) return;
    // Give the pointer time to reach a control in the open preview before switching to the page underneath.
    const { clientX, clientY, pointerType, buttons } = event;
    layer.switchTimer = setTimeout(() => {
      if (layer.anchor !== current || !hoverAllowed(layer) || layer === primary && nested.anchor) return;
      const target = document.elementFromPoint(clientX, clientY);
      if (target && popup.contains(target) &&
          previewUI.targetBehind({ target, clientX, clientY, pointerType, buttons }, targets, current) === candidate) {
        targets.get(candidate)?.();
      }
    }, nestedPreviewDwell);
  }

  function bindPopover(trigger, render, layer = primary) {
    const { popup } = layer;
    trigger.classList.add('has-skland-preview');
    previewUI.bindTarget(layer.targets, trigger, () => show(layer, trigger, render, false));
    trigger.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse' || !hoverAllowed(layer)) return;
      clearTimeout(layer.openTimer);
      clearTimeout(layer.closeTimer);
      if (layer.anchor === trigger) return;
      if (needsHoverDwell(layer)) queueHover(layer, trigger, render, nestedPreviewDwell);
      else if (layer.anchor) show(layer, trigger, render, false);
      else queueHover(layer, trigger, render, 160);
    });
    trigger.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse' && event.buttons === 0 && layer.anchor !== trigger &&
          hoverAllowed(layer) && needsHoverDwell(layer)) queueHover(layer, trigger, render, nestedPreviewDwell);
    });
    trigger.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'mouse') return;
      clearTimeout(layer.openTimer);
      if (layer.anchor) scheduleClose(layer);
    });
    trigger.addEventListener('focus', () => {
      if (trigger.matches(':focus-visible') && !restoringFocus && hoverAllowed(layer)) show(layer, trigger, render, false);
    });
    trigger.addEventListener('blur', event => {
      if (layer.anchor === trigger && !trigger.matches(':hover') && !contains(layer, event.relatedTarget)) scheduleClose(layer);
    });
    if (trigger.tagName === 'A') {
      trigger.setAttribute('aria-keyshortcuts', 'ArrowDown');
      trigger.addEventListener('keydown', event => {
        if (event.key !== 'ArrowDown') return;
        event.preventDefault();
        show(layer, trigger, render, true);
      });
    }
    if (trigger.tagName === 'BUTTON') {
      trigger.type = 'button';
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', popup.id);
      trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', () => {
        if (layer.anchor === trigger && layer.pinned) hideLayer(layer, true);
        else show(layer, trigger, render, true);
      });
    }
  }

  function bondContent(card, name) {
    const activation = card.querySelector('.library-card-meta')?.textContent;
    const effect = card.querySelector('[data-library-copy]')?.textContent;
    const members = bondMembers.get(name) ?? [];
    const roster = make('div', 'skland-bond-roster');
    roster.setAttribute('aria-label', '盟约成员');
    roster.append(...members.map(member => portrait(member, undefined, { preview: nested })));
    return {
      title: name,
      category: card.dataset.libraryKind === 'core' ? '核心盟约' : '附加盟约',
      icon: card.querySelector('summary img')?.getAttribute('src'),
      bondIcon: true,
      closeLabel: '关闭盟约浮窗',
      body: [
        isBanned.has(name) && make('p', 'skland-bond-activation skland-ban', '本局已 Ban'),
        activation && make('p', 'skland-bond-activation', activation),
        effect && make('p', 'skland-bond-effect game-copy', effect),
        members.length > 0 && roster,
        linkTo('#' + card.id, '查看盟约档案'),
      ],
    };
  }

  function bondChip(bond) {
    const card = bondCards.get(bond.id);
    const art = card?.querySelector('summary img')?.getAttribute('src');
    const chip = make(card ? 'button' : 'span', 'skland-bond-chip');
    chip.dataset.bond = bond.name;
    if (art) chip.append(image(art, ''));
    chip.append(make('span', '', bond.name));
    if (card) bindPopover(chip, () => bondContent(card, bond.name));
    return chip;
  }

  function markBonds(chips) {
    for (const chip of chips) {
      const banned = isBanned.has(chip.dataset.bond);
      chip.dataset.banned = banned;
      chip.setAttribute('aria-label', chip.dataset.bond + (banned ? '，已 Ban' : ''));
    }
  }

  for (const input of document.querySelectorAll('#team-bans input[name="ban"]')) {
    const card = bondCards.get(mode.bondIds[input.value]);
    if (card) bindPopover(input, () => bondContent(card, input.value));
  }
  for (const layer of [primary, nested]) {
    layer.popup.addEventListener('pointerenter', () => {
      clearTimeout(layer.closeTimer);
      if (layer === nested) clearTimeout(primary.closeTimer);
    });
    layer.popup.addEventListener('pointerleave', () => {
      clearTimeout(layer.switchTimer);
      scheduleClose(layer);
      if (layer === nested) scheduleClose(primary);
    });
    layer.popup.addEventListener('pointermove', event => switchCoveredPreview(layer, event));
  }
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || event.buttons !== 0 || !primary.anchor) return;
    trackTransit(primary, event);
    trackTransit(nested, event);
  }, true);
  document.addEventListener('pointerdown', event => {
    for (const layer of [nested, primary]) {
      if (layer.anchor && !contains(layer, event.target)) hideLayer(layer);
    }
  });
  document.addEventListener('focusin', event => {
    for (const layer of [nested, primary]) {
      if (layer.pinned && !contains(layer, event.target)) hideLayer(layer);
    }
  });
  document.addEventListener('keydown', event => {
    const layer = nested.anchor ? nested : primary;
    if (event.key === 'Escape' && layer.anchor) {
      hideLayer(layer, layer.popup.contains(document.activeElement));
      event.preventDefault();
    }
  });
  window.addEventListener('scroll', event => {
    if (!primary.anchor || event.target === nested.popup) return;
    clearTimeout(primary.switchTimer);
    clearTimeout(nested.switchTimer);
    cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(() => {
      if (event.target !== primary.popup) position(primary);
      position(nested);
      if (primary.anchor) scheduleClose(primary);
      if (nested.anchor) scheduleClose(nested);
    });
  }, true);
  window.addEventListener('resize', () => {
    position(primary);
    position(nested);
  });
  function previewNavigation(link) {
    const layer = [nested, primary].find(item => item.popup.contains(link));
    if (!layer) return null;
    return {
      focus: primary.anchor,
      entryPoint: layer.popup.querySelector('.stamp-portrait, .skland-popover-header .skland-bond-stamp')?.getBoundingClientRect(),
    };
  }
  return { stamp, cdn, eligibility, portrait, markPortrait, strategyStamp, strategyLink, equipmentTile,
    configuration, directoryConfiguration, bondChip, markBonds, close, previewNavigation,
    focusAfterNavigation, releaseForDirectoryPreview };
};
