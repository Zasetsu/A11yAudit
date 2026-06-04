import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, initializeDb, type DbClient } from "../db/client.js";
import { issues, projects, scanRuns, workspaces } from "../db/schema.js";
import { getBaselineIssues } from "./issues.js";

function issueFixture(
  overrides: Partial<typeof issues.$inferInsert> = {}
): typeof issues.$inferInsert {
  return {
    id: "issue-fixture",
    projectId: "P",
    scanRunId: "S1",
    issueKey: "k1",
    status: "new",
    title: "Image missing alternative text",
    severity: "serious",
    source: "axe",
    certainty: "automatic_violation",
    ruleId: "image-alt",
    wcagCriteria: "1.1.1",
    description: "Image elements must have alternate text.",
    recommendation: "Add alt text.",
    likelyScope: "single page",
    urlScopeGroup: "single page",
    componentArea: "content",
    cmsHint: "Unknown",
    confidence: "high",
    affectedPages: 1,
    occurrences: 1,
    viewportSummary: "desktop",
    representativeUrl: "https://fixture.example.com",
    representativeSelector: "img",
    representativeHtmlSnippet: "<img>",
    sampleUrls: JSON.stringify(["https://fixture.example.com"]),
    createdAt: "2026-05-31T00:00:01.000Z",
    ...overrides
  };
}

function scanRunFixture(
  overrides: Partial<typeof scanRuns.$inferInsert> = {}
): typeof scanRuns.$inferInsert {
  return {
    id: "S1",
    projectId: "P",
    url: "https://fixture.example.com",
    status: "completed",
    mode: "single_url",
    createdAt: "2026-05-31T00:00:00.000Z",
    finishedAt: "2026-05-31T00:00:10.000Z",
    ...overrides
  };
}

describe("getBaselineIssues", () => {
  let client: DbClient;

  beforeEach(() => {
    client = createDb(":memory:");
    initializeDb(client.sqlite);

    client.db.insert(workspaces).values({
      id: "ws",
      name: "Workspace",
      slug: "workspace",
      createdAt: "2026-05-31T00:00:00.000Z"
    }).run();

    client.db.insert(projects).values([
      {
        id: "P",
        workspaceId: "ws",
        name: "Project P",
        url: "https://p.example.com",
        domain: "p.example.com",
        createdAt: "2026-05-31T00:00:00.000Z"
      },
      {
        id: "Q",
        workspaceId: "ws",
        name: "Project Q",
        url: "https://q.example.com",
        domain: "q.example.com",
        createdAt: "2026-05-31T00:00:00.000Z"
      }
    ]).run();

    // S1: completed, finished earlier
    client.db.insert(scanRuns).values(scanRunFixture({
      id: "S1",
      finishedAt: "2026-05-31T01:00:00.000Z"
    })).run();
    // S2: completed, finished later
    client.db.insert(scanRuns).values(scanRunFixture({
      id: "S2",
      finishedAt: "2026-05-31T02:00:00.000Z"
    })).run();
    // S3: failed, finished latest, no issues
    client.db.insert(scanRuns).values(scanRunFixture({
      id: "S3",
      status: "failed",
      finishedAt: "2026-05-31T03:00:00.000Z"
    })).run();

    client.db.insert(issues).values(issueFixture({
      id: "issue-s1",
      scanRunId: "S1",
      issueKey: "k1"
    })).run();
    client.db.insert(issues).values(issueFixture({
      id: "issue-s2",
      scanRunId: "S2",
      issueKey: "k2"
    })).run();

    // Project Q: a single completed scan, so excluding it leaves no prior.
    client.db.insert(scanRuns).values(scanRunFixture({
      id: "QS1",
      projectId: "Q",
      finishedAt: "2026-05-31T01:00:00.000Z"
    })).run();
    client.db.insert(issues).values(issueFixture({
      id: "issue-qs1",
      projectId: "Q",
      scanRunId: "QS1",
      issueKey: "qk1"
    })).run();
  });

  afterEach(() => {
    client.close();
  });

  it("returns the most recent completed run's issues, excluding the given run", () => {
    // Excluding S2 (newest completed) -> prior completed is S1.
    expect(
      getBaselineIssues(client.db, { projectId: "P", excludeScanRunId: "S2" }).map((b) => b.issueKey)
    ).toEqual(["k1"]);
  });

  it("ignores failed runs and picks the newest completed one", () => {
    // Excluding a non-existent new run -> newest completed is S2; failed S3 ignored.
    expect(
      getBaselineIssues(client.db, { projectId: "P", excludeScanRunId: "S_new" }).map((b) => b.issueKey)
    ).toEqual(["k2"]);
  });

  it("returns [] when there is no prior completed scan", () => {
    // Q has only one completed scan; excluding it leaves nothing.
    expect(
      getBaselineIssues(client.db, { projectId: "Q", excludeScanRunId: "QS1" })
    ).toEqual([]);
  });

  it("excludes resolved carry-over rows from the baseline", () => {
    // S2 (newest completed for P) also carries a resolved row from a prior fix.
    // It must NOT seed the baseline — otherwise a fixed issue would re-resolve every
    // scan, and a regressed issue would be mislabeled "ongoing" instead of "new".
    client.db.insert(issues).values(issueFixture({
      id: "issue-s2-resolved",
      scanRunId: "S2",
      issueKey: "k-resolved",
      status: "resolved"
    })).run();

    const keys = getBaselineIssues(client.db, { projectId: "P", excludeScanRunId: "S_new" }).map((b) => b.issueKey);
    expect(keys).toContain("k2");
    expect(keys).not.toContain("k-resolved");
  });

  it("maps wcagCriteria and sampleUrls onto the BaselineIssue shape", () => {
    const [baseline] = getBaselineIssues(client.db, { projectId: "P", excludeScanRunId: "S2" });
    expect(baseline.wcagCriteria).toEqual(["1.1.1"]);
    expect(baseline.sampleUrls).toEqual(["https://fixture.example.com"]);
    expect(baseline.title).toBe("Image missing alternative text");
  });
});
