import { json, requireApiKey, trello } from "./_lib.js";

const SYNONYMS = {
  "us": "United States",
  "usa": "United States",
  "u.s.": "United States",
  "united states of america": "United States",
  "brasil": "Brazil"
};

// Checklist templates (edit freely)
const CHECKLIST_TEMPLATES = {
  quote_standard: [
    "Confirm requirements (SKU, qty, Incoterms, delivery date)",
    "Validate pricing tier / discounts",
    "Check stock / lead time",
    "Draft quote (PDF or formal format)",
    "Internal approval (if needed)",
    "Send quote + confirm receipt",
    "Set follow-up date"
  ],
  after_sales_ticket: [
    "Acknowledge receipt + confirm SLA",
    "Collect evidence (photos/logs/serial)",
    "Reproduce issue internally",
    "Decide action (replace/repair/remote)",
    "Update customer with plan + timeline",
    "Close loop + confirm satisfaction"
  ],
  info_to_send: [
    "Gather requested documents",
    "Verify latest version",
    "Draft email response",
    "Attach/link documents",
    "Send + request confirmation"
  ],
  project_rollout: [
    "Define scope + success criteria",
    "Stakeholders + communication channel",
    "Timeline + milestones",
    "Dependencies / risks",
    "Kickoff scheduled",
    "Weekly update cadence"
  ]
};

function canonicalizeCountry(country) {
  const raw = (country || "").trim();
  const key = raw.toLowerCase();
  return SYNONYMS[key] || raw;
}

export default async function handler(req, res) {
  const auth = requireApiKey(req);
  if (!auth.ok) return json(res, auth.status, auth);

  if (req.method !== "POST") return json(res, 405, { error: "METHOD_NOT_ALLOWED" });

  const boardId = process.env.TRELLO_BOARD_ID;
  if (!boardId) return json(res, 500, { error: "SERVER_MISCONFIGURED", message: "Missing TRELLO_BOARD_ID" });

  let payload = "";
  req.on("data", chunk => (payload += chunk));
  req.on("end", async () => {
    try {
      const input = payload ? JSON.parse(payload) : {};
      const country = canonicalizeCountry(input.country);
      const title = (input.title || "").trim();
      const description = (input.description || "").trim();
      const due = input.due || null;
      const checklistTemplate = input.checklistTemplate || null;

      if (!country) return json(res, 400, { error: "VALIDATION_ERROR", message: "country is required" });
      if (!title) return json(res, 400, { error: "VALIDATION_ERROR", message: "title is required" });

      // Find list by name on the board
      const lists = await trello(`/boards/${boardId}/lists`, { query: { fields: "name" } });
      const match = lists.find(l => l.name.toLowerCase() === country.toLowerCase());
      if (!match) {
        const suggestions = lists.map(l => l.name);
        return json(res, 400, { error: "COUNTRY_UNKNOWN", message: `No list named '${country}'`, suggestions });
      }

      // Create card
      const card = await trello(`/cards`, {
        method: "POST",
        body: {
          idList: match.id,
          name: title,
          desc: description,
          due
        }
      });

      // Optionally create checklist + items
      let checklist = null;
      if (checklistTemplate) {
        const items = CHECKLIST_TEMPLATES[checklistTemplate];
        if (!items) {
          return json(res, 400, {
            error: "TEMPLATE_UNKNOWN",
            message: `Unknown checklistTemplate '${checklistTemplate}'`,
            available: Object.keys(CHECKLIST_TEMPLATES)
          });
        }

        checklist = await trello(`/cards/${card.id}/checklists`, {
          method: "POST",
          query: { name: "Sales Checklist" }
        });

        for (const item of items) {
          await trello(`/checklists/${checklist.id}/checkItems`, {
            method: "POST",
            query: { name: item, pos: "bottom" }
          });
        }
      }

      json(res, 200, {
        id: card.id,
        name: card.name,
        url: card.url,
        country,
        due: card.due,
        checklist: checklist ? { id: checklist.id, name: checklist.name, template: checklistTemplate } : null
      });
    } catch (e) {
      json(res, e.status || 500, { error: "UPSTREAM_ERROR", message: e.message, details: e.data || null });
    }
  });
}
