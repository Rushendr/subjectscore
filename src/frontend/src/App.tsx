import { AdBanner } from "@/components/AdBanner";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import ABTestPage from "@/pages/ABTestPage";
import AnalyzerPage from "@/pages/AnalyzerPage";
import HistoryPage from "@/pages/HistoryPage";
import { useState } from "react";

const TOP_AD = {
  imageUrl: "https://adsection.tigoy.com/001.png",
  linkUrl: "https://adsection.tigoy.com/ad001.html",
};
const BOTTOM_AD = {
  imageUrl: "https://adsection.tigoy.com/002.png",
  linkUrl: "https://adsection.tigoy.com/ad002.html",
};

type Route = "analyzer" | "ab-testing" | "history";

export default function App() {
  const [route, setRoute] = useState<Route>("analyzer");

  const handleNavigate = (page: string) => {
    if (page === "/" || page === "analyzer") setRoute("analyzer");
    else if (page === "ab-testing") setRoute("ab-testing");
    else if (page === "history") setRoute("history");
  };

  const renderPage = () => {
    switch (route) {
      case "analyzer":
        return <AnalyzerPage />;
      case "ab-testing":
        return <ABTestPage onNavigate={handleNavigate} />;
      case "history":
        return <HistoryPage onNavigate={handleNavigate} />;
      default:
        return <AnalyzerPage />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      {/* Sub-nav for internal routes */}
      <div className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1 py-2">
          {(
            [
              { id: "analyzer", label: "Analyzer" },
              { id: "ab-testing", label: "A/B Testing" },
              { id: "history", label: "History" },
            ] as { id: Route; label: string }[]
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setRoute(id)}
              data-ocid={`subnav.${id}.tab`}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                route === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <AdBanner {...TOP_AD} altText="Top Advertisement" />

      <main className="flex-1 w-full">{renderPage()}</main>

      <AdBanner {...BOTTOM_AD} altText="Bottom Advertisement" />

      <Footer />
    </div>
  );
}
