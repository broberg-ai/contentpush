import { useEffect, useState } from "preact/hooks";

// F009.1: brand-vælger — én kilde til "aktivt brand". Custom pills (ingen
// native select). "Alle" = null = ufiltreret kø. Valget scoper post-køen.

type Brand = { id: string; name: string };

export function BrandSwitcher({
  activeBrandId,
  onSelect,
  refreshKey,
}: {
  activeBrandId: string | null;
  onSelect: (id: string | null) => void;
  refreshKey?: number;
}) {
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then(({ brands }: { brands: Brand[] }) => setBrands(brands))
      .catch(() => setBrands([]));
  }, [refreshKey]);

  return (
    <div class="brand-switcher" data-testid="brand-switcher" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={activeBrandId === null}
        class={`switcher-pill${activeBrandId === null ? " active" : ""}`}
        data-testid="brand-switcher-all"
        onClick={() => onSelect(null)}
      >
        Alle brands
      </button>
      {brands.map((b) => (
        <button
          key={b.id}
          type="button"
          role="tab"
          aria-selected={b.id === activeBrandId}
          class={`switcher-pill${b.id === activeBrandId ? " active" : ""}`}
          data-testid={`brand-switcher-${b.id}`}
          onClick={() => onSelect(b.id)}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
