export default function Test() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>✅ App is Working!</h1>
      <p>If you see this page, the React app is running correctly.</p>
      <p>Current URL: {window.location.href}</p>
      <p>Timestamp: {new Date().toLocaleString()}</p>
      <hr />
      <h2>Next Steps:</h2>
      <ol>
        <li>Go to <a href="/">Home Page</a></li>
        <li>Try <a href="/login">Login</a></li>
        <li>Try <a href="/register">Register</a></li>
      </ol>
    </div>
  );
}
