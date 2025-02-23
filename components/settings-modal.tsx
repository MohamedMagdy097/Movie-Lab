import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Settings, Key } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface ApiKeys {
  openaiKey: string
  falKey: string
  elevenLabsKey: string
}

export function SettingsModal() {
  const { toast } = useToast()
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    openaiKey: "",
    falKey: "",
    elevenLabsKey: "",
  })

  // Load API keys from localStorage on component mount
  useEffect(() => {
    const savedKeys = {
      openaiKey: localStorage.getItem("openai_api_key") || "",
      falKey: localStorage.getItem("fal_key") || "",
      elevenLabsKey: localStorage.getItem("elevenlabs_api_key") || "",
    }
    setApiKeys(savedKeys)
  }, [])

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem("openai_api_key", apiKeys.openaiKey)
    localStorage.setItem("fal_key", apiKeys.falKey)
    localStorage.setItem("elevenlabs_api_key", apiKeys.elevenLabsKey)

    toast({
      title: "Settings Saved",
      description: "Your API keys have been saved successfully.",
      duration: 3000,
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50"
        >
          <Settings className="h-5 w-5 text-gray-400" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800/95 border-gray-700 text-gray-100 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Key className="w-5 h-5" />
            API Settings
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure your API keys for video generation. These will be stored locally in your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="openai" className="text-gray-200">OpenAI API Key</Label>
            <Input
              id="openai"
              type="password"
              placeholder="sk-..."
              value={apiKeys.openaiKey}
              onChange={(e) => setApiKeys({ ...apiKeys, openaiKey: e.target.value })}
              className="bg-gray-700/50 border-gray-600 text-gray-200 placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-400">Used for scene suggestions and audio generation</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fal" className="text-gray-200">Fal.ai API Key</Label>
            <Input
              id="fal"
              type="password"
              placeholder="fal_..."
              value={apiKeys.falKey}
              onChange={(e) => setApiKeys({ ...apiKeys, falKey: e.target.value })}
              className="bg-gray-700/50 border-gray-600 text-gray-200 placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-400">Required for video generation and lip sync</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="elevenlabs" className="text-gray-200">ElevenLabs API Key</Label>
            <Input
              id="elevenlabs"
              type="password"
              placeholder="..."
              value={apiKeys.elevenLabsKey}
              onChange={(e) => setApiKeys({ ...apiKeys, elevenLabsKey: e.target.value })}
              className="bg-gray-700/50 border-gray-600 text-gray-200 placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-400">Used for high-quality voice generation</p>
          </div>
          <Button
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white"
          >
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
