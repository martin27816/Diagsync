"use client";

import { useState, useEffect, useCallback } from "react";

interface StaffItem {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: string;
  availabilityStatus: string;
  defaultShift: string;
  dateJoined: string;
  createdAt: string;
}

interface UseStaffOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  department?: string;
  status?: string;
}

export function useStaff(options: UseStaffOptions = {}) {
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options.page) params.set("page", String(options.page));
      if (options.pageSize) params.set("pageSize", String(options.pageSize));
      if (options.search) params.set("search", options.search);
      if (options.role) params.set("role", options.role);
      if (options.department) params.set("department", options.department);
      if (options.status) params.set("status", options.status);

      const res = await fetch(`/api/staff?${params.toString()}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Failed to load staff");
        return;
      }

      setStaff(data.data.items);
      setTotal(data.data.total);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [options.page, options.pageSize, options.search, options.role, options.department, options.status]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  return { staff, total, loading, error, refetch: fetchStaff };
}
