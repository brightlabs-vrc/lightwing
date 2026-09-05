import { describe, expect, test } from "vitest";
import { inferFinishTimes, type DerivedRow, type EditedResult, EMPTY_EDIT } from "./standings";

function makeMockRow(
  userId: string,
  position: string,
  finishTime: string,
  margin: string,
  rowState: "unchanged" | "new" | "modified" | "pending_delete" = "unchanged"
): DerivedRow {
  return {
    member: {
      userId,
      name: "User_" + userId,
      classTier: null as unknown as string,
    },
    savedResult: undefined,
    edit: {
      ...EMPTY_EDIT,
      position,
      finishTime,
      margin,
    },
    rowState,
  };
}

describe("inferFinishTimes", () => {
  test("standard contiguous positions with cumulative margins", () => {
    // Cumulative:
    // pos 1: 1:30.0
    // pos 2: 1:30.0 + 1 1/2 lengths (0.75s) = 1:30.7 (or actually 1.5 * 0.5 = 0.75s -> formatted is 1:30.8 since .toFixed(1) rounds)
    // pos 3: 1:30.8 + nose (0.05s) = 1:30.8 (1:30.75 + 0.05 = 1:30.8)
    const rows = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "2", "", "1 1/2"),
      makeMockRow("user3", "3", "", "nose"),
    ];

    const editedResults: Record<string, EditedResult> = {
      user1: rows[0].edit,
      user2: rows[1].edit,
      user3: rows[2].edit,
    };

    const result = inferFinishTimes(rows, editedResults);

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.inferredCount).toBe(2);
      // user2: 1:30.0 + (1.5 * 0.5) = 1:30.75 -> formatted 1:30.8
      expect(result.edits.user2.finishTime).toBe("1:30.8");
      // user3: 1:30.75 + 0.05 = 1:30.80 -> formatted 1:30.8
      expect(result.edits.user3.finishTime).toBe("1:30.8");
    }
  });

  test("more distinct cumulative math", () => {
    // Cumulative:
    // pos 1: 1:20.0 (80.0s)
    // pos 2: + 2 lengths (1.0s) = 1:21.0
    // pos 3: + 3 lengths (1.5s) = 1:22.5
    const rows = [
      makeMockRow("user1", "1", "1:20.0", ""),
      makeMockRow("user2", "2", "", "2"),
      makeMockRow("user3", "3", "", "3"),
    ];

    const result = inferFinishTimes(rows, {
      user1: rows[0].edit,
      user2: rows[1].edit,
      user3: rows[2].edit,
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.inferredCount).toBe(2);
      expect(result.edits.user2.finishTime).toBe("1:21.0");
      expect(result.edits.user3.finishTime).toBe("1:22.5");
    }
  });

  test("repeated inference: rerun after changing leader time recalculates downstream cumulatively", () => {
    const rows = [
      makeMockRow("user1", "1", "1:32.0", ""), // Updated leader time
      makeMockRow("user2", "2", "1:30.8", "1 1/2"),
      makeMockRow("user3", "3", "1:30.8", "nose"),
    ];

    const editedResults: Record<string, EditedResult> = {
      user1: rows[0].edit,
      user2: rows[1].edit,
      user3: rows[2].edit,
    };

    const result = inferFinishTimes(rows, editedResults);

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.inferredCount).toBe(2);
      expect(result.edits.user2.finishTime).toBe("1:32.8");
      expect(result.edits.user3.finishTime).toBe("1:32.8");
    }
  });

  test("repeated inference: rerun after changing upstream margin recalculates downstream cumulatively", () => {
    const rows = [
      makeMockRow("user1", "1", "1:20.0", ""),
      makeMockRow("user2", "2", "1:21.0", "4"), // Changed margin from 2 to 4 lengths (2.0s)
      makeMockRow("user3", "3", "1:22.5", "3"),
    ];

    const result = inferFinishTimes(rows, {
      user1: rows[0].edit,
      user2: rows[1].edit,
      user3: rows[2].edit,
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.inferredCount).toBe(2);
      expect(result.edits.user2.finishTime).toBe("1:22.0");
      expect(result.edits.user3.finishTime).toBe("1:23.5");
    }
  });

  test("error on missing position 1 row", () => {
    const rows = [
      makeMockRow("user2", "2", "", "1"),
      makeMockRow("user3", "3", "", "1"),
    ];
    const result = inferFinishTimes(rows, {
      user2: rows[0].edit,
      user3: rows[1].edit,
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Missing position 1 in the standings sequence. Infer time requires contiguous official finishing positions starting from 1.");
    }
  });

  test("error on gap in sequence", () => {
    const rows = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "2", "", "1"),
      makeMockRow("user4", "4", "", "1"),
    ];
    const result = inferFinishTimes(rows, {
      user1: rows[0].edit,
      user2: rows[1].edit,
      user4: rows[2].edit,
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Missing position 3 in the standings sequence. Infer time requires contiguous official finishing positions starting from 1.");
    }
  });

  test("error on duplicate position", () => {
    const rows = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "2", "", "1"),
      makeMockRow("user3", "2", "", "1"),
    ];
    const result = inferFinishTimes(rows, {
      user1: rows[0].edit,
      user2: rows[1].edit,
      user3: rows[2].edit,
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Duplicate position 2 detected in standings.");
    }
  });

  test("error on non-numeric position", () => {
    const rows = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "2a", "", "1"),
    ];
    const result = inferFinishTimes(rows, {
      user1: rows[0].edit,
      user2: rows[1].edit,
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("All rows participating in infer time must have numeric finishing positions.");
    }
  });

  test("error on blank position", () => {
    const rows = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "", "", "1"),
    ];
    const result = inferFinishTimes(rows, {
      user1: rows[0].edit,
      user2: rows[1].edit,
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("All rows participating in infer time must have numeric finishing positions.");
    }
  });

  test("error on position 1 missing leader finish time", () => {
    const rows = [
      makeMockRow("user1", "1", "", ""),
      makeMockRow("user2", "2", "", "1"),
    ];
    const result = inferFinishTimes(rows, {
      user1: rows[0].edit,
      user2: rows[1].edit,
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Unable to parse the leader finish time. Use m:ss.t format (e.g. 1:32.1).");
    }
  });

  test("error on blank or zero margin in downstream rows", () => {
    const blankRows = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "2", "", ""),
    ];
    const resultBlank = inferFinishTimes(blankRows, {
      user1: blankRows[0].edit,
      user2: blankRows[1].edit,
    });
    expect("error" in resultBlank).toBe(true);
    if ("error" in resultBlank) {
      expect(resultBlank.error).toBe("Position 2 has an empty or zero margin, which blocks cumulative inference.");
    }

    const zeroRows = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "2", "", "0"),
    ];
    const resultZero = inferFinishTimes(zeroRows, {
      user1: zeroRows[0].edit,
      user2: zeroRows[1].edit,
    });
    expect("error" in resultZero).toBe(true);
    if ("error" in resultZero) {
      expect(resultZero.error).toBe("Position 2 has an empty or zero margin, which blocks cumulative inference.");
    }

    const dashRows = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "2", "", "—"),
    ];
    const resultDash = inferFinishTimes(dashRows, {
      user1: dashRows[0].edit,
      user2: dashRows[1].edit,
    });
    expect("error" in resultDash).toBe(true);
    if ("error" in resultDash) {
      expect(resultDash.error).toBe("Position 2 has an empty or zero margin, which blocks cumulative inference.");
    }
  });

  test("rows with pending_delete are completely ignored", () => {
    const rows = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "2", "", "1"),
      makeMockRow("user3", "3", "", "1", "pending_delete"), // ignored, sequence is still contiguous from 1 to 2!
    ];

    const result = inferFinishTimes(rows, {
      user1: rows[0].edit,
      user2: rows[1].edit,
      user3: rows[2].edit,
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.inferredCount).toBe(1);
      expect(result.edits.user2.finishTime).toBe("1:30.5");
      expect(result.edits.user3.finishTime).toBe("");
    }
  });

  test("DSQ, DNF, and DNS rows are excluded from time inference", () => {
    const rows = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "2", "", "1"),
      makeMockRow("user3", "3", "", "1"),
      makeMockRow("user5", "4", "", "1"),
      makeMockRow("user4", "2", "", "3"),
    ];
    // Override edits with resultStatus
    rows[1].edit = { ...rows[1].edit, resultStatus: "DSQ" };
    rows[2].edit = { ...rows[2].edit, resultStatus: "DNF" };
    rows[3].edit = { ...rows[3].edit, resultStatus: "DNS" };

    const result = inferFinishTimes(rows, {
      user1: rows[0].edit,
      user2: rows[1].edit,
      user3: rows[2].edit,
      user5: rows[3].edit,
      user4: rows[4].edit,
    });

    // DSQ, DNF, and DNS rows excluded — sequence is now position 1 (user1) and 2 (user4)
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.inferredCount).toBe(1);
      // user4: 1:30.0 + 3 lengths (1.5s) = 1:31.5
      expect(result.edits.user4.finishTime).toBe("1:31.5");
      // DSQ/DNF/DNS rows were not modified
      expect(result.edits.user2.finishTime).toBe("");
      expect(result.edits.user3.finishTime).toBe("");
      expect(result.edits.user5.finishTime).toBe("");
    }
  });
});
