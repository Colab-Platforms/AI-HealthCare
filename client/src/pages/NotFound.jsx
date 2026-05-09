import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#faf9f8] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        {/* 404 Text */}
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-transparent bg-clip-text bg-[#2f6464] mb-4">
            404
          </h1>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
            Page Not Found
          </h2>
          <p className="text-gray-600 text-lg mb-2">
            Oops! The page you're looking for doesn't exist.
          </p>
          <p className="text-gray-500 text-sm">
            It might have been moved or deleted. Let's get you back on track!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-[#2f6464] text-[#2f6464] rounded-lg font-semibold hover:bg-[#2f6464] hover:text-white transition-colors duration-200"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#2f6464] text-white rounded-lg font-semibold hover:shadow-lg transition-all duration-200"
          >
            <Home size={20} />
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
