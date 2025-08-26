import crypto from 'crypto';

export const calculateProfileCompleteness = (profile: any): number => {
  const requiredFields = ['firstName', 'lastName', 'email'];
  const optionalFields = ['avatar', 'businessDetails'];
  
  let completenessScore = 0;
  
  requiredFields.forEach(field => {
    if (profile[field]) completenessScore += 20;
  });
  
  optionalFields.forEach(field => {
    if (profile[field]) completenessScore += 20;
  });
  
  return Math.min(completenessScore, 100);
};

export const validateAvatarUpload = (avatar: {
  file: Buffer,
  type: string,
  size: number
}): boolean => {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
  
  return (
    ALLOWED_TYPES.includes(avatar.type) &&
    avatar.size <= MAX_FILE_SIZE
  );
};

export const generatePrivacyToken = (email: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  return crypto
    .createHash('sha256')
    .update(email + salt + Date.now())
    .digest('hex');
};
