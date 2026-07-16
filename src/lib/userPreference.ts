export function buildDefaultUserPreferenceData(userId: number) {
  return {
    userId,
    timezone: "UTC",
    language: "en",
    emailNotification: true,
    pushNotification: true,
  };
}

export function buildDefaultUserPreferenceCreateData() {
  return {
    timezone: "UTC",
    language: "en",
    emailNotification: true,
    pushNotification: true,
  };
}
