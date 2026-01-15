// Simple endpoint to check environment variables (for debugging only)
module.exports = async (req, res) => {
  try {
    res.status(200).json({
      status: 'ok',
      env: {
        hasMongoUri: !!process.env.MONGODB_URI,
        mongoUriPrefix: process.env.MONGODB_URI?.substring(0, 20) + '...',
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
        openRouterKeyPrefix: process.env.OPENROUTER_API_KEY?.substring(0, 15) + '...',
        hasClientUrl: !!process.env.CLIENT_URL,
        clientUrl: process.env.CLIENT_URL,
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
