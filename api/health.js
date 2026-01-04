import { json } from "./_lib.js";

export default async function handler(req, res) {
  json(res, 200, { ok: true, service: "trello-sales-proxy" });
}
