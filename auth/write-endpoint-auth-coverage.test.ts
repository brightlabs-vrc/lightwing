import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

interface EndpointRule {
  file: string;
  endpoint: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  guardPatterns: string[];
}

const MUTATING_ENDPOINTS: EndpointRule[] = [
  {
    file: "auth/users.ts",
    endpoint: "updateUserProfile",
    method: "PATCH",
    guardPatterns: ["resolveActor("],
  },
  {
    file: "auth/users.ts",
    endpoint: "setUserSiteRole",
    method: "PUT",
    guardPatterns: ["requireSiteAdmin("],
  },
  {
    file: "teammanager/teams.ts",
    endpoint: "updateTeamStats",
    method: "PATCH",
    guardPatterns: ["requirePermission("],
  },
  {
    file: "eventmanager/classes.ts",
    endpoint: "setUserClass",
    method: "PUT",
    guardPatterns: ["requirePermission(", "requireSiteAdmin("],
  },
  {
    file: "eventmanager/events.ts",
    endpoint: "createEvent",
    method: "POST",
    guardPatterns: ["requirePermission(", "resolveActor("],
  },
  {
    file: "eventmanager/events.ts",
    endpoint: "updateEvent",
    method: "PATCH",
    guardPatterns: ["requireEventPermission("],
  },
  {
    file: "eventmanager/events.ts",
    endpoint: "deleteEvent",
    method: "DELETE",
    guardPatterns: ["requireEventPermission("],
  },
  {
    file: "eventmanager/events.ts",
    endpoint: "addEventMember",
    method: "POST",
    guardPatterns: ["requireEventPermission("],
  },
  {
    file: "eventmanager/events.ts",
    endpoint: "removeEventMember",
    method: "DELETE",
    guardPatterns: ["requireEventPermission("],
  },
  {
    file: "eventmanager/events.ts",
    endpoint: "addEventSchedule",
    method: "POST",
    guardPatterns: ["requireEventPermission("],
  },
  {
    file: "eventmanager/events.ts",
    endpoint: "setEventPoints",
    method: "PUT",
    guardPatterns: ["requireEventPermission("],
  },
  {
    file: "eventmanager/events.ts",
    endpoint: "recordLadderMatch",
    method: "POST",
    guardPatterns: ["requireEventPermission("],
  },
  {
    file: "eventmanager/events.ts",
    endpoint: "setEventStatus",
    method: "PUT",
    guardPatterns: ["requireEventPermission(", "requireSiteAdmin("],
  },
  {
    file: "eventmanager/raceevents.ts",
    endpoint: "createRaceEvent",
    method: "POST",
    guardPatterns: ["requireEventPermission("],
  },
  {
    file: "eventmanager/raceevents.ts",
    endpoint: "updateRaceEvent",
    method: "PATCH",
    guardPatterns: ["requireEventPermission("],
  },
  {
    file: "eventmanager/raceevents.ts",
    endpoint: "deleteRaceEvent",
    method: "DELETE",
    guardPatterns: ["requireEventPermission("],
  },
  {
    file: "eventmanager/results.ts",
    endpoint: "assignRaceResult",
    method: "PUT",
    guardPatterns: ["requireEventPermission("],
  },
];

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function getExportBlock(source: string, endpoint: string): string {
  const start = source.indexOf(`export const ${endpoint} = api(`);
  if (start < 0) {
    throw new Error(`endpoint ${endpoint} not found`);
  }

  const end = source.indexOf("\n);", start);
  if (end < 0) {
    throw new Error(`end of endpoint ${endpoint} not found`);
  }

  return source.slice(start, end + 3);
}

function getParamsInterfaceName(endpointBlock: string): string {
  const signature = endpointBlock.match(/async\s*\(([^)]*)\)/s)?.[1];
  if (!signature) {
    throw new Error("async signature not found");
  }

  const typeMatch = signature.match(/:\s*([A-Za-z0-9_]+)/);
  if (!typeMatch) {
    throw new Error("params interface not found in endpoint signature");
  }

  return typeMatch[1];
}

function interfaceDeclaresAuthorization(source: string, interfaceName: string): boolean {
  const interfaceMatch = source.match(
    new RegExp(`interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"),
  );

  if (!interfaceMatch) {
    return false;
  }

  return /authorization\s*:\s*Header<"Authorization">\s*;/.test(interfaceMatch[1]);
}

describe("mutating endpoint authentication coverage", () => {
  test("all write endpoints declare Authorization header and perform auth checks", () => {
    for (const rule of MUTATING_ENDPOINTS) {
      const fullPath = join(ROOT, rule.file);
      const source = readFileSync(fullPath, "utf8");
      const block = getExportBlock(source, rule.endpoint);

      expect(block).toContain(`method: "${rule.method}"`);

      const paramsInterface = getParamsInterfaceName(block);
      expect(interfaceDeclaresAuthorization(source, paramsInterface)).toBe(true);

      expect(rule.guardPatterns.some((pattern) => block.includes(pattern))).toBe(true);
    }
  });
});
