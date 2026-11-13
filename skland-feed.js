(() => {
  const api = 'https://zonai.skland.com/web/v1/game/garrison/guide/';
  const seasonId = 'act3autochess';
  const versionId = 'V3_1';
  const phase = 1;
  const isCurrent = (value) => value?.seasonId === seasonId && value.versionId === versionId && value.phase === phase;
  let resources;

  async function read(path, signal) {
    const timeout = AbortSignal.timeout(12000);
    const response = await fetch(api + path, {
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) throw new Error('森空岛返回 HTTP ' + response.status);
    const { code, data } = await response.json();
    if (code !== 0 || !data) throw new Error('森空岛没有返回可用资料');
    return data;
  }

  function loadResources() {
    if (!resources) {
      resources = read('resource').then(data => {
        if (!isCurrent(data.versionInfo) || !['序列I', '序列 I'].includes(data.versionInfo.phaseName)) {
          throw new Error('森空岛当前版本与本地资料库不一致');
        }
        return {
          phaseName: data.versionInfo.phaseName,
          chars: index(data.chars, 'charId'),
          items: index(data.items, 'itemId'),
          bonds: index(data.bonds, 'bondId'),
          strategies: index(data.strategies, 'strategyId'),
        };
      }).catch(error => {
        resources = undefined;
        throw error;
      });
    }
    return resources;
  }

  function index(entries, key) {
    return new Map(entries.map(entry => [entry[key], entry]));
  }

  function reference(map, id) {
    const entry = map.get(id);
    if (!entry || !id || typeof entry.name !== 'string' || !entry.name.trim()) {
      throw new Error('森空岛资料缺少可识别的 ID');
    }
    return { id, name: entry.name };
  }

  function optionalReference(entries, key, id) {
    if (id == null || id === '') return null;
    return reference(index(entries, key), id);
  }

  function timestamp(value) {
    if (!/^\d+$/.test(value ?? '') || Number(value) <= 0) throw new Error('缺少阵容更新时间');
    return new Date(Number(value) * 1000).toISOString();
  }

  // Match the desktop Lineup / SklandLineupSource contract. The list includes the complete tabs.
  function normalize(wrapper, catalog) {
    const guide = wrapper?.guide;
    if (!isCurrent(guide) || guide.auditStatus !== 2 || wrapper.invalid !== 0) return null;
    if (typeof guide.guideId !== 'string' || !/^\d{1,24}$/.test(guide.guideId) ||
        typeof guide.title !== 'string' || !guide.title.trim() ||
        !Number.isInteger(guide.version) || guide.version < 1 ||
        typeof wrapper.poster?.nickname !== 'string' || !wrapper.poster.nickname.trim() ||
        !Array.isArray(guide.tabs) || guide.tabs.length < 1 || guide.tabs.length > 32) {
      throw new Error('阵容字段不完整');
    }
    const stageKeys = new Set();
    const stages = guide.tabs.map(tab => {
      const { tabType, startRound, endRound } = tab;
      const key = [tabType, startRound, endRound].join(':');
      if (stageKeys.has(key) || !Number.isInteger(startRound) || !Number.isInteger(endRound) ||
          !(tabType === 1 && startRound === 0 && endRound === 0 ||
            tabType === 2 && startRound >= 1 && endRound >= startRound)) {
        throw new Error('阵容阶段无效');
      }
      stageKeys.add(key);
      const members = (tab.recChars ?? []).map(member => {
        const character = catalog.chars.get(member.charId);
        if (!character || ![0, 1].includes(member.mergeLevel)) throw new Error('干员配置无效');
        return {
          ...reference(catalog.chars, member.charId),
          mergeLevel: member.mergeLevel,
          skill: optionalReference(character.skills, 'skillId', member.skillId),
          module: optionalReference(character.modules, 'moduleId', member.moduleId),
        };
      });
      return {
        tabType, startRound, endRound, members,
        equipment: (tab.recItems ?? []).map(item => reference(catalog.items, item.itemId)),
        coreBonds: (tab.activeBonds?.seasonBondIds ?? []).map(id => reference(catalog.bonds, id)),
        additionalBonds: (tab.activeBonds?.regularBondIds ?? []).map(id => reference(catalog.bonds, id)),
        operationIdea: tab.operationIdea ?? '',
      };
    });
    const editedAt = timestamp(guide.latestEditAtTs);
    const strategies = (guide.strategyIds ?? []).map(id => reference(catalog.strategies, id));
    const applicableScope = guide.applicableScope ?? '';
    if (typeof applicableScope !== 'string' || strategies.length > 64 || stages.some(stage =>
      typeof stage.operationIdea !== 'string' ||
      [stage.members, stage.equipment, stage.coreBonds, stage.additionalBonds].some(list => list.length > 64))) {
      throw new Error('阵容字段超出支持范围');
    }
    return {
      id: 'skland-' + guide.guideId,
      name: guide.title,
      slots: (stages.find(stage => stage.tabType === 1)?.members ?? []).map(member => ({
        operatorName: member.name, transformedCovenant: '', equipments: [], coreEquipments: [], tags: [],
      })),
      earlySlots: [], midSlots: [], supportSlots: [],
      strategies: strategies.map(strategy => ({ strategyId: strategy.id, tags: [] })),
      skland: {
        schemaVersion: 1, guideId: guide.guideId, seasonId, versionId, phase,
        phaseName: catalog.phaseName, revision: guide.version, editedAt, author: wrapper.poster.nickname,
        applicableScope, strategies, stages,
      },
      createdAt: timestamp(guide.publishAtTs),
      updatedAt: editedAt,
    };
  }

  async function loadPage(query, pageToken, signal) {
    const params = new URLSearchParams({ source: 'COMMUNITY', sortType: query.sort, seasonId, pageSize: '10', pageToken });
    if (query.title) params.set('titleKeyword', query.title);
    if (query.core) params.set('seasonBondId', query.core);
    if (query.strategy) params.set('strategyId', query.strategy);
    for (const id of query.extra) params.append('regularBondIds', id);
    const [page, catalog] = await Promise.all([read('index?' + params, signal), loadResources()]);
    if (!Array.isArray(page.list) || typeof page.hasMore !== 'boolean' ||
        (page.hasMore && (typeof page.pageToken !== 'string' || !page.pageToken))) {
      throw new Error('森空岛返回的分页资料不完整');
    }
    const lineups = [];
    const byline = new Map();
    let skipped = 0;
    for (const entry of page.list) {
      try {
        const lineup = normalize(entry, catalog);
        if (!lineup) {
          skipped++;
          continue;
        }
        lineups.push(lineup);
        byline.set(lineup.id, presentation(entry));
      } catch {
        // One unsupported entry should not prevent the other results from opening.
        skipped++;
      }
    }
    return { lineups, byline, chars: catalog.chars, skipped, next: page.hasMore ? page.pageToken : null };
  }

  function presentation(entry) {
    return { avatar: entry.poster.avatar, collected: entry.rts?.collected, liked: entry.rts?.liked };
  }

  async function loadDetail(id, signal) {
    const params = new URLSearchParams({ guideId: id, hostNeedEditing: 'true' });
    const [data, catalog] = await Promise.all([read('info?' + params, signal), loadResources()]);
    const lineup = normalize(data.guide, catalog);
    if (!lineup || lineup.skland.guideId !== id) throw new Error('此阵容的详情不再适用当前序列');
    return { lineup, chars: catalog.chars, meta: presentation(data.guide) };
  }

  window.strongholdSklandFeed = { isCurrent, loadPage, loadDetail };
})();
