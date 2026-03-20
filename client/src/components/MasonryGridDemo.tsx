import * as React from 'react';
import { MasonryGrid } from './image-testimonial-grid'; // Adjust the import path as needed

// --- Data for the cards ---
const testimonials = [
    {
        profileImage: 'https://randomuser.me/api/portraits/men/32.jpg',
        name: 'Anaam Farooq',
        feedback: "Kashmir's Hidden Winter Wonderland",
        mainImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&h=1200&q=80',
    },
    {
        profileImage: 'https://randomuser.me/api/portraits/women/44.jpg',
        name: 'neophyte_clicker',
        feedback: 'Celebrating Diwali Through The Lens',
        mainImage: 'https://images.unsplash.com/photo-1605292356183-a77d0a9c9d1d?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8RGl3YWxpfGVufDB8fDB8fHww',
    },
    {
        profileImage: 'https://randomuser.me/api/portraits/men/56.jpg',
        name: 'Badshah1341',
        feedback: 'A Sunset Symphony in Gold',
        mainImage: 'https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?auto=format&fit=crop&w=800&h=1000&q=80',
    },
    {
        profileImage: 'https://randomuser.me/api/portraits/men/78.jpg',
        name: 'mohsinsyasin_',
        feedback: 'realme Insider Event Kashmir',
        mainImage: 'https://images.unsplash.com/photo-1617396900799-f4ec2b43c7ae?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fHdhbGxwYXBlciUyMDRrfGVufDB8fDB8fHww',
    },
    {
        profileImage: 'https://randomuser.me/api/portraits/women/68.jpg',
        name: 'Naaz khan',
        feedback: 'Illuminate the Night with the P3 Pro',
        mainImage: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NTF8fG5hdHVyZXxlbnwwfHwwfHx8MA%3D%3D',
    },
    {
        profileImage: 'https://randomuser.me/api/portraits/women/88.jpg',
        name: 'Venky_smile',
        feedback: 'Highlights from realme',
        mainImage: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OTh8fG5hdHVyZXxlbnwwfHwwfHx8MA%3D%3D',
    },
    {
        profileImage: 'https://randomuser.me/api/portraits/men/21.jpg',
        name: 'LoserAnant',
        feedback: '14 Pro Series Launch Event Recap',
        mainImage: 'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Njh8fG5hdHVyZXxlbnwwfHwwfHx8MA%3D%3D',
    },
    {
        profileImage: 'https://randomuser.me/api/portraits/women/11.jpg',
        name: 'Isabella',
        feedback: 'The mountains are calling me.',
        mainImage: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=800&h=1200&q=80',
    },
];

// --- Reusable Card Component ---
const TestimonialCard = ({ profileImage, name, feedback, mainImage }: (typeof testimonials)[0]) => (
  <div className="relative rounded-2xl overflow-hidden group transition-transform duration-300 ease-in-out hover:scale-105">
    <img
      src={mainImage}
      alt={feedback}
      className="w-full h-auto object-cover"
      onError={(e) => {
        e.currentTarget.src = 'https://placehold.co/800x600/1a1a1a/ffffff?text=Image';
      }}
    />
    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent" />
    <div className="absolute top-0 left-0 p-4 text-white">
      <div className="flex items-center gap-3 mb-2">
        <img
          src={profileImage}
          className="w-8 h-8 rounded-full border-2 border-white/80"
          alt={name}
          onError={(e) => {
            e.currentTarget.src = 'https://placehold.co/40x40/EFEFEF/333333?text=A';
          }}
        />
        <span className="font-semibold text-sm drop-shadow-md">{name}</span>
      </div>
      <p className="text-sm font-medium leading-tight drop-shadow-md">{feedback}</p>
    </div>
  </div>
);


// --- Demo Component ---
const MasonryGridDemo = () => {
  const [columns, setColumns] = React.useState(4);

  // Function to determine columns based on screen width
  const getColumns = (width: number) => {
    if (width < 640) return 1;    // sm
    if (width < 1024) return 2;   // lg
    if (width < 1280) return 3;   // xl
    return 4;                     // 2xl and up
  };

  React.useEffect(() => {
    const handleResize = () => {
      setColumns(getColumns(window.innerWidth));
    };

    handleResize(); // Set initial columns on mount

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8 bg-transparent text-white">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center text-white">What People Are Saying</h1>
        <MasonryGrid columns={columns} gap={4}>
          {testimonials.map((card, index) => (
            <TestimonialCard key={index} {...card} />
          ))}
        </MasonryGrid>
      </div>
    </div>
  );
};

export default MasonryGridDemo;