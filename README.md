# 🎬 MovieLab – AI-Powered Movie Generation  

🚀 **MovieLab** is an AI-driven platform that transforms simple text prompts into cinematic experiences. From scriptwriting to scene generation, our technology enables anyone—filmmakers, storytellers, and AI enthusiasts—to bring their vision to life through AI-powered storytelling.  

---

## 📽️ Features  

✅ **AI-Powered Scriptwriting** – Generate compelling scripts from a single prompt.  
✅ **OpenAI-Powered Image Analysis** – Detects gender, age, and scene context to match the best voice.  
✅ **Voice Matching & Lip Syncing** – Ensures accurate speech synchronization for realistic dialogues.  
✅ **Scene Merging for Extended Videos** – Seamlessly combines up to **4 scenes** for **20-second videos**.  
✅ **Multi-Model AI Pipeline** – Integrates multiple AI models to generate high-quality video content.  
✅ **Next.js Backend** – Fast, scalable, and efficient for API handling and UI interactions.  

---

## 🛠️ How It Works  

1️⃣ **OpenAI Image Analysis & Conversation Extraction**  
- Uses OpenAI's **vision model** to analyze an **uploaded image** and extract details such as **gender, age, and scene context**.  
- Determines the appropriate **voice type** for narration.  
- Extracts key dialogues and conversations from the input prompt.  

2️⃣ **AI Model Integration**  
- 🎞️ **Video Generation**: Uses **fal-ai/kling-video/v1.6/pro/image-to-video** to create scenes.  
- 🗣️ **Lip-Sync & Animation**: Applies **fal-ai/latentsync** for accurate lip-syncing.  
- 🎙️ **AI Voice Generation**: Utilizes **Eleven Labs' TTS** for high-quality voiceovers.  

3️⃣ **Scene Merging for Extended Videos**  
- For videos up to **20 seconds**, we generate **up to 4 scenes** using a staged approach:  
  - The **last frame** of a scene is used as the **starting image** for the next scene.  
  - The scenes are **stitched together** to ensure a smooth transition.  

---

## 🎥 Demo  

🔗 **[Live Demo (if available)](https://your-demo-link.com)**  

🖼️ *(Optional: Add GIFs or screenshots showcasing generated video clips!)*  

---

## 🚀 Getting Started  

### 🔧 Installation  

Clone the repo and install dependencies:  

```bash
git clone https://github.com/Ahmed14z/MovieLab.git
cd MovieLab
npm install
```

### ▶️ Run the App  

```bash
npm run dev
```

---

## 📌 Tech Stack  

- **AI Models**:  
  - 🖼️ **Image Analysis**: OpenAI Vision Model  
  - 🎞️ **Video Generation**: `fal-ai/kling-video/v1.6/pro/image-to-video`  
  - 🗣️ **Lip-Sync**: `fal-ai/latentsync`  
  - 🎙️ **Text-to-Speech**: `Eleven Labs TTS`  

- **Backend**: Next.js  
- **Frontend**: Next.js  
- **Deployment**: Vercel, AWS / NHN Cloud  

---

## 💡 Future Improvements  

🚀 **Enhanced AI-Generated Camera Angles** – More dynamic scene transitions.  
🎭 **Emotional Speech & Expressions** – Improve facial animations with emotion-based voice tones.  
🎨 **User-Uploaded Style Control** – Allow users to define aesthetics and cinematography.  

---

## 🏆 Hackathon Submission  

🎯 This project was built as part of **[Hackathon Name]** in [Month, Year].  

🤖 **Team Members**:  
- [Ahmed Mansy](https://github.com/Ahmed14z)  
- [Mohamed Magdy](https://github.com/MohamedMagdy097)  

🔗 **Submission Link**: [Devpost / Hackathon Page](https://hackathon-submission-link.com)  

---

## 📜 License  

📝 This project is licensed under the [MIT License](LICENSE).  

---

💬 **Feedback? Contributions?**  
Feel free to open an **Issue** or submit a **Pull Request**! 🚀  

