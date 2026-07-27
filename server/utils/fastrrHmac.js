const crypto = require("crypto");

// Signs the exact raw bytes of a request body — never re-serialize a JS object
// here, since JSON.stringify(obj) can differ byte-for-byte from what was
// originally sent/received, which silently breaks HMAC verification.
function signBody(rawBodyString, secret) {
  return crypto.createHmac("sha256", secret).update(rawBodyString, "utf8").digest("base64");
}

function verifyBody(rawBodyString, secret, providedSignature) {
  const expected = signBody(rawBodyString, secret);
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(providedSignature || "", "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

module.exports = { signBody, verifyBody };
