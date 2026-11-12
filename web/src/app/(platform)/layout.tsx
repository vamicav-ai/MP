import { AppFrame } from "@/components/app-frame";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppFrame user={user}>{children}</AppFrame>;
}
