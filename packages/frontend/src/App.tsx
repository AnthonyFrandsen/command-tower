import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar.js";
import FilesPage from "./pages/FilesPage.js";
import HistoryPage from "./pages/HistoryPage.js";
import PromptPage from "./pages/PromptPage.js";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <NavBar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/files" replace />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/prompt" element={<PromptPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/history/:runId" element={<HistoryPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
