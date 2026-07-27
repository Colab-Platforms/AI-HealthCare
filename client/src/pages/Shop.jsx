import { useEffect, useMemo, useState } from "react";
import { Star, SlidersHorizontal, X, ChevronLeft, ChevronRight, Heart, ShoppingBag } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";
const PAGE_SIZE = 12;

function formatINR(paiseOrRupee) {
  return `₹${Math.round(paiseOrRupee).toLocaleString("en-IN")}`;
}

function ProductCard({ product }) {
  const variant = product.variants?.[0];
  const price = Number(variant?.price) || 0;
  const compareAt = Number(variant?.compare_at_price) || 0;
  const discount = compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const inStock = (variant?.quantity ?? 0) > 0;

  return (
    <div className="group bg-white rounded-2xl border border-landing-accent-bg overflow-hidden hover:shadow-[0_10px_30px_rgba(1,67,67,0.10)] transition-all duration-300">
      <div className="relative aspect-square bg-landing-accent-bg/40 overflow-hidden">
        {product.image?.src ? (
          <img
            src={product.image.src}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-landing-text/30 text-sm">
            No image
          </div>
        )}

        {discount > 0 && (
          <span className="absolute top-3 left-3 bg-landing-primary text-white text-xs font-landing-accent font-bold px-2.5 py-1 rounded-full">
            {discount}% off
          </span>
        )}
        {!inStock && (
          <span className="absolute top-3 right-3 bg-landing-text/80 text-white text-[10px] font-landing-accent font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
            Out of stock
          </span>
        )}

        <button
          type="button"
          aria-label="Save to wishlist"
          className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        >
          <Heart className="w-4 h-4 text-landing-primary" />
        </button>
      </div>

      <div className="p-4">
        <p className="text-xs font-landing-accent text-landing-text/50 uppercase tracking-wide mb-1">
          {product.product_type || "Wellness"}
        </p>
        <h3 className="font-landing-title font-semibold text-landing-text text-[15px] leading-snug mb-2 line-clamp-2 min-h-[2.5rem]">
          {product.title}
        </h3>

        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          ))}
          <span className="text-xs text-landing-text/40 font-landing-accent ml-1">(5.0)</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-landing-title font-bold text-landing-primary text-lg">
            {formatINR(price)}
          </span>
          {compareAt > price && (
            <span className="text-sm text-landing-text/40 line-through font-landing-accent">
              {formatINR(compareAt)}
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!inStock}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-landing-primary text-white text-sm font-landing-accent font-semibold hover:bg-landing-primary-hover transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ShoppingBag className="w-4 h-4" />
          {inStock ? "Add to Cart" : "Out of Stock"}
        </button>
      </div>
    </div>
  );
}

function FilterSidebar({ categories, activeCategory, setActiveCategory, inStockOnly, setInStockOnly, priceRange, setPriceRange, maxPrice }) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-landing-title font-semibold text-landing-text mb-4">By Category</h3>
        <div className="space-y-2.5">
          <label className="flex items-center gap-2.5 cursor-pointer text-sm font-landing-accent text-landing-text/70 hover:text-landing-primary transition">
            <input
              type="radio"
              name="category"
              checked={activeCategory === "All"}
              onChange={() => setActiveCategory("All")}
              className="accent-landing-primary w-4 h-4"
            />
            All Products
          </label>
          {categories.map((cat) => (
            <label
              key={cat}
              className="flex items-center gap-2.5 cursor-pointer text-sm font-landing-accent text-landing-text/70 hover:text-landing-primary transition"
            >
              <input
                type="radio"
                name="category"
                checked={activeCategory === cat}
                onChange={() => setActiveCategory(cat)}
                className="accent-landing-primary w-4 h-4"
              />
              {cat}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-landing-title font-semibold text-landing-text mb-4">Price</h3>
        <input
          type="range"
          min="0"
          max={maxPrice}
          value={priceRange}
          onChange={(e) => setPriceRange(Number(e.target.value))}
          className="w-full accent-landing-primary"
        />
        <p className="text-xs font-landing-accent text-landing-text/50 mt-1">
          Up to {formatINR(priceRange)}
        </p>
      </div>

      <div>
        <h3 className="font-landing-title font-semibold text-landing-text mb-4">Availability</h3>
        <label className="flex items-center gap-2.5 cursor-pointer text-sm font-landing-accent text-landing-text/70">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="accent-landing-primary w-4 h-4 rounded"
          />
          In Stock Only
        </label>
      </div>
    </div>
  );
}

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeCategory, setActiveCategory] = useState("All");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState(5000);
  const [sortBy, setSortBy] = useState("default");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/shiprocket/products?limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setProducts(data.data?.products || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.product_type).filter(Boolean))],
    [products],
  );

  const maxPrice = useMemo(() => {
    const prices = products.map((p) => Number(p.variants?.[0]?.price) || 0);
    return Math.max(5000, ...prices);
  }, [products]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const price = Number(p.variants?.[0]?.price) || 0;
      const stock = p.variants?.[0]?.quantity ?? 0;
      if (activeCategory !== "All" && p.product_type !== activeCategory) return false;
      if (inStockOnly && stock <= 0) return false;
      if (price > priceRange) return false;
      return true;
    });

    if (sortBy === "price-asc") {
      list = [...list].sort((a, b) => (a.variants?.[0]?.price || 0) - (b.variants?.[0]?.price || 0));
    } else if (sortBy === "price-desc") {
      list = [...list].sort((a, b) => (b.variants?.[0]?.price || 0) - (a.variants?.[0]?.price || 0));
    }
    return list;
  }, [products, activeCategory, inStockOnly, priceRange, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [activeCategory, inStockOnly, priceRange, sortBy]);

  return (
    <div className="w-full">
      {/* In-page header — sits below the shared dashboard top bar/sidebar */}
      <div className="px-4 sm:px-6 pt-5 pb-2">
        <h1 className="font-landing-title text-2xl sm:text-3xl font-bold text-landing-text">
          Shop take.health Wellness
        </h1>
      </div>

      <div className="max-w-7xl px-4 sm:px-6 py-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="font-landing-accent text-sm text-landing-text/60">
            {loading ? "Loading…" : `Showing ${paginated.length ? (page - 1) * PAGE_SIZE + 1 : 0}-${(page - 1) * PAGE_SIZE + paginated.length} of ${filtered.length} results`}
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-full border border-landing-accent-bg text-sm font-landing-accent text-landing-text"
            >
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm font-landing-accent text-landing-text border border-landing-accent-bg rounded-full px-4 py-2 bg-white focus:outline-none focus:border-landing-primary"
            >
              <option value="default">Sort by: Default</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <FilterSidebar
              categories={categories}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              inStockOnly={inStockOnly}
              setInStockOnly={setInStockOnly}
              priceRange={priceRange}
              setPriceRange={setPriceRange}
              maxPrice={maxPrice}
            />
          </aside>

          {/* Mobile filter drawer */}
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-white p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-landing-title font-bold text-landing-text">Filter Options</h2>
                  <button onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters">
                    <X className="w-5 h-5 text-landing-text" />
                  </button>
                </div>
                <FilterSidebar
                  categories={categories}
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                  inStockOnly={inStockOnly}
                  setInStockOnly={setInStockOnly}
                  priceRange={priceRange}
                  setPriceRange={setPriceRange}
                  maxPrice={maxPrice}
                />
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="mt-8 w-full py-3 rounded-full bg-landing-primary text-white font-landing-accent font-semibold"
                >
                  Show {filtered.length} results
                </button>
              </div>
            </div>
          )}

          {/* Product grid */}
          <div className="flex-1">
            {error && (
              <p className="text-red-500 font-landing-accent text-sm mb-4">Error: {error}</p>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-white rounded-2xl border border-landing-accent-bg overflow-hidden">
                    <div className="aspect-square bg-landing-accent-bg/50" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-landing-accent-bg/50 rounded w-1/2" />
                      <div className="h-4 bg-landing-accent-bg/50 rounded w-3/4" />
                      <div className="h-4 bg-landing-accent-bg/50 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <p className="font-landing-accent text-landing-text/50 text-center py-20">
                No products match these filters.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                {paginated.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-landing-accent-bg text-landing-text disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-landing-accent transition ${
                      page === i + 1
                        ? "bg-landing-primary text-white"
                        : "text-landing-text/60 hover:bg-landing-accent-bg"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-landing-accent-bg text-landing-text disabled:opacity-30"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
