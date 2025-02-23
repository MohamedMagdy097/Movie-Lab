import { NextApiRequest } from "next";

export const getApiKeys = async (req?: NextApiRequest) => {
  // Initialize with environment variables as default
  let keys = {
    openaiKey: process.env.OPENAI_API_KEY || '',
    elevenLabsKey: process.env.ELEVENLABS_API_KEY || '',
    falKey: process.env.FAL_KEY || '',
  };

  // Only override with headers if they are present and not empty
  if (req?.headers) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 7) {
      const headerKey = authHeader.replace('Bearer ', '').trim();
      if (headerKey) {
        keys.openaiKey = headerKey;
      }
    }

    const elevenLabsHeader = req.headers['x-elevenlabs-key'];
    if (elevenLabsHeader && typeof elevenLabsHeader === 'string' && elevenLabsHeader.trim()) {
      keys.elevenLabsKey = elevenLabsHeader.trim();
    }

    const falHeader = req.headers['x-fal-key'];
    if (falHeader && typeof falHeader === 'string' && falHeader.trim()) {
      keys.falKey = falHeader.trim();
    }
  }

  return keys;
};