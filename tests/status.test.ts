import { describe, expect, it } from "vitest";
import { statusFromCwfis, statusFromWfigs, STATUS_META } from "@/lib/status";

describe("statusFromCwfis", () => {
  it("maps stage-of-control codes", () => {
    expect(statusFromCwfis("OC", false)).toBe("out_of_control");
    expect(statusFromCwfis("BH", false)).toBe("being_held");
    expect(statusFromCwfis("UC", false)).toBe("under_control");
    expect(statusFromCwfis("EX", false)).toBe("contained");
    expect(statusFromCwfis("OUT", false)).toBe("contained");
  });

  it("treats unknown codes as active and prescribed as prescribed", () => {
    expect(statusFromCwfis("??", false)).toBe("active");
    expect(statusFromCwfis(null, false)).toBe("active");
    expect(statusFromCwfis("OC", true)).toBe("prescribed");
  });

  it("is case/whitespace tolerant", () => {
    expect(statusFromCwfis(" oc ", false)).toBe("out_of_control");
  });
});

describe("statusFromWfigs", () => {
  it("derives status from containment thresholds", () => {
    expect(statusFromWfigs("WF", 100, false)).toBe("contained");
    expect(statusFromWfigs("WF", 85, false)).toBe("under_control");
    expect(statusFromWfigs("WF", 50, false)).toBe("active");
    expect(statusFromWfigs("WF", 10, false)).toBe("out_of_control");
    expect(statusFromWfigs("WF", 0, false)).toBe("out_of_control");
  });

  it("handles missing containment, fire-out and prescribed burns", () => {
    expect(statusFromWfigs("WF", null, false)).toBe("active");
    expect(statusFromWfigs("WF", 10, true)).toBe("contained");
    expect(statusFromWfigs("RX", 0, false)).toBe("prescribed");
  });
});

describe("STATUS_META", () => {
  it("uses the required colour scheme", () => {
    expect(STATUS_META.contained.color).toBe("#16a34a"); // green
    expect(STATUS_META.out_of_control.color).toBe("#dc2626"); // red
    expect(STATUS_META.prescribed.color).toBe("#2563eb"); // blue
  });
});
