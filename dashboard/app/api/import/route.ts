import { withRequestContextFromHeaders } from "@/lib/request-context";
export async function POST() {
  return withRequestContextFromHeaders(() => handlePOST());
}

async function handlePOST() {
  return Response.json(
    { error: "Calendar import is only available in local development" },
    { status: 501 }
  );
}
