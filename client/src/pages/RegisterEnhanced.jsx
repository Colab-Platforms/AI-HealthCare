import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Activity, Mail, Lock, User, Eye, EyeOff, ArrowRight, Stethoscope, 
  Heart, ArrowLeft, Scale, Ruler, Droplet, Cigarette, Wine, Moon,
  Dumbbell, Target, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterEnhanced() {
  const [step, setStep] = useState(1); // 1: role, 2: basic, 3: health, 4: lifestyle, 5: goals
  const [userType, setUserType] = useState(null);
  const [formData, setFormData] = useState({ 
    // Basic Info
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '',
    age: '',
    gender: '',
    // Health Profile
    height: '', // cm
    weight: '', // kg
    bloodGroup: '',
    dietaryPreference: 'non-vegetarian',
    activityLevel: 'sedentary',
    // Medical History
    chronicConditions: [],
    allergies: [],
    currentMedications: [],
    // Lifestyle
    smoker: false,
    smokingFrequency: '',
    alcohol: false,
    alcoholFrequency: '',
    sleepHours: '7',
    stressLevel: 'moderate',
    waterIntake: '8',
    // Nutrition Goals
    nutritionGoal: 'general_health',
    targetWeight: '',
    weeklyGoal: '0.5'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    setUserType(role);
    if (role === 'doctor') {
      navigate('/register/doctor');
    } else {
      setStep(2);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      const profileData = {
        age: parseInt(formData.age),
        gender: formData.gender,
        height: parseFloat(formData.height),
        weight: parseFloat(formData.weight),
        bloodGroup: formData.bloodGroup,
        dietaryPreference: formData.dietaryPreference,
        activityLevel: formData.activityLevel,
        medicalHistory: {
          conditions: formData.chronicConditions,
          currentMedications: formData.currentMedications
        },
        lifestyle: {
          smoker: formData.smoker,
          smokingFrequency: formData.smokingFrequency,
          alcohol: formData.alcohol,
          alcoholFrequency: formData.alcoholFrequency,
          sleepHours: parseInt(formData.sleepHours),
          stressLevel: formData.stressLevel,
          waterIntake: parseInt(formData.waterIntake)
        },
        allergies: formData.allergies
      };

      const nutritionGoal = {
        goal: formData.nutritionGoal,
        targetWeight: formData.targetWeight ? parseFloat(formData.targetWeight) : null,
        weeklyGoal: parseFloat(formData.weeklyGoal)
      };

      await register(formData.name, formData.email, formData.password, profileData, nutritionGoal);
      toast.success('Account created successfully! Your personalized nutrition plan is ready.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    // Validation for each step
    if (step === 2) {
      if (!formData.name || !formData.email || !formData.password || !formData.age || !formData.gender) {
        toast.error('Please fill in all required fields');
        return;
      }
    }
    if (step === 3) {
      if (!formData.height || !formData.weight) {
        toast.error('Please provide your height and weight for accurate calculations');
        return;
      }
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  const toggleArrayItem = (array, item) => {
    if (array.includes(item)) {
      return array.filter(i => i !== item);
    }
    return [...array, item];
  };
