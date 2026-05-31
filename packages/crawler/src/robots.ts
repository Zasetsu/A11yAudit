export interface RobotsRules {
  disallow: string[];
}

function stripComment(line: string): string {
  return line.split("#", 1)[0]?.trim() ?? "";
}

export function parseRobotsTxt(body: string): RobotsRules {
  const disallow: string[] = [];
  let groupAgents: string[] = [];
  let hasSeenRuleInGroup = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    if (!line) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (directive === "user-agent") {
      if (hasSeenRuleInGroup) {
        groupAgents = [];
        hasSeenRuleInGroup = false;
      }

      groupAgents.push(value.toLowerCase());
      continue;
    }

    if (directive === "disallow") {
      hasSeenRuleInGroup = true;
      if (groupAgents.includes("*") && value) {
        disallow.push(value);
      }
    }
  }

  return { disallow };
}

export function isAllowedByRobots(url: URL, rules: RobotsRules): boolean {
  return !rules.disallow.some((path) => url.pathname.startsWith(path));
}
