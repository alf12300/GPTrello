import { json, requireApiKey, trello } from "./_lib.js";

/* -------------------------
   AUTO TEMPLATE SELECTION
-------------------------- */
function autoTemplateFromTitle(title = "") {
  const t = title.toLowerCase();

  if (/(trip|travel|flight|hotel|onsite|on-site|visit)/.test(t)) return "business_trip";
  if (/(trade show|exhibition|expo|booth)/.test(t)) return "trade_show";
  if (/(meeting|call|demo|workshop)/.test(t) && /(internal|team|ops|finance)/.test(t)) return "meeting_internal";
  if (/(meeting|call|demo|workshop)/.test(t)) return "meeting_customer";

  if (/(renewal|extend|extension)/.test(t)) return "renewal";
  if (/(negotiate|negotiation|counteroffer)/.test(t)) return "negotiation";
  if (/(quote|quotation|pricing|price)/.test(t)) return "quote_standard";

  if (/(rma|return|refund|replace|replacement)/.test(t)) return "rma_return";
  if (/(escalation|urgent|critical)/.test(t)) return "escalation";
  if (/(ticket|issue|problem|bug|failure)/.test(t)) return "after_sales_ticket";

  if (/(compliance|certificate|coc|msds|rohs|reach)/.test(t)) return "compliance_docs";
  if (/(document|docs|datasheet|spec|information)/.test(t)) return "info_to_send";

  if (/(rollout|implementation|onboarding|go-live|deploy)/.test(t)) return "project_rollout";

  if (/(shipment|shipping|awb|tracking|delivery)/.test(t)) return "shipment_followup";
  if (/(payment|invoice|past due|overdue|collection)/.test(t)) return "payment_collection";

  if (/(follow up|follow-up)/.test(t)) return "follow_up";

  return "task_internal";
}

/* -------------------------
   COUNTRY NORMALIZATION
-------------------------- */
const SYNONYMS = {
  us: "United States",
  usa: "United States",
  "u.s.": "United States",
  "united states of america": "United States",
  brasil: "Brazil"
};

function canonicalizeCountry(country) {
  const raw = (country || "").trim();
  return SYNONYMS[raw.toLowerCase()] || raw;
}

/* -------------------------
   CHECKLIST TEMPLATES
-------------------------- */
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
  renewal: [
    "Confirm renewal scope and dates",
    "Review value delivered and usage",
    "Check pricing and uplift rules",
    "Identify renewal risks",
    "Prepare renewal proposal",
    "Send proposal and confirm receipt",
    "Schedule renewal follow-up"
  ],
  negotiation: [
    "Clarify decision criteria",
    "Prepare concessions strategy",
    "Align internally",
    "Run negotiation call",
    "Confirm commitments",
    "Send recap email",
    "Update forecast"
  ],
  after_sales_ticket: [
    "Acknowledge ticket and SLA",
    "Collect evidence",
    "Reproduce issue",
    "Define solution",
    "Update customer",
    "Confirm resolution"
  ],
  rma_return: [
    "Validate return eligibility",
    "Issue RMA",
    "Arrange shipment",
    "Track diagnostics",
    "Confirm outcome",
    "Close case"
  ],
  compliance_docs: [
    "Confirm required documents",
    "Collect certificates",
    "Verify versions",
    "Send documents",
    "Confirm acceptance"
  ],
  project_rollout: [
    "Define scope",
    "Assign stakeholders",
    "Define timeline",
    "Assess risks",
    "Kickoff meeting",
    "Weekly updates"
  ],
  meeting_customer: [
    "Confirm objective",
    "Prepare agenda",
    "Review context",
    "Run meeting",
    "Capture actions",
    "Send recap"
  ],
  meeting_internal: [
    "Define decision",
    "Invite stakeholders",
    "Prepare pre-read",
    "Run meeting",
    "Assign actions"
  ],
  business_trip: [
    "Confirm trip objectives",
    "Schedule meetings",
    "Book travel",
    "Prepare materials",
    "Capture notes",
    "Post-trip follow-ups"
  ],
  trade_show: [
    "Define event goals",
    "Register and book travel",
    "Prepare materials",
    "Capture leads",
    "Post-event follow-up"
  ],
  shipment_followup: [
    "Confirm shipment details",
    "Request tracking",
    "Notify customer",
    "Monitor delivery",
    "Confirm receipt"
  ],
  payment_collection: [
    "Confirm invoice details",
    "Send reminder",
    "Resolve blockers",
    "Confirm payment",
    "Close loop"
  ],
  follow_up: [
    "Review last contact",
    "Send follow-up",
    "Schedule next step"
  ],
  task_internal: [
    "Clarify task",
    "Execute work",
    "Document result",
    "Notify stakeholders"
  ]
};

/* -------------------------
   HANDLER
-------------------------- */
export default async function handler(req, res) {
  const auth = requireApiKey(req);
  if (!auth.ok) return json(res, auth.status, auth);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const boardId = process.env.TRELLO_BOARD_ID;
  if (!boardId) {
    return json(res, 500, { error: "SERVER_MISCONFIGURED", message: "Missing TRELLO_BOARD_ID" });
  }

  // Read JSON body safely
  let input;
  try {
    const raw = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
    input = raw ? JSON.parse(raw) : {};
  } catch {
    return json(res, 400, { error: "BAD_JSON", message: "Invalid JSON body" });
  }

  try {
    const country = canonicalizeCountry(input.country);
    const title = (input.title || "").trim();
    const description = (input.description || "").trim();
    const due = input.due || null;
    const checklistTemplate = input.checklistTemplate || autoTemplateFromTitle(title);

    if (!country) return json(res, 400, { error: "country is required" });
    if (!title) return json(res, 400, { error: "title is required" });

    const lists = await trello(`/boards/${boardId}/lists`, { query: { fields: "name" } });
    const list = lists.find(l => l.name.toLowerCase() === country.toLowerCase());

    if (!list) {
      return json(res, 400, {
        error: "COUNTRY_UNKNOWN",
        suggestions: lists.map(l => l.name)
      });
    }

    const card = await trello(`/cards`, {
      method: "POST",
      body: {
        idList: list.id,
        name: title,
        desc: description,
        due
      }
    });

    let checklist = null;
    const items = CHECKLIST_TEMPLATES[checklistTemplate];
    if (items && items.length) {
      checklist = await trello(`/cards/${card.id}/checklists`, {
        method: "POST",
        query: { name: "Checklist" }
      });

      for (const item of items) {
        await trello(`/checklists/${checklist.id}/checkItems`, {
          method: "POST",
          query: { name: item }
        });
      }
    }

    return json(res, 200, {
      id: card.id,
      name: card.name,
      url: card.url,
      country,
      due: card.due,
      checklist: checklist
        ? { id: checklist.id, name: checklist.name, template: checklistTemplate }
        : null
    });
  } catch (e) {
    return json(res, e.status || 500, {
      error: "UPSTREAM_ERROR",
      message: e.message,
      details: e.data || null
    });
  }
}
