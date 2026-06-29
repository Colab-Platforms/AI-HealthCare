/**
 * Maps reportType (user-selected) + flags to a medical document category.
 * Categories match MedicalDocument enum + HealthReport enum.
 */
const REPORT_TYPE_CATEGORY_MAP = {
  // Scans & Imaging
  'x-ray':           'scan',
  'xray':            'scan',
  'x ray':           'scan',
  'mri':             'scan',
  'ct scan':         'scan',
  'ct':              'scan',
  'ultrasound':      'scan',
  'usg':             'scan',
  'sonography':      'scan',
  'mammogram':       'scan',
  'echocardiogram':  'scan',
  'pet scan':        'scan',
  'dexa':            'scan',

  // Lab Reports
  'blood test':       'lab_report',
  'blood':            'lab_report',
  'cbc':              'lab_report',
  'complete blood count': 'lab_report',
  'lipid profile':    'lab_report',
  'liver function':   'lab_report',
  'lft':              'lab_report',
  'kidney function':  'lab_report',
  'kft':              'lab_report',
  'thyroid':          'lab_report',
  'tft':              'lab_report',
  'urine':            'lab_report',
  'urinalysis':       'lab_report',
  'stool':            'lab_report',
  'culture':          'lab_report',
  'biopsy':           'lab_report',
  'pathology':        'lab_report',
  'ecg':              'lab_report',
  'eeg':              'lab_report',
  'general checkup':  'lab_report',
  'health checkup':   'lab_report',
  'annual checkup':   'lab_report',

  // Doctor Notes / Discharge
  'discharge summary':  'doctor_notes',
  'discharge':          'doctor_notes',
  'doctor notes':       'doctor_notes',
  'clinical notes':     'doctor_notes',
  'consultation':       'doctor_notes',
  'opd':                'doctor_notes',
  'referral':           'doctor_notes',

  // Vaccination
  'vaccination':        'vaccination',
  'vaccine':            'vaccination',
  'immunization':       'vaccination',

  // Insurance
  'insurance':          'insurance',
  'health card':        'insurance',
  'id card':            'insurance',
};

/**
 * Returns the appropriate category string for a HealthReport.
 * @param {string} reportType - User-selected report type (e.g. "Blood Test")
 * @param {boolean} isPrescription - Whether the report is flagged as prescription
 * @param {object} aiAnalysis - AI analysis result (optional, used to detect prescription post-analysis)
 */
function inferCategory(reportType = '', isPrescription = false, aiAnalysis = null) {
  // Prescription takes highest priority
  if (isPrescription) return 'prescription';

  // Check if AI analysis detected it's a prescription (has medications array)
  if (aiAnalysis?.prescriptionDetails?.medications?.length > 0) return 'prescription';

  // Normalize and lookup
  const normalized = reportType.toLowerCase().trim();
  if (REPORT_TYPE_CATEGORY_MAP[normalized]) {
    return REPORT_TYPE_CATEGORY_MAP[normalized];
  }

  // Partial match fallback
  for (const [key, cat] of Object.entries(REPORT_TYPE_CATEGORY_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return cat;
    }
  }

  // Default: if it went through AI analyze flow, mark as ai_report
  return 'lab_report';
}

module.exports = { inferCategory };
