import { useEffect, useState } from "react";

type Deal = {
  id: string;
  source: string;
  url: string;
  title: string;
  description: string;
  listed_price: number;
  predicted_price: number;
  undervalue_percent: number;
  year: number;
  make: string;
  model: string;
  mileage: number | null;
  location: string;
  created_at: string;
  posted_at: string;
};

function App() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          "http://127.0.0.1:8000/deals?min_undervalue_percent=10"
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data: Deal[] = await res.json();
        setDeals(data);
      } catch (err: any) {
        setError(err.message ?? "Failed to load deals");
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Car Deal Finder
      </h1>
      <p style={{ marginBottom: "1.5rem", color: "#555" }}>
        Showing listings that look underpriced compared to predicted fair value.
      </p>

      {loading && <p>Loading deals...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && deals.length === 0 && <p>No deals found.</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {deals.map((deal) => (
          <a
            key={deal.id}
            href={deal.url}
            target="_blank"
            rel="noreferrer"
            style={{
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                borderRadius: "0.75rem",
                border: "1px solid #ddd",
                padding: "1rem",
                boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
                height: "100%",
              }}
            >
              <h2
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                {deal.year} {deal.make} {deal.model}
              </h2>
              <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                {deal.title}
              </p>

              <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.75rem" }}>
                {deal.location} •{" "}
                {deal.mileage != null ? `${deal.mileage.toLocaleString()} miles` : "Mileage N/A"}
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>
                    Listed
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    ${deal.listed_price.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>
                    Predicted
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    ${deal.predicted_price.toLocaleString()}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "inline-block",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "999px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  backgroundColor: "#e6f6ec",
                  color: "#166534",
                }}
              >
                {deal.undervalue_percent.toFixed(1)}% below market
              </div>

              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#999",
                  marginTop: "0.75rem",
                }}
              >
                Source: {deal.source}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default App;
