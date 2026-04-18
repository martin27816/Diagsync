import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EditPatientForm } from "@/components/receptionist/edit-patient-form";

export default async function EditReceptionPatientPage({
  params,
}: {
  params: { patientId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  if (!["RECEPTIONIST", "SUPER_ADMIN", "HRM"].includes(user.role)) {
    redirect("/dashboard/receptionist/patients");
  }

  const patient = await prisma.patient.findFirst({
    where: { id: params.patientId, organizationId: user.organizationId },
    include: {
      visits: {
        orderBy: { registeredAt: "desc" },
        take: 1,
        include: {
          testOrders: {
            orderBy: { registeredAt: "asc" },
            include: {
              test: {
                include: {
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!patient || patient.visits.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-semibold text-slate-800">Edit Patient</h1>
        <p className="text-sm text-slate-500">Patient or active visit was not found.</p>
        <Link href="/dashboard/receptionist/patients" className="text-xs text-blue-600 hover:underline">
          Back to Patients
        </Link>
      </div>
    );
  }

  const latestVisit = patient.visits[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Edit Patient Visit</h1>
          <p className="text-xs text-slate-500">
            {patient.fullName} · {patient.patientId} · {latestVisit.visitNumber}
          </p>
        </div>
        <Link href="/dashboard/receptionist/patients" className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
          Back
        </Link>
      </div>

      <EditPatientForm
        visitId={latestVisit.id}
        patient={{
          id: patient.id,
          fullName: patient.fullName,
          age: patient.age,
          sex: patient.sex,
          phone: patient.phone,
          email: patient.email,
          address: patient.address,
          dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString() : null,
          referringDoctor: patient.referringDoctor,
          clinicalNote: patient.clinicalNote,
        }}
        visit={{
          priority: latestVisit.priority,
          amountPaid: Number(latestVisit.amountPaid),
          discount: Number(latestVisit.discount),
          paymentMethod: latestVisit.paymentMethod,
          notes: latestVisit.notes,
        }}
        tests={latestVisit.testOrders.map((order) => ({
          orderId: order.id,
          status: order.status,
          id: order.test.id,
          name: order.test.name,
          code: order.test.code,
          type: order.test.type,
          department: order.test.department,
          sampleType: order.test.sampleType,
          category: order.test.category,
          price: Number(order.price),
        }))}
      />
    </div>
  );
}
