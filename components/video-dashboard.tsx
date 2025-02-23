"use client"

import type React from "react"

import { useState } from "react"
import imageCompression from "browser-image-compression"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Upload, RefreshCw, Play, ImageIcon, Clock, RatioIcon as AspectRatio, Wand2 } from 'lucide-react';

export function VideoDashboard() {
  const [prompts, setPrompts] = useState<string[]>([""])
  const [subtitles, setSubtitles] = useState<string[]>([""])
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0);
  interface GeneratedVideo {
    url: string
    description: string
    subtitles: string
  }

  const [videos, setVideos] = useState<GeneratedVideo[]>([])
  const [audioUrl, setAudioUrl] = useState("")
  const [syncedVideoUrls, setSyncedVideoUrls] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState("")
  type ValidDuration = "5" | "10"
  const [duration, setDuration] = useState<ValidDuration>("5")
  const [aspectRatio, setAspectRatio] = useState("16:9")
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({})
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([])
  const [syncedVideos, setSyncedVideos] = useState<string[]>([])

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
        },
        body: JSON.stringify({
          videoUrl: videoData.videos[0].url,
          audioUrl: audioBase64,
        }),
      })

      if (!syncResponse.ok) {
        throw new Error(`Failed to sync lip movement for scene ${sceneIndex + 1}`)
      }

      const data = await syncResponse.json()
      console.log('Sync response data:', data)
      return data.url
    } catch (error) {
      console.error(`Error processing scene ${sceneIndex + 1}:`, error)
      throw error
    }
  }

  const handleGenerateContent = async (index: number, type: 'description' | 'subtitles' | 'both') => {
    const stateKey = `${type}-${index}`;
    try {
      setLoadingStates(prev => ({ ...prev, [stateKey]: true }));
      const response = await fetch('/api/generate-scene-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneNumber: index + 1,
          totalScenes: parseInt(duration) / 5,
          base64Image: imagePreview.split(',')[1],
          type
        })
      });

      if (!response.ok) throw new Error(`Failed to generate ${type}`);
      
      const data = await response.json();
      
      if (type === 'both' || type === 'description') {
        const newPrompts = [...prompts];
        newPrompts[index] = data.sceneDescription;
        setPrompts(newPrompts);
      }
      
      if (type === 'both' || type === 'subtitles') {
        const newSubtitles = [...subtitles];
        newSubtitles[index] = data.subtitles;
        setSubtitles(newSubtitles);
      }
    } catch (error) {
      console.error(`Error getting ${type}:`, error);
      alert(`Failed to generate ${type}`);
    } finally {
      setLoadingStates(prev => ({ ...prev, [stateKey]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!image || prompts.some((p) => !p)) return

    setLoading(true);
    setSyncedVideoUrls([]);
    setProgress(0);
    
    const totalSteps = prompts.length * 4; // Audio + Video + Sync + Frame Extraction per scene
    let completedSteps = 0;
    
    const updateProgress = (step: string) => {
      completedSteps++;
      setProgress((completedSteps / totalSteps) * 100);
      setCurrentStep(step);
    };

    try {
      let currentImage = imagePreview
      const generatedVideos: GeneratedVideo[] = []
      const syncedVideos: string[] = []

      for (let i = 0; i < prompts.length; i++) {
        updateProgress(`Generating voice-over audio for Scene ${i + 1} of ${prompts.length}...`)

        // **Generate audio per scene**
        const audioResponse = await fetch("/api/generate-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: subtitles[i],
            base64Image: imagePreview.split(",")[1],
          }),
        })

        if (!audioResponse.ok) throw new Error(`Failed to generate audio for scene ${i + 1}`)

        const { audio } = await audioResponse.json()
        const audioBase64 = `data:audio/mp3;base64,${audio}`

        updateProgress(`Creating AI-generated video for Scene ${i + 1} of ${prompts.length}...`)

        // **Generate video per scene**
        const formData = new FormData()
        const imageBlob = await fetch(currentImage).then((r) => r.blob())
        const sceneImage = new File([imageBlob], "scene.jpg", { type: "image/jpeg" })

        formData.append("image", sceneImage)
        formData.append("prompts", JSON.stringify([prompts[i]]))
        formData.append("subtitles", JSON.stringify([subtitles[i]]))
        formData.append("duration", duration)
        formData.append("aspectRatio", aspectRatio)

        const videoResponse = await fetch("/api/generate-video", {
          method: "POST",
          body: formData,
        })

        if (!videoResponse.ok) throw new Error(`Failed to generate video for scene ${i + 1}`)

        const videoData = await videoResponse.json()
        if (!videoData.videos?.[0]?.url) throw new Error(`No valid video URL for scene ${i + 1}`)

        const videoUrl = videoData.videos[0].url
        generatedVideos.push({ url: videoUrl, description: `Scene ${i + 1}`, subtitles: subtitles[i] })

        updateProgress(`Synchronizing lip movements for Scene ${i + 1} of ${prompts.length}...`)

        // **Sync lips per scene**
        const syncResponse = await fetch("/api/sync-lip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: videoUrl,
            audioUrl: audioBase64,
          }),
        })

        if (!syncResponse.ok) throw new Error(`Failed to sync lip movement for scene ${i + 1}`)

        const data = await syncResponse.json()
        console.log(`Sync response data for scene ${i + 1}:`, data)
        if (!data.url) {
          throw new Error(`No synced video URL returned for scene ${i + 1}`)
        }
        syncedVideos.push(data.url)

        // **Extract last frame as transition if needed**
        if (i < prompts.length - 1) {
          updateProgress(`Processing transition frame from Scene ${i + 1}...`)
          const frameResponse = await fetch("/api/extract-frame", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoUrl: data.url }),
          })

          if (!frameResponse.ok) throw new Error(`Failed to extract frame for scene ${i + 1}`)
          const { frame } = await frameResponse.json()
          currentImage = frame
        }
      }

      // **Update UI with generated and synced videos**
      setVideos(generatedVideos)
      setSyncedVideoUrls(syncedVideos)
      setCurrentStep('Video generation complete! Your AI-powered video is ready for preview.');
    } catch (error) {
      console.error("Error in video processing:", error)
      alert(error.message || "Failed to process video.")
      console.error('Error:', error);
      alert('Failed to process video.');
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="container py-10">
        <div className="text-center mb-10 space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">MovieLab</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Transform your ideas into cinematic experiences with AI-powered video generation
          </p>
        </div>

        <Tabs defaultValue="create" className="max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="create">Create Video</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          
          <TabsContent value="create">
            <form onSubmit={handleSubmit} className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Image</CardTitle>
                  <CardDescription>Choose an image to start generating your video</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6">
                    <div 
                      onClick={() => document.getElementById('file-upload')?.click()}
                      className="cursor-pointer relative border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors"
                    >
                      {imagePreview ? (
                        <div className="relative aspect-video rounded-lg overflow-hidden">
                          <img src={imagePreview || "/placeholder.svg"} alt="Preview" className="object-cover w-full h-full" />
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <p className="text-white">Click to change image</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Drop your image here or click to browse</p>
                            <p className="text-xs text-muted-foreground">Supports JPG, PNG - Max 10MB</p>
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
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm font-medium">Duration</span>
                        </div>
                        <Select 
                          value={duration} 
                          onValueChange={(value: ValidDuration) => {
                            setDuration(value);
                            const numScenes = parseInt(value) / 5;
                            setPrompts(Array(numScenes).fill(''));
                            setSubtitles(Array(numScenes).fill(''));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 seconds</SelectItem>
                            <SelectItem value="10">10 seconds</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <AspectRatio className="w-4 h-4" />
                          <span className="text-sm font-medium">Aspect Ratio</span>
                        </div>
                        <Select value={aspectRatio} onValueChange={setAspectRatio}>
                          <SelectTrigger>
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

              <div className="space-y-6">
                {Array.from({ length: parseInt(duration) / 5 }).map((_, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <CardTitle>Scene {index + 1}</CardTitle>
                          <CardDescription>Configure your scene details</CardDescription>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() => handleGenerateContent(index, 'both')}
                          disabled={loadingStates[`both-${index}`] || !imagePreview}
                        >
                          <Wand2 className="w-4 h-4" />
                          {loadingStates[`both-${index}`] ? 'Generating...' : 'Generate All'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Scene Description</label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGenerateContent(index, 'description')}
                            disabled={loadingStates[`description-${index}`] || !imagePreview}
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loadingStates[`description-${index}`] ? 'animate-spin' : ''}`} />
                            Regenerate
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Describe how you want this scene to look..."
                          value={prompts[index] || ''}
                          onChange={(e) => {
                            const newPrompts = [...prompts];
                            newPrompts[index] = e.target.value;
                            setPrompts(newPrompts);
                          }}
                          className="min-h-[100px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Subtitles</label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGenerateContent(index, 'subtitles')}
                            disabled={loadingStates[`subtitles-${index}`] || !imagePreview}
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loadingStates[`subtitles-${index}`] ? 'animate-spin' : ''}`} />
                            Regenerate
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Enter subtitles or dialogue..."
                          value={subtitles[index] || ''}
                          onChange={(e) => {
                            const newSubtitles = [...subtitles];
                            newSubtitles[index] = e.target.value;
                            setSubtitles(newSubtitles);
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardContent className="pt-6">
                  {loading ? (
                    <div className="space-y-4">
                      <Progress value={progress} />
                      <p className="text-sm text-center text-muted-foreground">{currentStep}</p>
                    </div>
                  ) : (
                    <Button type="submit" className="w-full" size="lg" disabled={!image || prompts.some(p => !p)}>
                      <Play className="w-4 h-4 mr-2" />
                      Generate Video
                    </Button>
                  )}
                </CardContent>
              </Card>
            </form>
          </TabsContent>

          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <CardTitle>Generated Content</CardTitle>
                <CardDescription>Preview your generated videos and audio</CardDescription>
              </CardHeader>
              <CardContent>
                {syncedVideoUrls.length > 0 ? (
                  <div className="grid gap-6">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Lip Sync Complete</Badge>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      {syncedVideoUrls.map((url, index) => (
                        <Card key={url}>
                          <CardHeader>
                            <CardTitle className="text-lg">Scene {index + 1}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <video
                              controls
                              className="w-full rounded-lg"
                              src={url}
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : videos.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                      <span className="text-sm">Processing videos...</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      {videos.map((video, index) => (
                        <Card key={video.url}>
                          <CardHeader>
                            <CardTitle className="text-lg">{video.description}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <video
                              controls
                              className="w-full rounded-lg"
                              src={video.url}
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No videos generated yet. Start by creating a video in the Create tab.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
