import { NextFunction, Request, Response } from 'express';

import APIError from '../utils/APIError';
import { verifyAccessToken } from '../utils/token';
import { User } from '../models/user.model';

export default async (req: Request, res: Response, next: NextFunction) => {
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith('Bearer')
  )
    throw new APIError(
      'You are not logged in! please login to get access.',
      401
    );

  const accessToken = req.headers.authorization.split(' ')[1];
  if (!accessToken) {
    throw new APIError('Your access token is invalid or has expired.', 401);
  }

  const payload = verifyAccessToken(accessToken);
  if (!payload) {
    throw new APIError('Your access token is invalid or has expired.', 401);
  }

  const user = await User.findOne({ _id: payload._id, active: true });
  if (!user)
    throw new APIError(
      'The user belonging to this token does no longer exist.',
      401
    );

  if (user.changedPasswordAfterJWT(payload.iat as number))
    throw new APIError(
      'User recently changed password! Please log in again.',
      401
    );

  req.user = user;
  next();
};
