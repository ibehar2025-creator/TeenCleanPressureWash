import type { BusinessSettings, CrewMember, Customer, Expense, Invoice, Job, Lead, Payment, Review, ServicePlan } from "../types/business";

// Fresh installations have no bundled business records or fallback customer data.
export const customers: Customer[] = [];
export const crewMembers: CrewMember[] = [];
export const jobs: Job[] = [];
export const leads: Lead[] = [];
export const invoices: Invoice[] = [];
export const payments: Payment[] = [];
export const servicePlans: ServicePlan[] = [];
export const reviews: Review[] = [];
export const expenses: Expense[] = [];
export const spreadsheetImportNotice = "";

export const businessSettings: BusinessSettings = {
  businessName: "TeenCleanPressureWash",
  phone: "",
  email: "",
  website: "",
  defaultInvoiceMessage: "Thank you for choosing TeenCleanPressureWash.",
  defaultTaxRate: 0,
  defaultDiscountPct: 0,
  defaultCommissionPct: 0,
  paymentMethods: ["Zelle", "cash", "card", "check", "other"],
  serviceTypes: ["Driveway wash", "Sidewalk cleaning", "Patio cleaning", "Paver cleaning", "Full property wash", "Recurring check-up"],
  theme: "light",
};
