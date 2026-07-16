import { describe, expect, it } from "vitest";
import { buildDefaultUserPreferenceData } from "../src/lib/userPreference";

describe("buildDefaultUserPreferenceData", () => {
  it("returns the expected defaults for a first-time user preference record", () => {
    const preference = buildDefaultUserPreferenceData(42);

    expect(preference).toEqual({
      userId: 42,
      timezone: "UTC",
      language: "en",
      emailNotification: true,
      pushNotification: true,
    });
  });
});
