/**
 * DPDPA 2023, Section 6(4): withdrawal of consent must be as easy as giving it,
 * and must actually stop the processing the consent covered. This gates every
 * endpoint that sends the user's health data to a third-party AI processor
 * (Anthropic, Gemini) once that user has withdrawn health_processing consent.
 */
exports.requireHealthConsent = (req, res, next) => {
  if (req.user?.consent?.withdrawn) {
    return res.status(403).json({
      success: false,
      code: 'CONSENT_WITHDRAWN',
      message: 'You have withdrawn consent for health data processing. Re-enable it from Privacy Settings to use AI features.',
    });
  }
  next();
};
