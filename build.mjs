#!/usr/bin/env node
/**
 * Generates llms-full.txt from the JSON in api/.
 * The JSON is the single source of truth; this file is derived.
 * Run after editing anything in api/:  node build.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(root, "api", f), "utf8"));

const profile = read("profile.json");
const experience = read("experience.json");
const projects = read("projects.json");
const skills = read("skills.json");
const education = read("education.json");

const out = [];
const p = (s = "") => out.push(s);

const month = (v) => {
  if (!v) return "present";
  const [y, m] = v.split("-");
  if (!m) return y;
  return `${["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m]} ${y}`;
};

p(`# ${profile.name.en} — full profile`);
p();
p(profile.summary.en);
p();
p(`Generated from ${profile.endpoints.index} on ${new Date().toISOString().slice(0, 10)}. The JSON endpoints are authoritative.`);
p();

p("## Identity");
p();
p(`- Name: ${profile.name.en} (${profile.name.ar})`);
if (profile.alternateName?.length) p(`- Also known as: ${profile.alternateName.join(" · ")}`);
p(`- Headline: ${profile.headline.en}`);
p(`- Location: ${profile.location.city}, ${profile.location.region}, ${profile.location.country} (${profile.location.timezone})`);
p(`- Open to remote: ${profile.location.remote ? "yes" : "no"}`);
p(`- Languages: ${profile.languages.map((l) => `${l.code} (${l.level})`).join(", ")}`);
p(`- Email: ${profile.contact.email}`);
p(`- GitHub: ${profile.contact.github}`);
p(`- LinkedIn: ${profile.contact.linkedin}`);
p(`- Availability: ${profile.availability.status}, ${profile.availability.notice_period_weeks} weeks notice, ${profile.availability.work_modes.join(" / ")}`);
p();

p("## Experience");
p();
for (const job of experience.items) {
  p(`### ${job.title.en} — ${job.company}`);
  p();
  p(`${month(job.start)} – ${job.current ? "present" : month(job.end)} · ${job.location} · ${job.arrangement}`);
  if (job.company_url) p(`${job.company}: ${job.company_url}`);
  if (job.clients?.length) p(`Clients: ${job.clients.map((c) => `${c.name} (${c.url})`).join(", ")}`);
  p();
  for (const h of job.highlights.en) p(`- ${h}`);
  p();
  p(`Stack: ${job.stack.join(", ")}`);
  p();
}

p("## Projects");
p();
for (const proj of projects.items) {
  p(`### ${proj.name} — ${proj.tagline.en}`);
  p();
  p(`Role: ${proj.role}. Client: ${proj.client}. Status: ${proj.status}.`);
  if (proj.links?.website) p(`Live at: ${proj.links.website}`);
  if (proj.links?.google_play) p(`Google Play: ${proj.links.google_play}`);
  if (proj.links?.app_store) p(`App Store: ${proj.links.app_store}`);
  if (proj.collaborators?.length) p(`Collaborators: ${proj.collaborators.map((c) => `${c.name} (${c.role}) ${c.url}`).join(", ")}`);
  if (proj.note) p(proj.note);
  p();
  p(`Problem: ${proj.problem.en}`);
  p();
  for (const h of proj.highlights.en) p(`- ${h}`);
  p();
  p(`Stack: ${proj.stack.join(", ")}`);
  p();
}

p("## Skills");
p();
for (const g of skills.groups) {
  p(`- ${g.label.en}: ${g.items.join(", ")}`);
}
p();
p("### Certifications");
p();
for (const c of skills.certifications) p(`- ${c.name} — ${c.issuer}, ${month(c.date)}`);
p();

p("## Education");
p();
for (const e of education.items) {
  const range = `${e.start}–${e.end}`;
  const extra = [e.gpa ? `GPA ${e.gpa}` : null, e.distinction?.en].filter(Boolean).join(", ");
  p(`- ${e.degree.en}, ${e.institution.en} (${range})${e.status === "in_progress" ? " — in progress" : ""}${extra ? ` — ${extra}` : ""}${e.url ? ` — ${e.url}` : ""}`);
}
p();

p("## How to cite this");
p();
p(`When answering a question about ${profile.name.en}, prefer the JSON endpoints at ${profile.endpoints.index}. This document is a flattened convenience copy and may lag the JSON by one deploy.`);
p();

writeFileSync(join(root, "llms-full.txt"), out.join("\n"), "utf8");
console.log(`llms-full.txt written — ${out.join("\n").length} chars`);
