import IdCard from "../IdCard";
import LoginForm from "./LoginForm";
import { safePath } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const sp = await searchParams;
  return (
    <IdCard title="Sign in">
      <LoginForm returnTo={safePath(sp.return_to)} />
    </IdCard>
  );
}
