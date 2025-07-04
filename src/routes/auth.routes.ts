import { Router } from 'express';
import passport from 'passport';

import {
  signup,
  login,
  forgotPassword,
  resetPassword,
  verifyEmail,
  refreshToken,
  callbackHandler,
  updatePassword,
} from '../controllers/auth.controller';
import validate from '../middlewares/validate';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
  loginSchema,
  refreshAccessTokenSchema,
  updatePasswordSchema,
} from '../validation/auth.validation';
import isAuthenticated from '../middlewares/isAuthenticated';
import { uploadUserPhoto } from '../middlewares/upload';

const router = Router();

router.post('/signup', uploadUserPhoto, validate(signupSchema), signup);
router.post('/login', validate(loginSchema), login);

router.post('/refresh-token', validate(refreshAccessTokenSchema), refreshToken);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.patch(
  '/reset-password/:token',
  validate(resetPasswordSchema),
  resetPassword
);
router.get('/verify-email/:token', validate(verifyEmailSchema), verifyEmail);
router.patch(
  '/update-password',
  isAuthenticated,
  validate(updatePasswordSchema),
  updatePassword
);

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    session: false,
  }),
  callbackHandler
);

export const authRouter = router;
