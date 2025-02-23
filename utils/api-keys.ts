import { NextApiRequest } from "next";

export const getApiKeys = async (req?: NextApiRequest) => {
  let keys = {
    openaiKey: process.env.OPENAI_API_KEY || '',
    elevenLabsKey: process.env.ELEVENLABS_API_KEY || '',
    falKey: process.env.FAL_KEY || '',
  };


  // If API keys are missing in .env, try to get them from request headers
  if (req) {
    const authHeader = req.headers.authorization;
    if (!keys.openaiKey && authHeader) {
      keys.openaiKey = authHeader.replace("Bearer ", "");
    }

    if (!keys.elevenLabsKey && req.headers["x-elevenlabs-key"]) {
      keys.elevenLabsKey = req.headers["x-elevenlabs-key"] as string;
    }

    if (!keys.falKey && req.headers["x-fal-key"]) {
      keys.falKey = req.headers["x-fal-key"] as string;
    }
  }

  return keys;
};
