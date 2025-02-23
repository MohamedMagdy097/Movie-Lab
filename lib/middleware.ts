import { NextApiRequest, NextApiResponse } from 'next';
import getRawBody from 'raw-body';

export async function parseBody(req: NextApiRequest) {
  const contentType = req.headers['content-type'];
  if (contentType && contentType.includes('application/json')) {
    const raw = await getRawBody(req, {
      length: req.headers['content-length'],
      limit: '10mb',
    });
    return JSON.parse(raw.toString());
  }
  return {};
}

export function withBodyParser(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async function (req: NextApiRequest, res: NextApiResponse) {
    if (!req.body) {
      try {
        req.body = await parseBody(req);
      } catch (error) {
        console.error('Error parsing body:', error);
        return res.status(400).json({ error: 'Invalid request body' });
      }
    }
    return handler(req, res);
  };
}
