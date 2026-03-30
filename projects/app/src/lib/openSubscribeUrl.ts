import { Linking } from "react-native";
import { SUBSCRIBE_URL } from "./constants";

export async function openSubscribeUrl(plan?: string, email?: string) {
  const params = new URLSearchParams();
  if (plan) params.set("plan", plan);
  if (email) params.set("email", email);
  const qs = params.toString();
  const url = qs ? `${SUBSCRIBE_URL}?${qs}` : SUBSCRIBE_URL;
  await Linking.openURL(url);
}
