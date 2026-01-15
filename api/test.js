// Simple test endpoint to check if serverless functions work
module.exports = (req, res) => {
  res.json({
    status: 'ok',
    message: 'Serverless function is working!',
    env: {
      hasMongoUri: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      nodeEnv: process.env.NODE_ENV,
      clientUrl: process.env.CLIENT_URL
    },
    timestamp: new Date().toISOString()
  });
};
