import { useState } from 'react';
import { Mail, Send, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EmailTest() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const testEmail = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/doctors/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({ success: true, message: data.message });
        toast.success('Test email sent successfully!');
      } else {
        setResult({ success: false, message: data.message });
        toast.error('Failed to send email');
      }
    } catch (error) {
      console.error('Email test error:', error);
      setResult({ success: false, message: error.message });
      toast.error('Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Email Test</h1>
          <p className="text-slate-400">Test your SMTP email configuration</p>
        </div>

        {/* SMTP Configuration Display */}
        <div className="bg-slate-800 rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-cyan-400" />
            Current SMTP Configuration
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Host:</span>
              <span className="text-white ml-2">smtp.gmail.com</span>
            </div>
            <div>
              <span className="text-slate-400">Port:</span>
              <span className="text-white ml-2">587</span>
            </div>
            <div>
              <span className="text-slate-400">User:</span>
              <span className="text-white ml-2">tech@colabplatforms.com</span>
            </div>
            <div>
              <span className="text-slate-400">From:</span>
              <span className="text-white ml-2">HealthAI &lt;tech@colabplatforms.com&gt;</span>
            </div>
          </div>
        </div>

        {/* Email Test Form */}
        <div className="bg-slate-800 rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-bold text-white mb-4">Send Test Email</h3>
          
          <form onSubmit={testEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Test Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email to receive test appointment confirmation"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 disabled:from-slate-600 disabled:to-slate-600 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Test Email
                </>
              )}
            </button>
          </form>
        </div>

        {/* Result Display */}
        {result && (
          <div className={`rounded-2xl p-6 ${
            result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              {result.success ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-400" />
              )}
              <h3 className={`text-lg font-bold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? 'Email Sent Successfully!' : 'Email Failed'}
              </h3>
            </div>
            <p className={`${result.success ? 'text-green-300' : 'text-red-300'}`}>
              {result.message}
            </p>
            
            {result.success && (
              <div className="mt-4 p-4 bg-slate-800 rounded-lg">
                <h4 className="text-white font-medium mb-2">What to expect:</h4>
                <ul className="text-slate-300 text-sm space-y-1">
                  <li>• Check your inbox for "Appointment Confirmation - HealthAI"</li>
                  <li>• The email will contain appointment details and a join link</li>
                  <li>• It may take a few minutes to arrive</li>
                  <li>• Check spam folder if not received</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Email Features</h3>
          <div className="space-y-4 text-slate-300">
            <div>
              <h4 className="text-white font-medium mb-2">📧 Appointment Confirmation</h4>
              <p className="text-sm">Professional HTML email with appointment details, doctor info, and video call join link.</p>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-2">⏰ Automated Reminders</h4>
              <p className="text-sm">System sends reminders 24 hours before and 30 minutes before appointments.</p>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-2">📱 Mobile Responsive</h4>
              <p className="text-sm">Emails look great on all devices with touch-friendly buttons and responsive design.</p>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-2">🎨 Professional Design</h4>
              <p className="text-sm">Branded emails with HealthAI colors, gradients, and professional layout.</p>
            </div>
          </div>
        </div>

        {/* SMTP Troubleshooting */}
        <div className="mt-8 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-yellow-400 mb-4">Troubleshooting</h3>
          <div className="space-y-2 text-yellow-300 text-sm">
            <p>• <strong>Gmail App Password:</strong> Make sure you're using an app password, not your regular Gmail password</p>
            <p>• <strong>2FA Required:</strong> Gmail requires 2-factor authentication to generate app passwords</p>
            <p>• <strong>Less Secure Apps:</strong> App passwords bypass the need for "less secure apps" setting</p>
            <p>• <strong>Rate Limits:</strong> Gmail has sending limits (500 emails/day for free accounts)</p>
            <p>• <strong>Spam Filters:</strong> Test emails might go to spam initially</p>
          </div>
        </div>
      </div>
    </div>
  );
}