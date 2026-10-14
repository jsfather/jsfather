// Retire the timer endpoint so old open tabs cannot also award measured time.
export async function POST() {
  return Response.json(
    { error: 'Practice time is now estimated automatically. Reload this page.' },
    { status: 410 },
  );
}
