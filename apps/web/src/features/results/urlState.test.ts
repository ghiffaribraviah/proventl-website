import { describe, expect, it, vi } from "vitest";

import {
  readBatchUrlState,
  readResultUrlState,
  updateBatchUrl,
  updateResultUrl,
} from "./urlState";

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

describe("batch URL state", () => {
  it("reads the threshold param and falls back to the default", () => {
    const location = new URL("https://example.test/batch?threshold=0.91");
    expect(readBatchUrlState(location as unknown as Location)).toEqual({
      threshold: 0.91,
    });
    const missing = new URL("https://example.test/batch");
    expect(readBatchUrlState(missing as unknown as Location)).toEqual({
      threshold: 0.95,
    });
  });

  it("writes the threshold param to the URL alongside any existing params", () => {
    const history = { replaceState: vi.fn() };
    updateBatchUrl(
      0.93,
      { href: "https://example.test/batch?other=1" },
      history,
    );
    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("threshold=0.93"),
    );
  });
});
