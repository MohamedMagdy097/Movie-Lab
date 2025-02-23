"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

export function LipSyncTest() {
  const { toast } = useToast()
  const [videoUrl, setVideoUrl] = useState("")
  const [audioUrl, setAudioUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const getStoredApiKeys = (): { openaiKey: string; elevenLabsKey: string; falKey: string } => {
    if (typeof window === "undefined") {
      return { openaiKey: "", elevenLabsKey: "", falKey: "" };
    }
    try {
      return {
        openaiKey: localStorage.getItem("openai_api_key") || "",
        elevenLabsKey: localStorage.getItem("elevenlabs_api_key") || "",
        falKey: localStorage.getItem("fal_key") || "",
      };
    } catch (error) {
      console.error("Error accessing localStorage:", error);
      return { openaiKey: "", elevenLabsKey: "", falKey: "" };
    }
  };
  
  
  const [apiKeys, setApiKeys] = useState({
    openaiKey: "",
    elevenLabsKey: "",
    falKey: "",
  });
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const keys = getStoredApiKeys();
      setApiKeys(keys);
    }
  }, []);
  const handleTest = async () => {
    if (!videoUrl || !audioUrl) {
      toast({
        title: "Missing Input",
        description: "Please provide both video and audio URLs",
        duration: 3000,
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/sync-lip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKeys.openaiKey}`,
          "x-elevenlabs-key": apiKeys.elevenLabsKey,
          "x-fal-key": apiKeys.falKey,
        },
        body: JSON.stringify({
          videoUrl,
          audioUrl,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to sync lip movement")
      }

      const data = await response.json()
      setResult(data.url)
      toast({
        title: "Success!",
        description: "Lip sync completed successfully",
        duration: 3000,
      })
    } catch (error) {
      console.error("Error in lip sync:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to sync lip movement",
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gray-800/95 border-gray-700">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-100">Lip Sync Test</CardTitle>
        <CardDescription className="text-gray-400">
          Test the lip sync functionality by providing a video URL and an audio URL
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-200">Video URL</label>
          <Input
            placeholder="Enter video URL..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="bg-gray-700/50 border-gray-600 text-gray-200"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-200">Audio URL</label>
          <Input
            placeholder="Enter audio URL (base64 or URL)..."
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            className="bg-gray-700/50 border-gray-600 text-gray-200"
          />
        </div>
        <Button 
          onClick={handleTest}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? "Processing..." : "Test Lip Sync"}
        </Button>

        {result && (
          <div className="mt-4 space-y-2">
            <h3 className="text-lg font-medium text-gray-200">Result</h3>
            <video 
              src={result}
              controls
              className="w-full rounded-lg"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
