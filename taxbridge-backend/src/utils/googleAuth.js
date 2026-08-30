const { AppError } = require('./AppError');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

/**
 * Verifies a Google OAuth access token server-side and returns the
 * associated profile. Two calls, not one:
 *  1. tokeninfo — confirms the token was actually issued for *our* app
 *     (checks `aud` against GOOGLE_CLIENT_ID). Skipping this would let a
 *     token minted for a different app be replayed against our backend.
 *  2. userinfo — the canonical profile fields (email, name, sub, etc.)
 *     for a token that's passed the audience check.
 */
async function verifyGoogleAccessToken(accessToken) {
  if (!accessToken) throw new AppError(400, 'accessToken is required.');
  if (!GOOGLE_CLIENT_ID) throw new AppError(500, 'Google sign-in is not configured on the server.');

  let tokenInfo;
  try {
    const tokenInfoResp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!tokenInfoResp.ok) throw new Error('tokeninfo request failed');
    tokenInfo = await tokenInfoResp.json();
  } catch (err) {
    throw new AppError(401, 'Invalid or expired Google credential.');
  }
  if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
    throw new AppError(401, 'This Google credential was not issued for this app.');
  }

  let profile;
  try {
    const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userInfoResp.ok) throw new Error('userinfo request failed');
    profile = await userInfoResp.json();
  } catch (err) {
    throw new AppError(401, 'Could not verify Google account.');
  }
  if (!profile.email) throw new AppError(401, 'Your Google account has no email address.');

  return {
    email: String(profile.email).trim().toLowerCase(),
    name: profile.name || profile.email.split('@')[0],
    googleId: profile.sub,
    emailVerified: profile.email_verified === true || profile.email_verified === 'true',
  };
}

module.exports = { verifyGoogleAccessToken };