/* Online results and the bundled snapshot use the same card and desktop export. */
window.mountStrongholdSkland = function ({ mode, blockReason, linkTo, directoryLinks, teamNames, operatorPreviewContent, previewUI, savedPlan, onPlanChange, beforePreviewOpen }) {
  const feed = window.strongholdSklandFeed;
  const list = document.getElementById('skland-list');
  const detail = document.getElementById('skland-detail');
  const planPanel = document.getElementById('skland-plan');
  const planCount = document.getElementById('skland-plan-count');
  const planOrigin = document.getElementById('skland-plan-origin');
  const planMembers = document.getElementById('skland-plan-members');
  const planForm = document.getElementById('skland-plan-form');
  const planSearch = document.getElementById('skland-plan-search');
  const planPick = document.getElementById('skland-plan-pick');
  const planAdd = document.getElementById('skland-plan-add');
  const planCancel = document.getElementById('skland-plan-cancel');
  const planExport = document.getElementById('skland-plan-export');
  const planExportStatus = document.getElementById('skland-plan-export-status');
  const planExportText = document.getElementById('skland-plan-export-text');
  const cards = document.getElementById('skland-cards');
  const roundFilter = document.getElementById('skland-round-filter');
  const banMatches = document.getElementById('skland-ban-matches');
  const banAll = document.getElementById('skland-ban-all');
  const banResults = document.getElementById('skland-ban-results');
  const banEmpty = document.getElementById('skland-ban-empty');
  const empty = document.getElementById('skland-empty');
  const status = document.getElementById('skland-feed-status');
  const form = document.getElementById('skland-filters');
  const online = document.getElementById('skland-online');
  const snapshot = document.getElementById('skland-snapshot');
  const search = document.getElementById('skland-search');
  const sort = document.getElementById('skland-sort');
  const core = document.getElementById('skland-core');
  const strategy = document.getElementById('skland-strategy');
  const extra = document.getElementById('skland-extra');
  const extraCount = document.getElementById('skland-extra-count');
  const more = document.getElementById('skland-more');
  const all = Array.isArray(window.strongholdSklandLineups) ? window.strongholdSklandLineups : [];
  const snapshots = all.filter(lineup => {
    const s = lineup?.skland;
    return s?.schemaVersion === 1 && (feed ? feed.isCurrent(s) :
      s.seasonId === 'act3autochess' && s.versionId === 'V3_1' && s.phase === 1);
  });
  form.hidden = false;
  status.hidden = false;
  const gearIds = new Map(Array.from(document.querySelectorAll('.catalog-gear'), card => [card.dataset.equipment, card.id]));
  const formatDate = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Hong_Kong', dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23',
  });
  const make = (tag, className, value) => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (value !== undefined) result.textContent = value;
    return result;
  };
  const stageLabel = (stage) => stage.tabType === 1 ? '成型阵容' : stage.startRound === stage.endRound
    ? '第 ' + stage.startRound + ' 回合' : '第 ' + stage.startRound + '–' + stage.endRound + ' 回合';
  const isBanned = new Set();
  let manualBans = new Set();
  let showAll = false;
  const hasBans = () => isBanned.size > 0 || manualBans.size > 0;
  const records = new Map();
  const detailRecords = new Map(snapshots.map(lineup => [lineup.id, { lineup, snapshot: true }]));
  const motionPreference = matchMedia('(prefers-reduced-motion: no-preference)');
  const reveals = new Map();

  function stopReveal(target) {
    reveals.get(target)?.cancel();
    reveals.delete(target);
  }

  function reveal(target, kind, duration) {
    stopReveal(target);
    if (!motionPreference.matches) return;
    const animation = target.animate([{ opacity: .82 }, { opacity: 1 }], {
      duration, easing: 'cubic-bezier(.22, .61, .36, 1)',
    });
    animation.id = 'skland-' + kind;
    reveals.set(target, animation);
    animation.onfinish = () => {
      if (reveals.get(target) === animation) reveals.delete(target);
    };
  }

  motionPreference.addEventListener('change', () => {
    if (!motionPreference.matches) for (const target of reveals.keys()) stopReveal(target);
  });
  const art = window.createSklandArt({
    mode, directoryLinks, linkTo, blockReason, isBanned, make, memberBanText, operatorPreviewContent, previewUI, beforePreviewOpen,
  });
  const emptyPlan = () => ({ origin: null, members: [] });
  let plan = Array.isArray(savedPlan?.members) && savedPlan.members.every(member => typeof member?.name === 'string' && member.name)
    ? savedPlan : emptyPlan();
  let replaceIndex = null;
  let roundDiy = new Set();
  const needsDiy = name => !Object.hasOwn(mode.operators, name) &&
    Object.hasOwn(mode.diyCandidates, name) && !roundDiy.has(name);
  let planCandidates = [];

  function memberBanText({ affiliations, reason, hits }) {
    return [reason ? reason.text : hits.length ? '仍可选' : '',
      hits.length && reason?.kind !== 'bond' ? '关联盟约已 Ban：' + hits.join('／') : '',
      !affiliations ? '暂无本局盟约数据' : ''].filter(Boolean).join(' · ');
  }

  function conflictLabels(blocked, unknown) {
    const labels = [];
    if (blocked) labels.push(blocked + ' 名干员已 Ban');
    if (unknown) labels.push(unknown + ' 名干员待核对');
    return labels;
  }

  function updatePlanAction(button) {
    if (button) button.textContent = plan.members.length ? '用此阶段替换本局名单' : '带入本局名单';
  }

  function renderPlanPicker() {
    const previous = planPick.value;
    const query = planSearch.value.trim().toLocaleLowerCase();
    const candidates = planCandidates.filter(name => name.toLocaleLowerCase().includes(query));
    const placeholder = candidates.length ? '选择本局可选干员' : query ? '没有匹配干员' : '暂无其他可选干员';
    planPick.replaceChildren(new Option(placeholder, ''));
    for (const name of candidates) planPick.add(new Option(name, name));
    planPick.value = candidates.includes(previous) ? previous : '';
    planPick.disabled = candidates.length === 0;
    planAdd.disabled = !planPick.value;
    planAdd.textContent = replaceIndex === null ? '加入名单' : '确认替换 ' + plan.members[replaceIndex].name;
    planCancel.hidden = replaceIndex === null;
  }

  function renderPlan() {
    art.close();
    planExport.hidden = !plan.members.length;
    planExportStatus.textContent = '';
    planExportText.hidden = true;
    const occupied = new Set(plan.members.map(member => member.name));
    planCandidates = [...new Set([...teamNames, ...roundDiy])]
      .filter(name => !occupied.has(name) && !art.eligibility(name).reason)
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
    renderPlanPicker();
    const { origin } = plan;
    if (/^skland-\d{1,24}$/.test(origin?.id) && typeof origin.name === 'string' && typeof origin.stage === 'string') {
      planOrigin.replaceChildren('来自 ', linkTo('#' + origin.id, origin.name), ' · ' + origin.stage);
    } else {
      planOrigin.textContent = plan.members.length ? '手动配队' : '从森空岛详情带入一个阶段，或直接选择本局可选干员。';
    }
    let blocked = 0;
    let check = 0;
    planMembers.replaceChildren(...plan.members.map((member, index) => {
      const row = make('li', 'skland-plan-member');
      const tile = art.portrait(member);
      const eligibility = art.eligibility(member.name);
      const missingDiy = needsDiy(member.name);
      const notes = [memberBanText(eligibility), missingDiy ? '尚未加入本局自选' : ''].filter(Boolean);
      if (eligibility.reason) blocked++;
      else if (missingDiy || !eligibility.affiliations) check++;
      row.dataset.banned = Boolean(eligibility.reason);
      row.classList.toggle('is-replacing', index === replaceIndex);
      const info = make('div', 'skland-plan-member-info');
      info.append(make('strong', 'skland-tile-name', member.name));
      const rank = member.mergeLevel === 1 ? '精锐' : member.mergeLevel === 0 ? '初始' : '';
      if (rank) info.append(make('span', 'skland-config', rank));
      const config = art.configuration(member);
      if (config.childElementCount) info.append(config);
      if (notes.length) info.append(make('span', 'skland-ban', notes.join(' · ')));
      const actions = make('div', 'skland-plan-member-actions');
      const swap = make('button', 'secondary', '换人');
      swap.type = 'button';
      swap.disabled = planCandidates.length === 0;
      swap.setAttribute('aria-label', '替换 ' + member.name);
      swap.addEventListener('click', () => {
        replaceIndex = index;
        planSearch.value = '';
        planPick.value = '';
        renderPlan();
        planSearch.focus();
      });
      const remove = make('button', 'secondary', '移除');
      remove.type = 'button';
      remove.setAttribute('aria-label', '从本局名单移除 ' + member.name);
      remove.addEventListener('click', () => {
        plan.members.splice(index, 1);
        replaceIndex = null;
        savePlan();
        (planMembers.children[index]?.querySelector('button:last-child') ?? planPanel.querySelector('summary')).focus();
      });
      actions.append(swap, remove);
      row.append(tile, info, actions);
      return row;
    }));
    planCount.textContent = [plan.members.length + ' 名干员', blocked ? blocked + ' 名已 Ban' : '', check ? check + ' 名待核对' : '']
      .filter(Boolean).join(' · ');
    updatePlanAction(detail.querySelector('.skland-use-stage'));
  }

  function savePlan() {
    renderPlan();
    onPlanChange();
  }

  planPanel.hidden = false;
  planPanel.open = plan.members.length > 0;
  function exportPlanJson() {
    return JSON.stringify({
      name: plan.origin ? '本局名单 · ' + plan.origin.name + ' · ' + plan.origin.stage : '本局名单',
      slots: plan.members.map(member => ({
        operatorName: member.name,
        mergeLevel: member.mergeLevel,
        skill: member.skill,
        module: member.module,
      })),
    }, null, 2);
  }

  document.getElementById('skland-plan-copy').addEventListener('click', async () => {
    const json = exportPlanJson();
    try {
      await navigator.clipboard.writeText(json);
      planExportStatus.textContent = '已复制，可粘贴到助手「阵容 → 导入」。';
    } catch {
      planExportText.value = json;
      planExportText.hidden = false;
      planExportText.focus();
      planExportText.select();
      planExportStatus.textContent = '已选中 JSON，复制后粘贴到助手。';
    }
  });
  document.getElementById('skland-plan-download').addEventListener('click', event => {
    const url = URL.createObjectURL(new Blob([exportPlanJson()], { type: 'application/json' }));
    event.currentTarget.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
  planSearch.addEventListener('input', renderPlanPicker);
  planPick.addEventListener('change', () => { planAdd.disabled = !planPick.value; });
  planCancel.addEventListener('click', () => {
    replaceIndex = null;
    planSearch.value = '';
    planPick.value = '';
    renderPlan();
    planPick.focus();
  });
  planForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = planPick.value;
    if (!name) return;
    if (replaceIndex === null) plan.members.push({ name });
    else plan.members[replaceIndex] = { name };
    replaceIndex = null;
    planSearch.value = '';
    planPick.value = '';
    savePlan();
    planPick.focus();
  });

  function links(parent, label, entries, makeLink) {
    if (!entries.length) return;
    const group = make('p', 'skland-links');
    group.append(make('strong', '', label));
    for (const entry of entries) group.append(makeLink(entry));
    parent.append(group);
  }

  function actionLink(url, label, external = false) {
    const a = make('a', 'inline-link', label);
    a.href = url;
    if (external) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  }

  function byline(lineup, meta) {
    const s = lineup.skland;
    const footer = make('div', 'skland-byline');
    const identity = make('span', 'skland-author');
    identity.append(art.stamp(art.cdn(meta?.avatar), 'skland-author-stamp', s.author), make('span', '', s.author));
    const time = make('time', '', formatDate.format(new Date(s.editedAt)) + '（UTC+8）');
    time.dateTime = s.editedAt;
    time.title = '阵容更新时间';
    footer.append(identity, time, make('span', 'skland-sequence', '序列 I'));
    const stats = make('span', 'skland-stats');
    for (const [label, value] of [['收藏', meta?.collected], ['赞', meta?.liked]]) {
      if (/^\d+$/.test(value ?? '')) stats.append(make('span', '', label + ' ' + value));
    }
    if (stats.childElementCount) footer.append(stats);
    return footer;
  }

  function appendCard(lineup, { meta, chars, matchedStage } = {}) {
    const s = lineup.skland;
    const card = make('article', 'skland-card');
    card.id = lineup.id;
    const headline = linkTo('#' + lineup.id, '', 'skland-card-open');
    headline.append(art.strategyStamp(s.strategies[0]), make('strong', '', lineup.name));
    const arrow = make('span', 'skland-card-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    headline.append(arrow);
    const stage = s.stages.find(item => item.tabType === 1) ?? s.stages[0];
    const overview = make('div', 'skland-overview');
    if (matchedStage) overview.append(make('p', 'skland-card-match', '盟约命中 · ' + stageLabel(matchedStage)));
    const chips = [...stage.coreBonds, ...stage.additionalBonds].map(art.bondChip);
    if (chips.length) {
      const strip = make('div', 'skland-bond-strip');
      strip.append(...chips);
      overview.append(strip);
    }
    const tiles = stage.members.map(member => art.portrait(member, chars?.get(member.id)));
    if (tiles.length) {
      const roster = make('div', 'skland-roster-strip');
      roster.setAttribute('aria-label', stageLabel(stage));
      roster.append(...tiles);
      overview.append(roster);
    }
    const banNote = make('p', 'skland-card-ban');
    overview.prepend(banNote);
    const diyNote = make('p', 'skland-card-diy');
    overview.prepend(diyNote);
    card.append(headline, overview, byline(lineup, meta));
    cards.append(card);
    const record = { lineup, meta, chars, card };
    records.set(lineup.id, record);
    record.updateListBans = () => {
      const missing = [...new Set(stage.members.map(member => member.name).filter(needsDiy))];
      diyNote.hidden = !missing.length;
      diyNote.textContent = missing.length ? stageLabel(stage) + ' · 尚未加入本局自选 · ' + missing.join('、') : '';
      art.markBonds(chips);
      let blocked = 0;
      let unknown = 0;
      for (const tile of tiles) {
        const { reason, affiliations } = art.markPortrait(tile);
        if (reason) blocked++;
        else if (!affiliations) unknown++;
      }
      record.allClear = tiles.length > 0 && blocked === 0 && unknown === 0;
      const labels = conflictLabels(blocked, unknown);
      if (record.allClear && chips.some(chip => chip.dataset.banned === 'true')) labels.push('干员均未被 Ban');
      banNote.hidden = labels.length === 0;
      banNote.textContent = stageLabel(stage) + ' · ' + labels.join(' · ');
      banNote.dataset.conflict = Boolean(blocked);
    };
    record.updateListBans();
    return card;
  }

  function detailRow(title, content) {
    const row = make('section', 'skland-stage-row');
    row.append(make('h4', '', title), content);
    return row;
  }

  function buildDetail(record) {
    const { lineup, meta, chars } = record;
    const s = lineup.skland;
    const root = make('div', 'skland-detail-view');
    const url = 'https://game.skland.com/arknights/stronghold-guide/detail?header=0&guideId=' + encodeURIComponent(s.guideId);
    const top = make('div', 'skland-detail-top');
    top.append(returnToListLink(), make('span', 'skland-config', '规程 · 序列 I / ' + s.versionId));
    if (record.snapshot) {
      const snapshotNote = make('p', 'skland-detail-source');
      snapshotNote.setAttribute('role', 'status');
      root.append(top, snapshotNote);
      record.snapshotNote = snapshotNote;
    } else root.append(top);
    const header = make('header', 'skland-detail-heading');
    const identity = make('div', 'skland-detail-identity');
    const title = make('h2', '', lineup.name);
    title.id = 'skland-detail-title';
    const heading = make('div', 'skland-detail-labels');
    heading.append(title, byline(lineup, meta));
    identity.append(art.strategyStamp(s.strategies[0]), heading);
    header.append(identity);

    const actions = make('div', 'skland-actions');
    const exportStatus = make('span', 'skland-config');
    exportStatus.setAttribute('role', 'status');
    const copy = make('button', '', '复制原阵容 JSON');
    copy.type = 'button';
    const data = JSON.stringify(lineup, null, 2);
    const download = actionLink('#', '下载原阵容 JSON');
    download.download = 'skland-' + s.guideId + '.json';
    download.addEventListener('click', () => {
      const objectUrl = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      download.href = objectUrl;
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    });
    const manualCopy = make('textarea', 'skland-json');
    manualCopy.setAttribute('aria-label', '阵容 JSON');
    manualCopy.readOnly = true;
    manualCopy.hidden = true;
    manualCopy.value = data;
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(data);
        exportStatus.textContent = '已复制，可粘贴到助手「阵容 → 导入」。';
      } catch {
        manualCopy.hidden = false;
        manualCopy.focus();
        manualCopy.select();
        exportStatus.textContent = '已选中 JSON，按 Ctrl+C 复制后粘贴到助手。';
      }
    });
    actions.append(actionLink(url, '森空岛原文', true), copy, download, exportStatus);
    header.append(actions, manualCopy);

    const metaRow = make('div', 'skland-detail-meta');
    links(metaRow, '策略', s.strategies, art.strategyLink);
    if (s.applicableScope.trim()) {
      const scope = make('div', 'skland-scope');
      scope.append(make('strong', '', '适用范围'), make('p', 'skland-copy', s.applicableScope));
      metaRow.append(scope);
    }
    if (metaRow.childElementCount) header.append(metaRow);
    const detailBans = make('p', 'skland-round-summary');
    header.append(detailBans);

    const frame = make('div', 'skland-detail-stages');
    const stageActions = make('div', 'skland-stage-actions');
    const stagePicker = make('div', 'skland-stages');
    stagePicker.setAttribute('role', 'group');
    stagePicker.setAttribute('aria-label', '阵容阶段');
    const useStage = make('button', 'skland-use-stage secondary');
    useStage.type = 'button';
    let selectedStage;
    let selectedPanel;
    useStage.addEventListener('click', () => {
      plan = {
        origin: { id: lineup.id, name: lineup.name, stage: stageLabel(selectedStage) },
        members: [...selectedStage.members],
      };
      replaceIndex = null;
      planSearch.value = '';
      planPick.value = '';
      savePlan();
      planPanel.open = true;
      planPanel.querySelector('summary').focus({ preventScroll: true });
      planPanel.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    const stageViews = s.stages.map((stage, index) => {
      const button = make('button', '', stageLabel(stage));
      button.type = 'button';
      const stageBans = make('span', 'skland-stage-bans');
      stageBans.hidden = true;
      button.append(stageBans);
      stagePicker.append(button);
      const panel = make('div', 'skland-stage');
      panel.id = lineup.id + '-stage-' + index;
      button.setAttribute('aria-controls', panel.id);

      const memberRows = [];
      const roster = make('ul', 'skland-members');
      for (const member of stage.members) {
        const row = make('li', 'skland-member');
        const source = chars?.get(member.id);
        const tile = art.portrait(member, source, { large: true });
        const ban = make('span', 'skland-ban');
        row.append(tile, art.configuration(member, source), make('strong', 'skland-tile-name', member.name), ban);
        roster.append(row);
        memberRows.push({ row, tile, ban });
      }
      panel.append(detailRow('推荐干员', roster.childElementCount ? roster : make('p', 'skland-config', '此阶段未填写干员。')));
      const chips = [...stage.coreBonds, ...stage.additionalBonds].map(art.bondChip);
      if (chips.length) {
        const bonds = make('div', 'skland-bond-strip');
        bonds.append(...chips);
        panel.append(detailRow('来源标注盟约', bonds));
      }
      if (stage.equipment.length) {
        const equipment = make('div', 'skland-gear-strip');
        equipment.append(...stage.equipment.map(item => art.equipmentTile(item, gearIds.get(item.name))));
        panel.append(detailRow('公共推荐装备', equipment));
      }
      if (stage.operationIdea.trim()) {
        const notes = make('div', 'skland-operation');
        notes.append(make('h4', '', '作者运营说明'), make('p', 'skland-copy', stage.operationIdea));
        panel.append(notes);
      }
      button.addEventListener('click', () => select(panel, true));
      return { button, panel, memberRows, chips, stage, stageBans };
    });

    function select(panel, animate = false) {
      if (selectedPanel === panel) return;
      stopReveal(selectedPanel);
      art.close();
      selectedPanel = panel;
      for (const view of stageViews) {
        const selected = view.panel === panel;
        view.panel.hidden = !selected;
        view.button.setAttribute('aria-pressed', String(selected));
        if (selected) selectedStage = view.stage;
      }
      useStage.disabled = selectedStage.members.length === 0;
      updatePlanAction(useStage);
      if (animate) {
        stopReveal(root);
        reveal(panel, 'stage-entrance', 150);
      }
    }
    stageActions.append(stagePicker, useStage);
    frame.append(stageActions, ...stageViews.map(stage => stage.panel));
    select(stageViews[s.stages.findIndex(stage => stage.tabType === 1)]?.panel ?? stageViews[0].panel);
    root.append(header, frame);

    record.updateDetailBans = () => {
      updateRoundSummary(detailBans, s.guideId);
      for (const stage of stageViews) {
        art.markBonds(stage.chips);
        let blocked = 0;
        let unknown = 0;
        for (const { row, tile, ban } of stage.memberRows) {
          const result = art.markPortrait(tile);
          if (result.reason) blocked++;
          else if (!result.affiliations) unknown++;
          row.dataset.banned = Boolean(result.reason);
          ban.textContent = memberBanText(result);
          ban.hidden = !ban.textContent;
        }
        stage.stageBans.textContent = conflictLabels(blocked, unknown).join(' · ');
        stage.stageBans.hidden = !stage.stageBans.textContent;
      }
    };
    record.updateDetailBans();
    return root;
  }

  for (const card of document.querySelectorAll('#bonds .library-card')) {
    const id = card.id.slice('bond-'.length);
    const name = card.querySelector('summary strong').textContent;
    if (card.dataset.libraryKind === 'core') {
      core.add(new Option(name, id));
    } else if (id !== 'suntShip') {
      // 绝技 appears on cards but is excluded from the source site's filter.
      const label = make('label', 'skland-extra-chip');
      const checkbox = make('input');
      checkbox.type = 'checkbox';
      checkbox.value = id;
      label.append(checkbox, document.createTextNode(name));
      extra.append(label);
    }
  }
  for (const card of document.querySelectorAll('#strategies .library-card')) {
    const title = card.querySelector('summary .library-card-title');
    const name = title.querySelector('strong').textContent;
    const initiator = title.querySelector('small').textContent.split(' · ')[0];
    strategy.add(new Option(initiator + ' ' + name, card.id.slice('strategy-'.length)));
  }

  let source = 'snapshot';
  let snapshotFallback = '';
  let cursor;
  let pending;
  let searchTimer;
  let observer;
  let detailRequest;

  function readQuery() {
    const checked = [...extra.querySelectorAll(':checked')].map(input => input.value);
    extraCount.textContent = checked.length ? ' · ' + checked.length + ' 项' : '';
    return { title: search.value.trim(), sort: sort.value, core: core.value, strategy: strategy.value, extra: checked };
  }

  function matchesBondFilter(lineup, query) {
    if (!query.core && !query.extra.length) return { matchedStage: null };
    const formation = lineup.skland.stages.find(stage => stage.tabType === 1);
    if (!formation ||
        (query.core && !formation.coreBonds.some(bond => bond.id === query.core)) ||
        !query.extra.every(id => formation.additionalBonds.some(bond => bond.id === id))) return null;
    return { matchedStage: formation };
  }

  function clearCards() {
    art.close();
    for (const card of cards.children) stopReveal(card);
    cards.replaceChildren();
    records.clear();
    applyBanFilter();
  }

  function applyBanFilter() {
    const active = hasBans();
    const filtering = active && !showAll;
    let total = 0;
    let matches = 0;
    for (const record of records.values()) {
      if (!record.card) continue;
      const hidden = filtering && !record.allClear;
      if (hidden) stopReveal(record.card);
      record.card.hidden = hidden;
      total++;
      if (record.allClear) matches++;
    }
    roundFilter.hidden = !active;
    banMatches.setAttribute('aria-pressed', String(filtering));
    banAll.setAttribute('aria-pressed', String(!filtering));
    banMatches.querySelector('span').textContent = matches;
    banAll.querySelector('span').textContent = total;
    const announcement = active && total > 0
      ? '已加载 ' + total + ' 套，预览干员无 Ban 冲突 ' + matches + ' 套。'
      : '';
    if (banResults.textContent !== announcement) banResults.textContent = announcement;
    banEmpty.hidden = !filtering || total === 0 || matches > 0;
    if (!banEmpty.hidden) {
      banEmpty.textContent = cursor?.next != null
        ? '已加载的阵容暂无无冲突结果。可以继续加载，或查看全部阵容。'
        : '当前结果暂无无冲突阵容。可以查看全部，带入后手动换人。';
    }
  }

  function setSource(next) {
    source = next;
    online.setAttribute('aria-pressed', String(next === 'online'));
    snapshot.setAttribute('aria-pressed', String(next === 'snapshot'));
  }

  function showSnapshot(prefix = snapshotFallback) {
    pending?.abort();
    pending = undefined;
    setSource('snapshot');
    snapshotFallback = prefix;
    online.textContent = prefix ? '重试在线阵容' : '在线阵容';
    cursor = undefined;
    const query = readQuery();
    const title = query.title.toLocaleLowerCase();
    const matches = [];
    for (const lineup of snapshots) {
      if (!lineup.name.toLocaleLowerCase().includes(title) ||
          (query.strategy && !lineup.skland.strategies.some(item => item.id === query.strategy))) continue;
      const match = matchesBondFilter(lineup, query);
      if (match) matches.push({ lineup, match });
    }
    if (query.sort === '2') matches.sort((a, b) => Date.parse(b.lineup.createdAt) - Date.parse(a.lineup.createdAt));
    clearCards();
    for (const { lineup, match } of matches) appendCard(lineup, match);
    applyBanFilter();
    status.textContent = prefix + '本地快照 · ' + matches.length + ' / ' + snapshots.length + ' 套';
    empty.textContent = snapshots.length ? '快照中没有符合条件的阵容。' : '暂未载入阵容快照，其他速查仍可使用。';
    empty.hidden = matches.length > 0;
    more.hidden = true;
    cards.removeAttribute('aria-busy');
  }

  async function loadNext() {
    if (!cursor || cursor.next === null || pending) return;
    const firstPage = cursor.next === '';
    const controller = new AbortController();
    pending = controller;
    status.textContent = firstPage ? '正在读取在线阵容…' : '正在加载更多阵容…';
    cards.setAttribute('aria-busy', 'true');
    more.disabled = true;
    try {
      const page = await feed.loadPage(cursor.query, cursor.next, controller.signal);
      if (pending !== controller) return;
      const stalled = page.next !== null && cursor.tokens.has(page.next);
      if (page.next !== null) cursor.tokens.add(page.next);
      cursor.next = stalled ? null : page.next;
      cursor.skipped += page.skipped;
      const added = [];
      for (const lineup of page.lineups) {
        if (cursor.ids.has(lineup.id)) continue;
        const match = matchesBondFilter(lineup, cursor.query);
        if (!match) continue;
        cursor.ids.add(lineup.id);
        added.push(appendCard(lineup, { ...match, meta: page.byline.get(lineup.id), chars: page.chars }));
      }
      applyBanFilter();
      if (!firstPage && !list.hidden) {
        for (const card of added) if (!card.hidden) reveal(card, 'page-entrance', 150);
      }
      status.textContent = '在线阵容 · 已加载 ' + cursor.ids.size + ' 套' +
        (cursor.skipped ? ' · ' + cursor.skipped + ' 条版本不符或暂不可预览' : '') +
        (stalled ? ' · 森空岛未返回新的翻页位置' : cursor.next === null ? ' · 已加载全部结果' : '');
      empty.textContent = cursor.next === null ? '没有符合条件的阵容。' : '已加载页暂无可预览阵容。';
      empty.hidden = cursor.ids.size > 0;
      more.hidden = cursor.next === null;
      more.textContent = '加载更多阵容';
    } catch (error) {
      if (pending !== controller) return;
      if (firstPage) {
        const reason = error.message.startsWith('森空岛') ? error.message : '在线阵容暂不可用';
        showSnapshot(reason + '。');
      } else {
        status.textContent = '后续阵容暂未加载 · 已保留 ' + cursor.ids.size + ' 套在线结果';
        more.hidden = false;
        more.textContent = '重试加载更多';
      }
    } finally {
      if (pending === controller) {
        pending = undefined;
        more.disabled = false;
        cards.removeAttribute('aria-busy');
      }
    }
  }

  function showOnline() {
    if (!feed) {
      showSnapshot('在线阵容暂不可用。');
      return;
    }
    pending?.abort();
    pending = undefined;
    snapshotFallback = '';
    online.textContent = '在线阵容';
    setSource('online');
    cursor = { query: readQuery(), next: '', tokens: new Set(), ids: new Set(), skipped: 0 };
    clearCards();
    more.hidden = true;
    empty.hidden = true;
    void loadNext();
  }

  function refresh() {
    clearTimeout(searchTimer);
    if (source === 'online') showOnline();
    else showSnapshot();
  }

  online.addEventListener('click', () => {
    observer?.disconnect();
    clearTimeout(searchTimer);
    if (source !== 'online') showOnline();
  });
  snapshot.addEventListener('click', () => {
    observer?.disconnect();
    clearTimeout(searchTimer);
    if (source !== 'snapshot' || snapshotFallback) showSnapshot('');
  });
  more.addEventListener('click', () => void loadNext());
  banMatches.addEventListener('click', () => {
    art.close();
    showAll = false;
    applyBanFilter();
  });
  banAll.addEventListener('click', () => {
    art.close();
    showAll = true;
    applyBanFilter();
  });
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    if (source === 'online') {
      pending?.abort();
      pending = undefined;
      more.disabled = true;
      searchTimer = setTimeout(refresh, 280);
    } else refresh();
  });
  form.addEventListener('change', event => {
    if (event.target !== search) refresh();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    refresh();
  });
  form.addEventListener('reset', () => requestAnimationFrame(refresh));

  showSnapshot();
  // Bookmarked details hide the list; start its feed the first time the list is shown.
  observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    showOnline();
  });
  observer.observe(list.querySelector('.skland-list-title'));

  function updateRoundSummary(target, guideId) {
    target.replaceChildren(document.createTextNode(
      '本局 Ban · 盟约 ' + isBanned.size + ' 项 · 单独禁用干员 ' + manualBans.size + ' 名'),
    linkTo('#team-ban-panel?lineup=' + guideId, '本局设置'));
  }

  function stopDetailReveal() {
    stopReveal(detail.querySelector('.skland-detail-view'));
    stopReveal(detail.querySelector('.skland-stage:not([hidden])'));
  }

  function showDetail(record, animate) {
    record.detail ??= buildDetail(record);
    if (detail.firstChild !== record.detail) {
      stopDetailReveal();
      detail.replaceChildren(record.detail);
    }
    updatePlanAction(detail.querySelector('.skland-use-stage'));
    if (animate) reveal(record.detail, 'detail-entrance', 185);
  }

  function returnToListLink() {
    const link = linkTo('#skland-lineups', '← 返回阵容列表');
    link.dataset.sklandReturn = '';
    return link;
  }

  function snapshotStatus(record, message) {
    record.snapshotNote.textContent = '本地快照 · 来源更新于 ' +
      formatDate.format(new Date(record.lineup.skland.editedAt)) + '（UTC+8） · ' + message;
  }

  function detailStatus(message) {
    const top = make('div', 'skland-detail-top');
    top.append(returnToListLink());
    const title = make('h2', '', '阵容详情');
    title.id = 'skland-detail-title';
    const feedback = make('p', 'skland-config', message);
    feedback.setAttribute('role', 'status');
    stopDetailReveal();
    detail.replaceChildren(top, title, feedback);
  }

  function loadDetail(id, animate, fallback) {
    const controller = new AbortController();
    detailRequest = controller;
    if (fallback) snapshotStatus(fallback, '正在核验在线详情…');
    else detailStatus('正在读取阵容详情…');
    feed.loadDetail(id, controller.signal).then(record => {
      if (detailRequest !== controller) return;
      detailRecords.set(record.lineup.id, record);
      const selected = fallback?.detail.querySelector('.skland-stages button[aria-pressed="true"]');
      const stageIndex = selected ? [...selected.parentElement.children].indexOf(selected) : -1;
      const stageKey = stage => stage && [stage.tabType, stage.startRound, stage.endRound].join(':');
      const key = stageKey(fallback?.lineup.skland.stages[stageIndex]);
      const restoreStage = record.lineup.skland.stages.findIndex(stage => stageKey(stage) === key);
      const hadFocus = fallback?.detail.contains(document.activeElement);
      if (fallback) art.close();
      showDetail(record, animate);
      const stageButton = record.detail.querySelectorAll('.skland-stages button')[restoreStage];
      if (stageButton && stageButton.getAttribute('aria-pressed') !== 'true') stageButton.click();
      if (hadFocus) (stageButton ?? detail).focus({ preventScroll: true });
    }).catch(error => {
      if (detailRequest !== controller) return;
      const reason = error.message.startsWith('森空岛') || error.message.startsWith('此阵容')
        ? error.message : '在线详情暂不可用';
      if (fallback) snapshotStatus(fallback, reason + '，当前显示快照');
      else detailStatus(reason + '。');
    }).finally(() => {
      if (detailRequest === controller) detailRequest = undefined;
    });
  }

  return {
    previewNavigation: art.previewNavigation,
    focusAfterNavigation: art.focusAfterNavigation,
    directoryConfiguration: art.directoryConfiguration,
    releaseForDirectoryPreview: art.releaseForDirectoryPreview,
    getPlan() { return plan; },
    resetPlan() {
      plan = emptyPlan();
      replaceIndex = null;
      planSearch.value = '';
      planPick.value = '';
      planPanel.open = false;
    },
    updateBans(banned, blocked, selectedDiy) {
      if (banned.size !== isBanned.size || [...banned].some(name => !isBanned.has(name)) ||
          blocked.size !== manualBans.size || [...blocked].some(name => !manualBans.has(name))) {
        showAll = false;
      }
      isBanned.clear();
      for (const name of banned) isBanned.add(name);
      manualBans = new Set(blocked);
      roundDiy = new Set(selectedDiy);
      for (const record of records.values()) record.updateListBans();
      for (const record of detailRecords.values()) record.updateDetailBans?.();
      applyBanFilter();
      renderPlan();
    },
    syncRoute(hash, params, animate) {
      art.close();
      if (hash === '#operator') {
        stopDetailReveal();
        return;
      }
      detailRequest?.abort();
      detailRequest = undefined;
      const inBanPanel = hash === '#team-ban-panel';
      const detailHash = inBanPanel && params.has('lineup') ? '#skland-' + params.get('lineup') : hash;
      const id = detailHash.match(/^#skland-(\d{1,24})$/)?.[1];
      const key = detailHash.slice(1);
      const listed = records.get(key);
      let record = detailRecords.get(key);
      if (!id) {
        stopDetailReveal();
        detail.hidden = true;
        list.hidden = false;
        return;
      }
      if (listed?.chars && (!record || record.snapshot || listed.lineup.skland.revision > record.lineup.skland.revision)) {
        record = { lineup: listed.lineup, chars: listed.chars, meta: listed.meta };
        detailRecords.set(key, record);
      }
      for (const card of cards.children) stopReveal(card);
      const entering = animate && (detail.hidden || detail.firstChild !== record?.detail);
      list.hidden = true;
      detail.hidden = false;
      if (record) {
        showDetail(record, entering);
        if (record.snapshot) {
          if (feed) loadDetail(id, false, record);
          else snapshotStatus(record, '在线详情暂不可用');
        }
      }
      else if (feed) loadDetail(id, entering);
      else detailStatus('暂时无法读取这套阵容。');
      if (!inBanPanel) return detail;
    },
  };
};
