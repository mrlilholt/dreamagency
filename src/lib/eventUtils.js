const toNumber = (value) => {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeKey = (value) => {
  if (!value) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
};

export const parseEventDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") {
    return value.toDate();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isEventActive = (event, now = new Date()) => {
  if (!event) return false;
  if (event.enabled === false) return false;
  const start = parseEventDate(event.startAt || event.startDate || event.startsAt);
  const end = parseEventDate(event.endAt || event.endDate || event.endsAt);
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

export const eventAppliesToClass = (event, classId, orgId) => {
  if (!event) return false;
  if (orgId && event.orgId && event.orgId !== orgId) return false;
  const scope = event.scope || event.classScope || (event.classId === "all" ? "all" : null);
  const normalizedScope = normalizeKey(scope);
  if (normalizedScope === "all" || normalizedScope === "all_classes" || normalizedScope === "all_class") {
    return true;
  }
  if (event.classId && event.classId !== "all") return event.classId === classId;
  const classIds = event.classIds || event.classes || event.allowedClasses;
  if (Array.isArray(classIds) && classIds.length) {
    return classIds.includes(classId);
  }
  return !scope && !event.classId && !classIds;
};

export const getActiveEventsForClass = (events, classId, orgId) => {
  if (!Array.isArray(events)) return [];
  return events.filter(
    (event) => isEventActive(event) && eventAppliesToClass(event, classId, orgId)
  );
};

export const getActiveEventsForClasses = (events, classIds, orgId) => {
  if (!Array.isArray(events)) return [];
  const classList = Array.isArray(classIds) ? classIds : classIds ? [classIds] : [];
  return events.filter((event) => {
    if (!isEventActive(event)) return false;
    if (classList.length === 0) return eventAppliesToClass(event, "all", orgId);
    return classList.some((classId) => eventAppliesToClass(event, classId, orgId));
  });
};

export const eventAppliesToType = (event, eventType) => {
  if (!event) return false;
  const appliesToRaw = Array.isArray(event.appliesToTypes)
    ? event.appliesToTypes
    : event.appliesTo
      ? [event.appliesTo]
      : event.targetType
        ? [event.targetType]
        : [];
  const normalizedList = appliesToRaw
    .map((value) => normalizeKey(value))
    .filter(Boolean);
  if (normalizedList.length === 0) return true;
  if (normalizedList.includes("all_submissions") || normalizedList.includes("all") || normalizedList.includes("all_items")) {
    return true;
  }
  if (!eventType) return false;
  if (normalizedList.includes("contract_stage") || normalizedList.includes("contract")) {
    return eventType === "contract_stage";
  }
  if (normalizedList.includes("side_hustle") || normalizedList.includes("side_hustles")) {
    return eventType === "side_hustle";
  }
  if (normalizedList.includes("mission") || normalizedList.includes("missions")) {
    return eventType === "mission";
  }
  return false;
};

export const getOneTimeEvents = (events) => {
  if (!Array.isArray(events)) return [];
  return events.filter((event) => event?.oneTimePerUser);
};

export const filterEventsByClaims = (events, claimedEventIds) => {
  if (!Array.isArray(events)) return [];
  const claimedSet = claimedEventIds instanceof Set
    ? claimedEventIds
    : new Set(Array.isArray(claimedEventIds) ? claimedEventIds : []);
  return events.filter((event) => !event?.oneTimePerUser || !claimedSet.has(event.id));
};

export const applyEventRewards = ({ baseXp, baseCurrency, events, eventType }) => {
  const activeEvents = Array.isArray(events) ? events : [];
  const appliedEvents = activeEvents.filter((event) => eventAppliesToType(event, eventType));
  const startingXp = toNumber(baseXp);
  const startingCurrency = toNumber(baseCurrency);

  let xpPercent = 0;
  let currencyPercent = 0;
  let flatCurrency = 0;
  let randomCurrency = 0;

  appliedEvents.forEach((event) => {
    xpPercent += toNumber(event.xpMultiplierPercent);
    currencyPercent += toNumber(event.currencyMultiplierPercent);
    flatCurrency += toNumber(event.flatCurrencyBonus);

    const min = toNumber(event.randomCurrencyBonusMin ?? event.randomCurrencyMin);
    const max = toNumber(event.randomCurrencyBonusMax ?? event.randomCurrencyMax ?? min);
    if (min > 0 || max > 0) {
      const low = Math.min(min, max);
      const high = Math.max(min, max);
      randomCurrency += Math.floor(Math.random() * (high - low + 1)) + low;
    }
  });

  const xpWithMultiplier = Math.ceil(startingXp * (1 + xpPercent / 100));
  const currencyWithMultiplier = Math.ceil(startingCurrency * (1 + currencyPercent / 100));
  const finalCurrency = currencyWithMultiplier + flatCurrency + randomCurrency;

  return {
    xp: xpWithMultiplier,
    currency: finalCurrency,
    bonus: {
      xp: Math.max(0, xpWithMultiplier - startingXp),
      currency: Math.max(0, finalCurrency - startingCurrency),
      xpPercent,
      currencyPercent,
      flatCurrency,
      randomCurrency
    },
    appliedEvents
  };
};

export const formatEventBonusMessage = ({ bonus, events }) => {
  if (!bonus) return null;
  const parts = [];
  if (bonus.xp > 0) parts.push(`+${bonus.xp} XP`);
  if (bonus.currency > 0) parts.push(`+$${bonus.currency}`);
  if (parts.length === 0) return null;

  const titles = (events || []).map((event) => event.title).filter(Boolean);
  const suffix = titles.length ? ` (${titles.join(", ")})` : "";
  return `Special Event Bonus${suffix}: ${parts.join(" and ")}`;
};
