import { redirect } from "next/navigation";

// This route came from the starter template and no longer exists. Send visitors to the real page.
export default function Page() {
  redirect("/");
}
