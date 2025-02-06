"use client";

import { useState, useRef } from "react";
import { toast, Toaster } from "react-hot-toast";
import {
  FiSettings,
  FiMoon,
  FiSun,
  FiGlobe,
  FiClock,
  FiBell,
} from "react-icons/fi";
import { trpc } from "@/utils/trpc";
import { SettingsPanel } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TranslationHistory } from "@/components/translation-history";

const TARGET_LANGUAGES = [
  "English",
  "Japanese",
  "Chinese",
  "Vietnamese",
  "Thai",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Russian",
  "Arabic",
  "Hindi",
  "Korean",
  "Dutch",
  "Swedish",
  "Polish",
];

export function TranslationDashboard() {
  // State for URL, language, loading, and other UI parts
  const [url, setUrl] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState(TARGET_LANGUAGES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("browser");
  const [proxyUrl, setProxyUrl] = useState("");

  // Reference to the iframe element
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Your TRPC mutation for translating a single chunk of text
  const translateChunkMutation = trpc.translation.translateChunk.useMutation();

  // New recursive function that traverses the document and translates only text nodes.
  const translateTextNodesParallel = async (node: Node) => {
    // Helper function to recursively collect text nodes
    const getTextNodes = (node: Node): Node[] => {
      let nodes: Node[] = [];
      node.childNodes.forEach((child) => {
        if (
          child.nodeType === Node.TEXT_NODE &&
          child.textContent &&
          child.textContent.trim()
        ) {
          nodes.push(child);
        } else if (
          child.nodeType === Node.ELEMENT_NODE &&
          !["SCRIPT", "STYLE"].includes(child.nodeName)
        ) {
          nodes = nodes.concat(getTextNodes(child));
        }
      });
      return nodes;
    };

    // Gather all text nodes under the given node
    const textNodes = getTextNodes(node);
    const totalNodes = textNodes.length;
    const batchSize = 100; // Adjust this number based on your needs

    for (let i = 0; i < totalNodes; i += batchSize) {
      const batch = textNodes.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (textNode) => {
          const originalText = textNode.textContent?.trim();
          if (originalText) {
            try {
              // Send the translation request concurrently for each node in the batch
              const { translatedText } =
                await translateChunkMutation.mutateAsync({
                  text: originalText,
                  targetLanguage: selectedLanguage,
                });
              // Update the text node with the translated text
              textNode.textContent =
                textNode.textContent?.replace(originalText, translatedText) ||
                translatedText;
            } catch (error) {
              console.error("Translation failed for text node:", error);
            }
          }
        })
      );
      // Optionally update progress (e.g., update a progress bar)
      setProgress(Math.min(100, ((i + batch.length) / totalNodes) * 100));
    }
  };

  // Updated incrementalTranslate uses the recursive function instead of replacing entire elements.
  const incrementalTranslate = async () => {
    if (!iframeRef.current) return;
    const iframeDoc = iframeRef.current.contentDocument;
    if (!iframeDoc) {
      toast.error("Could not access iframe content.");
      return;
    }

    const body = iframeDoc.body;
    if (!body) {
      toast.error("No body element found in iframe.");
      return;
    }

    setIsLoading(true);
    try {
      await translateTextNodesParallel(body);
      toast.success("Translation completed.");
    } catch (error) {
      console.error("Error during translation:", error);
      toast.error("Translation encountered an error.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle the URL submission (with a basic URL validation)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast.error("Please enter a URL");
      return;
    }
    try {
      new URL(url);
    } catch {
      toast.error("Invalid URL. Example: https://example.com");
      return;
    }
    setIsLoading(true);
    setProxyUrl(
      `/api/proxy?url=${encodeURIComponent(url)}&executeScripts=true`
    );
    setIsLoading(false);
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark" : ""}`}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 shadow-md">
          <div className="p-4">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              TranslateAI
            </h1>
          </div>
          <nav className="mt-6">
            <Button
              variant="ghost"
              className={`w-full justify-start px-4 py-2 text-left ${
                activeTab === "browser" ? "bg-gray-200 dark:bg-gray-700" : ""
              }`}
              onClick={() => {
                setActiveTab("browser");
                setShowHistory(false);
                setShowSettings(false);
              }}
            >
              <FiGlobe className="mr-3" /> Browser Translation
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start px-4 py-2 text-left"
              onClick={() => {
                setActiveTab("history");
                setShowHistory(true);
                setShowSettings(false);
              }}
            >
              <FiClock className="mr-3" /> History
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start px-4 py-2 text-left"
              onClick={() => {
                setActiveTab("settings");
                setShowSettings(true);
                setShowHistory(false);
              }}
            >
              <FiSettings className="mr-3" /> Settings
            </Button>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {/* Header */}
          <header className="bg-white dark:bg-gray-800 shadow-sm">
            <div className="max-w-7xl mx-auto py-2 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Switch
                    checked={isDarkMode}
                    onCheckedChange={setIsDarkMode}
                    className="mr-4"
                  />
                  {isDarkMode ? (
                    <FiSun className="h-5 w-5 text-gray-200" />
                  ) : (
                    <FiMoon className="h-5 w-5 text-gray-600" />
                  )}
                </div>
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" className="ml-4">
                    <FiBell className="h-5 w-5" />
                  </Button>
                  <Avatar className="ml-4">
                    <AvatarImage src="/placeholder-user.jpg" alt="User" />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </div>
          </header>

          {/* Render content based on the active tab */}
          {activeTab === "browser" && (
            <div className="p-4">
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                {/* Browser Top Bar */}
                <div className="border-b p-2 flex items-center gap-2">
                  <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="Enter URL to translate..."
                      className="flex-1 bg-white border rounded-md px-3 py-2"
                    />
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="border rounded-md px-3 py-2"
                    >
                      {TARGET_LANGUAGES.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                    <Button onClick={incrementalTranslate} disabled={isLoading}>
                      Translate
                    </Button>
                  </form>
                </div>

                {/* Website Iframe */}
                {proxyUrl && (
                  <iframe
                    ref={iframeRef}
                    src={proxyUrl}
                    className="w-full h-screen border mt-4"
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === "history" && showHistory && (
            <div className="p-4">
              <TranslationHistory
                isOpen={false}
                setIsOpen={function (isOpen: boolean): void {
                  throw new Error("Function not implemented.");
                }}
              />
            </div>
          )}

          {activeTab === "settings" && showSettings && (
            <div className="p-4">
              <SettingsPanel
                isOpen={false}
                setIsOpen={function (isOpen: boolean): void {
                  throw new Error("Function not implemented.");
                }}
                onClose={function (): void {
                  throw new Error("Function not implemented.");
                }}
              />
            </div>
          )}
        </main>
      </div>

      <Toaster />
    </div>
  );
}
