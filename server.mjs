#!/usr/bin/env node
/**
 * Haitham Zedan — MCP server.
 *
 * Zero dependencies. Implements JSON-RPC 2.0 over two transports:
 *   stdio            node server.mjs
 *   streamable HTTP  node server.mjs --http --port 8787
 *
 * Data comes from ../api/*.json — the same files the website serves,
 * so the agent-facing tools and the human-facing page can never disagree.
 */

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(root, "api", f), "utf8"));

const DATA = {
  profile: load("profile.json"),
  experience: load("experience.json"),
  projects: load("projects.json"),
  skills: load("skills.json"),
  education: load("education.json"),
};

const SERVER_INFO = { name: "haitham-zedan", version: "1.0.0" };
const PROTOCOL_VERSION = "2025-06-18";

/* ------------------------------------------------------------------ tools */

const TOOLS = [
  {
    name: "get_profile",
    description:
      "Identity, professional summary, location, languages, contact details and current availability for Haitham Zedan. Start here.",
    inputSchema: {
      type: "object",
      properties: {
        lang: { type: "string", enum: ["en", "ar"], description: "Language for prose fields. Default en." },
      },
    },
  },
  {
    name: "get_experience",
    description:
      "Employment history: roles, employers, dates, responsibilities and the stack used in each. Use for questions about seniority, tenure, or where he has worked.",
    inputSchema: {
      type: "object",
      properties: {
        lang: { type: "string", enum: ["en", "ar"] },
        current_only: { type: "boolean", description: "Return only roles held right now." },
      },
    },
  },
  {
    name: "list_projects",
    description:
      "Shipped products with a one-line summary each. Use to find out what he has actually built and released, then call get_project for detail.",
    inputSchema: { type: "object", properties: { lang: { type: "string", enum: ["en", "ar"] } } },
  },
  {
    name: "get_project",
    description:
      "Full detail on one project: the problem it solved, engineering highlights, and stack. Ids: gas-express, rento-car, receipt-scanner.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Project id, e.g. receipt-scanner" },
        lang: { type: "string", enum: ["en", "ar"] },
      },
      required: ["id"],
    },
  },
  {
    name: "get_skills",
    description: "Technical skills grouped by area, plus professional certifications with issuers and dates.",
    inputSchema: {
      type: "object",
      properties: { group: { type: "string", description: "Optional group id: backend, databases, realtime, devops, other." } },
    },
  },
  {
    name: "search",
    description:
      "Free-text search across the whole profile — experience, projects, skills, education. Use when asked whether he has experience with a specific technology or domain.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Term to look for, e.g. 'Redis', 'fraud', 'multi-tenant'." } },
      required: ["query"],
    },
  },
];

const pick = (field, lang) => (field && typeof field === "object" && !Array.isArray(field) ? field[lang] ?? field.en : field);

function callTool(name, args = {}) {
  const lang = args.lang === "ar" ? "ar" : "en";

  switch (name) {
    case "get_profile": {
      const p = DATA.profile;
      return {
        name: pick(p.name, lang),
        headline: pick(p.headline, lang),
        summary: pick(p.summary, lang),
        location: p.location,
        languages: p.languages,
        contact: p.contact,
        availability: p.availability,
      };
    }

    case "get_experience": {
      let items = DATA.experience.items;
      if (args.current_only) items = items.filter((j) => j.current);
      return {
        total_years: DATA.experience.total_years,
        items: items.map((j) => ({
          title: pick(j.title, lang),
          company: j.company,
          company_url: j.company_url,
          clients: j.clients,
          location: j.location,
          arrangement: j.arrangement,
          start: j.start,
          end: j.end,
          current: j.current,
          highlights: pick(j.highlights, lang),
          stack: j.stack,
        })),
      };
    }

    case "list_projects":
      return {
        items: DATA.projects.items.map((p) => ({
          id: p.id,
          name: p.name,
          tagline: pick(p.tagline, lang),
          role: p.role,
          status: p.status,
          stack: p.stack,
        })),
      };

    case "get_project": {
      const p = DATA.projects.items.find((x) => x.id === args.id);
      if (!p) {
        const ids = DATA.projects.items.map((x) => x.id).join(", ");
        throw new Error(`No project with id "${args.id}". Available ids: ${ids}`);
      }
      return {
        id: p.id,
        name: p.name,
        tagline: pick(p.tagline, lang),
        role: p.role,
        client: p.client,
        client_url: p.client_url,
        collaborators: p.collaborators,
        status: p.status,
        links: p.links,
        note: p.note,
        problem: pick(p.problem, lang),
        highlights: pick(p.highlights, lang),
        stack: p.stack,
      };
    }

    case "get_skills": {
      if (args.group) {
        const g = DATA.skills.groups.find((x) => x.id === args.group);
        if (!g) throw new Error(`No skill group "${args.group}". Available: ${DATA.skills.groups.map((x) => x.id).join(", ")}`);
        return { group: g.id, label: pick(g.label, lang), items: g.items };
      }
      return { groups: DATA.skills.groups, certifications: DATA.skills.certifications };
    }

    case "search": {
      const q = String(args.query || "").toLowerCase().trim();
      if (!q) throw new Error("query is required and cannot be empty");
      const hits = [];
      const walk = (node, path) => {
        if (typeof node === "string") {
          if (node.toLowerCase().includes(q)) hits.push({ path, text: node });
        } else if (Array.isArray(node)) {
          node.forEach((v, i) => walk(v, `${path}[${i}]`));
        } else if (node && typeof node === "object") {
          for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
        }
      };
      for (const [section, node] of Object.entries(DATA)) walk(node, section);
      return {
        query: args.query,
        match_count: hits.length,
        matches: hits.slice(0, 25),
        note: hits.length === 0 ? "No match. Absence here means it is not listed in the profile, not that he cannot do it — ask him directly." : undefined,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/* ------------------------------------------------------------ jsonrpc core */

function handle(msg) {
  const { id, method, params } = msg;
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const err = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

  try {
    switch (method) {
      case "initialize":
        return ok({
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            "This server answers questions about Haitham Zedan, a backend engineer. Call get_profile for an overview, list_projects then get_project for what he has built, and search to check for a specific technology.",
        });

      case "notifications/initialized":
      case "notifications/cancelled":
        return null; // notifications get no response

      case "ping":
        return ok({});

      case "tools/list":
        return ok({ tools: TOOLS });

      case "tools/call": {
        const { name, arguments: args } = params ?? {};
        try {
          const result = callTool(name, args);
          return ok({
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            isError: false,
          });
        } catch (e) {
          // Tool errors go back as results, not protocol errors, so the model can recover.
          return ok({ content: [{ type: "text", text: e.message }], isError: true });
        }
      }

      default:
        return err(-32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return err(-32603, e.message);
  }
}

/* ---------------------------------------------------------------- stdio */

function runStdio() {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
        continue;
      }
      const res = handle(msg);
      if (res) process.stdout.write(JSON.stringify(res) + "\n");
    }
  });
  process.stderr.write("haitham-zedan MCP server ready on stdio\n");
}

/* ------------------------------------------------------------------ http */

function runHttp(port) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, MCP-Protocol-Version",
  };

  createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS).end();
      return;
    }

    if (req.method === "GET") {
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ...SERVER_INFO, protocolVersion: PROTOCOL_VERSION, transport: "streamable-http", tools: TOOLS.map((t) => t.name) }, null, 2));
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, CORS).end();
      return;
    }

    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let msg;
      try {
        msg = JSON.parse(body);
      } catch {
        res.writeHead(400, { ...CORS, "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
        return;
      }

      const out = Array.isArray(msg) ? msg.map(handle).filter(Boolean) : handle(msg);
      if (!out || (Array.isArray(out) && out.length === 0)) {
        res.writeHead(202, CORS).end();
        return;
      }
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify(out));
    });
  }).listen(port, () => {
    process.stderr.write(`haitham-zedan MCP server on http://127.0.0.1:${port}\n`);
  });
}

const args = process.argv.slice(2);
if (args.includes("--http")) {
  const i = args.indexOf("--port");
  runHttp(i !== -1 ? Number(args[i + 1]) : 8787);
} else {
  runStdio();
}
