import { v2 as cloudinary } from 'cloudinary';
import env from './env';

cloudinary.config({
  cloud_name: env.CLOUD_NAME,
  api_key: env.CLOUD_KEY,
  api_secret: env.CLOUD_SECRET,
});

export default cloudinary;
