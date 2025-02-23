"use client"

import type React from "react"
import { useEffect, useState } from "react"
import imageCompression from "browser-image-compression"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { RefreshCw, Play, ImageIcon, Clock, RatioIcon, Wand2, Sparkles, CheckCircle, Settings } from "lucide-react"
import { SettingsModal } from "./settings-modal"
import { useToast } from "@/components/ui/use-toast"
import { Toast, ToastProvider } from "@/components/ui/toast"

export function VideoDashboard() {
  const { toast } = useToast()
  const [prompts, setPrompts] = useState<string[]>([""])
  const [subtitles, setSubtitles] = useState<string[]>([""])
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  interface GeneratedVideo {
    url: string
    description: string
    subtitles: string
  }

  const [videos, setVideos] = useState<GeneratedVideo[]>([])
  const [audioUrl, setAudioUrl] = useState("")
  const [syncedVideoUrls, setSyncedVideoUrls] = useState<string[]>([])
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string>("");
  const [currentStep, setCurrentStep] = useState("")
  const [activeTab, setActiveTab] = useState("create")
  type ValidDuration = "5" | "10" | "15"
  const [duration, setDuration] = useState<ValidDuration>("5")
  const [aspectRatio, setAspectRatio] = useState("16:9")
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({})
  const [generatedAudio, setGeneratedAudio] = useState<{ [key: number]: string }>({});

  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([])
  const [syncedVideos, setSyncedVideos] = useState<string[]>([])
  
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
  
  
    // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  }

  const extractLastFrame = async (videoUrl: string): Promise<string> => {
    try {
      const response = await fetch("/api/extract-frame", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ videoUrl })
      });

      if (!response.ok) throw new Error("Failed to extract frame");
      
      const { frame } = await response.json();
      return frame;
    } catch (error) {
      console.error("Error extracting frame:", error);
      throw error;
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Compression options
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      }

      try {
        const compressedFile = await imageCompression(file, options)
        setImage(compressedFile)

        // Create preview
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            setImagePreview(e.target.result as string)
          }
        }
        reader.readAsDataURL(compressedFile)
      } catch (error) {
        console.error("Error compressing image:", error)
        alert("Error compressing image. Please try again with a different image.")
      }
    }
  }

  const processScene = async (sceneIndex: number, inputImage: string, subtitle: string, prompt: string) => {
    try {
      // Generate audio for this scene
      const audioResponse = await fetch("/api/generate-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKeys.openaiKey}`,
          "x-elevenlabs-key": apiKeys.elevenLabsKey,
          "x-fal-key": apiKeys.falKey,
        },
        body: JSON.stringify({
          text: subtitle,
          base64Image: inputImage.split(",")[1], // Remove data:image/jpeg;base64, prefix
        }),
      })

      if (!audioResponse.ok) {
        throw new Error(`Failed to generate audio for scene ${sceneIndex + 1}`)
      }

      const { audio } = await audioResponse.json()
      const audioBase64 = `data:audio/mp3;base64,${audio}`

      // Generate video for this scene
      const formData = new FormData()
      const imageBlob = await fetch(inputImage).then((r) => r.blob())
      const sceneImage = new File([imageBlob], "scene.jpg", { type: "image/jpeg" })

      formData.append("image", sceneImage)
      formData.append("prompts", JSON.stringify([prompt]))
      formData.append("subtitles", JSON.stringify([subtitle]))
      formData.append("duration", duration)
      formData.append("aspectRatio", aspectRatio)

      const videoResponse = await fetch("/api/generate-video", {
        headers: {
          "Authorization": `Bearer ${apiKeys.openaiKey}`,
          "x-elevenlabs-key": apiKeys.elevenLabsKey,
          "x-fal-key": apiKeys.falKey,
        },
        method: "POST",
        body: formData,
      })

      if (!videoResponse.ok) {
        const error = await videoResponse.json()
        throw new Error(error.message || `Failed to generate video for scene ${sceneIndex + 1}`)
      }

      const videoData = await videoResponse.json()
      if (!videoData.videos?.[0]?.url) {
        throw new Error(`No valid video URL for scene ${sceneIndex + 1}`)
      }

      // Sync lip movement
      const syncResponse = await fetch("/api/sync-lip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKeys.openaiKey}`,
          "x-elevenlabs-key": apiKeys.elevenLabsKey,
          "x-fal-key": apiKeys.falKey,
        },
        body: JSON.stringify({
          videoUrl: videoData.videos[0].url,
          audioUrl: audioBase64,
        }),
      })

      if (!syncResponse.ok) {
        throw new Error(`Failed to sync lip movement for scene ${sceneIndex + 1}`)
      }

      const { url: syncedUrl } = await syncResponse.json()
      return syncedUrl
    } catch (error) {
      console.error(`Error processing scene ${sceneIndex + 1}:`, error)
      throw error
    }
  }
 
  const handleGenerateContent = async (index: number, type: "description" | "subtitles" | "both") => {
    const stateKey = `${type}-${index}`;
    try {
        setLoadingStates((prev) => ({ ...prev, [stateKey]: true }));

        console.log("🔍 API Keys Before Request:", apiKeys);

        const requestBody = {
            sceneNumber: index + 1,
            totalScenes: Number.parseInt(duration) / 5,
            base64Image: imagePreview.split(",")[1],
            type,
        };

        console.log("📤 Sending Payload:", requestBody);

        const response = await fetch("/api/generate-scene-suggestions", {
            method: "POST",
            headers: new Headers({
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKeys.openaiKey}`, // Ensure this is sent properly
                "x-elevenlabs-key": apiKeys.elevenLabsKey,
                "x-fal-key": apiKeys.falKey,
            }),
            body: JSON.stringify(requestBody),
        });

        console.log("🛜 API Response Status:", response.status);
        const responseData = await response.json();
        console.log("📩 API Response Data:", responseData);

        if (!response.ok) throw new Error(responseData.error || `Failed to generate ${type}`);

        if (type === "both" || type === "description") {
            const newPrompts = [...prompts];
            newPrompts[index] = responseData.sceneDescription;
            setPrompts(newPrompts);
        }

        if (type === "both" || type === "subtitles") {
            const newSubtitles = [...subtitles];
            newSubtitles[index] = responseData.subtitles;
            setSubtitles(newSubtitles);
        }
    } catch (error) {
        console.error(`❌ Error getting ${type}:`, error);
        alert(`Failed to generate ${type}`);
    } finally {
        setLoadingStates((prev) => ({ ...prev, [stateKey]: false }));
    }
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!image || prompts.some((p) => !p)) return;

  setLoading(true);
  setSyncedVideoUrls([]);
  setProgress(0);

  const totalSteps = prompts.length * 4;
  let completedSteps = 0;

  const updateProgress = (step: string) => {
    completedSteps++;
    setProgress((completedSteps / totalSteps) * 100);
    setCurrentStep(step);
  };

  try {
    let currentImage = imagePreview;
    const generatedVideos: GeneratedVideo[] = [];
    const syncedVideos: string[] = [];

    for (let i = 0; i < prompts.length; i++) {
      updateProgress(`Generating voice-over for Scene ${i + 1} of ${prompts.length}...`);

      // ✅ Check if audio already exists
      let audioBase64 = generatedAudio[i];

      if (!audioBase64) {
        const audioResponse = await fetch("/api/generate-audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKeys.openaiKey}`,
            "x-elevenlabs-key": apiKeys.elevenLabsKey,
            "x-fal-key": apiKeys.falKey,
          },
          body: JSON.stringify({
            text: subtitles[i],
            base64Image: imagePreview.split(",")[1],
          }),
        });

        if (!audioResponse.ok) throw new Error(`Failed to generate audio for scene ${i + 1}`);

        const { audio } = await audioResponse.json();
        audioBase64 = `data:audio/mp3;base64,${audio}`;

        // ✅ Cache the generated audio
        setGeneratedAudio((prev) => ({ ...prev, [i]: audioBase64 }));
      } else {
        console.log(`🎤 Using cached audio for Scene ${i + 1}`);
      }

      updateProgress(`Creating AI video for Scene ${i + 1} of ${prompts.length}...`);

      // **Generate video per scene**
      const formData = new FormData();
      const imageBlob = await fetch(currentImage).then((r) => r.blob());
      const sceneImage = new File([imageBlob], "scene.jpg", { type: "image/jpeg" });

      formData.append("image", sceneImage);
      formData.append("prompts", JSON.stringify([prompts[i]]));
      formData.append("subtitles", JSON.stringify([subtitles[i]]));
      formData.append("duration", duration);
      formData.append("aspectRatio", aspectRatio);

      const videoResponse = await fetch("/api/generate-video", {
        headers: {
          "Authorization": `Bearer ${apiKeys.openaiKey}`,
          "x-elevenlabs-key": apiKeys.elevenLabsKey,
          "x-fal-key": apiKeys.falKey,
        },
        method: "POST",
        body: formData,
      });

      if (!videoResponse.ok) throw new Error(`Failed to generate video for scene ${i + 1}`);

      const videoData = await videoResponse.json();
      if (!videoData.videos?.[0]?.url) throw new Error(`No valid video URL for scene ${i + 1}`);

      const videoUrl = videoData.videos[0].url;
      generatedVideos.push({ url: videoUrl, description: `Scene ${i + 1}`, subtitles: subtitles[i] });

      updateProgress(`Synchronizing lip movements for Scene ${i + 1} of ${prompts.length}...`);

      // **Sync lips per scene**
      const syncResponse = await fetch("/api/sync-lip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKeys.openaiKey}`,
          "x-elevenlabs-key": apiKeys.elevenLabsKey,
          "x-fal-key": apiKeys.falKey,
        },
        body: JSON.stringify({
          videoUrl: videoUrl,
          audioUrl: audioBase64,
        }),
      });

      if (!syncResponse.ok) throw new Error(`Failed to sync lip movement for scene ${i + 1}`);

      const { url: syncedUrl } = await syncResponse.json();
      syncedVideos.push(syncedUrl);

      // Extract last frame for next scene if not the last scene
      if (i < prompts.length - 1) {
        try {
          updateProgress(`Extracting frame from Scene ${i + 1} for next scene...`);
          currentImage = await extractLastFrame(syncedUrl);
        } catch (error) {
          console.error(`Failed to extract frame from scene ${i + 1}, using previous image`, error);
          // Continue with the previous image if frame extraction fails
        }
      }
    }

    setVideos(generatedVideos);
    setSyncedVideoUrls(syncedVideos);

    // If there are multiple scenes, merge them
    if (syncedVideos.length > 1) {
      updateProgress(`Merging ${syncedVideos.length} scenes into final video...`);
      try {
        const mergeResponse = await fetch("/api/merge-videos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            videoUrls: syncedVideos
          })
        });

        if (!mergeResponse.ok) throw new Error("Failed to merge videos");

        const { mergedVideoUrl } = await mergeResponse.json();
        setMergedVideoUrl(mergedVideoUrl);
      } catch (error) {
        console.error("Error merging videos:", error);
        toast({
          title: "Warning",
          description: "Videos generated successfully but could not be merged. You can still preview individual scenes.",
          duration: 5000,
        });
      }
    }

    setCurrentStep("Video generation complete! 🎉");

    // ✅ Show success toast and switch to preview tab
    toast({
      title: "Video Generation Complete!",
      description: "Your video has been generated successfully. Switching to preview...",
      duration: 5000,
    });

    // ✅ Switch to preview tab after a delay
    setTimeout(() => {
      setActiveTab("preview");
      setCurrentStep("");
    }, 1000);
  } catch (error) {
    console.error("Error in video processing:", error);
    toast({
      title: "Error Processing Video",
      description: "There was an error processing your video. Please check if your API keys are correctly set in the settings (⚙️). If the issue persists, try again or contact support.",
      duration: 8000,
    });
  } finally {
    setLoading(false);
  }
};

  return (
    <ToastProvider>
    <div className="min-h-screen bg-[#0a0b0d] text-gray-100 overflow-hidden">
      {/* Cool background */}
      <div className="absolute inset-0 bg-[url('/')] bg-cover bg-center opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1b1e] via-[#0d0e10] to-[#0a0b0d] opacity-90"></div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="container relative z-10 py-10 px-4 sm:px-6 lg:px-8"
      >
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-10">
          <div className="text-center space-y-4 flex-1">

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400">
            MovieLab
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Transform your ideas into cinematic experiences with AI-powered video generation
          </p>
          </div>
          <SettingsModal />
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-gray-800/50 rounded-lg p-1">
            <TabsTrigger
              value="create"
              className="rounded-md text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white transition-all duration-300"
            >
              Create Video
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="rounded-md text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white transition-all duration-300"
            >
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <form onSubmit={handleSubmit} className="space-y-8">
              <motion.div variants={itemVariants}>
                <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-2xl text-gray-200">Upload Image</CardTitle>
                    <CardDescription className="text-gray-400">
                      Choose an image to start generating your video
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6">
                      <div
                        onClick={() => document.getElementById("file-upload")?.click()}
                        className="cursor-pointer relative border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-gray-500 transition-colors duration-300"
                      >
                        {imagePreview ? (
                          <div className="relative aspect-video rounded-lg overflow-hidden">
                            <img
                              src={imagePreview || "/placeholder.svg"}
                              alt="Preview"
                              className="object-cover w-full h-full"
                            />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                              <p className="text-white">Click to change image</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="mx-auto w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-gray-400" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-medium text-gray-300">
                                Drop your image here or click to browse
                              </p>
                              <p className="text-sm text-gray-400">Supports JPG, PNG - Max 10MB</p>
                            </div>
                          </div>
                        )}
                        <Input
                          id="file-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-gray-300">
                            <Clock className="w-5 h-5" />
                            <span className="text-sm font-medium">Duration</span>
                          </div>
                          <Select
                            value={duration}
                            onValueChange={(value: ValidDuration) => {
                              setDuration(value)
                              const numScenes = Math.min(4, Number.parseInt(value) / 5);
                              setPrompts(Array(numScenes).fill(""))
                              setSubtitles(Array(numScenes).fill(""))
                              
                            }}
                          >
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-gray-200">
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="5">5 seconds</SelectItem>
<SelectItem value="10">10 seconds</SelectItem>
<SelectItem value="15">15 seconds</SelectItem>
<SelectItem value="20">20 seconds</SelectItem>

                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-gray-300">
                            <RatioIcon className="w-5 h-5" />
                            <span className="text-sm font-medium">Aspect Ratio</span>
                          </div>
                          <Select value={aspectRatio} onValueChange={setAspectRatio}>
                            <SelectTrigger className="bg-gray-700 border-gray-600 text-gray-200">
                              <SelectValue placeholder="Select aspect ratio" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="16:9">16:9</SelectItem>
                              <SelectItem value="9:16">9:16</SelectItem>
                              <SelectItem value="1:1">1:1</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <AnimatePresence>
              {Array.from({ length: Math.min(4, Number.parseInt(duration) / 5) }).map((_, index) => (
                  <motion.div key={index} variants={itemVariants} initial="hidden" animate="visible" exit="hidden">
                    <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm overflow-hidden">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-2xl text-gray-200">Scene {index + 1}</CardTitle>
                            <CardDescription className="text-gray-400">Configure your scene details</CardDescription>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600 transition-colors duration-300"
                            onClick={() => handleGenerateContent(index, "both")}
                            disabled={loadingStates[`both-${index}`] || !imagePreview}
                          >
                            <Wand2 className="w-4 h-4 mr-2" />
                            {loadingStates[`both-${index}`] ? "Generating..." : "Generate All"}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-300">Scene Description</label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-gray-200 transition-colors duration-300"
                              onClick={() => handleGenerateContent(index, "description")}
                              disabled={loadingStates[`description-${index}`] || !imagePreview}
                            >
                              <RefreshCw
                                className={`w-4 h-4 mr-2 ${loadingStates[`description-${index}`] ? "animate-spin" : ""}`}
                              />
                              Regenerate
                            </Button>
                          </div>
                          <Textarea
                            placeholder="Describe how you want this scene to look..."
                            value={prompts[index] || ""}
                            onChange={(e) => {
                              const newPrompts = [...prompts]
                              newPrompts[index] = e.target.value
                              setPrompts(newPrompts)
                            }}
                            className="min-h-[100px] bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-300">Subtitles</label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-gray-200 transition-colors duration-300"
                              onClick={() => handleGenerateContent(index, "subtitles")}
                              disabled={loadingStates[`subtitles-${index}`] || !imagePreview}
                            >
                              <RefreshCw
                                className={`w-4 h-4 mr-2 ${loadingStates[`subtitles-${index}`] ? "animate-spin" : ""}`}
                              />
                              Regenerate
                            </Button>
                          </div>
                          <Textarea
                            placeholder="Enter subtitles or dialogue..."
                            value={subtitles[index] || ""}
                            onChange={(e) => {
                              const newSubtitles = [...subtitles]
                              newSubtitles[index] = e.target.value
                              setSubtitles(newSubtitles)
                            }}
                            className="bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>

              <motion.div variants={itemVariants}>
                <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm overflow-hidden">
                  <CardContent className="pt-6">
                    {loading ? (
                      <div className="space-y-4">
                        <Progress value={progress} className="h-2 bg-gray-700">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-teal-500 rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </Progress>
                        <p className="text-sm text-center text-gray-400">{currentStep}</p>
                      </div>
                    ) : (
                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white transition-all duration-300 transform hover:scale-105"
                        size="lg"
                        disabled={!image || prompts.some((p) => !p)}
                      >
                        <Play className="w-5 h-5 mr-2" />
                        Generate Video
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </form>
          </TabsContent>

          <TabsContent value="preview">
            <motion.div variants={itemVariants}>
              <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-2xl text-gray-200">Generated Content</CardTitle>
                  <CardDescription className="text-gray-400">Preview your generated videos and audio</CardDescription>
                </CardHeader>
                <CardContent>
                  {syncedVideoUrls.length > 0 ? (
                    <div className="grid gap-6">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-full">
                          Lip Sync Complete
                        </span>
                      </div>
                      
                      {/* Show merged video if available */}
                      {mergedVideoUrl && (
                        <Card className="bg-gray-700/50 border-gray-600 overflow-hidden">
                          <CardHeader>
                            <CardTitle className="text-lg text-gray-200">Final Merged Video</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <video controls className="w-full rounded-lg" src={mergedVideoUrl} />
                          </CardContent>
                        </Card>
                      )}

                      {/* Show individual scenes */}
                      <div className="grid md:grid-cols-2 gap-6">
                        {syncedVideoUrls.map((url, index) => (
                          <Card key={url} className="bg-gray-700/50 border-gray-600 overflow-hidden">
                            <CardHeader>
                              <CardTitle className="text-lg text-gray-200">Scene {index + 1}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <video controls className="w-full rounded-lg" src={url} />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : videos.length > 0 ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                        <span className="text-sm text-gray-400">Processing videos...</span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-6">
                        {videos.map((video, index) => (
                          <Card key={video.url} className="bg-gray-700/50 border-gray-600 overflow-hidden">
                            <CardHeader>
                              <CardTitle className="text-lg text-gray-200">{video.description}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <video controls className="w-full rounded-lg" src={video.url} />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <Sparkles className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                      <p className="text-xl font-semibold mb-2">No videos generated yet</p>
                      <p className="text-sm">Start by creating a video in the Create tab.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
      </div>
    </ToastProvider>
  )
}

