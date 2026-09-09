import type { AuthUser } from "./authContext";

let active = false;

export function setStarterPreview(enabled: boolean) {
  active = enabled;
}

export function isStarterPreview() {
  return active;
}

export const starterUser: AuthUser = {
  id: "starter-preview",
  name: "TeenCleanPressureWash",
  email: "",
  pictureUrl: "",
  phone: "",
  age: 0,
  role: "owner",
};

export function emptyStarterRecords() {
  return { customers: [], jobs: [], leads: [], invoices: [], servicePlans: [], reviews: [], expenses: [], solicitations: [], calendarEvents: [] };
}
