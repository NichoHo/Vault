import IdCard from "../IdCard";
import MfaManager from "./MfaManager";

export default function MfaPage() {
  return (
    <IdCard title="Two-factor authentication">
      <MfaManager />
    </IdCard>
  );
}
