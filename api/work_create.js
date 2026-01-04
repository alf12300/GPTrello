import { json, requireApiKey, trello } from "./_lib.js";

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


const SYNONYMS = {
  "us": "United States",
  "usa": "United States",
  "u.s.": "United States",
  "united states of america": "United States",
  "brasil": "Brazil"
};

// Checklist templates (edit freely)
const CHECKLIST_TEMPLATES = {
  // SALES / COMMERCIAL
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
    "Confirm renewal scope (products/services, term, start date)",
    "Review usage/performance + value delivered",
    "Check current pricing and renewal uplift guidelines",
    "Identify risks (competition, budget, satisfaction)",
    "Prepare renewal offer and terms",
    "Send renewal proposal + confirm receipt",
    "Schedule renewal call and next follow-up"
  ],
  negotiation: [
    "Clarify decision criteria and stakeholders",
    "Confirm current offer and walk-away points",
    "Prepare concessions strategy (give/get)",
    "Align internally before customer call",
    "Run negotiation meeting and capture commitments",
    "Send recap email with agreed next steps",
    "Update forecast and follow-up date"
  ],
  lead_qualification: [
    "Confirm need/problem statement",
    "Identify stakeholders and decision process",
    "Confirm budget range and timing",
    "Validate technical/operational fit",
    "Agree next step (demo/quote/visit)",
    "Send recap + required info request",
    "Set follow-up date"
  ],

  // AFTER-SALES / SUPPORT
  after_sales_ticket: [
    "Acknowledge receipt + confirm SLA",
    "Collect evidence (photos/logs/serial)",
    "Reproduce issue internally",
    "Decide action (replace/repair/remote)",
    "Update customer with plan + timeline",
    "Close loop + confirm satisfaction"
  ],
  rma_return: [
    "Confirm product details (serial/lot) and issue summary",
    "Validate warranty/return eligibility",
    "Issue RMA number + return instructions",
    "Arrange pickup/shipping label (if applicable)",
    "Notify warehouse/service team and expected arrival",
    "Track receipt and diagnostics",
    "Communicate outcome (repair/replace/credit) and close"
  ],
  escalation: [
    "Acknowledge escalation and owner assigned",
    "Collect all context (timeline, evidence, impact)",
    "Define immediate containment action",
    "Engage internal teams (engineering/ops/QA)",
    "Provide customer update with ETA",
    "Confirm resolution and prevention actions",
    "Document final summary and close"
  ],

  // INFORMATION / DOCUMENTS
  info_to_send: [
    "Gather requested documents",
    "Verify latest version",
    "Draft email response",
    "Attach/link documents",
    "Send + request confirmation"
  ],
  compliance_docs: [
    "Confirm required document list and destination requirements",
    "Collect latest certificates (CoC, MSDS, RoHS/REACH, etc.)",
    "Verify validity dates and version control",
    "Package documents in a single shareable link/folder",
    "Send to customer + confirm acceptance",
    "Log what was sent and where stored"
  ],

  // PROJECTS / IMPLEMENTATION
  project_rollout: [
    "Define scope + success criteria",
    "Stakeholders + communication channel",
    "Timeline + milestones",
    "Dependencies / risks",
    "Kickoff scheduled",
    "Weekly update cadence"
  ],
  onboarding: [
    "Confirm onboarding goals and success metrics",
    "Collect required inputs (access, data, contacts)",
    "Schedule kickoff and training sessions",
    "Deliver setup/configuration steps",
    "Validate first successful outcome",
    "Provide customer documentation and support path",
    "Schedule 30-day check-in"
  ],

  // MEETINGS (internal or customer)
  meeting_customer: [
    "Confirm meeting objective and desired outcome",
    "Confirm attendees and roles (customer + internal)",
    "Prepare agenda and timeboxes",
    "Collect latest context (open items, last email, quote, ticket)",
    "Bring required materials (pricing, slides, docs)",
    "Run meeting and capture decisions + action items",
    "Send recap email with owners + deadlines"
  ],
  meeting_internal: [
    "Define decision needed and success criteria",
    "Invite required stakeholders",
    "Prepare agenda + pre-read",
    "Gather key data (pipeline, issues, blockers)",
    "Run meeting and capture actions",
    "Publish notes and assign owners",
    "Schedule follow-up if needed"
  ],

  // TRAVEL / TRIPS / ONSITE
  business_trip: [
    "Confirm trip purpose and success outcomes",
    "Lock meetings/agenda (who/where/when)",
    "Book travel (flight/train) and lodging",
    "Prepare travel logistics (transfers, local contact, visas if needed)",
    "Prepare customer materials (samples, docs, deck)",
    "During trip: capture notes and action items after each meeting",
    "After trip: send recaps, update Trello, and schedule follow-ups"
  ],
  onsite_visit: [
    "Confirm onsite objectives and scope",
    "Confirm site access requirements and safety rules",
    "Schedule onsite agenda and attendees",
    "Prepare materials/tools (samples, PPE, docs, laptop access)",
    "Conduct onsite visit and document findings",
    "Agree corrective actions / next steps on-site",
    "Send visit report + owners + deadlines"
  ],
  trade_show: [
    "Confirm event goals (leads, meetings, partners)",
    "Register badges and book travel/hotel",
    "Prepare booth materials (collateral, demos, samples)",
    "Pre-schedule key meetings and outreach",
    "During event: capture leads with notes and next step",
    "Post-event: follow up within 48 hours",
    "Qualify leads and create opportunities/tasks"
  ],

  // OPERATIONS / LOGISTICS (useful for international sales)
  shipment_followup: [
    "Confirm PO/order details and promised ship date",
    "Check production/stock status",
    "Confirm shipping method and Incoterms",
    "Request tracking / AWB / BOL",
    "Inform customer with tracking and ETA",
    "Monitor delivery and exceptions",
    "Confirm receipt and close loop"
  ],
  payment_collection: [
    "Confirm invoice number, amount, and due date",
    "Check if PO/receiving is blocking payment",
    "Send polite payment reminder with payment details",
    "Escalate internally if past due threshold reached",
    "Agree payment date/plan with customer",
    "Confirm payment received",
    "Update account status and close"
  ],

  // ADMIN / MISC
  follow_up: [
    "Review last interaction and open questions",
    "Draft follow-up message with clear ask",
    "Send follow-up and confirm delivery/receipt",
    "Set next follow-up date",
    "Update card with outcome"
  ],
  task_internal: [
    "Clarify objective and definition of done",
    "Identify dependencies/inputs needed",
    "Estimate effort and target date",
    "Execute task",
    "Document result/decision",
    "Notify relevant stakeholders",
    "Close or schedule next step"
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
      const checklistTemplate = input.checklistTemplate || autoTemplateFromTitle(title) || null;

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
