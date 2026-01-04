import { json, requireApiKey, trello } from "./_lib.js";

function normalizeCard(card, listNameById) {
  const due = card.due ? new Date(card.due) : null;
  const now = new Date();
  const isOverdue = !!due && due < now && !card.dueComplete;

  return {
    id: card.id,
    name: card.name,
    url: card.url,
    country: listNameById[card.idList] || "Unknown",
    due: card.due,
    dueComplete: !!card.dueComplete,
    isOverdue
  };
}

export default async function handler(req, res) {
  const auth = requireApiKey(req);
  if (!auth.ok) return json(res, auth.status, auth);

  const boardId = process.env.TRELLO_BOARD_ID;
  if (!boardId) return json(res, 500, { error: "SERVER_MISCONFIGURED", message: "Missing TRELLO_BOARD_ID" });

  try {
    // 1) Fetch lists on board (map id -> name)
    const lists = await trello(`/boards/${boardId}/lists`, { query: { fields: "name" } });
    const listNameById = {};
    for (const l of lists) listNameById[l.id] = l.name;

    // 2) Fetch open cards on board (only fields we need)
    const cards = await trello(`/boards/${boardId}/cards`, {
      query: { fields: "name,due,dueComplete,idList,url" }
    });

    const now = new Date();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);

    const start7 = new Date(startToday);
    const end7 = new Date(startToday);
    end7.setDate(end7.getDate() + 7);
    end7.setHours(23, 59, 59, 999);

    const normalized = cards.map(c => normalizeCard(c, listNameById));

    const overdue = normalized.filter(c => c.isOverdue);
    const dueToday = normalized.filter(c => {
      if (!c.due) return false;
      const d = new Date(c.due);
      return d >= startToday && d <= endToday && !c.dueComplete;
    });
    const next7Days = normalized.filter(c => {
      if (!c.due) return false;
      const d = new Date(c.due);
      return d > endToday && d <= end7 && !c.dueComplete;
    });

    // Sort: earliest due first
    const sortByDue = (a, b) => (a.due || "").localeCompare(b.due || "");
    overdue.sort(sortByDue);
    dueToday.sort(sortByDue);
    next7Days.sort(sortByDue);

    json(res, 200, { overdue, dueToday, next7Days, generatedAt: now.toISOString() });
  } catch (e) {
    json(res, e.status || 500, { error: "UPSTREAM_ERROR", message: e.message, details: e.data || null });
  }
}
