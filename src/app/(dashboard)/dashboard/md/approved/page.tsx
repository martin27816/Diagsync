import { redirect } from "next/navigation";

export default function MdApprovedRedirectPage() {
  redirect("/dashboard/md?status=approved");
}

