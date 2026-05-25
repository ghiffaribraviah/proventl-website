import { describe, expect, it, vi } from "vitest";

import { readResultUrlState, updateResultUrl } from "./urlState";

describe("result URL state", () => {
  it("reads valid target and threshold params", () => {
    const location = new URL("https://example.test/?target=p01133&threshold=0.91");

    expect(readResultUrlState(location as unknown as Location)).toEqual({
      target: "P01133",
      threshold: 0.91,
    });
  });

  it("falls back for invalid threshold params", () => {
    const location = new URL("https://example.test/?target=P01133&threshold=bad");

    expect(readResultUrlState(location as unknown as Location)).toEqual({
      target: "P01133",
      threshold: 0.95,
    });
  });

  it("updates URL only when called by successful visible results", () => {
    const history = {
      replaceState: vi.fn(),
    };

    updateResultUrl(
      "P01133",
      0.93,
      { href: "https://example.test/#/docs" },
      history,
    );

    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("target=P01133"),
    );
    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("threshold=0.93"),
    );
  });
});
