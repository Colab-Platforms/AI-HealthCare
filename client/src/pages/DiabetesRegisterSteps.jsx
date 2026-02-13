// This file contains the remaining steps for DiabetesRegister
// Copy these into DiabetesRegister.jsx replacing "return <div>Other steps coming...</div>;"

// STEP 2: DIABETES PROFILE
export const Step2DiabetesProfile = ({ formData, setFormData, nextStep, prevStep, toggleArrayItem }) => (
  <div className="min-h-screen flex bg-gradient-to-br from-cyan-50 to-blue-50">
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-cyan-500 via-blue-500 to-cyan-600">
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white">
        <div className="relative w-32 h-32 mb-8">
          <div className="absolute inset-0 bg-white/20 backdrop-blur-xl rounded-full animate-pulse"></div>
          <div className="absolute inset-4 bg-white/30 backdrop-blur-xl rounded-full flex items-center justify-center">
            <Activity className="w-12 h-12" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4 text-center">Diabetes Profile</h1>
        <p className="text-xl text-white/80 text-center max-w-md mb-6">
          Help us understand your diabetes management needs
        </p>
        <div className="flex items-center gap-3 mt-4">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="w-12 h-0.5 bg-white"></div>
          <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center">
            <span className="text-sm font-bold">2</span>
          </div>
          <div className="w-12 h-0.5 bg-white/20"></div>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-sm">3</span>
          </div>
          <div className="w-12 h-0.5 bg-white/20"></div>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-sm">4</span>
          </div>
        </div>
        <p className="text-sm text-white/70 mt-6">Step 2 of 4</p>
      </div>
    </div>
    
    <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
      <div className="w-full max-w-md py-8">
        <button onClick={prevStep} className="flex items-center gap-2 mb-6 text-cyan-600 hover:text-cyan-700">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2 text-gray-900">Diabetes Profile</h2>
          <p className="text-gray-600">Step 2 of 4 - Core diabetes information</p>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
          {/* Diabetes Type */}
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-700">Diabetes Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {['Type 1', 'Type 2', 'Prediabetes', 'Gestational'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, diabetesType: type })}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    formData.diabetesType === type
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{type}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Year of Diagnosis & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Year of Diagnosis *</label>
              <input
                type="number"
                value={formData.diagnosisYear}
                onChange={(e) => setFormData({ ...formData, diagnosisYear: e.target.value })}
                className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                placeholder="2020"
                min="1900"
                max={new Date().getFullYear()}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Current Status *</label>
              <select
                value={formData.diabetesStatus}
                onChange={(e) => setFormData({ ...formData, diabetesStatus: e.target.value })}
                className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                required
              >
                <option value="">Select</option>
                <option value="Controlled">Controlled</option>
                <option value="Uncontrolled">Uncontrolled</option>
                <option value="Newly diagnosed">Newly diagnosed</option>
              </select>
            </div>
          </div>

          {/* HbA1c */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Latest HbA1c (%) - Optional</label>
            <input
              type="number"
              value={formData.hba1c}
              onChange={(e) => setFormData({ ...formData, hba1c: e.target.value })}
              className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
              placeholder="6.5"
              step="0.1"
              min="4"
              max="15"
            />
            <p className="text-xs mt-1 text-gray-500">Used for risk scoring and personalized recommendations</p>
          </div>

          {/* Glucose Monitoring */}
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-700">How do you measure glucose?</label>
            <div className="grid grid-cols-3 gap-3">
              {['Glucometer', 'CGM', 'Both'].map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setFormData({ ...formData, glucoseMonitoring: method })}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    formData.glucoseMonitoring === method
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{method}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Glucose Ranges */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Fasting Glucose (mg/dL)</label>
              <input
                type="text"
                value={formData.fastingGlucose}
                onChange={(e) => setFormData({ ...formData, fastingGlucose: e.target.value })}
                className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                placeholder="80-120"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Post-Meal Glucose</label>
              <input
                type="text"
                value={formData.postMealGlucose}
                onChange={(e) => setFormData({ ...formData, postMealGlucose: e.target.value })}
                className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                placeholder="120-180"
              />
            </div>
          </div>

          {/* Testing Frequency */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Testing Frequency</label>
            <select
              value={formData.testingFrequency}
              onChange={(e) => setFormData({ ...formData, testingFrequency: e.target.value })}
              className="w-full bg-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
            >
              <option value="">Select</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="rarely">Rarely</option>
            </select>
          </div>

          {/* Medication */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-700">
              <Pill className="w-4 h-4" />
              Are you on diabetes medication?
            </label>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!formData.onMedication}
                  onChange={() => setFormData({ ...formData, onMedication: false, medicationType: [] })}
                  className="text-cyan-500"
                />
                <span className="text-sm text-gray-900">No</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.onMedication}
                  onChange={() => setFormData({ ...formData, onMedication: true })}
                  className="text-cyan-500"
                />
                <span className="text-sm text-gray-900">Yes</span>
              </label>
            </div>

            {formData.onMedication && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Medication Type (select all that apply)</label>
                <div className="space-y-2">
                  {['Insulin', 'Oral medicines (Metformin, etc.)', 'Lifestyle only'].map(med => (
                    <label key={med} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.medicationType.includes(med)}
                        onChange={() => toggleArrayItem('medicationType', med)}
                        className="rounded text-cyan-500"
                      />
                      <span className="text-sm text-gray-900">{med}</span>
                    </label>
                  ))}
                </div>

                {formData.medicationType.includes('Insulin') && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Insulin Timing</label>
                    <input
                      type="text"
                      value={formData.insulinTiming}
                      onChange={(e) => setFormData({ ...formData, insulinTiming: e.target.value })}
                      className="w-full bg-white rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-200 text-gray-900"
                      placeholder="e.g., Before meals, Bedtime"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.recentDosageChange}
                    onChange={(e) => setFormData({ ...formData, recentDosageChange: e.target.checked })}
                    className="rounded text-cyan-500"
                  />
                  <span className="text-sm text-gray-900">Recent dosage change</span>
                </label>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              We do not provide dosage advice. Our recommendations are pattern-based insights only.
            </p>
          </div>
        
          <button 
            type="submit"
            className="w-full py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
          >
            Continue <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  </div>
);
