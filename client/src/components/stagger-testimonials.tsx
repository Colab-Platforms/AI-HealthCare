import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SQRT_5000 = Math.sqrt(5000);

const testimonials = [
  {
    tempId: 0,
    testimonial: "The personalized diet suggestions are well structured. It’s great to see technology helping people make better food choices based on their health data.",
    by: "Saurabh Sonawane",
  },
  {
    tempId: 1,
    testimonial: "I never paid attention to nutrition before. This app made it easy to understand calories, macros, and even micronutrients.",
    by: "Kavya Nair",
  },
  {
    tempId: 2,
    testimonial: "A very smart platform for people who want to stay healthy and avoid future medical problems.",
    by: "Arjun Gupta",
  },
  {
    tempId: 3,
    testimonial: "I uploaded my blood test report and the AI explained everything in simple language. It pointed out that my Vitamin B12 levels were low and suggested diet changes. No app has ever made my lab reports this easy to understand.",
    by: "Rohit Patil",
  },
  {
    tempId: 4,
    testimonial: "The calorie and nutrition tracking is very detailed. I can see my macros and micronutrients clearly, and the AI tells me exactly what I should improve in my diet.",
    by: "Shreya Shah",
  },
  {
    tempId: 5,
    testimonial: "The sleep tracking insights helped me realize my irregular sleep pattern was affecting my energy levels. The app’s suggestions helped me improve my routine.",
    by: "Nikhil Jain",
  },
  {
    tempId: 6,
    testimonial: "My father has diabetes and the dedicated diabetes section helps him track sugar levels and get diet suggestions. It’s very helpful for daily management.",
    by: "Rahul Nair",
  },
  {
    tempId: 7,
    testimonial: "This app feels like having a personal health advisor in your pocket. It tells you what your body actually needs.",
    by: "Karan Deshmukh",
  },
  {
    tempId: 8,
    testimonial: "I like how the platform connects food, activity, sleep, and lab reports in one place.",
    by: "Aditya Mehta",
  },
  {
    tempId: 9,
    testimonial: "The AI lab report analyser is extremely useful. It explains what each parameter means and what I should do next.",
    by: "Dr. Sneha Iyer",
  }
];

interface TestimonialCardProps {
  position: number;
  testimonial: typeof testimonials[0];
  handleMove: (steps: number) => void;
  cardSize: number;
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({ 
  position, 
  testimonial, 
  handleMove, 
  cardSize 
}) => {
  const isCenter = position === 0;

  return (
    <div
      onClick={() => handleMove(position)}
      className={cn(
        "absolute left-1/2 top-1/2 cursor-pointer border-2 p-8 transition-all duration-500 ease-in-out",
        isCenter 
          ? "z-10 bg-gradient-to-br from-[#0a3d5c] to-[#0d5a8a] text-white border-cyan-400/60" 
          : "z-0 bg-gradient-to-br from-[#0a3d5c]/40 to-[#0d5a8a]/40 text-cyan-100 border-cyan-400/20 hover:border-cyan-400/40"
      )}
      style={{
        width: cardSize,
        height: cardSize,
        clipPath: `polygon(50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, calc(100% - 50px) 100%, 50px 100%, 0 100%, 0 0)`,
        transform: `
          translate(-50%, -50%) 
          translateX(${(cardSize / 1.5) * position}px)
          translateY(${isCenter ? -65 : position % 2 ? 15 : -15}px)
          rotate(${isCenter ? 0 : position % 2 ? 2.5 : -2.5}deg)
        `,
        boxShadow: isCenter ? "0px 8px 0px 4px hsl(var(--border))" : "0px 0px 0px 0px transparent"
      }}
    >
      <span
        className="absolute block origin-top-right rotate-45 bg-border"
        style={{
          right: -2,
          top: 48,
          width: SQRT_5000,
          height: 2
        }}
      />
      <div className="mb-6" /> {/* Spacer instead of image */}
      <h3 className={cn(
        "text-base sm:text-xl font-medium",
        isCenter ? "text-white" : "text-cyan-100"
      )}>
        "{testimonial.testimonial}"
      </h3>
      <p className={cn(
        "absolute bottom-8 left-8 right-8 mt-2 text-sm italic",
        isCenter ? "text-white/80" : "text-cyan-100/60"
      )}>
        - {testimonial.by}
      </p>
    </div>
  );
};

export const StaggerTestimonials: React.FC = () => {
  const [cardSize, setCardSize] = useState(365);
  const [testimonialsList, setTestimonialsList] = useState(testimonials);

  const handleMove = (steps: number) => {
    const newList = [...testimonialsList];
    if (steps > 0) {
      for (let i = steps; i > 0; i--) {
        const item = newList.shift();
        if (!item) return;
        newList.push({ ...item, tempId: Math.random() });
      }
    } else {
      for (let i = steps; i < 0; i++) {
        const item = newList.pop();
        if (!item) return;
        newList.unshift({ ...item, tempId: Math.random() });
      }
    }
    setTestimonialsList(newList);
  };

  useEffect(() => {
    const updateSize = () => {
      const { matches } = window.matchMedia("(min-width: 640px)");
      setCardSize(matches ? 365 : 290);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden bg-muted/30"
      style={{ height: 600 }}
    >
      {testimonialsList.map((testimonial, index) => {
        const position = testimonialsList.length % 2
          ? index - (testimonialsList.length + 1) / 2
          : index - testimonialsList.length / 2;
        return (
          <TestimonialCard
            key={testimonial.tempId}
            testimonial={testimonial}
            handleMove={handleMove}
            position={position}
            cardSize={cardSize}
          />
        );
      })}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        <button
          onClick={() => handleMove(-1)}
          className={cn(
            "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
            "bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
          aria-label="Previous testimonial"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={() => handleMove(1)}
          className={cn(
            "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
            "bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
          aria-label="Next testimonial"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
};