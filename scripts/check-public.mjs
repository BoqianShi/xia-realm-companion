import { execFileSync } from "node:child_process";
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const failures = [];
const forbiddenPath = /(^|\/)(\.env[^/]*|\.openai|\.local-content|private-content|outputs|backups|\.wrangler|node_modules|dist|data)(\/|$)|^public\/modules\/|\.(pdf|docx?|xlsx|zip|sqlite\w*|db)$/i;
const secrets = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, /\bgithub_pat_[A-Za-z0-9_]{40,}\b/, /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/];
for (const file of files) {
  if (forbiddenPath.test(file) || file.startsWith("content/") && file !== "content/demo.json") {
    failures.push(`${file}: private/generated content path`); continue;
  }
  const data = execFileSync("git", ["show", `:${file}`], { maxBuffer: 8 * 1024 * 1024 });
  if (data.length > 2 * 1024 * 1024) failures.push(`${file}: unexpectedly large file`);
  const text = data.toString("utf8");
  if (secrets.some(pattern => pattern.test(text))) failures.push(`${file}: possible credential`);
  if (/\/Users\/[^/\s]+\//.test(text) || /boqians-apply\.chatgpt\.site/.test(text)) failures.push(`${file}: private path or deployment reference`);
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Public boundary checks passed for ${files.length} indexed files. Review rights and privacy separately.`);
