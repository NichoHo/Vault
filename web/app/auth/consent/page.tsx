import IdCard from "../IdCard";
import ConsentForm from "./ConsentForm";
import { safePath } from "@/lib/auth";

const scopeHelp: Record<string, string> = {
  openid: "Confirm your identity",
  profile: "See your email and handle",
};

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{
    client_id?: string;
    client_name?: string;
    scope?: string;
    return_to?: string;
  }>;
}) {
  const sp = await searchParams;
  const scopes = (sp.scope ?? "openid profile").split(" ").filter(Boolean);
  return (
    <IdCard title="Authorize access">
      <p className="mb-3 text-sm text-sumi-60">
        <span className="font-medium text-ink">{sp.client_name ?? sp.client_id}</span> wants
        to:
      </p>
      <ul className="mb-4 list-inside list-disc text-sm">
        {scopes.map((s) => (
          <li key={s}>{scopeHelp[s] ?? s}</li>
        ))}
      </ul>
      <ConsentForm
        clientId={sp.client_id ?? ""}
        scope={scopes.join(" ")}
        returnTo={safePath(sp.return_to)}
      />
    </IdCard>
  );
}
