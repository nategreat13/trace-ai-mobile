import * as WebBrowser from "expo-web-browser";
import { SUBSCRIBE_URL } from "./constants";

export async function openSubscribeUrl(plan?: string) {
  const url = plan ? `${SUBSCRIBE_URL}?plan=${plan}` : SUBSCRIBE_URL;
  await WebBrowser.openBrowserAsync(url);
}
