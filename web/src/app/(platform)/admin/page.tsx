import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function AdminHomePage() {
  await requireUser(["admin"]);
  redirect("/dashboard");
}
