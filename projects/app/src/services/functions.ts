// Firebase Functions client for Stripe and other server-side operations
// These will call the Firebase Functions HTTP endpoints

const FUNCTIONS_BASE = "https://us-central1-YOUR_PROJECT.cloudfunctions.net";

export async function createPaymentIntent(params: {
  plan: string;
  userId: string;
}): Promise<{ clientSecret: string }> {
  const response = await fetch(`${FUNCTIONS_BASE}/createPaymentIntent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error("Payment intent creation failed");
  return response.json();
}

export async function cancelSubscription(userId: string): Promise<void> {
  await fetch(`${FUNCTIONS_BASE}/cancelSubscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}
