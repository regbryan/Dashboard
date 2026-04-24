export async function POST() {
  return Response.json(
    { error: "Calendar import is only available in local development" },
    { status: 501 }
  );
}
