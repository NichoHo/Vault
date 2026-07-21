// Shared shell for IdP screens — visually distinct from the storefront:
// the identity provider is its own product.
export default function IdCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto mt-12 max-w-sm">
      <div className="mb-4 text-center">
        <span className="rounded-[6px] bg-indigo px-2 py-1 text-xs font-bold tracking-widest text-white">
          VAULT ID
        </span>
      </div>
      <div className="rounded-[8px] border border-sumi-20 bg-surface p-6">
        <h1 className="mb-4 text-xl font-bold">{title}</h1>
        {children}
      </div>
    </div>
  );
}
