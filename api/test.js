// Simplest possible test endpoint - no dependencies
module.exports = async (req, res) => {
  try {
    res.status(200).json({
      status: 'ok',
      message: 'Serverless function is working!',
      method: req.method,
      url: req.url,
      env: {
        hasMongoUri: !!process.env.MONGODB_URI,
        hasJwtSecret: !!process.env.JWT_SECRET,
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
