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
      classTier: null,
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
  test("first inference: one leader time plus margins", () => {
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
      expect(result.edits.user2.finishTime).toBe("1:30.8");
      expect(result.edits.user3.finishTime).toBe("1:30.0");
    }
  });

  test("repeated inference: repeated run after changing leader time recalculates from the new leader time", () => {
    const rows = [
      makeMockRow("user1", "1", "1:32.0", ""),
      makeMockRow("user2", "2", "1:30.8", "1 1/2"),
      makeMockRow("user3", "3", "1:30.0", "nose"),
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
      expect(result.edits.user3.finishTime).toBe("1:32.0");
    }
  });

  test("leader identified by position === '1' (even if multiple rows have finish times)", () => {
    const rows = [
      makeMockRow("user1", "1", "1:20.0", ""),
      makeMockRow("user2", "2", "1:21.0", "2"),
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
      expect(result.edits.user2.finishTime).toBe("1:21.0");
      expect(result.edits.user3.finishTime).toBe("1:20.0");
    }
  });

  test("fallback leader: exactly one horse has an entered finish time and no horse has position === '1'", () => {
    const rows = [
      makeMockRow("user1", "", "1:40.0", ""),
      makeMockRow("user2", "2", "", "head"),
      makeMockRow("user3", "3", "", "neck"),
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
      expect(result.edits.user2.finishTime).toBe("1:40.2");
      expect(result.edits.user3.finishTime).toBe("1:40.3");
    }
  });

  test("error when no valid leader can be determined", () => {
    // Scenario 1: Multiple position 1 horses
    const rows1 = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "1", "1:32.0", ""),
    ];
    const result1 = inferFinishTimes(rows1, {
      user1: rows1[0].edit,
      user2: rows1[1].edit,
    });
    expect("error" in result1).toBe(true);
    if ("error" in result1) {
      expect(result1.error).toContain("multiple horses are marked with position 1");
    }

    // Scenario 2: No position 1 and multiple horses have finish times
    const rows2 = [
      makeMockRow("user1", "", "1:30.0", ""),
      makeMockRow("user2", "", "1:32.0", ""),
    ];
    const result2 = inferFinishTimes(rows2, {
      user1: rows2[0].edit,
      user2: rows2[1].edit,
    });
    expect("error" in result2).toBe(true);
    if ("error" in result2) {
      expect(result2.error).toContain("Multiple horses have finish times entered");
    }

    // Scenario 3: No leader could be found at all
    const rows3 = [
      makeMockRow("user1", "", "", "1"),
      makeMockRow("user2", "", "", "2"),
    ];
    const result3 = inferFinishTimes(rows3, {
      user1: rows3[0].edit,
      user2: rows3[1].edit,
    });
    expect("error" in result3).toBe(true);
    if ("error" in result3) {
      expect(result3.error).toContain("Unable to determine the leader");
    }
  });

  test("rows with blank or zero-equivalent margins are skipped without causing total failure", () => {
    const rows = [
      makeMockRow("user1", "1", "1:30.0", ""),
      makeMockRow("user2", "2", "", "1"),
      makeMockRow("user3", "3", "", "0"),
      makeMockRow("user4", "4", "", "—"),
      makeMockRow("user5", "5", "", ""),
    ];

    const editedResults: Record<string, EditedResult> = {
      user1: rows[0].edit,
      user2: rows[1].edit,
      user3: rows[2].edit,
      user4: rows[3].edit,
      user5: rows[4].edit,
    };

    const result = inferFinishTimes(rows, editedResults);

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.inferredCount).toBe(1);
      expect(result.edits.user2.finishTime).toBe("1:30.5");
      expect(result.edits.user3.finishTime).toBe("");
      expect(result.edits.user4.finishTime).toBe("");
      expect(result.edits.user5.finishTime).toBe("");
    }
  });

  test("safe row handling: rows with pending_delete are ignored from both leader selection and calculation", () => {
    const rows = [
      makeMockRow("user1", "1", "1:30.0", "", "pending_delete"),
      makeMockRow("user2", "1", "1:35.0", ""),
      makeMockRow("user3", "3", "", "1", "pending_delete"),
      makeMockRow("user4", "4", "", "2"),
    ];

    const editedResults: Record<string, EditedResult> = {
      user1: rows[0].edit,
      user2: rows[1].edit,
      user3: rows[2].edit,
      user4: rows[3].edit,
    };

    const result = inferFinishTimes(rows, editedResults);

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.inferredCount).toBe(1);
      expect(result.edits.user4.finishTime).toBe("1:36.0");
      expect(result.edits.user3.finishTime).toBe("");
    }
  });
});
