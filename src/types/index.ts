import {
  Role,
  Department,
  StaffStatus,
  AvailabilityStatus,
  Shift,
  TestType,
  FieldType,
  Sex,
  Priority,
  PaymentStatus,
  OrderStatus,
} from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH / STAFF
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  organizationId: string;
  department: Department;
}

export interface StaffWithOrg {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  department: Department;
  status: StaffStatus;
  availabilityStatus: AvailabilityStatus;
  defaultShift: Shift;
  dateJoined: Date;
  createdAt: Date;
  organization: { id: string; name: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// API WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — TEST DATABASE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultTemplateField {
  id: string;
  testId: string;
  label: string;
  fieldKey: string;
  fieldType: FieldType;
  unit?: string | null;
  normalMin?: number | null;
  normalMax?: number | null;
  options?: string | null;
  isRequired: boolean;
  sortOrder: number;
}

export interface DiagnosticTestWithFields {
  id: string;
  organizationId: string;
  categoryId?: string | null;
  name: string;
  code: string;
  type: TestType;
  department: Department;
  price: number;
  turnaroundMinutes: number;
  sampleType?: string | null;
  description?: string | null;
  isActive: boolean;
  category?: { id: string; name: string } | null;
  resultFields: ResultTemplateField[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — PATIENT & VISIT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  organizationId: string;
  patientId: string;
  fullName: string;
  age: number;
  sex: Sex;
  phone: string;
  email?: string | null;
  address?: string | null;
  dateOfBirth?: Date | null;
  referringDoctor?: string | null;
  clinicalNote?: string | null;
  createdAt: Date;
}

export interface Visit {
  id: string;
  patientId: string;
  organizationId: string;
  visitNumber: string;
  priority: Priority;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  amountPaid: number;
  discount: number;
  paymentMethod?: string | null;
  notes?: string | null;
  registeredAt: Date;
  testOrders?: TestOrder[];
}

export interface TestOrder {
  id: string;
  visitId: string;
  testId: string;
  organizationId: string;
  status: OrderStatus;
  price: number;
  notes?: string | null;
  registeredAt: Date;
  test?: DiagnosticTestWithFields;
}

// Cart item used in patient registration form
export interface TestCartItem {
  testId: string;
  name: string;
  code: string;
  type: TestType;
  department: Department;
  price: number;
}