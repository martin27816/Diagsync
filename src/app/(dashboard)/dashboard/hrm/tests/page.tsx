import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { FlaskConical, Scan, Clock, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/index";
import { formatCurrency } from "@/lib/utils";

export default async function TestCatalogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  if (!["SUPER_ADMIN", "HRM"].includes(user.role)) redirect("/dashboard/hrm");

  const tests = await prisma.diagnosticTest.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    include: {
      category: { select: { name: true } },
      resultFields: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const labTests = tests.filter((t) => t.type === "LAB");
  const radioTests = tests.filter((t) => t.type === "RADIOLOGY");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="h-6 w-6" />
          Test Catalog
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          All diagnostic tests available in your organization ({tests.length} total)
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Tests</p>
          <p className="text-2xl font-bold mt-1">{tests.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Lab Tests</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">{labTests.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Radiology Tests</p>
          <p className="text-2xl font-bold mt-1 text-purple-600">{radioTests.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Result Templates</p>
          <p className="text-2xl font-bold mt-1 text-green-600">
            {tests.reduce((sum, t) => sum + t.resultFields.length, 0)}
          </p>
        </div>
      </div>

      {/* Lab Tests */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <FlaskConical className="h-5 w-5 text-blue-600" />
          Laboratory Tests
          <Badge variant="info" className="ml-1">{labTests.length}</Badge>
        </h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Test Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sample</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 inline mr-1" />Target
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 inline" />Price
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fields</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {labTests.map((test) => (
                <tr key={test.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{test.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="font-mono text-xs">{test.code}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{test.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{test.sampleType ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {test.turnaroundMinutes >= 60
                      ? `${Math.floor(test.turnaroundMinutes / 60)}h ${test.turnaroundMinutes % 60 > 0 ? `${test.turnaroundMinutes % 60}m` : ""}`
                      : `${test.turnaroundMinutes}m`}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(Number(test.price))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{test.resultFields.length} fields</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Radiology Tests */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Scan className="h-5 w-5 text-purple-600" />
          Radiology Tests
          <Badge variant="secondary" className="ml-1">{radioTests.length}</Badge>
        </h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Test Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 inline mr-1" />Target
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 inline" />Price
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fields</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {radioTests.map((test) => (
                <tr key={test.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{test.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="font-mono text-xs">{test.code}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{test.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {test.turnaroundMinutes >= 60
                      ? `${Math.floor(test.turnaroundMinutes / 60)}h ${test.turnaroundMinutes % 60 > 0 ? `${test.turnaroundMinutes % 60}m` : ""}`
                      : `${test.turnaroundMinutes}m`}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(Number(test.price))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{test.resultFields.length} fields</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}